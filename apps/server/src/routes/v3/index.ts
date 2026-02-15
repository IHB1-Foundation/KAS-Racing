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

const router = Router();

router.use('/session', sessionRoutes);
router.use('/match', matchRoutes);
router.use('/tx', txRoutes);

export default router;
