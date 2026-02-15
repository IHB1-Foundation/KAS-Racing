/**
 * V3 Transaction & Proof Routes — EVM-based
 *
 * Tx status from chain_events_evm (indexed) + RPC receipt fallback.
 * Proof verification from RewardPaid/ProofRecorded events.
 */

import { Router, type Request, type Response, type RequestHandler } from 'express';
import { getEvmTxStatus, getEvmEventsByTxHash } from '../../services/evmChainQueryService.js';
import { getProofData } from '../../services/evmRewardService.js';

const router = Router();

type AsyncHandler = (req: Request, res: Response) => Promise<void>;
const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => { fn(req, res).catch(next); };
};

/**
 * GET /api/v3/tx/:txHash/status
 * Get EVM transaction status (chain_events_evm → RPC fallback)
 */
router.get('/:txHash/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    if (!txHash) {
      res.status(400).json({ error: 'txHash is required' });
      return;
    }

    const status = await getEvmTxStatus(txHash);
    res.json(status);
  } catch (error) {
    console.error('[v3/tx] Status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/v3/tx/:txHash
 * Get full EVM transaction details (events + receipt)
 */
router.get('/:txHash', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    if (!txHash) {
      res.status(400).json({ error: 'txHash is required' });
      return;
    }

    // Get indexed events
    const events = await getEvmEventsByTxHash(txHash);

    // Try to get receipt from RPC
    let receipt: {
      blockNumber: string;
      status: string;
      gasUsed: string;
      from: string;
      to: string | null;
    } | null = null;

    try {
      const { getPublicClient } = await import('../../tx/evmClient.js');
      const client = getPublicClient();
      const r = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
      if (r) {
        receipt = {
          blockNumber: r.blockNumber.toString(),
          status: r.status,
          gasUsed: r.gasUsed.toString(),
          from: r.from,
          to: r.to,
        };
      }
    } catch {
      // RPC unavailable
    }

    if (!receipt && events.length === 0) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json({ txHash, receipt, events });
  } catch (error) {
    console.error('[v3/tx] Details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/v3/proof/:sessionId/:seq
 * Get proof-of-action data for a specific reward event
 */
router.get('/proof/:sessionId/:seq', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { sessionId, seq } = req.params;
    if (!sessionId || !seq) {
      res.status(400).json({ error: 'sessionId and seq are required' });
      return;
    }

    const seqNum = parseInt(seq, 10);
    if (isNaN(seqNum) || seqNum < 0) {
      res.status(400).json({ error: 'seq must be a non-negative integer' });
      return;
    }

    const proof = await getProofData(sessionId, seqNum);
    res.json(proof);
  } catch (error) {
    console.error('[v3/tx] Proof error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

export default router;
