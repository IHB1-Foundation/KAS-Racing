/**
 * V3 Faucet Routes — kFUEL mint for testnet UX
 */

import { Router, type Request, type Response, type RequestHandler } from 'express';
import { parseEther } from 'viem';
import { mintFuel } from '../../tx/evmContracts.js';
import { normalizeEvmAddress } from '../../utils/evmAddress.js';
import type { Address } from 'viem';

const router = Router();

type AsyncHandler = (req: Request, res: Response) => Promise<void>;
const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => { fn(req, res).catch(next); };
};

const DEFAULT_FAUCET_AMOUNT = parseEther('25');
const MAX_FAUCET_AMOUNT = parseEther('100');
const COOLDOWN_MS = 10 * 60 * 1000;
const lastClaimByAddress = new Map<string, number>();

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { address?: string; amountWei?: string };

  if (!body.address) {
    res.status(400).json({ error: 'address is required' });
    return;
  }

  const normalized = normalizeEvmAddress(body.address);
  if (!normalized) {
    res.status(400).json({ error: 'address must be a valid EVM address' });
    return;
  }

  const now = Date.now();
  const lastClaim = lastClaimByAddress.get(normalized);
  if (lastClaim && now - lastClaim < COOLDOWN_MS) {
    res.status(429).json({ error: 'Faucet cooldown active. Please try again later.' });
    return;
  }

  const amountWei = body.amountWei ? BigInt(body.amountWei) : DEFAULT_FAUCET_AMOUNT;
  if (amountWei <= 0n) {
    res.status(400).json({ error: 'amountWei must be a positive value' });
    return;
  }
  if (amountWei > MAX_FAUCET_AMOUNT) {
    res.status(400).json({ error: 'amountWei exceeds faucet limit' });
    return;
  }

  const result = await mintFuel({ to: normalized as Address, amountWei });
  if (!result.success) {
    res.status(500).json({ error: result.error ?? 'Faucet request failed' });
    return;
  }

  lastClaimByAddress.set(normalized, now);
  res.json({ txHash: result.hash, amountWei: amountWei.toString() });
}));

export default router;
