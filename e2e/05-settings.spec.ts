import { test, expect } from '@playwright/test';
import { registerUser } from './helpers';

/**
 * React 18 concurrent rendering triggers many re-renders in Settings (loadAllPrices
 * fires ~15 API calls). During each reconciliation, React briefly removes/re-adds
 * portal nodes, detaching inputs from the DOM.
 *
 * Two-part fix:
 *  1. reactFill: atomic find+fill inside waitForFunction (one browser round-trip,
 *     retries every 100ms until the element is found AND the value is set).
 *  2. Serial test mode: settings tests run one-at-a-time, eliminating parallel
 *     resource contention that amplifies the render frequency.
 */

// Run all Settings tests serially (one at a time in the same page)
test.describe.configure({ mode: 'serial' });

async function reactFill(
  page: import('@playwright/test').Page,
  selector: string,
  value: string
) {
  await page.waitForFunction(
    ({ sel, val }) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) return false;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      if (!nativeSetter) return false;
      nativeSetter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    { sel: selector, val: value },
    { timeout: 15000, polling: 100 }
  );
}

async function reactSelect(
  page: import('@playwright/test').Page,
  targetValue: string
) {
  await page.waitForFunction(
    ({ val }) => {
      const selects = Array.from(document.querySelectorAll('select'));
      const select = selects.find((s) => {
        const opts = Array.from(s.options || []);
        const hasFrames = opts.some((o) => String(o.value) === 'frames');
        const hasTarget = opts.some((o) => String(o.value) === val);
        return hasFrames && hasTarget;
      }) as HTMLSelectElement | undefined;

      if (!select) return false;

      select.value = val;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value === val;
    },
    { val: targetValue },
    { timeout: 15000, polling: 100 }
  );
}

async function adminLogin(page: import('@playwright/test').Page) {
  await reactFill(page, 'input[placeholder="admin"]', 'admin');
  await reactFill(page, 'input[type="password"]', '1234');
  await page.waitForTimeout(80);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 20000 });
}

async function fillAdminForm(
  page: import('@playwright/test').Page,
  username: string,
  password: string
) {
  await reactFill(page, 'input[placeholder="admin"]', username);
  await reactFill(page, 'input[type="password"]', password);
  await page.waitForTimeout(80);
  await page.getByRole('button', { name: 'Login' }).click();
}

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await page.locator('a[href*="/app/settings"]').click();
    await page.waitForURL('**/app/settings**');
  });

  test('Settings page loads and shows admin login prompt', async ({ page }) => {
    await expect(page).toHaveURL(/\/app\/settings/);
    await expect(page.getByText(/Owner Login/i)).toBeVisible({ timeout: 8000 });
  });

  test('Admin gate: shows username and password fields', async ({ page }) => {
    await expect(page.locator('input[placeholder="admin"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 8000 });
  });

  test('Admin gate: entering wrong password shows error', async ({ page }) => {
    await fillAdminForm(page, 'admin', 'wrongpassword123');
    await expect(page.getByText(/Invalid password/i)).toBeVisible({ timeout: 8000 });
  });

  test('Admin gate: entering wrong username shows error', async ({ page }) => {
    await fillAdminForm(page, 'wronguser', '1234');
    await expect(page.getByText(/Invalid/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('Admin gate: correct credentials unlock Settings', async ({ page }) => {
    await adminLogin(page);
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('Activity report: date input and View Report visible after login', async ({ page }) => {
    await adminLogin(page);
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /view report/i })).toBeVisible();
  });

  test('Activity report section heading is visible', async ({ page }) => {
    await adminLogin(page);
    await expect(page.getByText(/Reports/i).first()).toBeVisible();
  });

  test('Shop settings: form inputs visible after login', async ({ page }) => {
    await adminLogin(page);
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test('Custom roll sale: backend insert shows in Settings table', async ({ page, request }) => {
    const now = Date.now();
    const rand = Math.random().toString(16).slice(2);
    const sectionId = `custom-e2e-${now}-${rand}`;
    const sectionLabel = `Cloth e2e ${now}-${rand}`;
    const subitemName = `Backlight print e2e-${now}-${rand}`;
    const itemType = 'Banner';
    const unitPrice = 250;

    // Setup: create a roll custom section that affects sales.
    const createRes = await request.post('http://localhost:5000/api/stock/custom-sections', {
      data: {
        section_id: sectionId,
        label: sectionLabel,
        section_type: 'roll',
        affects_sales: 1,
      },
    });
    expect(createRes.status()).toBe(201);

    // Unlock settings UI.
    await adminLogin(page);

    // Insert roll sale subtype via API.
    const insertRes = await request.post('http://localhost:5000/api/stock/custom-sale-items', {
      data: {
        section_id: sectionId,
        item_name: subitemName,
        item_type: itemType,
        qty_type: 'per_sqft',
        unit_price: unitPrice,
      },
    });
    expect(insertRes.status()).toBe(201);

    // Go to Settings page again so it re-fetches custom sections + sale items.
    await page.locator('a[href*="/app/settings"]').click();
    await page.waitForURL('**/app/settings**', { timeout: 20000 });
    if (await page.locator('input[placeholder="admin"]').count() > 0) {
      await adminLogin(page);
    } else {
      await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 20000 });
    }
    await expect(page.getByText('Edit All Prices')).toBeVisible({ timeout: 15000 });

    // Assert: the new row appears under the table.
    await expect(page.getByText(subitemName, { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('td', { hasText: sectionLabel }).first()).toBeVisible({ timeout: 15000 });
  });
});
