import type { BillableItem } from '../types';

/** Stable unique key per catalog row (dedupe duplicate API rows). */
export function billableRowKey(i: BillableItem): string {
  return [
    i.type,
    i.name,
    i.materialId ?? '',
    i.sizeId,
    i.bannerStockId ?? '',
    i.stickerStockId ?? '',
    i.stockTypeLabel ?? '',
    i.printTypeLabel ?? '',
    i.calcType ?? '',
    (i as { frameGroupKey?: string }).frameGroupKey ?? '',
    i.priceAudience ?? '',
    i.itemLabel ?? '',
    (i as { sectionId?: string }).sectionId ?? '',
    (i as { serviceItemId?: number }).serviceItemId ?? '',
  ].join('\u001f');
}

/**
 * Label for the billing "Item" picker: distinguishes sub-types (frame pricing rows, photocopy sizes,
 * banner/sticker roll physical types) without repeating the same generic name.
 */
export function getItemListDisplayLabel(i: BillableItem): string {
  const name = String(i.name || '').trim();
  const il = String(i.itemLabel || '').trim();
  const st = String(i.stockTypeLabel || '').trim();

  if (i.type === 'frame') {
    return il || name;
  }
  if (i.type === 'photocopy') {
    return il || name;
  }
  if (i.type === 'banner_roll' || i.type === 'sticker_roll') {
    const pt = String(i.printTypeLabel || '').trim();
    if (st && pt) return `${name} (${st}) · ${pt}`;
    if (st) return `${name} (${st})`;
    if (pt) return `${name} · ${pt}`;
    return name;
  }
  if (i.type === 'custom') {
    return il || name;
  }
  if (i.type === 'service_item') {
    return name;
  }
  if (i.type === 'service') {
    return name;
  }
  if (il && il !== name && !il.toLowerCase().startsWith(name.toLowerCase())) {
    return `${name} · ${il}`;
  }
  return il || name;
}

export function dedupeBillableItems(rows: BillableItem[]): BillableItem[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = billableRowKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Rows that share the same "product" for the Size / roll-width picker (second column).
 * e.g. all banner_roll rows for one material + physical stock type; one row for a single frame price.
 */
export function sameProductGroupForSizePicker(selected: BillableItem, row: BillableItem): boolean {
  if (selected.type !== row.type) return false;
  switch (row.type) {
    case 'banner_roll':
      return (
        String(selected.materialName || selected.itemLabel || '') === String(row.materialName || row.itemLabel || '') &&
        String(selected.calcType || '') === String(row.calcType || '')
      );
    case 'sticker_roll':
      return (
        String(selected.materialName || '') === String(row.materialName || '') &&
        String(selected.stockTypeLabel || '') === String(row.stockTypeLabel || '')
      );
    case 'banner':
      return selected.name === row.name && selected.materialId === row.materialId;
    case 'service':
      return selected.name === row.name && selected.materialId === row.materialId;
    case 'service_item':
      return selected.name === row.name && String(selected.groupLabel || '') === String(row.groupLabel || '');
    case 'frame':
      return (
        String((selected as { frameGroupKey?: string }).frameGroupKey || '') ===
        String((row as { frameGroupKey?: string }).frameGroupKey || '')
      );
    case 'designforBanner':
    case 'designforPhoto':
      return selected.name === row.name;
    case 'custom': {
      const s = selected as BillableItem & { sectionId?: string };
      const r = row as BillableItem & { sectionId?: string };
      if (s.sectionId !== r.sectionId) return false;
      if (selected.calcType === 'sqft_direct' && row.calcType === 'sqft_direct') {
        return selected.name === row.name;
      }
      return billableRowKey(selected) === billableRowKey(row);
    }
    default:
      return billableRowKey(selected) === billableRowKey(row);
  }
}
