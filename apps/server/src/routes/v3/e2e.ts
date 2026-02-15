import { Router, type Request, type Response, type RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { matchesV3 } from '../../db/schema.js';
import { getEvmEventsByMatchId } from '../../services/evmChainQueryService.js';
import { normalizeEvmAddress } from '../../utils/evmAddress.js';
import { insertChainEvent, isE2EEnabled, resetE2EData } from '../../utils/e2e.js';

const router = Router();

type AsyncHandler = (req: Request, res: Response) => Promise<void>;
const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => { fn(req, res).catch(next); };
};

router.post('/reset', asyncHandler(async (_req, res) => {
  if (!isE2EEnabled()) {
    res.status(404).json({ error: 'E2E mode not enabled' });
    return;
  }

  await resetE2EData();
  res.json({ ok: true });
}));

/**
 * POST /api/v3/e2e/match/:id/deposit
 * Simulate a deposit event for a match.
 */
router.post('/match/:id/deposit', asyncHandler(async (req, res) => {
  if (!isE2EEnabled()) {
    res.status(404).json({ error: 'E2E mode not enabled' });
    return;
  }

  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'match id is required' });
    return;
  }

  const body = req.body as {
    playerAddress?: string;
    player?: 'player1' | 'player2';
    amountWei?: string;
    txHash?: string;
  };

  const matchRows = await db.select().from(matchesV3).where(eq(matchesV3.id, id)).limit(1);
  const match = matchRows[0];
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  if (!match.matchIdOnchain) {
    res.status(400).json({ error: 'Match has no on-chain id yet' });
    return;
  }

  const resolvedAddress = body.playerAddress
    ? normalizeEvmAddress(body.playerAddress)
    : body.player === 'player2'
      ? normalizeEvmAddress(match.player2Address ?? '')
      : normalizeEvmAddress(match.player1Address);

  if (!resolvedAddress) {
    res.status(400).json({ error: 'playerAddress must be a valid EVM address' });
    return;
  }

  const amountWei = body.amountWei ?? match.depositAmountWei;

  const { txHash } = await insertChainEvent({
    contract: 'MatchEscrow',
    eventName: 'Deposited',
    txHash: body.txHash,
    args: {
      matchId: match.matchIdOnchain,
      player: resolvedAddress,
      amount: amountWei,
    },
  });

  // Auto-fund if both players have deposited
  const events = await getEvmEventsByMatchId(match.matchIdOnchain);
  const depositedPlayers = new Set(
    events
      .filter((evt) => evt.eventName === 'Deposited')
      .map((evt) => {
        const playerValue = evt.args.player;
        return typeof playerValue === 'string' ? playerValue.toLowerCase() : '';
      })
      .filter(Boolean),
  );

  const p1 = match.player1Address.toLowerCase();
  const p2 = match.player2Address?.toLowerCase();
  const alreadyFunded = events.some((evt) => evt.eventName === 'MatchFunded');

  if (p2 && depositedPlayers.has(p1) && depositedPlayers.has(p2) && !alreadyFunded) {
    await insertChainEvent({
      contract: 'MatchEscrow',
      eventName: 'MatchFunded',
      args: { matchId: match.matchIdOnchain },
    });
  }

  res.json({ ok: true, txHash, playerAddress: resolvedAddress });
}));

export default router;
