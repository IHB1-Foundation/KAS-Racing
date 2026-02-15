/**
 * V3 API Router — EVM/KASPLEX zkEVM endpoints
 *
 * All endpoints under /api/v3/ use contract-first EVM logic.
 * State transitions verified against chain_events_evm (indexed).
 */

import { Router } from 'express';
import sessionRoutes from './session.js';
import matchRoutes from './match.js';
import txRoutes from './tx.js';
import { getSlaSummary, getRecentMetrics } from '../../services/metricsService.js';

const router = Router();

router.use('/session', sessionRoutes);
router.use('/match', matchRoutes);
router.use('/tx', txRoutes);

/**
 * GET /api/v3/metrics/sla
 * Get SLA metrics summary (latency percentiles, event counts)
 */
router.get('/metrics/sla', (_req, res) => {
  const summary = getSlaSummary();
  res.json(summary);
});

/**
 * GET /api/v3/metrics/events
 * Get recent latency metrics (last N events)
 */
router.get('/metrics/events', (req, res) => {
  const limit = parseInt(req.query.limit as string ?? '50', 10);
  const events = getRecentMetrics(limit);
  res.json({ events, total: events.length });
});

export default router;
