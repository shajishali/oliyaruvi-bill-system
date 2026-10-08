import type { LowStockItem } from '../types';

const STORAGE_KEY = 'oliyaruvi_low_stock_read';

function itemKey(item: LowStockItem): string {
  return `${item.type}:${item.id}`;
}

/** Remaining amount the alert is about. A new amount shows the alert again. */
export function lowStockFingerprint(item: LowStockItem): string {
  const feetBased = item.feet_remaining != null || item.type === 'banner' || item.type === 'sticker';
  if (feetBased) {
    const feet = item.feet_remaining ?? item.stock_qty * 150;
    return `ft:${Number(feet).toFixed(0)}`;
  }
  return `qty:${item.stock_qty}`;
}

function readStore(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function isLowStockRead(item: LowStockItem): boolean {
  return readStore()[itemKey(item)] === lowStockFingerprint(item);
}

export function markLowStockRead(items: LowStockItem | LowStockItem[]) {
  const list = Array.isArray(items) ? items : [items];
  const store = readStore();
  for (const item of list) {
    store[itemKey(item)] = lowStockFingerprint(item);
  }
  writeStore(store);
  window.dispatchEvent(new Event('oliyaruvi-low-stock-read'));
}
