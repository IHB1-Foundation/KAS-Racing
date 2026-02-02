/**
 * Escrow Service
 *
 * Handles escrow address generation for duel matches.
 *
 * MVP (Fallback Mode):
 * - Uses treasury address as escrow (server-custodial)
 * - Both players deposit to the same treasury address
 * - Settlement pays winner from treasury
 *
 * Future (Covenant Mode - T-070+):
 * - Generate unique escrow addresses per match
 * - Use covenant/KIP-10 for theft-resistant escrow
 */

import { getConfig, type Network } from '../config/index.js';

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
 * Generate escrow address for a match
 *
 * MVP: Returns treasury address (server-custodial fallback)
 * Future: Will return unique covenant-based escrow address
 *
 * @param matchId - Match ID (unused in MVP, will be used for covenant escrow)
 * @param playerSide - Player side A or B (unused in MVP)
 */
export async function generateEscrowAddress(
  matchId: string,
  playerSide: 'A' | 'B'
): Promise<string> {
  // Future: Use matchId and playerSide to generate unique covenant-based escrow
  void matchId;
  void playerSide;

  // MVP: Use treasury address for all escrows (server-custodial)
  // This is the "fallback" mode mentioned in PROJECT.md
  return getTreasuryAddress();
}

/**
 * Generate both escrow addresses for a match
 */
export async function generateMatchEscrowAddresses(
  matchId: string
): Promise<{ escrowAddressA: string; escrowAddressB: string }> {
  const escrowAddressA = await generateEscrowAddress(matchId, 'A');
  const escrowAddressB = await generateEscrowAddress(matchId, 'B');

  return { escrowAddressA, escrowAddressB };
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
 * Escrow mode info (for transparency in UI/docs)
 */
export function getEscrowMode(): 'fallback' | 'covenant' {
  // Currently only fallback is implemented
  return 'fallback';
}
