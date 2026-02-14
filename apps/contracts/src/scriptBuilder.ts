/**
 * Covenant Escrow Script Builder
 *
 * Generates P2SH escrow scripts for theft-resistant duel matches.
 *
 * Script has two branches:
 * 1. Oracle Settlement: Oracle can settle to playerA or playerB only
 * 2. Timelock Refund: After locktime, depositor can reclaim funds
 *
 * Note: Covenant opcodes only work on Testnet 12+
 */

import * as kaspa from 'kaspa-wasm';
import {
  OP_IF,
  OP_ELSE,
  OP_ENDIF,
  OP_DROP,
  OP_DUP,
  OP_SWAP,
  OP_EQUAL,
  OP_VERIFY,
  OP_BOOLOR,
  OP_CHECKSIG,
  OP_CHECKSIGVERIFY,
  OP_CHECKLOCKTIMEVERIFY,
  OP_TXOUTPUTCOUNT,
  OP_OUTPUTSPKHASH,
  OP_1,
  OP_0,
  supportsCovenants,
} from './opcodes.js';
import type { EscrowScriptParams, EscrowScriptTemplate, Network } from './types.js';
import { ESCROW_DEFAULTS } from './types.js';

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash data with BLAKE2b-256.
 * Uses SHA-256 as placeholder — production should use kaspa-wasm's native blake2b.
 */
async function blake2b256(data: Uint8Array): Promise<Uint8Array> {
  const { createHash } = await import('crypto');
  const hash = createHash('sha256').update(data).digest();
  return new Uint8Array(hash);
}

/**
 * Build escrow script for a player's deposit.
 *
 * Script structure:
 * ```
 * OP_IF
 *   <oracle_pubkey> OP_CHECKSIGVERIFY
 *   OP_TXOUTPUTCOUNT OP_1 OP_EQUAL OP_VERIFY
 *   OP_0 OP_OUTPUTSPKHASH
 *   OP_DUP <playerA_spk_hash> OP_EQUAL
 *   OP_SWAP <playerB_spk_hash> OP_EQUAL
 *   OP_BOOLOR OP_VERIFY
 *   OP_1
 * OP_ELSE
 *   <refund_locktime> OP_CHECKLOCKTIMEVERIFY OP_DROP
 *   <depositor_pubkey> OP_CHECKSIG
 * OP_ENDIF
 * ```
 */
export function buildEscrowScript(
  params: EscrowScriptParams,
  forPlayer: 'A' | 'B'
): Uint8Array {
  const builder = new kaspa.ScriptBuilder();

  const oraclePubkey = hexToBytes(params.oracle.pubkey);
  const playerAPubkey = hexToBytes(params.playerA.pubkey);
  const playerBPubkey = hexToBytes(params.playerB.pubkey);

  // Use pubkey as simplified SPK hash identifier
  const playerASpkHash = hexToBytes(params.playerA.pubkey);
  const playerBSpkHash = hexToBytes(params.playerB.pubkey);

  const depositorPubkey = forPlayer === 'A' ? playerAPubkey : playerBPubkey;

  builder.addOp(OP_IF);

  // Branch A: Oracle Settlement
  builder.addData(oraclePubkey);
  builder.addOp(OP_CHECKSIGVERIFY);

  builder.addOp(OP_TXOUTPUTCOUNT);
  builder.addOp(OP_1);
  builder.addOp(OP_EQUAL);
  builder.addOp(OP_VERIFY);

  builder.addOp(OP_0);
  builder.addOp(OP_OUTPUTSPKHASH);

  builder.addOp(OP_DUP);
  builder.addData(playerASpkHash);
  builder.addOp(OP_EQUAL);
  builder.addOp(OP_SWAP);
  builder.addData(playerBSpkHash);
  builder.addOp(OP_EQUAL);
  builder.addOp(OP_BOOLOR);
  builder.addOp(OP_VERIFY);

  builder.addOp(OP_1);

  builder.addOp(OP_ELSE);

  // Branch B: Timelock Refund
  builder.addLockTime(BigInt(params.refundLocktimeBlocks));
  builder.addOp(OP_CHECKLOCKTIMEVERIFY);
  builder.addOp(OP_DROP);
  builder.addData(depositorPubkey);
  builder.addOp(OP_CHECKSIG);

  builder.addOp(OP_ENDIF);

  const scriptHex = builder.script();
  return hexToBytes(scriptHex);
}

/**
 * Generate P2SH address from script.
 */
export async function scriptToP2SHAddress(
  scriptBytes: Uint8Array,
  network: Network
): Promise<string> {
  const scriptHash = await blake2b256(scriptBytes);
  const prefix = network === 'mainnet' ? 'kaspa' : 'kaspatest';
  const hashHex = bytesToHex(scriptHash);

  // P2SH addresses start with 'p' prefix in Kaspa
  return `${prefix}:p${hashHex.substring(0, 56)}`;
}

/**
 * Generate escrow script template for a player.
 */
export async function generateEscrowScriptTemplate(
  params: EscrowScriptParams,
  forPlayer: 'A' | 'B',
  network: Network
): Promise<EscrowScriptTemplate> {
  if (!supportsCovenants(network)) {
    throw new Error(`Covenant opcodes not supported on ${network}`);
  }

  const scriptBytes = buildEscrowScript(params, forPlayer);
  const scriptHex = bytesToHex(scriptBytes);
  const scriptHash = bytesToHex(await blake2b256(scriptBytes));
  const address = await scriptToP2SHAddress(scriptBytes, network);

  return {
    branch: 'oracle_settle',
    forPlayer,
    scriptHex,
    scriptHash,
    address,
  };
}

/**
 * Generate both escrow addresses for a match.
 */
export async function generateMatchEscrows(
  matchId: string,
  playerAPubkey: string,
  playerAAddress: string,
  playerBPubkey: string,
  playerBAddress: string,
  oraclePubkey: string,
  network: Network,
  refundLocktimeBlocks: number = ESCROW_DEFAULTS.REFUND_LOCKTIME_BLOCKS
): Promise<{
  escrowA: EscrowScriptTemplate;
  escrowB: EscrowScriptTemplate;
  params: EscrowScriptParams;
}> {
  const params: EscrowScriptParams = {
    playerA: { pubkey: playerAPubkey, address: playerAAddress },
    playerB: { pubkey: playerBPubkey, address: playerBAddress },
    oracle: { pubkey: oraclePubkey },
    refundLocktimeBlocks,
  };

  const escrowA = await generateEscrowScriptTemplate(params, 'A', network);
  const escrowB = await generateEscrowScriptTemplate(params, 'B', network);

  return { escrowA, escrowB, params };
}

/**
 * Extract public key from Kaspa address.
 * Returns null — clients must provide pubkey directly for covenant mode.
 */
export function extractPubkeyFromAddress(address: string): string | null {
  if (!address.startsWith('kaspa:q') && !address.startsWith('kaspatest:q')) {
    return null;
  }
  return null;
}
