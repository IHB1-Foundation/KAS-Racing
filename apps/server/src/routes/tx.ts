import { Router, type Request, type Response, type RequestHandler } from 'express';
import type { TxStatus, TxStatusResponse } from '../types/index.js';
import { getTxStatusFromDb } from '../services/txStatusService.js';
import { getChainTxInfo } from '../services/chainQueryService.js';
import { getKaspaRestClient } from '../tx/kaspaRestClient.js';
import { getConfig } from '../config/index.js';

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

  // 1) Check reward_events table (DB tracking)
  const dbEvent = await getTxStatusFromDb(txid);

  if (dbEvent) {
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
    res.json({ ...response, source: 'db' });
    return;
  }

  // 2) For stub txids (test mode), simulate progression
  if (txid.startsWith('stub_') || txid.startsWith('test-txid-')) {
    const stubResponse = getStubTxStatus(txid);
    if (stubResponse) {
      res.json({ ...stubResponse, source: 'stub' });
      return;
    }
  }

  // 3) Check chain_events (indexer) then fall back to REST API
  try {
    const chainInfo = await getChainTxInfo(txid);

    if (!chainInfo) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const response: TxStatusResponse = {
      txid,
      status: chainInfo.status,
      timestamps: {
        broadcasted: Date.now(),
      },
      confirmations: chainInfo.confirmations,
    };

    res.json({ ...response, source: chainInfo.source });

  } catch (error) {
    console.error(`[tx] Error fetching status for ${txid}:`, error);
    res.status(404).json({ error: 'Transaction not found' });
  }
}));

/**
 * GET /api/tx/:txid
 * Get full transaction details including payload
 */
router.get('/:txid', asyncHandler(async (req: Request, res: Response) => {
  const { txid } = req.params;

  if (!txid) {
    res.status(400).json({ error: 'txid is required' });
    return;
  }

  // For stub txids, return mock data
  if (txid.startsWith('stub_') || txid.startsWith('test-txid-')) {
    const stubData = getStubTxDetails(txid);
    res.json(stubData);
    return;
  }

  try {
    const config = getConfig();
    const client = getKaspaRestClient(config.network);

    const txData = await client.getTransaction(txid) as {
      transaction_id?: string;
      outputs?: Array<{
        amount: number;
        script_public_key_address?: string;
      }>;
      inputs?: Array<{
        previous_outpoint_hash?: string;
        previous_outpoint_index?: number;
      }>;
      payload?: string;
      accepting_block_hash?: string;
      block_time?: number;
    };

    // Extract payload (hex-encoded in REST API response)
    let payloadText: string | null = null;
    if (txData.payload) {
      try {
        // Decode hex to UTF-8 text
        const bytes = Buffer.from(txData.payload, 'hex');
        payloadText = bytes.toString('utf-8');
      } catch {
        payloadText = txData.payload; // Return as-is if decode fails
      }
    }

    res.json({
      txid: txData.transaction_id ?? txid,
      payload: payloadText,
      outputs: txData.outputs,
      inputs: txData.inputs,
      blockHash: txData.accepting_block_hash,
      blockTime: txData.block_time,
    });
  } catch (error) {
    console.error(`[tx] Error fetching tx ${txid}:`, error);
    res.status(404).json({ error: 'Transaction not found' });
  }
}));

/**
 * Get stub tx details for testing
 */
function getStubTxDetails(txid: string): {
  txid: string;
  payload: string;
  outputs: Array<{ amount: number; address: string }>;
  blockHash: string | null;
  blockTime: number | null;
} {
  // Parse info from stub txid
  const parts = txid.split('_');
  const sessionId = parts[1] ?? 'testsess';
  const seq = parts[2] ?? '1';

  // Generate mock payload
  const mockPayload = `KASRACE1|t|f|${sessionId.slice(0, 8)}|c|${seq}|mockhash12345678`;

  return {
    txid,
    payload: mockPayload,
    outputs: [
      { amount: 2000000, address: 'kaspa:mock_recipient' },
      { amount: 100000000, address: 'kaspa:mock_treasury_change' },
    ],
    blockHash: 'mock_block_hash_' + Date.now().toString(36),
    blockTime: Date.now(),
  };
}

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
