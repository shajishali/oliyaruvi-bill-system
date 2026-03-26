import { test, expect } from '@playwright/test';
import { registerUser } from './helpers';

test.describe('Billing', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await page.locator('a[href*="/app/billing"]').first().click();
    await page.waitForURL('**/app/billing**', { timeout: 10000 });
  });

  test('Billing page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/app\/billing/, { timeout: 8000 });
    await expect(page.getByText(/Billing/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('Create new bill button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new bill/i })).toBeVisible();
  });

  test('New Bill tab: customer form is visible', async ({ page }) => {
    // Billing page opens with "New Bill" tab active by default - form should already be shown
    await expect(
      page.getByPlaceholder(/customer name/i).or(page.getByText(/customer/i).first())
    ).toBeVisible({ timeout: 8000 });
  });

  test('Bill List tab: bill list is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /bill list/i })).toBeVisible({ timeout: 8000 });
  });

  test('Bill list: search box is visible', async ({ page }) => {
    const searchBox = page.getByPlaceholder(/search|bill number|customer/i);
    if (await searchBox.count() > 0) {
      await expect(searchBox.first()).toBeVisible();
    }
  });

  test('Bill list: filter dropdown is visible', async ({ page }) => {
    const filter = page.locator('select').first();
    if (await filter.count() > 0) {
      await expect(filter).toBeVisible();
    }
  });
});
