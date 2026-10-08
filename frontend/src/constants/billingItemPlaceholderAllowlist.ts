import type { BillableItem } from '../types';
import { billableRowKey, dedupeBillableItems, getItemListDisplayLabel } from '../utils/billableDisplay';

function normalizeLabel(s: string | undefined | null): string {
  return String(s || '').trim();
}

function normalizeKey(s: string | undefined | null): string {
  return normalizeLabel(s).toLowerCase();
}

function frameLineDisplayLabel(r: BillableItem): string {
  const k = String(r.frameGroupKey || '');
  const sep = k.indexOf('\u001f');
  const sub = sep >= 0 ? k.slice(0, sep) : k;
  const ft = sep >= 0 ? k.slice(sep + 1) : '';
  const cap = (s: string) =>
    s ? s.charAt(0).toUpperCase() + (s.length > 1 ? s.slice(1).toLowerCase() : '') : '';
  return cap(sub.trim()) || cap(ft.trim()) || normalizeLabel(r.itemLabel) || 'Frame';
}

function groupForItem(i: BillableItem): string {
  const explicit = normalizeLabel(i.groupLabel || i.itemTypeLabel);
  if (explicit) return explicit;
  switch (i.type) {
    case 'banner':
    case 'banner_roll':
      return 'Banner';
    case 'sticker_roll':
      return 'Sticker';
    case 'frame':
      return 'Frames';
    case 'service':
    case 'service_item':
      return 'Services (no stock)';
    case 'designforBanner':
      return 'Design for Banner';
    case 'designforPhoto':
      return 'Design for Photo';
    case 'photocopy':
      return 'Photocopy';
    case 'custom':
      return normalizeLabel(i.name) || 'Custom';
    default:
      return 'Other';
  }
}

function labelForItem(i: BillableItem): string {
  if (i.type === 'frame') return frameLineDisplayLabel(i);
  return getItemListDisplayLabel(i).trim() || normalizeLabel(i.itemLabel || i.name);
}

export type BillingPlaceholderOption = {
  key: string;
  label: string;
  display: string;
  groupLabel: string;
  item: BillableItem;
};

export function buildBillingPlaceholderOptions(billableItems: BillableItem[]): BillingPlaceholderOption[] {
  const rows = dedupeBillableItems(billableItems);
  const seen = new Set<string>();
  const options: BillingPlaceholderOption[] = [];

  for (const item of rows) {
    const label = labelForItem(item);
    if (!label) continue;
    const groupLabel = groupForItem(item);
    const dedupeKey = `${normalizeKey(groupLabel)}\u001f${normalizeKey(label)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    options.push({
      key: `catalog:${billableRowKey(item)}`,
      label,
      display: label,
      groupLabel,
      item,
    });
  }

  return options.sort((a, b) => {
    const byGroup = a.groupLabel.localeCompare(b.groupLabel, undefined, { sensitivity: 'base' });
    if (byGroup !== 0) return byGroup;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });
}
