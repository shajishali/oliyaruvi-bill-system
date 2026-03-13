const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),
  bills: {
    list: (params) => request(`/bills${params ? '?' + new URLSearchParams(params) : ''}`),
    get: (id) => request(`/bills/${id}`),
    create: (data) => request('/bills', { method: 'POST', body: JSON.stringify(data) }),
  },
  customers: {
    list: () => request('/customers'),
    search: (q) => request(`/customers/search?q=${encodeURIComponent(q)}`),
    create: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  },
  stock: {
    frames: () => request('/stock/frames'),
    photos: () => request('/stock/photos'),
    updateFrame: (id, data) => request(`/stock/frames/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updatePhoto: (id, data) => request(`/stock/photos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    addTransaction: (data) => request('/stock/transactions', { method: 'POST', body: JSON.stringify(data) }),
    transactions: (params) => request(`/stock/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  },
  reports: {
    revenue: (period) => request(`/reports/revenue?period=${period || 'daily'}`),
    revenueTrend: (days) => request(`/reports/revenue-trend?days=${days || 7}`),
    topServices: (limit) => request(`/reports/top-services?limit=${limit || 10}`),
    ordersToday: () => request('/reports/orders-today'),
    lowStock: () => request('/reports/low-stock'),
  },
  services: {
    bannerMaterials: () => request('/services/banner-materials'),
    updateBannerMaterial: (id, data) => request(`/services/banner-materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    frameSizes: () => request('/services/frame-sizes'),
    photoSizes: () => request('/services/photo-sizes'),
    charges: () => request('/services/charges'),
    billableItems: (q) => request(`/services/billable-items${q ? '?q=' + encodeURIComponent(q) : ''}`),
    designBannerSizes: () => request('/services/design-banner-sizes'),
    designPhotoSizes: () => request('/services/design-photo-sizes'),
    updateDesignBannerSize: (id, data) => request(`/services/design-banner-sizes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateDesignPhotoSize: (id, data) => request(`/services/design-photo-sizes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  settings: () => request('/settings'),
  notifications: {
    list: (unreadOnly) => request(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
    markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  },
};
