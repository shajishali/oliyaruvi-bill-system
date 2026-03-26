import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000/api';

test.describe('Backend API', () => {
  test('Health check returns ok', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/bills returns array', async ({ request }) => {
    const res = await request.get(`${API}/bills`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/customers returns array', async ({ request }) => {
    const res = await request.get(`${API}/customers`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/stock/frames returns array', async ({ request }) => {
    const res = await request.get(`${API}/stock/frames`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/services/frame-pricing returns array', async ({ request }) => {
    const res = await request.get(`${API}/services/frame-pricing`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/stock/photos returns array', async ({ request }) => {
    const res = await request.get(`${API}/stock/photos`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/stock/banners returns array', async ({ request }) => {
    const res = await request.get(`${API}/stock/banners`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/reports/orders-today returns count', async ({ request }) => {
    const res = await request.get(`${API}/reports/orders-today`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.count).toBe('number');
  });

  test('GET /api/reports/low-stock returns array', async ({ request }) => {
    const res = await request.get(`${API}/reports/low-stock`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/reports/activity returns array', async ({ request }) => {
    const res = await request.get(`${API}/reports/activity`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/settings returns shop settings', async ({ request }) => {
    const res = await request.get(`${API}/settings`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('shop_name');
  });

  test('POST /api/bills with missing fields returns 400', async ({ request }) => {
    const res = await request.post(`${API}/bills`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test('POST /api/reports/log-activity with invalid action returns 400', async ({ request }) => {
    const res = await request.post(`${API}/reports/log-activity`, {
      data: { action_type: 'hacked' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/auth/request-otp without email returns 400', async ({ request }) => {
    const res = await request.post(`${API}/auth/request-otp`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test('POST /api/auth/verify-otp with missing fields returns 400', async ({ request }) => {
    const res = await request.post(`${API}/auth/verify-otp`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test('GET unknown API route returns 404', async ({ request }) => {
    const res = await request.get(`${API}/does-not-exist`);
    expect(res.status()).toBe(404);
  });
});
