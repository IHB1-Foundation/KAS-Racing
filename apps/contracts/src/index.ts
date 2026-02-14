// Types
export type {
  EscrowPlayer,
  EscrowOracle,
  EscrowScriptParams,
  MatchEscrow,
  SettlementType,
  SettlementRequest,
  SettlementResult,
  ScriptBranch,
  EscrowScriptTemplate,
  EscrowMode,
  Network,
  SettlementConfig,
  DeploymentArtifact,
} from './types.js';

export { ESCROW_DEFAULTS } from './types.js';

// Opcodes
export * from './opcodes.js';

// Script Builder
export {
  buildEscrowScript,
  scriptToP2SHAddress,
  generateEscrowScriptTemplate,
  generateMatchEscrows,
  extractPubkeyFromAddress,
  hexToBytes,
  bytesToHex,
} from './scriptBuilder.js';

// Settlement TX Builder
export {
  buildCovenantSettlementTx,
  calculateOutputs,
  canUseCovenantSettlement,
  getEscrowUtxo,
} from './settlementTxBuilder.js';
