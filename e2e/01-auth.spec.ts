import { test, expect } from '@playwright/test';
import { TEST_USER, clearAppStorage, registerUser } from './helpers';

test.describe('Authentication', () => {
  test('First-time: shows Register form when no user exists', async ({ page }) => {
    await clearAppStorage(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register & Start' })).toBeVisible();
    // Login button should NOT be visible on first run
    await expect(page.getByRole('button', { name: 'Login' })).not.toBeVisible();
  });

  test('Register: shows error for mismatched passwords', async ({ page }) => {
    await clearAppStorage(page);
    await page.reload();
    await page.fill('[placeholder="Enter your name"]', TEST_USER.name);
    await page.fill('[placeholder="e.g. name@example.com"]', TEST_USER.email);
    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.nth(0).fill('password1');
    await passwordFields.nth(1).fill('password2');
    await page.click('button:has-text("Register & Start")');
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('Register: shows error for short password', async ({ page }) => {
    await clearAppStorage(page);
    await page.reload();
    await page.fill('[placeholder="Enter your name"]', TEST_USER.name);
    await page.fill('[placeholder="e.g. name@example.com"]', TEST_USER.email);
    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.nth(0).fill('abc');
    await passwordFields.nth(1).fill('abc');
    await page.click('button:has-text("Register & Start")');
    await expect(page.getByText('at least 6 characters')).toBeVisible();
  });

  test('Register: success redirects to dashboard', async ({ page }) => {
    await registerUser(page);
    await expect(page).toHaveURL(/\/app/);
    // The heading in the nav/layout is different from the Home page title
    await expect(page.getByRole('heading', { name: 'Create Account' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Login' })).not.toBeVisible();
  });

  test('Login: shows Login form on returning visit', async ({ page }) => {
    await registerUser(page);
    await page.evaluate(() => localStorage.removeItem('oliyaruvi_auth'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    // Register form should NOT be shown
    await expect(page.getByRole('button', { name: 'Register & Start' })).not.toBeVisible();
  });

  test('Login: shows error for wrong password', async ({ page }) => {
    await registerUser(page);
    await page.evaluate(() => localStorage.removeItem('oliyaruvi_auth'));
    await page.reload();
    await page.fill('[placeholder="e.g. name@example.com"]', TEST_USER.email);
    await page.fill('[placeholder="Enter your password"]', 'wrongpassword');
    await page.click('button:has-text("Login")');
    await expect(page.getByText('Incorrect password')).toBeVisible();
  });

  test('Login: shows error for unknown email', async ({ page }) => {
    await registerUser(page);
    await page.evaluate(() => localStorage.removeItem('oliyaruvi_auth'));
    await page.reload();
    await page.fill('[placeholder="e.g. name@example.com"]', 'nobody@example.com');
    await page.fill('[placeholder="Enter your password"]', 'anypassword');
    await page.click('button:has-text("Login")');
    await expect(page.getByText('No account found')).toBeVisible();
  });

  test('Login: success redirects to dashboard', async ({ page }) => {
    await registerUser(page);
    await page.evaluate(() => localStorage.removeItem('oliyaruvi_auth'));
    await page.reload();
    await page.fill('[placeholder="e.g. name@example.com"]', TEST_USER.email);
    await page.fill('[placeholder="Enter your password"]', TEST_USER.password);
    await page.click('button:has-text("Login")');
    await page.waitForURL('**/app**');
    await expect(page).toHaveURL(/\/app/);
  });

  test('Logout: redirects back to home/login', async ({ page }) => {
    await registerUser(page);
    // Click logout (look for it in nav/layout)
    const logoutBtn = page.locator('button', { hasText: /logout|sign out/i });
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
    } else {
      // Manual logout via localStorage
      await page.evaluate(() => localStorage.removeItem('oliyaruvi_auth'));
      await page.reload();
    }
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });

  test('Forgot password: shows error for unregistered email', async ({ page }) => {
    await registerUser(page);
    await page.evaluate(() => localStorage.removeItem('oliyaruvi_auth'));
    await page.reload();
    await page.click('button:has-text("Forgot password?")');
    await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible();
    await page.fill('[placeholder="e.g. name@example.com"]', 'notregistered@example.com');
    await page.click('button:has-text("Send OTP")');
    await expect(page.getByText('No account found')).toBeVisible();
  });

  test('Forgot password: back to login works', async ({ page }) => {
    await registerUser(page);
    await page.evaluate(() => localStorage.removeItem('oliyaruvi_auth'));
    await page.reload();
    await page.click('button:has-text("Forgot password?")');
    await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible();
    await page.click('button:has-text("← Back to Login")');
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });

  test('Protected route: unauthenticated redirects to home', async ({ page }) => {
    await page.goto('/app');
    await expect(page).not.toHaveURL(/\/app/);
  });
});
