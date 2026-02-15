const DEFAULT_EVM_EXPLORER = 'https://explorer.testnet.kasplextest.xyz';

export const EVM_EXPLORER_BASE =
  (import.meta.env.VITE_EXPLORER_URL as string | undefined) ?? DEFAULT_EVM_EXPLORER;

export function getEvmExplorerTxUrl(txHash: string): string {
  const base = EVM_EXPLORER_BASE.replace(/\/+$/, '');
  return `${base}/tx/${txHash}`;
}
