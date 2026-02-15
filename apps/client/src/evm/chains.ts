/**
 * KASPLEX zkEVM Chain Definition
 *
 * Custom chain for wagmi/viem — Chain ID 167012
 */

import { defineChain } from 'viem';

export const kasplexTestnet = defineChain({
  id: 167012,
  name: 'KASPLEX Testnet',
  nativeCurrency: {
    name: 'KAS',
    symbol: 'KAS',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.kasplextest.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'KASPLEX Explorer',
      url: 'https://explorer.testnet.kasplextest.xyz',
    },
  },
  testnet: true,
});
