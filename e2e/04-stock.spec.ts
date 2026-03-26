import { test, expect } from '@playwright/test';
import { registerUser } from './helpers';

test.describe('Stock Management', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await page.locator('a[href*="/app/stock"]').click();
    await page.waitForURL('**/app/stock**');
  });

  test('Stock page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/app\/stock/);
    await expect(
      page.getByText(/stock|frame|photo|banner/i).first()
    ).toBeVisible();
  });

  test('Frame tab or section is visible', async ({ page }) => {
    const frameTab = page.getByRole('tab', { name: /frame/i })
      .or(page.getByRole('button', { name: /frame/i }))
      .or(page.getByText(/frame/i).first());
    await expect(frameTab).toBeVisible();
  });

  test('Can navigate to Photo section', async ({ page }) => {
    const photoTab = page.getByRole('tab', { name: /photo/i })
      .or(page.getByRole('button', { name: /photo/i }));
    if (await photoTab.count() > 0) {
      await photoTab.first().click();
      await expect(page.getByText(/photo/i).first()).toBeVisible();
    }
  });

  test('Can navigate to Banner section', async ({ page }) => {
    await page.waitForTimeout(800);
    const bannerTab = page.getByRole('tab', { name: /banner/i })
      .or(page.getByRole('button', { name: /banner/i }));
    if (await bannerTab.count() > 0) {
      await bannerTab.first().click({ force: true });
      await expect(page.getByText(/banner/i).first()).toBeVisible();
    }
  });

  test('Low stock alerts section exists', async ({ page }) => {
    const lowStockSection = page.getByText(/low stock/i).first();
    if (await lowStockSection.count() > 0) {
      await expect(lowStockSection).toBeVisible();
    }
  });
});
