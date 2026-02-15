/**
 * EVM Wallet Button — Connect/Disconnect/Chain-Switch UI
 */

import React, { useState } from 'react';
import { useEvmWallet } from './useEvmWallet.js';
import { formatEvmAddress } from './formatAddress.js';

export function EvmWalletButton() {
  const {
    address,
    isConnected,
    isConnecting,
    isCorrectChain,
    balance,
    error,
    connect,
    disconnect,
    switchToKasplex,
  } = useEvmWallet();

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      void navigator.clipboard.writeText(address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  if (!isConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <button
          onClick={connect}
          disabled={isConnecting}
          style={{
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            cursor: isConnecting ? 'wait' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
        {error && (
          <span style={{ color: '#ef4444', fontSize: 12, maxWidth: 200, textAlign: 'right' }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <button
          onClick={switchToKasplex}
          style={{
            background: '#f59e0b',
            color: 'black',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Switch to KASPLEX
        </button>
        <span style={{ color: '#f59e0b', fontSize: 11 }}>Wrong network</span>
      </div>
    );
  }

  const shortAddr = formatEvmAddress(address);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {balance && (
        <span style={{ color: '#94a3b8', fontSize: 12 }}>
          {parseFloat(balance).toFixed(4)} KAS
        </span>
      )}
      <button
        onClick={handleCopy}
        title={address ?? ''}
        style={{
          background: '#1e293b',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: 'monospace',
        }}
      >
        {copied ? 'Copied!' : shortAddr}
      </button>
      <button
        onClick={disconnect}
        style={{
          background: 'transparent',
          color: '#ef4444',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        Disconnect
      </button>
    </div>
  );
}
