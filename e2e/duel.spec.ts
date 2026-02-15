import { test, expect } from '@playwright/test';
import { resetE2E, joinMatch, player2 } from './helpers';

test.describe('Duel flow', () => {
  test('creates match, simulates deposits, settles', async ({ page, request }) => {
    await resetE2E(request);

    await page.goto('/duel');

    const connectBtn = page.getByRole('button', { name: /connect wallet/i });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    await page.getByRole('button', { name: /create match/i }).click();
    await page.getByRole('button', { name: /^create match$/i }).click();

    const joinCodeLocator = page.locator('.join-code');
    await expect(joinCodeLocator).toBeVisible();
    const joinCode = (await joinCodeLocator.textContent())?.trim() ?? '';
    expect(joinCode).not.toEqual('');

    await joinMatch(request, joinCode, player2);

    await expect(page.getByRole('heading', { name: /deposit required/i })).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('e2e-deposit-self').click();
    await page.getByTestId('e2e-deposit-opponent').click();

    await expect(page.getByText(/race in progress/i)).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('e2e-score-self').click();
    await page.getByTestId('e2e-score-opponent').click();

    await expect(page.getByRole('heading', { name: /match complete/i })).toBeVisible({ timeout: 20_000 });
  });
});
