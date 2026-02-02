import { Router, type Request, type Response, type RequestHandler } from 'express';
import type { TxStatus, TxStatusResponse } from '../types/index.js';
import { getTxStatusFromDb, fetchTxStatus } from '../services/txStatusService.js';

const router = Router();

// Async handler wrapper
type AsyncHandler = (req: Request, res: Response) => Promise<void>;
const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
};

/**
 * GET /api/tx/:txid/status
 * Get transaction status
 */
router.get('/:txid/status', asyncHandler(async (req: Request, res: Response) => {
  const { txid } = req.params;

  if (!txid) {
    res.status(400).json({ error: 'txid is required' });
    return;
  }

  // First, check if we have this tx in database
  const dbEvent = await getTxStatusFromDb(txid);

  if (dbEvent) {
    // Return status from database
    const response: TxStatusResponse = {
      txid,
      status: dbEvent.txStatus as TxStatus,
      timestamps: {
        broadcasted: dbEvent.broadcastedAt?.getTime(),
        accepted: dbEvent.acceptedAt?.getTime(),
        included: dbEvent.includedAt?.getTime(),
        confirmed: dbEvent.confirmedAt?.getTime(),
      },
      confirmations: dbEvent.txStatus === 'confirmed' ? 10 : 0,
    };
    res.json(response);
    return;
  }

  // For stub txids (test mode), simulate progression
  if (txid.startsWith('stub_') || txid.startsWith('test-txid-')) {
    const stubResponse = getStubTxStatus(txid);
    if (stubResponse) {
      res.json(stubResponse);
      return;
    }
  }

  // If not in DB and not a stub, try fetching from REST API
  try {
    const apiResult = await fetchTxStatus(txid);

    if (apiResult.error && !apiResult.accepted) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Determine status from API result
    let status: TxStatus = 'broadcasted';
    if (apiResult.confirmations && apiResult.confirmations >= 10) {
      status = 'confirmed';
    } else if (apiResult.included) {
      status = 'included';
    } else if (apiResult.accepted) {
      status = 'accepted';
    }

    const response: TxStatusResponse = {
      txid,
      status,
      timestamps: {
        broadcasted: Date.now(), // Unknown, use current
      },
      confirmations: apiResult.confirmations ?? 0,
    };

    res.json(response);

  } catch (error) {
    console.error(`[tx] Error fetching status for ${txid}:`, error);
    res.status(404).json({ error: 'Transaction not found' });
  }
}));

/**
 * Generate stub tx status for testing
 */
function getStubTxStatus(txid: string): TxStatusResponse | null {
  // Parse timestamp from stub txid (format: stub_sessionid_seq_timestamp or test-txid-seq)
  let broadcastedAt: number;

  if (txid.startsWith('stub_')) {
    const parts = txid.split('_');
    const ts = parts[parts.length - 1] ?? '';
    broadcastedAt = parseInt(ts, 36);
    if (isNaN(broadcastedAt)) {
      broadcastedAt = Date.now() - 5000; // Fallback
    }
  } else {
    // test-txid-* format (from mocked tests)
    broadcastedAt = Date.now() - 5000;
  }

  const elapsed = Date.now() - broadcastedAt;

  // Simulate status progression
  let status: TxStatus = 'broadcasted';
  const timestamps: {
    broadcasted?: number;
    accepted?: number;
    included?: number;
    confirmed?: number;
  } = { broadcasted: broadcastedAt };

  if (elapsed > 500) {
    status = 'accepted';
    timestamps.accepted = broadcastedAt + 500;
  }
  if (elapsed > 2000) {
    status = 'included';
    timestamps.included = broadcastedAt + 2000;
  }
  if (elapsed > 4000) {
    status = 'confirmed';
    timestamps.confirmed = broadcastedAt + 4000;
  }

  // Calculate confirmations
  let confirmations = 0;
  if (status === 'confirmed' && timestamps.confirmed) {
    const elapsedSinceConfirm = Date.now() - timestamps.confirmed;
    confirmations = Math.min(100, 1 + Math.floor(elapsedSinceConfirm / 1000));
  }

  return {
    txid,
    status,
    timestamps,
    confirmations,
  };
}

export default router;
