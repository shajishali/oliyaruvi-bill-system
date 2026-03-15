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
  photoId?: number;
  stockQty?: number;
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
