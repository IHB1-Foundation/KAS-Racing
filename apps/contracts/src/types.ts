/**
 * Escrow Script Types
 *
 * Type definitions for covenant-based escrow scripts.
 * These types define the structure for generating escrow addresses
 * and building settlement transactions.
 *
 * Note: Actual implementation requires KIP-10 covenant support,
 * currently only available on Testnet 12 (as of Feb 2026).
 */

export interface EscrowPlayer {
  /** Player's x-only public key (32 bytes, hex encoded) */
  pubkey: string;
  /** Player's Kaspa address */
  address: string;
}

export interface EscrowOracle {
  /** Oracle's x-only public key (32 bytes, hex encoded) */
  pubkey: string;
}

export interface EscrowScriptParams {
  playerA: EscrowPlayer;
  playerB: EscrowPlayer;
  oracle: EscrowOracle;
  /** Refund locktime in DAA blocks (default: 1000 ~ 16 hours) */
  refundLocktimeBlocks: number;
}

export interface MatchEscrow {
  matchId: string;
  escrowAddressA: string;
  escrowAddressB: string;
  params: EscrowScriptParams;
  mode: EscrowMode;
  network: Network;
  createdAt: number;
}

export type SettlementType = 'winner_A' | 'winner_B' | 'draw' | 'refund';

export interface SettlementRequest {
  matchId: string;
  type: SettlementType;
  depositA: { txid: string; index: number; amount: bigint };
  depositB: { txid: string; index: number; amount: bigint };
}

export interface SettlementResult {
  txid: string;
  type: SettlementType;
  outputs: { address: string; amount: bigint }[];
  feeSompi: bigint;
}

export type ScriptBranch = 'oracle_settle' | 'timelock_refund';

export interface EscrowScriptTemplate {
  branch: ScriptBranch;
  forPlayer: 'A' | 'B';
  scriptHex: string;
  scriptHash: string;
  address: string;
}

export type EscrowMode = 'covenant' | 'fallback';
export type Network = 'mainnet' | 'testnet';

/** Configuration needed by settlement TX builder (injected, not imported from server) */
export interface SettlementConfig {
  network: Network;
  oraclePrivateKey: string;
}

/** Per-network deployment artifact */
export interface DeploymentArtifact {
  /** Artifact schema version */
  version: 1;
  /** Network this deployment targets */
  network: Network;
  /** Oracle x-only public key used for escrow scripts */
  oraclePubkey: string;
  /** Treasury address for fallback mode */
  treasuryAddress: string;
  /** Default refund locktime in DAA blocks */
  refundLocktimeBlocks: number;
  /** Whether covenant mode is available on this network */
  covenantEnabled: boolean;
  /** REST API base URL for the target network */
  apiBaseUrl: string;
  /** Block explorer base URL */
  explorerBaseUrl: string;
  /** Deployment timestamp (ISO 8601) */
  deployedAt: string;
  /** Git commit hash at deployment time */
  gitCommit: string;
  /** Human-readable notes */
  notes: string;
}

export const ESCROW_DEFAULTS = {
  /** Default refund locktime in DAA blocks (~16 hours) */
  REFUND_LOCKTIME_BLOCKS: 1000,
  /** Minimum deposit amount in sompi */
  MIN_DEPOSIT_SOMPI: BigInt(10_000_000), // 0.1 KAS
  /** Priority fee in sompi */
  PRIORITY_FEE_SOMPI: BigInt(5000),
} as const;
