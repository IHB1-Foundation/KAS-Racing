/**
 * WalletButton Component
 *
 * Connect/Disconnect button with address display and copy functionality.
 * Shows appropriate error messages for common wallet issues.
 */

import { useState } from 'react';
import { useWallet, getWalletErrorMessage, WalletErrorCode } from '../wallet';

/**
 * Truncate Kaspa address for display
 * e.g., "kaspa:qz0c8gf8lm54u4m3dw6p0z23vhfmryj8x7qxmq9k5v"
 *    -> "kaspa:qz0c...9k5v"
 */
function truncateAddress(address: string): string {
  if (!address) return '';

  // Kaspa addresses start with "kaspa:" prefix
  const prefix = 'kaspa:';
  if (address.startsWith(prefix)) {
    const addr = address.slice(prefix.length);
    if (addr.length <= 12) return address;
    return `${prefix}${addr.slice(0, 4)}...${addr.slice(-4)}`;
  }

  // Fallback for other formats
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const {
    address,
    network,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    clearError,
  } = useWallet();

  const [copied, setCopied] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleConnect = () => {
    clearError();
    setShowError(false);
    void connect().catch(() => {
      setShowError(true);
    });
  };

  const handleDisconnect = () => {
    void disconnect().then(() => {
      clearError();
      setShowError(false);
    });
  };

  const handleCopyAddress = () => {
    if (!address) return;

    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      console.warn('Failed to copy address to clipboard');
    });
  };

  const handleDismissError = () => {
    setShowError(false);
    clearError();
  };

  // Render error message
  if (showError && error) {
    const isNotInstalled = error.code === WalletErrorCode.NOT_INSTALLED;

    return (
      <div className="wallet-button-container">
        <div className="wallet-error">
          <span className="wallet-error-message">
            {getWalletErrorMessage(error)}
          </span>
          {isNotInstalled && (
            <a
              href="https://kasware.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="wallet-install-link"
            >
              Install Kasware
            </a>
          )}
          <button
            className="btn btn-small"
            onClick={handleDismissError}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Render connected state
  if (isConnected && address) {
    return (
      <div className="wallet-button-container">
        <div className="wallet-connected">
          <div className="wallet-info">
            <span className="wallet-network">{network ?? 'unknown'}</span>
            <button
              className="wallet-address"
              onClick={handleCopyAddress}
              title={address}
            >
              {truncateAddress(address)}
              <span className="wallet-copy-icon">
                {copied ? ' Copied!' : ' (click to copy)'}
              </span>
            </button>
          </div>
          <button
            className="btn btn-outline btn-small"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  // Render connect button
  return (
    <div className="wallet-button-container">
      <button
        className="btn btn-primary"
        onClick={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    </div>
  );
}
