/**
 * EVM Wallet Module — KASPLEX zkEVM integration
 *
 * Provides wagmi-based wallet connectivity for Chain ID 167012.
 */

export { kasplexTestnet } from './chains.js';
export { wagmiConfig } from './config.js';
export { EvmWalletProvider } from './EvmWalletProvider.js';
export { useEvmWallet, type EvmWalletState } from './useEvmWallet.js';
export { EvmWalletButton } from './EvmWalletButton.js';
export { EvmNetworkGuard } from './EvmNetworkGuard.js';
export { useMatchEscrow, useIsDeposited, type DepositState } from './useMatchEscrow.js';
export { useFuelToken, type ApproveState } from './useFuelToken.js';
export { formatEvmAddress } from './formatAddress.js';
