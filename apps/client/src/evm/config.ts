/**
 * Wagmi Configuration for KASPLEX zkEVM
 *
 * Supports MetaMask (primary) + injected wallets.
 * Enforces Chain ID 167012.
 */

import { http, createConfig } from 'wagmi';
import { metaMask, mock } from 'wagmi/connectors';
import type { Address } from 'viem';
import { kasplexTestnet } from './chains.js';
import { isE2E, e2eAccounts } from '../e2e.js';

const connectors = isE2E
  ? [
      mock({
        accounts: (e2eAccounts.length > 0 ? e2eAccounts : ['0x1111111111111111111111111111111111111111']) as [
          Address,
          ...Address[],
        ],
        features: { defaultConnected: true, reconnect: true },
      }),
    ]
  : [metaMask()];

export const wagmiConfig = createConfig({
  chains: [kasplexTestnet],
  connectors,
  transports: {
    [kasplexTestnet.id]: http(),
  },
  multiInjectedProviderDiscovery: !isE2E,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
