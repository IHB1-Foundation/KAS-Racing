/**
 * EVM Network Guard — Shows warning if not on KASPLEX Testnet
 */

import React from 'react';
import { useEvmWallet } from './useEvmWallet.js';
import { kasplexTestnet } from './chains.js';

export function EvmNetworkGuard() {
  const { isConnected, isCorrectChain, chainId, switchToKasplex } = useEvmWallet();

  if (!isConnected || isCorrectChain) return null;

  return (
    <div
      style={{
        background: '#451a03',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        padding: '12px 16px',
        margin: '8px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#fbbf24', fontSize: 13 }}>
        Wrong network (Chain ID: {chainId}). Please switch to {kasplexTestnet.name} ({kasplexTestnet.id}).
      </span>
      <button
        onClick={switchToKasplex}
        style={{
          background: '#f59e0b',
          color: 'black',
          border: 'none',
          borderRadius: 6,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Switch Network
      </button>
    </div>
  );
}
