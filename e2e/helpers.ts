import { Page } from '@playwright/test';

export const TEST_USER = {
  name: 'Test User',
  email: 'testuser@example.com',
  password: 'test1234',
};

/** Clear app localStorage so it starts fresh (no registered users). */
export async function clearAppStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('oliyaruvi_auth');
    localStorage.removeItem('oliyaruvi_users');
  });
}

/** Register a fresh test user (assumes no user exists). */
export async function registerUser(
  page: Page,
  name = TEST_USER.name,
  email = TEST_USER.email,
  password = TEST_USER.password
) {
  await clearAppStorage(page);
  await page.reload();
  await page.fill('[placeholder="Enter your name"]', name);
  await page.fill('[placeholder="e.g. name@example.com"]', email);
  const passwordFields = page.locator('input[type="password"]');
  await passwordFields.nth(0).fill(password);
  await passwordFields.nth(1).fill(password);
  await page.click('button:has-text("Register & Start")');
  await page.waitForURL('**/app**');
}

/** Login with existing credentials (user must already be registered). */
export async function loginUser(
  page: Page,
  email = TEST_USER.email,
  password = TEST_USER.password
) {
  await page.evaluate(() => localStorage.removeItem('oliyaruvi_auth'));
  await page.reload();
  await page.fill('[placeholder="e.g. name@example.com"]', email);
  await page.fill('[placeholder="Enter your password"]', password);
  await page.click('button:has-text("Login")');
  await page.waitForURL('**/app**');
}
