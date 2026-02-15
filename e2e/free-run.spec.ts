import { test, expect } from '@playwright/test';
import { resetE2E } from './helpers';

test.describe('Free Run flow', () => {
  test('rewards checkpoint and verifies proof', async ({ page, request }) => {
    await resetE2E(request);

    await page.goto('/');
    await page.getByRole('link', { name: /free run/i }).click();

    const connectBtn = page.getByRole('button', { name: /connect wallet/i });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    await page.getByTestId('e2e-start-session').click();
    const sessionIdLocator = page.getByTestId('e2e-session-id');
    await expect(sessionIdLocator).not.toHaveText('none');
    const sessionId = (await sessionIdLocator.textContent())?.trim() ?? '';
    expect(sessionId).not.toEqual('');

    await page.getByTestId('e2e-checkpoint').click();

    const txLink = page.locator('.svs-txid').first();
    await expect(txLink).toBeVisible();
    const txHash = await txLink.getAttribute('title');
    expect(txHash).toBeTruthy();

    await page.goto('/proof');
    await page.getByRole('button', { name: /by session \+ seq/i }).click();
    await page.fill('#sessionId', sessionId);
    await page.fill('#seq', '1');
    await page.getByRole('button', { name: /verify proof/i }).click();

    await expect(page.getByText(/verified on-chain proof/i)).toBeVisible();

    await page.getByRole('button', { name: /by tx hash/i }).click();
    await page.fill('#txhash', txHash ?? '');
    await page.getByRole('button', { name: /^verify$/i }).click();
    await expect(page.getByText(/transaction found/i)).toBeVisible();
  });
});
