const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers } as HeadersInit,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  bills: {
    list: (params?: Record<string, string>) =>
      request<import('../types').Bill[]>(`/bills${params && Object.keys(params).length ? '?' + new URLSearchParams(params as Record<string, string>) : ''}`),
    get: (id: number) => request<import('../types').Bill>(`/bills/${id}`),
    create: (data: { customer_id?: number | null; customer_name: string; items: import('../types').BillItem[]; discount: number; payment_method: string; notes?: string | null; advance_amount?: number }) =>
      request<import('../types').Bill>('/bills', { method: 'POST', body: JSON.stringify(data) }),
    payBalance: (id: number, amount: number, payment_method?: 'Cash' | 'Bank') =>
      request<import('../types').Bill>(`/bills/${id}/pay-balance`, { method: 'PUT', body: JSON.stringify({ amount, payment_method }) }),
  },
  customers: {
    list: () => request<import('../types').Customer[]>('/customers'),
    search: (q: string) => request<import('../types').Customer[]>(`/customers/search?q=${encodeURIComponent(q)}`),
    create: (data: { name: string; phone?: string | null }) =>
      request<import('../types').Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  },
  stock: {
    frames: () => request<unknown[]>('/stock/frames'),
    photos: () => request<unknown[]>('/stock/photos'),
    banners: () => request<unknown[]>('/stock/banners'),
    stickers: () => request<unknown[]>('/stock/stickers'),
    createFrame: (data: { size_name: string; frame_type?: string; stock_qty?: number; unit_price?: number; low_stock_threshold?: number }) =>
      request('/stock/frames', { method: 'POST', body: JSON.stringify(data) }),
    createPhoto: (data: { size_name: string; stock_qty?: number; unit_price?: number; low_stock_threshold?: number }) =>
      request('/stock/photos', { method: 'POST', body: JSON.stringify(data) }),
    createBanner: (data: { size_name: string; stock_qty?: number; low_stock_threshold?: number }) =>
      request('/stock/banners', { method: 'POST', body: JSON.stringify(data) }),
    createSticker: (data: { size_name: string; stock_qty?: number; low_stock_threshold?: number }) =>
      request('/stock/stickers', { method: 'POST', body: JSON.stringify(data) }),
    updateFrame: (id: number, data: unknown) =>
      request(`/stock/frames/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFrame: (id: number) =>
      request(`/stock/frames/${id}`, { method: 'DELETE' }),
    updatePhoto: (id: number, data: unknown) =>
      request(`/stock/photos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePhoto: (id: number) =>
      request(`/stock/photos/${id}`, { method: 'DELETE' }),
    updateBanner: (id: number, data: unknown) =>
      request(`/stock/banners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateSticker: (id: number, data: unknown) =>
      request(`/stock/stickers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    addTransaction: (data: unknown) =>
      request('/stock/transactions', { method: 'POST', body: JSON.stringify(data) }),
    transactions: (params?: Record<string, string>) =>
      request(`/stock/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  },
  reports: {
    revenue: (period: string) => request<import('../types').RevenueReport>(`/reports/revenue?period=${period || 'daily'}`),
    actualReceivedToday: () =>
      request<{ total: number; byCash: number; byBank: number; date: string }>('/reports/actual-received-today'),
    revenueTrend: (days: number) =>
      request<import('../types').RevenueTrendPoint[]>(`/reports/revenue-trend?days=${days || 7}`),
    topServices: (limit: number) =>
      request<import('../types').TopService[]>(`/reports/top-services?limit=${limit || 10}`),
    ordersToday: () => request<{ count: number }>('/reports/orders-today'),
    lowStock: () => request<import('../types').LowStockItem[]>('/reports/low-stock'),
    activity: (params?: { date?: string; from?: string; to?: string }) =>
      request<import('../types').ActivityLogEntry[]>(`/reports/activity${params && Object.keys(params).length ? '?' + new URLSearchParams(params as Record<string, string>) : ''}`),
  },
  services: {
    bannerMaterials: (admin?: boolean) =>
      request<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string; is_active: number }[]>(
        `/services/banner-materials${admin ? '?admin=1' : ''}`
      ),
    createBannerMaterial: (data: { material_name: string; price_per_sqft: number; pricing_type?: 'per_sqft' | 'per_qty' }) =>
      request<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string }>('/services/banner-materials', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateBannerMaterial: (id: number, data: { material_name?: string; price_per_sqft?: number; pricing_type?: 'per_sqft' | 'per_qty' }) =>
      request(`/services/banner-materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBannerMaterial: (id: number) =>
      request(`/services/banner-materials/${id}`, { method: 'DELETE' }),
    stickerMaterials: (admin?: boolean) =>
      request<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string; is_active: number }[]>(
        `/services/sticker-materials${admin ? '?admin=1' : ''}`
      ),
    createStickerMaterial: (data: { material_name: string; price_per_sqft: number; pricing_type?: 'per_sqft' | 'per_qty' }) =>
      request<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string }>('/services/sticker-materials', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStickerMaterial: (id: number, data: { material_name?: string; price_per_sqft?: number; pricing_type?: 'per_sqft' | 'per_qty' }) =>
      request(`/services/sticker-materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteStickerMaterial: (id: number) =>
      request(`/services/sticker-materials/${id}`, { method: 'DELETE' }),
    bannerSizes: (materialId?: number) =>
      request<{ id: number; material_id: number; size_name: string; width_ft: number; height_ft: number; material_name: string; price_per_sqft: number }[]>(
        materialId ? `/services/banner-sizes?material_id=${materialId}` : '/services/banner-sizes'
      ),
    createBannerSize: (data: { material_id: number; size_name: string; width_ft: number; height_ft: number }) =>
      request('/services/banner-sizes', { method: 'POST', body: JSON.stringify(data) }),
    deleteBannerSize: (id: number) => request(`/services/banner-sizes/${id}`, { method: 'DELETE' }),
    frameSizes: () => request<unknown[]>('/services/frame-sizes'),
    photoSizes: () => request<unknown[]>('/services/photo-sizes'),
    charges: () => request<unknown[]>('/services/charges'),
    billableItems: (q?: string) =>
      request<import('../types').BillableItem[]>(`/services/billable-items${q ? '?q=' + encodeURIComponent(q) : ''}`),
    designBannerSizes: () => request<unknown[]>('/services/design-banner-sizes'),
    designPhotoSizes: () => request<unknown[]>('/services/design-photo-sizes'),
    updateDesignBannerSize: (id: number, data: unknown) =>
      request(`/services/design-banner-sizes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDesignBannerSize: (id: number) =>
      request(`/services/design-banner-sizes/${id}`, { method: 'DELETE' }),
    updateDesignPhotoSize: (id: number, data: unknown) =>
      request(`/services/design-photo-sizes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDesignPhotoSize: (id: number) =>
      request(`/services/design-photo-sizes/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => request<import('../types').ShopSettings>('/settings'),
    update: (data: Partial<import('../types').ShopSettings>) =>
      request<import('../types').ShopSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  auth: {
    requestOtp: (email: string) =>
      request<{ success: boolean; message?: string; method?: 'resend' | 'gmail' }>('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email }) }),
    verifyOtp: (email: string, otp: string) =>
      request<{ success: boolean; valid: boolean }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  },
  notifications: {
    list: (unreadOnly?: boolean) =>
      request<import('../types').Notification[]>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
    markRead: (id: number) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  },
};
