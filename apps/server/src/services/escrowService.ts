/**
 * Escrow Service (T-072)
 *
 * Handles escrow address generation for duel matches.
 *
 * Modes:
 * 1. Covenant Mode (Testnet only):
 *    - Generate unique P2SH escrow addresses per match
 *    - Uses KIP-10 covenant opcodes for theft-resistant escrow
 *    - Oracle can only settle to player addresses
 *
 * 2. Fallback Mode (Mainnet):
 *    - Uses treasury address as escrow (server-custodial)
 *    - Both players deposit to the same treasury address
 *    - Settlement pays winner from treasury
 */

import { getConfig, type Network } from '../config/index.js';
import { supportsCovenants } from '../escrow/opcodes.js';
import { generateMatchEscrows } from '../escrow/scriptBuilder.js';
import type { MatchEscrow } from '../escrow/types.js';
import { ESCROW_DEFAULTS } from '../escrow/types.js';

// Module-level kaspa-wasm (loaded dynamically)
let kaspaWasm: typeof import('kaspa-wasm') | null = null;

/**
 * Load kaspa-wasm module
 */
async function loadKaspaWasm(): Promise<typeof import('kaspa-wasm')> {
  if (!kaspaWasm) {
    kaspaWasm = await import('kaspa-wasm');
  }
  return kaspaWasm;
}

/**
 * Get treasury address from private key
 */
export async function getTreasuryAddress(): Promise<string> {
  const config = getConfig();
  const kaspa = await loadKaspaWasm();

  const privateKey = new kaspa.PrivateKey(config.treasuryPrivateKey);
  const keypair = privateKey.toKeypair();

  const networkType = config.network === 'mainnet'
    ? kaspa.NetworkType.Mainnet
    : kaspa.NetworkType.Testnet;

  const addrObj = kaspa.createAddress(keypair.publicKey as string, networkType) as { toString(): string };
  return addrObj.toString();
}

/**
 * Get oracle public key from private key
 */
export async function getOraclePublicKey(): Promise<string> {
  const config = getConfig();
  const kaspa = await loadKaspaWasm();

  const privateKey = new kaspa.PrivateKey(config.oraclePrivateKey);
  const keypair = privateKey.toKeypair();

  return keypair.publicKey as string;
}

/**
 * Determine escrow mode based on network
 */
export function getEscrowMode(network?: Network): 'covenant' | 'fallback' {
  // If network is provided, use it directly without loading config
  const targetNetwork = network || getConfig().network;

  // Covenant mode only available on testnet
  if (supportsCovenants(targetNetwork)) {
    return 'covenant';
  }
  return 'fallback';
}

/**
 * Generate escrow address for a match (fallback mode)
 *
 * MVP: Returns treasury address (server-custodial fallback)
 *
 * @param matchId - Match ID (unused in fallback mode)
 * @param playerSide - Player side A or B (unused in fallback mode)
 */
export async function generateEscrowAddressFallback(
  matchId: string,
  playerSide: 'A' | 'B'
): Promise<string> {
  // Fallback: Use treasury address for all escrows
  void matchId;
  void playerSide;
  return getTreasuryAddress();
}

/**
 * Generate escrow addresses for a match (covenant mode)
 *
 * Creates unique P2SH escrow addresses using KIP-10 covenant opcodes.
 *
 * @param matchId - Match ID
 * @param playerAPubkey - Player A's x-only public key (32 bytes hex)
 * @param playerAAddress - Player A's Kaspa address
 * @param playerBPubkey - Player B's x-only public key (32 bytes hex)
 * @param playerBAddress - Player B's Kaspa address
 */
export async function generateEscrowAddressCovenant(
  matchId: string,
  playerAPubkey: string,
  playerAAddress: string,
  playerBPubkey: string,
  playerBAddress: string
): Promise<MatchEscrow> {
  const config = getConfig();

  if (!supportsCovenants(config.network)) {
    throw new Error(`Covenant escrow not supported on ${config.network}`);
  }

  const oraclePubkey = await getOraclePublicKey();
  const refundLocktimeBlocks = ESCROW_DEFAULTS.REFUND_LOCKTIME_BLOCKS;

  const { escrowA, escrowB, params } = await generateMatchEscrows(
    matchId,
    playerAPubkey,
    playerAAddress,
    playerBPubkey,
    playerBAddress,
    oraclePubkey,
    config.network,
    refundLocktimeBlocks
  );

  return {
    matchId,
    escrowAddressA: escrowA.address,
    escrowAddressB: escrowB.address,
    params,
    mode: 'covenant',
    network: config.network,
    createdAt: Date.now(),
  };
}

/**
 * Generate escrow addresses for a match
 *
 * Automatically selects covenant or fallback mode based on network.
 * Returns undefined addresses if config is not available (test environment).
 */
export async function generateMatchEscrowAddresses(
  matchId: string,
  playerAAddress: string,
  playerBAddress: string,
  playerAPubkey?: string,
  playerBPubkey?: string
): Promise<{
  escrowAddressA: string | undefined;
  escrowAddressB: string | undefined;
  mode: 'covenant' | 'fallback';
  escrowScriptA?: string;
  escrowScriptB?: string;
  refundLocktimeBlocks?: number;
  oraclePublicKey?: string;
}> {
  // Check if config is available
  let config;
  try {
    config = getConfig();
  } catch {
    // Config not available (e.g., test environment without env vars)
    // Return fallback mode with no addresses
    return {
      escrowAddressA: undefined,
      escrowAddressB: undefined,
      mode: 'fallback',
    };
  }

  const mode = getEscrowMode(config.network);

  if (mode === 'covenant' && playerAPubkey && playerBPubkey) {
    // Covenant mode: Generate unique escrow addresses
    const oraclePubkey = await getOraclePublicKey();
    const refundLocktimeBlocks = ESCROW_DEFAULTS.REFUND_LOCKTIME_BLOCKS;

    const { escrowA, escrowB } = await generateMatchEscrows(
      matchId,
      playerAPubkey,
      playerAAddress,
      playerBPubkey,
      playerBAddress,
      oraclePubkey,
      config.network,
      refundLocktimeBlocks
    );

    return {
      escrowAddressA: escrowA.address,
      escrowAddressB: escrowB.address,
      mode: 'covenant',
      escrowScriptA: escrowA.scriptHex,
      escrowScriptB: escrowB.scriptHex,
      refundLocktimeBlocks,
      oraclePublicKey: oraclePubkey,
    };
  }

  // Fallback mode: Use treasury address
  const treasuryAddress = await getTreasuryAddress();

  return {
    escrowAddressA: treasuryAddress,
    escrowAddressB: treasuryAddress,
    mode: 'fallback',
  };
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(txid: string, network: Network): string {
  const baseUrl = network === 'mainnet'
    ? 'https://explorer.kaspa.org'
    : 'https://explorer-tn11.kaspa.org';

  return `${baseUrl}/txs/${txid}`;
}

/**
 * Get escrow mode info for transparency
 */
export function getEscrowModeInfo(): {
  mode: 'covenant' | 'fallback';
  network: Network;
  description: string;
} {
  const config = getConfig();
  const mode = getEscrowMode();

  const descriptions = {
    covenant: 'Theft-resistant escrow using KIP-10 covenants. Oracle can only settle to player addresses.',
    fallback: 'Server-custodial escrow. Treasury holds deposits and pays winner.',
  };

  return {
    mode,
    network: config.network,
    description: descriptions[mode],
  };
}
