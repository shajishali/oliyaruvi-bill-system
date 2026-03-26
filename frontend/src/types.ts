export interface PaymentTransaction {
  amount: number;
  paid_at: string;
  payment_method: string;
  payment_type: 'advance' | 'balance';
}

export interface Bill {
  id: number;
  bill_number: string;
  bill_date: string;
  customer_id: number | null;
  customer_name: string;
  total: number;
  discount: number;
  amount_paid?: number;
  payment_method: string;
  notes: string | null;
  items?: BillItem[];
  payment_transactions?: PaymentTransaction[];
}

export interface BillItem {
  item_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  subtotal: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
}

export interface BillableItem {
  type: string;
  name: string;
  /** Primary product/subitem label for the bill "Item" column (material, service, stamp, etc.) */
  itemLabel?: string;
  sizeName: string;
  sizeId: number;
  materialId?: number;
  materialName?: string;
  widthFt?: number;
  heightFt?: number;
  pricePerSqft?: number;
  unitPrice?: number;
  calcType: 'sqft' | 'sqft_direct' | 'fixed';
  frameId?: number;
  /** Settings frame line: group rows (Class / Crystle / Duro…) for size picker */
  frameGroupKey?: string;
  photoId?: number;
  photocopyId?: number;
  stockQty?: number;
  /** Physical stock row (banner/sticker roll) — distinct when same width, different type */
  bannerStockId?: number;
  stickerStockId?: number;
  stockTypeLabel?: string;
  /** Banner roll: print type from stock (e.g. normal, quality) — separate from physical stock_type */
  printTypeLabel?: string;
  feetRemaining?: number;
  /** Custom section billing row */
  sectionId?: string;
  customItemId?: number | null;
  serviceItemId?: number;
}

export interface ShopSettings {
  shop_name: string;
  address: string;
  contact: string;
  gstin?: string;
}

export interface RevenueReport {
  revenue: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
}

export interface TopService {
  item_name: string;
  service_type: string;
  total_revenue: number;
}

export interface LowStockItem {
  id: number;
  name: string;
  type: string;
  stock_qty: number;
  feet_remaining?: number;
}

export interface Notification {
  id: number;
  title: string;
  message?: string;
}

export interface ActivityLogEntry {
  id: number;
  action_type: string;
  entity_type: string | null;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface DailyExpense {
  id: number;
  expense_date: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface DailyRevenueReport {
  date: string;
  income: number;
  outcome: number;
  finalRevenue: number;
}

export interface FinalRevenueReport {
  period: 'daily' | 'weekly' | 'monthly';
  from: string;
  to: string;
  date?: string;
  month?: string;
  income: number;
  outcome: number;
  finalRevenue: number;
}
