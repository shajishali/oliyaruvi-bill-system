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
  customer_phone?: string | null;
  total: number;
  discount: number;
  amount_paid?: number;
  payment_method: string;
  notes: string | null;
  counter_staff_name?: string | null;
  counter_shift_id?: number | null;
  items?: BillItem[];
  payment_transactions?: PaymentTransaction[];
}

export interface CounterStaff {
  id: number;
  name: string;
}

export interface CounterBill {
  id: number;
  bill_number: string;
  customer_name: string;
  total: number;
  created_at: string;
}

export interface CounterShift {
  id: number;
  staff_id: number;
  staff_name: string;
  started_at: string;
  ended_at: string | null;
  work_date: string;
  bills?: CounterBill[];
}

export interface CounterDay {
  date: string;
  today: string;
  staff: CounterStaff[];
  active: CounterShift | null;
  shifts: CounterShift[];
}

export interface BillItem {
  id?: number;
  service_type?: string;
  item_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  item_discount?: number;
  subtotal: number;
  metadata?: string | Record<string, unknown> | null;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
}

export interface BillableItem {
  type: string;
  name: string;
  groupLabel?: string;
  itemTypeLabel?: string;
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
  /** Settings price row: studio (ST) or local customer. */
  priceAudience?: 'st' | 'local';
}

export interface ShopSettings {
  shop_name: string;
  branch_name?: string;
  address: string;
  contact: string;
  gstin?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_password?: string;
  report_receiver_email?: string;
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

export interface ShopBranch {
  id: number;
  name: string;
  place: string;
  phone: string;
  created_at?: string;
}

export interface BranchTransfer {
  id: number;
  direction: 'send' | 'receive';
  branch_id: number | null;
  branch_name: string;
  item_type: string;
  item_id: number | null;
  item_label: string;
  quantity: number;
  adjust_stock: number;
  stock_adjusted: number;
  note: string;
  created_at: string;
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

export interface SalaryPerson {
  id: number;
  name: string;
}

export interface SalaryPayment {
  id: number;
  person_id: number;
  person_name: string;
  pay_kind: 'monthly' | 'project';
  pay_month: string | null;
  project_name: string | null;
  started_on: string | null;
  ended_on: string | null;
  paid_on: string;
  amount: number;
  notes: string | null;
}

export interface SalarySummaryRow {
  person_id: number;
  person_name: string;
  monthly: number;
  project: number;
  total: number;
}

export interface SalaryMonth {
  month: string;
  people: SalaryPerson[];
  payments: SalaryPayment[];
  summary: SalarySummaryRow[];
  monthlyTotal: number;
  projectTotal: number;
  total: number;
}

export interface DailyExpense {
  id: number;
  expense_date: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface DayBookPayment {
  bill_number: string;
  bill_date: string;
  customer_name: string;
  customer_phone?: string | null;
  amount: number;
  payment_method: 'Cash' | 'Bank' | string;
  payment_type: string;
  paid_at: string;
  reason: string;
}

export interface DayBookOrder {
  id: number;
  bill_number: string;
  bill_date: string;
  customer_name: string;
  customer_phone?: string | null;
  total: number;
  pending: number;
  notes?: string | null;
  cash: number;
  bank: number;
  items: { item_name: string; size?: string | null; quantity: number; unit_price: number; subtotal: number }[];
  laterPayments: DayBookPayment[];
}

export interface DayBookDay {
  date: string;
  orderCount: number;
  orderTotal: number;
  pending: number;
  cash: number;
  bank: number;
  expenses: number;
  collected: number;
  moneyBox: number;
}

export interface DayBookReport {
  date: string;
  orderCount: number;
  orderTotal: number;
  pending: number;
  cash: number;
  bank: number;
  collected: number;
  expenseTotal: number;
  moneyBox: number;
  orders: DayBookOrder[];
  received: DayBookPayment[];
  expenses: { id: number; expense_date: string; amount: number; description: string | null }[];
  days: DayBookDay[];
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
