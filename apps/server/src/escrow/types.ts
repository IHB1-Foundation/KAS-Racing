/**
 * Escrow Script Types (T-071)
 *
 * Type definitions for covenant-based escrow scripts.
 * These types define the structure for generating escrow addresses
 * and building settlement transactions.
 *
 * Note: Actual implementation requires KIP-10 covenant support,
 * currently only available on Testnet 12 (as of Feb 2026).
 */

/**
 * Player information for escrow script
 */
export interface EscrowPlayer {
  /** Player's x-only public key (32 bytes, hex encoded) */
  pubkey: string;
  /** Player's Kaspa address */
  address: string;
}

/**
 * Oracle (server) information
 */
export interface EscrowOracle {
  /** Oracle's x-only public key (32 bytes, hex encoded) */
  pubkey: string;
}

/**
 * Parameters for generating an escrow script
 */
export interface EscrowScriptParams {
  /** Player A information */
  playerA: EscrowPlayer;
  /** Player B information */
  playerB: EscrowPlayer;
  /** Oracle information */
  oracle: EscrowOracle;
  /** Refund locktime in DAA blocks (default: 1000 ≈ 16 hours) */
  refundLocktimeBlocks: number;
}

/**
 * Generated escrow information for a match
 */
export interface MatchEscrow {
  /** Match ID */
  matchId: string;
  /** Escrow address for Player A's deposit */
  escrowAddressA: string;
  /** Escrow address for Player B's deposit */
  escrowAddressB: string;
  /** Script parameters used */
  params: EscrowScriptParams;
  /** Escrow mode (covenant or fallback) */
  mode: 'covenant' | 'fallback';
  /** Network (mainnet or testnet) */
  network: 'mainnet' | 'testnet';
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Settlement type
 */
export type SettlementType = 'winner_A' | 'winner_B' | 'draw' | 'refund';

/**
 * Settlement transaction request
 */
export interface SettlementRequest {
  /** Match ID */
  matchId: string;
  /** Settlement type */
  type: SettlementType;
  /** Player A's deposit UTXO */
  depositA: {
    txid: string;
    index: number;
    amount: bigint;
  };
  /** Player B's deposit UTXO */
  depositB: {
    txid: string;
    index: number;
    amount: bigint;
  };
}

/**
 * Settlement transaction result
 */
export interface SettlementResult {
  /** Settlement transaction ID */
  txid: string;
  /** Settlement type */
  type: SettlementType;
  /** Output amounts */
  outputs: {
    address: string;
    amount: bigint;
  }[];
  /** Fee paid */
  feeSompi: bigint;
}

/**
 * Script branch types
 */
export type ScriptBranch = 'oracle_settle' | 'timelock_refund';

/**
 * Escrow script template
 */
export interface EscrowScriptTemplate {
  /** Script branch */
  branch: ScriptBranch;
  /** For which player (A or B) */
  forPlayer: 'A' | 'B';
  /** Compiled script bytes (hex) */
  scriptHex: string;
  /** Script hash for P2SH address */
  scriptHash: string;
  /** P2SH address */
  address: string;
}

/**
 * Default escrow configuration
 */
export const ESCROW_DEFAULTS = {
  /** Default refund locktime in DAA blocks (~16 hours) */
  REFUND_LOCKTIME_BLOCKS: 1000,
  /** Minimum deposit amount in sompi */
  MIN_DEPOSIT_SOMPI: BigInt(10_000_000), // 0.1 KAS
} as const;
