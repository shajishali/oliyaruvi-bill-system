const API_BASE = (typeof window !== 'undefined' && window.location?.protocol === 'file:')
  ? 'http://localhost:5000/api'
  : '/api';

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
    delete: (id: number) => request<{ success: boolean }>(`/bills/${id}`, { method: 'DELETE' }),
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
    photocopy: () => request<unknown[]>('/stock/photocopy'),
    banners: () => request<unknown[]>('/stock/banners'),
    stickers: () => request<unknown[]>('/stock/stickers'),
    createFrame: (data: { size_name: string; frame_type?: string; subitem_name?: string; stock_qty?: number; unit_price?: number; low_stock_threshold?: number }) =>
      request('/stock/frames', { method: 'POST', body: JSON.stringify(data) }),
    createPhoto: (data: { size_name: string; stock_qty?: number; unit_price?: number; low_stock_threshold?: number }) =>
      request('/stock/photos', { method: 'POST', body: JSON.stringify(data) }),
    createPhotocopy: (data: { size_name: string; stock_qty?: number; unit_price?: number; low_stock_threshold?: number }) =>
      request('/stock/photocopy', { method: 'POST', body: JSON.stringify(data) }),
    createBanner: (data: {
      size_name: string;
      stock_qty?: number;
      low_stock_threshold?: number;
      stock_type?: string;
      print_type?: string;
      unit_price?: number | null;
      price_unit?: 'per_sqft' | 'per_qty';
    }) => request('/stock/banners', { method: 'POST', body: JSON.stringify(data) }),
    createSticker: (data: { size_name: string; stock_qty?: number; low_stock_threshold?: number; stock_type?: string }) =>
      request('/stock/stickers', { method: 'POST', body: JSON.stringify(data) }),
    updateFrame: (id: number, data: unknown) =>
      request(`/stock/frames/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFrame: (id: number) =>
      request(`/stock/frames/${id}`, { method: 'DELETE' }),
    updatePhoto: (id: number, data: unknown) =>
      request(`/stock/photos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePhoto: (id: number) =>
      request(`/stock/photos/${id}`, { method: 'DELETE' }),
    updatePhotocopy: (id: number, data: unknown) =>
      request(`/stock/photocopy/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePhotocopy: (id: number) =>
      request(`/stock/photocopy/${id}`, { method: 'DELETE' }),
    updateBanner: (id: number, data: unknown) =>
      request(`/stock/banners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBanner: (id: number) =>
      request(`/stock/banners/${id}`, { method: 'DELETE' }),
    updateSticker: (id: number, data: unknown) =>
      request(`/stock/stickers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSticker: (id: number) =>
      request(`/stock/stickers/${id}`, { method: 'DELETE' }),
    customItems: () => request<unknown[]>('/stock/custom-items'),
    customSections: () => request<unknown[]>('/stock/custom-sections'),
    createCustomSection: (data: { section_id: string; label: string; section_type: 'count' | 'roll'; affects_sales?: boolean }) =>
      request('/stock/custom-sections', { method: 'POST', body: JSON.stringify(data) }),
    updateCustomSection: (sectionId: string, data: { section_type?: 'count' | 'roll'; affects_sales?: boolean; unit_price?: number }) =>
      request(`/stock/custom-sections/${encodeURIComponent(sectionId)}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCustomSection: (sectionId: string) =>
      request<{ success: boolean }>(`/stock/custom-sections/${encodeURIComponent(sectionId)}`, { method: 'DELETE' }),
    createCustomSectionItem: (sectionId: string, data: { size_name: string; stock_qty?: number; low_stock_threshold?: number; unit_price?: number; item_type?: string }) =>
      request('/stock/custom-items', { method: 'POST', body: JSON.stringify({ section_id: sectionId, ...data }) }),
    updateCustomSectionItem: (id: number, data: unknown) =>
      request(`/stock/custom-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCustomSectionItem: (id: number) =>
      request(`/stock/custom-items/${id}`, { method: 'DELETE' }),
    customSaleItems: (sectionId?: string) =>
      request<unknown[]>(
        `/stock/custom-sale-items${sectionId ? '?section_id=' + encodeURIComponent(sectionId) : ''}`
      ),
    createCustomSaleItem: (data: { section_id: string; item_name: string; item_type?: string; qty_type?: 'per_sqft' | 'per_unit'; unit_price: number; size_name?: string }) =>
      request('/stock/custom-sale-items', { method: 'POST', body: JSON.stringify(data) }),
    updateCustomSaleItem: (id: number, data: { item_name?: string; item_type?: string; qty_type?: 'per_sqft' | 'per_unit'; unit_price?: number; size_name?: string }) =>
      request(`/stock/custom-sale-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCustomSaleItem: (id: number) =>
      request(`/stock/custom-sale-items/${id}`, { method: 'DELETE' }),
    deleteCustomSectionStock: (sectionId: string) =>
      request<{ success: boolean; rows_removed?: number }>(`/stock/custom-section/${encodeURIComponent(sectionId)}`, { method: 'DELETE' }),
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
    logActivity: (action_type: string, details?: Record<string, unknown>) =>
      request<{ success: boolean }>('/reports/log-activity', { method: 'POST', body: JSON.stringify({ action_type, details }) }),
    dailyRevenue: (date?: string) =>
      request<import('../types').DailyRevenueReport>(`/reports/daily-revenue${date ? '?date=' + encodeURIComponent(date) : ''}`),
    finalRevenue: (params: { period: string; date?: string; from?: string; to?: string; month?: string }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, String(v)); });
      return request<import('../types').FinalRevenueReport>('/reports/final-revenue?' + q.toString());
    },
  },
  expenses: {
    list: (params?: { date?: string; from?: string; to?: string }) =>
      request<import('../types').DailyExpense[]>(`/expenses${params && Object.keys(params).length ? '?' + new URLSearchParams(params as Record<string, string>) : ''}`),
    create: (data: { expense_date: string; amount: number; description?: string }) =>
      request<import('../types').DailyExpense>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { amount?: number; description?: string }) =>
      request<import('../types').DailyExpense>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ success: boolean }>(`/expenses/${id}`, { method: 'DELETE' }),
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
    /** Catalog prices for frames (Settings). Stock rows are separate (`/stock/frames`). */
    framePricing: () =>
      request<{ id: number; size_name: string; frame_type: string; subitem_name: string; unit_price: number }[]>('/services/frame-pricing'),
    createFramePricing: (data: { size_name: string; frame_type?: string; subitem_name?: string; unit_price: number }) =>
      request('/services/frame-pricing', { method: 'POST', body: JSON.stringify(data) }),
    updateFramePricing: (
      id: number,
      data: { size_name?: string; frame_type?: string; subitem_name?: string; unit_price?: number }
    ) => request(`/services/frame-pricing/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFramePricing: (id: number) => request(`/services/frame-pricing/${id}`, { method: 'DELETE' }),
    photoSizes: () => request<unknown[]>('/services/photo-sizes'),
    charges: () => request<unknown[]>('/services/charges'),
    billableItems: (q?: string) =>
      request<import('../types').BillableItem[]>(`/services/billable-items${q ? '?q=' + encodeURIComponent(q) : ''}`),
    designBannerSizes: () => request<unknown[]>('/services/design-banner-sizes'),
    designPhotoSizes: () => request<unknown[]>('/services/design-photo-sizes'),
    updateDesignBannerSize: (id: number, data: { unit_price?: number; size_name?: string }) =>
      request(`/services/design-banner-sizes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDesignBannerSize: (id: number) =>
      request(`/services/design-banner-sizes/${id}`, { method: 'DELETE' }),
    updateDesignPhotoSize: (id: number, data: { unit_price?: number; size_name?: string }) =>
      request(`/services/design-photo-sizes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDesignPhotoSize: (id: number) =>
      request(`/services/design-photo-sizes/${id}`, { method: 'DELETE' }),
    serviceItems: () => request<{ id: number; name: string; item_type?: string; qty_type: string; unit_price: number }[]>('/services/service-items'),
    createServiceItem: (data: { name: string; item_type?: string; qty_type?: 'per_unit' | 'per_sqft'; unit_price: number }) =>
      request('/services/service-items', { method: 'POST', body: JSON.stringify(data) }),
    updateServiceItem: (id: number, data: { name?: string; item_type?: string; qty_type?: 'per_unit' | 'per_sqft'; unit_price?: number }) =>
      request(`/services/service-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteServiceItem: (id: number) =>
      request(`/services/service-items/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => request<import('../types').ShopSettings>('/settings'),
    update: (data: Partial<import('../types').ShopSettings>) =>
      request<import('../types').ShopSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  auth: {
    requestOtp: (email: string, appUser?: boolean) =>
      request<{ success: boolean; message?: string; method?: 'resend' | 'gmail' }>('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email, appUser: !!appUser }) }),
    verifyOtp: (email: string, otp: string) =>
      request<{ success: boolean; valid: boolean }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  },
  notifications: {
    list: (unreadOnly?: boolean) =>
      request<import('../types').Notification[]>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
    markRead: (id: number) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  },
};
