/**
 * TX Lifecycle Types
 */

export type TxStatus = 'broadcasted' | 'accepted' | 'included' | 'confirmed' | 'failed';

export interface TxStatusInfo {
  txid: string;
  status: TxStatus;
  timestamps: {
    broadcasted?: number;
    accepted?: number;
    included?: number;
    confirmed?: number;
  };
  confirmations: number;
}

export interface TxLifecycleTimelineProps {
  txid: string;
  status: TxStatus;
  timestamps?: {
    broadcasted?: number;
    accepted?: number;
    included?: number;
    confirmed?: number;
  };
  confirmations?: number;
  explorerUrl?: string;
  network?: 'mainnet' | 'testnet';
  onStatusClick?: (status: TxStatus) => void;
}

export interface KaspaRPMGaugeProps {
  bps?: number;
  maxBps?: number;
  label?: string;
  showValue?: boolean;
}

export interface NetworkPulsePanelProps {
  lastBlockTime?: number;
  avgBlockTime?: number;
  networkStatus?: 'online' | 'offline' | 'unknown';
}
