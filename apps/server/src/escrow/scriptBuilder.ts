/**
 * Covenant Escrow Script Builder (T-072)
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
import type { EscrowScriptParams, EscrowScriptTemplate } from './types.js';
import { ESCROW_DEFAULTS } from './types.js';

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash data with BLAKE2b-256
 */
async function blake2b256(data: Uint8Array): Promise<Uint8Array> {
  // kaspa-wasm provides blake2b through address generation
  // For now, we'll use a simple implementation
  // In production, use kaspa-wasm's internal blake2b
  const { createHash } = await import('crypto');
  // Note: Kaspa uses BLAKE2b-256, but Node.js crypto doesn't support it directly
  // Using SHA-256 as placeholder - in production, use kaspa-wasm's blake2b
  const hash = createHash('sha256').update(data).digest();
  return new Uint8Array(hash);
}

/**
 * Build escrow script for a player's deposit
 *
 * Script structure:
 * ```
 * OP_IF
 *   # Branch A: Oracle Settlement
 *   <oracle_pubkey> OP_CHECKSIGVERIFY
 *   OP_TXOUTPUTCOUNT OP_1 OP_EQUAL OP_VERIFY    # Must have exactly 1 output
 *   OP_0 OP_OUTPUTSPKHASH                       # Get output 0 script hash
 *   OP_DUP <playerA_spk_hash> OP_EQUAL
 *   OP_SWAP <playerB_spk_hash> OP_EQUAL
 *   OP_BOOLOR OP_VERIFY                         # Output must be to A or B
 *   OP_1
 * OP_ELSE
 *   # Branch B: Timelock Refund
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

  // Script pubkey hashes for output verification
  // P2PK script: <pubkey> OP_CHECKSIG => hash of this
  const playerASpkHash = hexToBytes(params.playerA.pubkey); // Simplified: use pubkey as identifier
  const playerBSpkHash = hexToBytes(params.playerB.pubkey);

  const depositorPubkey = forPlayer === 'A' ? playerAPubkey : playerBPubkey;

  // Build script
  builder.addOp(OP_IF);

  // Branch A: Oracle Settlement
  builder.addData(oraclePubkey);
  builder.addOp(OP_CHECKSIGVERIFY);

  // Verify single output
  builder.addOp(OP_TXOUTPUTCOUNT);
  builder.addOp(OP_1);
  builder.addOp(OP_EQUAL);
  builder.addOp(OP_VERIFY);

  // Get output script hash
  builder.addOp(OP_0); // Output index 0
  builder.addOp(OP_OUTPUTSPKHASH);

  // Check if output is to playerA or playerB
  builder.addOp(OP_DUP);
  builder.addData(playerASpkHash);
  builder.addOp(OP_EQUAL);
  builder.addOp(OP_SWAP);
  builder.addData(playerBSpkHash);
  builder.addOp(OP_EQUAL);
  builder.addOp(OP_BOOLOR);
  builder.addOp(OP_VERIFY);

  builder.addOp(OP_1); // Return true

  builder.addOp(OP_ELSE);

  // Branch B: Timelock Refund
  builder.addLockTime(BigInt(params.refundLocktimeBlocks));
  builder.addOp(OP_CHECKLOCKTIMEVERIFY);
  builder.addOp(OP_DROP);
  builder.addData(depositorPubkey);
  builder.addOp(OP_CHECKSIG);

  builder.addOp(OP_ENDIF);

  // Get script hex and convert to bytes
  const scriptHex = builder.script();
  return hexToBytes(scriptHex);
}

/**
 * Generate P2SH address from script
 */
export async function scriptToP2SHAddress(
  scriptBytes: Uint8Array,
  network: 'mainnet' | 'testnet'
): Promise<string> {
  // Hash the script with BLAKE2b-256
  const scriptHash = await blake2b256(scriptBytes);

  // For P2SH, the address is derived from the script hash
  // Format: kaspa:p<base32(scriptHash)> or kaspatest:p<base32(scriptHash)>
  const prefix = network === 'mainnet' ? 'kaspa' : 'kaspatest';

  // Encode script hash as hex (actual encoding would use bech32)
  const hashHex = bytesToHex(scriptHash);

  // P2SH addresses start with 'p' prefix in Kaspa
  // The actual encoding should use kaspa-wasm's address functions
  // For now, return a placeholder format
  return `${prefix}:p${hashHex.substring(0, 56)}`;
}

/**
 * Generate escrow script template for a player
 */
export async function generateEscrowScriptTemplate(
  params: EscrowScriptParams,
  forPlayer: 'A' | 'B',
  network: 'mainnet' | 'testnet'
): Promise<EscrowScriptTemplate> {
  if (!supportsCovenants(network)) {
    throw new Error(`Covenant opcodes not supported on ${network}`);
  }

  const scriptBytes = buildEscrowScript(params, forPlayer);
  const scriptHex = bytesToHex(scriptBytes);
  const scriptHash = bytesToHex(await blake2b256(scriptBytes));
  const address = await scriptToP2SHAddress(scriptBytes, network);

  return {
    branch: 'oracle_settle', // Primary branch
    forPlayer,
    scriptHex,
    scriptHash,
    address,
  };
}

/**
 * Generate both escrow addresses for a match
 */
export async function generateMatchEscrows(
  matchId: string,
  playerAPubkey: string,
  playerAAddress: string,
  playerBPubkey: string,
  playerBAddress: string,
  oraclePubkey: string,
  network: 'mainnet' | 'testnet',
  refundLocktimeBlocks: number = ESCROW_DEFAULTS.REFUND_LOCKTIME_BLOCKS
): Promise<{
  escrowA: EscrowScriptTemplate;
  escrowB: EscrowScriptTemplate;
  params: EscrowScriptParams;
}> {
  const params: EscrowScriptParams = {
    playerA: {
      pubkey: playerAPubkey,
      address: playerAAddress,
    },
    playerB: {
      pubkey: playerBPubkey,
      address: playerBAddress,
    },
    oracle: {
      pubkey: oraclePubkey,
    },
    refundLocktimeBlocks,
  };

  const escrowA = await generateEscrowScriptTemplate(params, 'A', network);
  const escrowB = await generateEscrowScriptTemplate(params, 'B', network);

  return { escrowA, escrowB, params };
}

/**
 * Extract public key from Kaspa address
 * Returns x-only pubkey (32 bytes) for P2PK addresses
 *
 * Note: Currently returns null - in a full implementation,
 * this would decode the bech32 address to extract the pubkey.
 * For covenant mode, clients should provide their pubkey directly.
 */
export function extractPubkeyFromAddress(address: string): string | null {
  // Parse address to get the payload
  // Kaspa P2PK addresses encode the x-only pubkey directly
  // Format: kaspa:q<base32(pubkey)> or kaspatest:q<base32(pubkey)>

  // Validate address format
  if (!address.startsWith('kaspa:q') && !address.startsWith('kaspatest:q')) {
    return null;
  }

  // For now, return null as we need the actual pubkey from the client
  // In a real implementation, we'd decode the bech32 address
  return null;
}
