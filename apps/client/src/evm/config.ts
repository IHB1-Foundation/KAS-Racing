/**
 * Wagmi Configuration for KASPLEX zkEVM
 *
 * Supports MetaMask (primary) + injected wallets.
 * Enforces Chain ID 167012.
 */

import { http, createConfig } from 'wagmi';
import { injected, metaMask } from 'wagmi/connectors';
import { kasplexTestnet } from './chains.js';

export const wagmiConfig = createConfig({
  chains: [kasplexTestnet],
  connectors: [
    metaMask(),
    injected(),
  ],
  transports: {
    [kasplexTestnet.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
