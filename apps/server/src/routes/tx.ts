import { Router, type Request, type Response } from 'express';
import type { TxStatus, TxStatusResponse } from '../types/index.js';

const router = Router();

// In-memory tx status store (will be replaced with actual tracking in T-050)
const txStatuses = new Map<
  string,
  {
    status: TxStatus;
    broadcastedAt?: number;
    acceptedAt?: number;
    includedAt?: number;
    confirmedAt?: number;
  }
>();

/**
 * Register a new tx (internal use)
 */
export function registerTx(txid: string): void {
  if (!txStatuses.has(txid)) {
    txStatuses.set(txid, {
      status: 'broadcasted',
      broadcastedAt: Date.now(),
    });
  }
}

/**
 * Update tx status (internal use, will be called by tx tracker worker)
 */
export function updateTxStatus(txid: string, status: TxStatus): boolean {
  const tx = txStatuses.get(txid);
  if (!tx) return false;

  const now = Date.now();
  tx.status = status;

  switch (status) {
    case 'accepted':
      tx.acceptedAt = now;
      break;
    case 'included':
      tx.includedAt = now;
      break;
    case 'confirmed':
      tx.confirmedAt = now;
      break;
  }

  return true;
}

/**
 * GET /api/tx/:txid/status
 * Get transaction status (stub implementation)
 */
router.get('/:txid/status', (req: Request, res: Response) => {
  const { txid } = req.params;

  if (!txid) {
    res.status(400).json({ error: 'txid is required' });
    return;
  }

  // Check if we have this tx tracked
  let txData = txStatuses.get(txid);

  // For stub txids, simulate progression
  if (!txData && txid.startsWith('stub_')) {
    // Parse timestamp from stub txid
    const parts = txid.split('_');
    const ts = parts[parts.length - 1] ?? '';
    const broadcastedAt = parseInt(ts, 36);
    const elapsed = Date.now() - broadcastedAt;

    // Simulate status progression
    let status: TxStatus = 'broadcasted';
    const timestamps: {
      broadcastedAt?: number;
      acceptedAt?: number;
      includedAt?: number;
      confirmedAt?: number;
    } = { broadcastedAt };

    if (elapsed > 500) {
      status = 'accepted';
      timestamps.acceptedAt = broadcastedAt + 500;
    }
    if (elapsed > 2000) {
      status = 'included';
      timestamps.includedAt = broadcastedAt + 2000;
    }
    if (elapsed > 4000) {
      status = 'confirmed';
      timestamps.confirmedAt = broadcastedAt + 4000;
    }

    txData = { status, ...timestamps };
  }

  if (!txData) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  // Calculate confirmations (stub: based on time elapsed)
  let confirmations = 0;
  if (txData.status === 'confirmed' && txData.confirmedAt) {
    const elapsed = Date.now() - txData.confirmedAt;
    confirmations = Math.min(100, 1 + Math.floor(elapsed / 1000));
  }

  const response: TxStatusResponse = {
    txid,
    status: txData.status,
    timestamps: {
      broadcasted: txData.broadcastedAt,
      accepted: txData.acceptedAt,
      included: txData.includedAt,
      confirmed: txData.confirmedAt,
    },
    confirmations,
  };

  res.json(response);
});

export default router;
export { txStatuses };
