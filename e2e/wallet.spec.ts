import { test, expect } from '@playwright/test';

test.describe('Wallet UI states', () => {
  test('shows connect prompt when disconnected', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('e2eDisconnected', 'true');
      localStorage.removeItem('e2eWrongChain');
      localStorage.removeItem('e2eWalletError');
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
  });

  test('shows wrong network prompt when chain mismatch is forced', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('e2eWrongChain', 'true');
      localStorage.removeItem('e2eDisconnected');
      localStorage.removeItem('e2eWalletError');
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: /switch to kasplex/i })).toBeVisible();
    await expect(page.getByText(/wrong network/i)).toBeVisible();
  });

  test('shows wallet error message when forced', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('e2eDisconnected', 'true');
      localStorage.setItem('e2eWalletError', 'Connection rejected. Please try again.');
      localStorage.removeItem('e2eWrongChain');
    });

    await page.goto('/');
    await expect(page.getByText(/connection rejected/i)).toBeVisible();
  });
});
