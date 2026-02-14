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
  MatchState,
  MatchAction,
  MatchContext,
  TransitionResult,
  ValidationResult,
  RefundRequest,
  RefundResult,
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

// Match State Machine
export {
  transition,
  getValidActions,
  isTerminal,
  createMatchContext,
} from './matchStateMachine.js';

// Validation
export {
  validateSettlementOutputs,
  validateSettlementRequest,
  validateDeposit,
  validateRefundEligibility,
  validateCovenantMode,
} from './validation.js';

// Refund TX Builder
export {
  buildRefundTx,
  isRefundEligible,
} from './refundTxBuilder.js';

// Deployment Loader
export {
  loadDeployment,
  hasDeployment,
  getServerEnvFromDeployment,
  getClientEnvFromDeployment,
} from './deploymentLoader.js';
