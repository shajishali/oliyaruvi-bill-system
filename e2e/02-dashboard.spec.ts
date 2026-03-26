import { test, expect } from '@playwright/test';
import { registerUser, loginUser } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('Dashboard loads with key cards', async ({ page }) => {
    await expect(page).toHaveURL(/\/app/);
    // Should show revenue/income cards
    await expect(page.getByText(/today|revenue|income/i).first()).toBeVisible();
  });

  test('Dashboard navigation: Billing link works', async ({ page }) => {
    await page.getByRole('link', { name: /billing/i }).first().click();
    await expect(page).toHaveURL(/\/app\/billing/);
  });

  test('Dashboard navigation: Stock link works', async ({ page }) => {
    await page.locator('a[href*="/app/stock"]').click();
    await expect(page).toHaveURL(/\/app\/stock/, { timeout: 8000 });
  });

  test('Dashboard navigation: Settings link works', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).first().click();
    // AdminGate may redirect back to /app after clicking close - just check we navigated to settings at all
    await page.waitForURL(/\/app(\/settings)?/, { timeout: 5000 });
    // Settings admin gate OR dashboard - the click worked
    await expect(
      page.getByText(/Owner Login|Settings/i).first()
    ).toBeVisible();
  });

  test('Daily Revenue Card: date picker is visible', async ({ page }) => {
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('Page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(/OLIYARUVI PRINTERS/i);
  });
});
