import type { APIRequestContext } from '@playwright/test';

export const apiBase = process.env.E2E_API_URL ?? 'http://localhost:8788';

export const player1 = process.env.E2E_PLAYER1 ?? '0x1111111111111111111111111111111111111111';
export const player2 = process.env.E2E_PLAYER2 ?? '0x2222222222222222222222222222222222222222';

export async function resetE2E(request: APIRequestContext): Promise<void> {
  await request.post(`${apiBase}/api/v3/e2e/reset`);
}

export async function joinMatch(
  request: APIRequestContext,
  joinCode: string,
  playerAddress: string,
): Promise<void> {
  await request.post(`${apiBase}/api/v3/match/join`, {
    data: { joinCode, playerAddress },
  });
}

export async function depositMatch(
  request: APIRequestContext,
  matchId: string,
  player: 'player1' | 'player2',
): Promise<void> {
  await request.post(`${apiBase}/api/v3/e2e/match/${matchId}/deposit`, {
    data: { player },
  });
}

export async function submitScore(
  request: APIRequestContext,
  matchId: string,
  playerAddress: string,
  score: number,
): Promise<void> {
  await request.post(`${apiBase}/api/v3/match/${matchId}/submit-score`, {
    data: { playerAddress, score },
  });
}

export async function getMatchByCode(
  request: APIRequestContext,
  joinCode: string,
): Promise<{ id: string }> {
  const res = await request.get(`${apiBase}/api/v3/match/code/${joinCode}`);
  const data = await res.json();
  return { id: data.id as string };
}
