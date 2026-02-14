/**
 * NetworkGuard
 *
 * Shows a warning banner when the user's wallet is connected to the wrong network.
 * Guides the user to switch to the expected network (testnet for demo).
 */

import { useWallet } from '../wallet';

const EXPECTED_NETWORK = (import.meta.env.VITE_NETWORK as string | undefined) ?? 'testnet';

export function NetworkGuard() {
  const { isConnected, network } = useWallet();

  if (!isConnected || !network) return null;
  if (network === EXPECTED_NETWORK) return null;

  return (
    <div style={{
      background: 'rgba(255, 200, 50, 0.15)',
      border: '1px solid rgba(255, 200, 50, 0.4)',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '16px',
      fontSize: '13px',
      lineHeight: '1.5',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#ffd93d' }}>
        Wrong Network
      </div>
      <div style={{ color: '#ccc' }}>
        Your wallet is on <strong>{network}</strong>, but this app requires{' '}
        <strong>{EXPECTED_NETWORK}</strong>.
      </div>
      <div style={{ marginTop: '8px', color: '#999', fontSize: '12px' }}>
        Open your Kasware wallet settings and switch to {EXPECTED_NETWORK}.
      </div>
    </div>
  );
}
