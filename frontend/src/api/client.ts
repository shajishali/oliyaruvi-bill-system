const API_BASE = (typeof window !== 'undefined' && window.location?.protocol === 'file:')
  ? `http://127.0.0.1:${new URLSearchParams(window.location.search).get('apiPort')}/api`
  : '/api';

export function shopLogoUrl(version?: string | number) {
  const v = version ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('shop-logo-v') || '0' : '0');
  return `${API_BASE}/settings/logo?v=${encodeURIComponent(String(v))}`;
}

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
    create: (data: { customer_id?: number | null; customer_name: string; customer_phone?: string | null; items: import('../types').BillItem[]; discount: number; payment_method: string; notes?: string | null; advance_amount?: number }) =>
      request<import('../types').Bill>('/bills', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { customer_id?: number | null; customer_name: string; customer_phone?: string | null; items: import('../types').BillItem[]; discount?: number; payment_method: string; notes?: string | null }) =>
      request<import('../types').Bill>(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    payBalance: (id: number, amount: number, payment_method?: 'Cash' | 'Bank') =>
      request<import('../types').Bill>(`/bills/${id}/pay-balance`, { method: 'PUT', body: JSON.stringify({ amount, payment_method }) }),
  },
  customers: {
    list: () => request<import('../types').Customer[]>('/customers'),
    search: (q: string) => request<import('../types').Customer[]>(`/customers/search?q=${encodeURIComponent(q)}`),
    create: (data: { name: string; phone?: string | null }) =>
      request<import('../types').Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; phone?: string | null }) =>
      request<import('../types').Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  counter: {
    day: (date?: string) =>
      request<import('../types').CounterDay>(`/counter${date ? `?date=${encodeURIComponent(date)}` : ''}`),
    addStaff: (name: string) =>
      request<import('../types').CounterStaff>('/counter/staff', { method: 'POST', body: JSON.stringify({ name }) }),
    removeStaff: (id: number) =>
      request<{ success: boolean }>(`/counter/staff/${id}`, { method: 'DELETE' }),
    start: (staffId: number) =>
      request<{ active: import('../types').CounterShift }>('/counter/start', { method: 'POST', body: JSON.stringify({ staff_id: staffId }) }),
    end: () =>
      request<{ active: null }>('/counter/end', { method: 'POST', body: JSON.stringify({}) }),
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
    createCustomSaleItem: (data: { section_id: string; item_name: string; item_type?: string; qty_type?: 'per_sqft' | 'per_unit'; unit_price: number; size_name?: string; price_audience?: 'st' | 'local' }) =>
      request('/stock/custom-sale-items', { method: 'POST', body: JSON.stringify(data) }),
    updateCustomSaleItem: (id: number, data: { item_name?: string; item_type?: string; qty_type?: 'per_sqft' | 'per_unit'; unit_price?: number; size_name?: string; price_audience?: 'st' | 'local' }) =>
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
    activity: (params?: { date?: string; from?: string; to?: string; limit?: string }) =>
      request<import('../types').ActivityLogEntry[]>(`/reports/activity${params && Object.keys(params).length ? '?' + new URLSearchParams(params as Record<string, string>) : ''}`),
    logActivity: (action_type: string, details?: Record<string, unknown>) =>
      request<{ success: boolean }>('/reports/log-activity', { method: 'POST', body: JSON.stringify({ action_type, details }) }),
    dayBook: (date?: string) =>
      request<import('../types').DayBookReport>(`/reports/day-book${date ? '?date=' + encodeURIComponent(date) : ''}`),
    dailyRevenue: (date?: string) =>
      request<import('../types').DailyRevenueReport>(`/reports/daily-revenue${date ? '?date=' + encodeURIComponent(date) : ''}`),
    finalRevenue: (params: { period: string; date?: string; from?: string; to?: string; month?: string }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, String(v)); });
      return request<import('../types').FinalRevenueReport>('/reports/final-revenue?' + q.toString());
    },
  },
  salary: {
    month: (month?: string) =>
      request<import('../types').SalaryMonth>(`/salary${month ? '?month=' + encodeURIComponent(month) : ''}`),
    addPerson: (name: string) =>
      request<import('../types').SalaryPerson>('/salary/people', { method: 'POST', body: JSON.stringify({ name }) }),
    removePerson: (id: number) =>
      request<{ success: boolean }>(`/salary/people/${id}`, { method: 'DELETE' }),
    addPayment: (data: {
      person_id: number;
      pay_kind: 'monthly' | 'project';
      pay_month?: string;
      project_name?: string;
      started_on?: string;
      ended_on?: string;
      paid_on: string;
      amount: number;
      notes?: string;
    }) => request<import('../types').SalaryPayment>('/salary/payments', { method: 'POST', body: JSON.stringify(data) }),
    deletePayment: (id: number) =>
      request<{ success: boolean }>(`/salary/payments/${id}`, { method: 'DELETE' }),
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
      request<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string; is_active: number; price_audience?: string }[]>(
        `/services/banner-materials${admin ? '?admin=1' : ''}`
      ),
    createBannerMaterial: (data: { material_name: string; price_per_sqft: number; pricing_type?: 'per_sqft' | 'per_qty'; price_audience?: 'st' | 'local' }) =>
      request<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string }>('/services/banner-materials', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateBannerMaterial: (id: number, data: { material_name?: string; price_per_sqft?: number; pricing_type?: 'per_sqft' | 'per_qty'; price_audience?: 'st' | 'local' }) =>
      request(`/services/banner-materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBannerMaterial: (id: number) =>
      request(`/services/banner-materials/${id}`, { method: 'DELETE' }),
    stickerMaterials: (admin?: boolean) =>
      request<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string; is_active: number; price_audience?: string }[]>(
        `/services/sticker-materials${admin ? '?admin=1' : ''}`
      ),
    createStickerMaterial: (data: { material_name: string; price_per_sqft: number; pricing_type?: 'per_sqft' | 'per_qty'; price_audience?: 'st' | 'local' }) =>
      request<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string }>('/services/sticker-materials', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStickerMaterial: (id: number, data: { material_name?: string; price_per_sqft?: number; pricing_type?: 'per_sqft' | 'per_qty'; price_audience?: 'st' | 'local' }) =>
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
      request<{ id: number; size_name: string; frame_type: string; subitem_name: string; unit_price: number; price_audience?: string }[]>('/services/frame-pricing'),
    createFramePricing: (data: { size_name: string; frame_type?: string; subitem_name?: string; unit_price: number; price_audience?: 'st' | 'local' }) =>
      request('/services/frame-pricing', { method: 'POST', body: JSON.stringify(data) }),
    updateFramePricing: (
      id: number,
      data: { size_name?: string; frame_type?: string; subitem_name?: string; unit_price?: number; price_audience?: 'st' | 'local' }
    ) => request(`/services/frame-pricing/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFramePricing: (id: number) => request(`/services/frame-pricing/${id}`, { method: 'DELETE' }),
    photoSizes: () => request<unknown[]>('/services/photo-sizes'),
    charges: () => request<unknown[]>('/services/charges'),
    billableItems: (q?: string) =>
      request<import('../types').BillableItem[]>(`/services/billable-items${q ? '?q=' + encodeURIComponent(q) : ''}`),
    designBannerSizes: () => request<unknown[]>('/services/design-banner-sizes'),
    designPhotoSizes: () => request<unknown[]>('/services/design-photo-sizes'),
    updateDesignBannerSize: (id: number, data: { unit_price?: number; size_name?: string; price_audience?: 'st' | 'local' }) =>
      request(`/services/design-banner-sizes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDesignBannerSize: (id: number) =>
      request(`/services/design-banner-sizes/${id}`, { method: 'DELETE' }),
    updateDesignPhotoSize: (id: number, data: { unit_price?: number; size_name?: string; price_audience?: 'st' | 'local' }) =>
      request(`/services/design-photo-sizes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDesignPhotoSize: (id: number) =>
      request(`/services/design-photo-sizes/${id}`, { method: 'DELETE' }),
    serviceItems: () => request<{ id: number; name: string; item_type?: string; qty_type: string; unit_price: number; price_audience?: string }[]>('/services/service-items'),
    createServiceItem: (data: { name: string; item_type?: string; qty_type?: 'per_unit' | 'per_sqft'; unit_price: number; price_audience?: 'st' | 'local' }) =>
      request('/services/service-items', { method: 'POST', body: JSON.stringify(data) }),
    updateServiceItem: (id: number, data: { name?: string; item_type?: string; qty_type?: 'per_unit' | 'per_sqft'; unit_price?: number; price_audience?: 'st' | 'local' }) =>
      request(`/services/service-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteServiceItem: (id: number) =>
      request(`/services/service-items/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => request<import('../types').ShopSettings>('/settings'),
    update: (data: Partial<import('../types').ShopSettings>) =>
      request<import('../types').ShopSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    setBranchName: (branch_name: string) =>
      request<import('../types').ShopSettings>('/settings/branch-name', { method: 'PUT', body: JSON.stringify({ branch_name }) }),
    sendReport: (data: {
      smtp_host?: string;
      smtp_port?: string;
      smtp_user?: string;
      smtp_password?: string;
      report_receiver_email?: string;
      pdf_base64: string;
      from?: string;
      to?: string;
    }) => request<{ ok: boolean; message: string }>('/settings/send-report', { method: 'POST', body: JSON.stringify(data) }),
    uploadLogo: (file: File) =>
      new Promise<{ ok: boolean }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the image.'));
        reader.onload = () => {
          const result = String(reader.result || '');
          const data = result.includes(',') ? result.split(',')[1] : result;
          fetch(`${API_BASE}/settings/logo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mime: file.type, data }),
          })
            .then(async (res) => {
              const body = await res.json().catch(() => ({}));
              if (!res.ok) reject(new Error((body as { error?: string }).error || 'Could not save the logo.'));
              else resolve(body as { ok: boolean });
            })
            .catch((err) => reject(err instanceof Error ? err : new Error('Could not save the logo.')));
        };
        reader.readAsDataURL(file);
      }),
  },
  auth: {
    requestOtp: (email: string, appUser?: boolean) =>
      request<{ success: boolean; message?: string; method?: 'resend' | 'gmail' }>('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email, appUser: !!appUser }) }),
    verifyOtp: (email: string, otp: string) =>
      request<{ success: boolean; valid: boolean }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  },
  branches: {
    list: () => request<import('../types').ShopBranch[]>('/branches'),
    create: (data: { name: string; place?: string; phone?: string }) =>
      request<import('../types').ShopBranch>('/branches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string; place?: string; phone?: string }) =>
      request<import('../types').ShopBranch>(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<{ deleted: boolean }>(`/branches/${id}`, { method: 'DELETE' }),
    transfers: () => request<import('../types').BranchTransfer[]>('/branches/transfers'),
    transfer: (data: {
      direction: 'send' | 'receive';
      branch_id: number;
      item_type?: string;
      item_id?: number | null;
      frame_pricing_id?: number | null;
      item_label: string;
      quantity: number;
      adjust_stock: boolean;
      note?: string;
    }) => request<{ transfer: import('../types').BranchTransfer; stock_adjusted: boolean; message: string }>('/branches/transfers', { method: 'POST', body: JSON.stringify(data) }),
    updateTransfer: (id: number, data: {
      branch_id: number;
      item_label: string;
      quantity: number;
      note?: string;
      adjust_stock: boolean;
      item_type?: string;
      item_id?: number | null;
    }) => request<{ transfer: import('../types').BranchTransfer; message: string }>(`/branches/transfers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    undoTransfer: (id: number) => request<{ deleted: boolean; message: string }>(`/branches/transfers/${id}`, { method: 'DELETE' }),
  },
  notifications: {
    list: (unreadOnly?: boolean) =>
      request<import('../types').Notification[]>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
    markRead: (id: number) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  },
};
