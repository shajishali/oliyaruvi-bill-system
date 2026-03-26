import type { BillableItem } from '../types';
import { dedupeBillableItems, getItemListDisplayLabel } from '../utils/billableDisplay';

/**
 * Exact labels shown in the billing "Item" picker (order preserved).
 * Duplicates in the user's list (e.g. multiple "Duro") are collapsed to one row each.
 */
export const BILLING_ITEM_PLACEHOLDER_LABELS = [
  'IC Print',
  'Passport print',
  'form fill up',
  'Class',
  'Crystle',
  'Duro',
  'black and white print',
  'color',
] as const;

export type BillingPlaceholderLabel = (typeof BILLING_ITEM_PLACEHOLDER_LABELS)[number];

function n(s: string | undefined | null): string {
  return String(s || '')
    .trim()
    .toLowerCase();
}

function firstMatch(rows: BillableItem[], pred: (i: BillableItem) => boolean): BillableItem | undefined {
  return rows.find(pred);
}

/** Map catalog rows to one representative billable row per placeholder (or undefined). */
function resolvePlaceholderLabel(label: BillingPlaceholderLabel, rows: BillableItem[]): BillableItem | undefined {
  const L = n(label);

  if (L === 'ic print') {
    return firstMatch(
      rows,
      (i) =>
        (i.type === 'photocopy' || i.type === 'service_item') &&
        /^ic\s*print$/i.test(String(i.itemLabel || i.name || '').trim())
    );
  }
  if (L === 'passport print') {
    return firstMatch(
      rows,
      (i) =>
        (i.type === 'photocopy' || i.type === 'service_item') &&
        /passport/i.test(String(i.itemLabel || i.name || ''))
    );
  }
  if (L === 'form fill up') {
    return firstMatch(
      rows,
      (i) =>
        i.type === 'service_item' &&
        /form/i.test(String(i.name || '')) &&
        /fill/i.test(String(i.name || ''))
    );
  }

  if (L === 'class') {
    return firstMatch(rows, (i) => i.type === 'frame' && /^class\b/i.test(String(i.itemLabel || '').trim()));
  }
  if (L === 'crystle') {
    return firstMatch(
      rows,
      (i) => i.type === 'frame' && (/\bcrystle\b/i.test(String(i.itemLabel || '')) || /\bcrystal\b/i.test(String(i.itemLabel || '')))
    );
  }
  if (L === 'duro') {
    return firstMatch(rows, (i) => {
      if (i.type !== 'frame') return false;
      const il = String(i.itemLabel || '');
      if (!/\bduro\b/i.test(il)) return false;
      if (/^class\b/i.test(il.trim())) return false;
      if (/\bcrystle\b/i.test(il)) return false;
      return true;
    });
  }

  if (L === 'black and white print') {
    return firstMatch(rows, (i) => {
      if (i.type !== 'photocopy' && i.type !== 'service_item') return false;
      const t = n(i.itemLabel || i.name);
      return (
        (t.includes('black') && t.includes('white')) ||
        /\bb\s*&\s*w\b/i.test(t) ||
        t.includes('black and white')
      );
    });
  }
  if (L === 'color') {
    return firstMatch(
      rows,
      (i) =>
        i.type === 'photocopy' &&
        (n(i.itemLabel || i.sizeName) === 'color' || /^color$/i.test(String(i.itemLabel || '').trim()))
    );
  }

  return undefined;
}

export type BillingPlaceholderOption = {
  key: string;
  /** Item field text — catalog row from Settings / Stock only (no unresolved placeholders). */
  label: string;
  display: string;
  item: BillableItem;
};

/** Normalized set of static placeholder labels (lowercase) — used to skip duplicate service rows. */
const STATIC_LABEL_KEYS = new Set(
  (BILLING_ITEM_PLACEHOLDER_LABELS as readonly string[]).map((l) => n(l))
);

/** Short label for a frame product line from `frameGroupKey` (`subitem|frame_type`, lowercase). */
function frameLineDisplayLabel(r: BillableItem): string {
  const k = String((r as BillableItem).frameGroupKey || '');
  const sep = k.indexOf('\u001f');
  const sub = sep >= 0 ? k.slice(0, sep) : k;
  const ft = sep >= 0 ? k.slice(sep + 1) : '';
  const cap = (s: string) =>
    s ? s.charAt(0).toUpperCase() + (s.length > 1 ? s.slice(1).toLowerCase() : '') : '';
  return cap(sub.trim()) || cap(ft.trim()) || String(r.itemLabel || 'Frame').trim() || 'Frame';
}

/**
 * Item dropdown = **only** rows that exist in Settings + Stock (`/billable-items`).
 * - Static names (Duro, IC Print, …) appear only if they resolve to a catalog row.
 * - No “(manual)” entries; free-typed names are not added to this list.
 * - Also lists: extra Services, banner/sticker materials, frame lines, **custom sections** (stamp, etc.) — deduped by label where noted.
 */
export function buildBillingPlaceholderOptions(billableItems: BillableItem[]): BillingPlaceholderOption[] {
  const rows = dedupeBillableItems(billableItems);
  const seen = new Set<string>();
  const pinned: BillingPlaceholderOption[] = [];

  for (const label of BILLING_ITEM_PLACEHOLDER_LABELS) {
    const item = resolvePlaceholderLabel(label, rows);
    if (!item) continue;
    const nk = n(label);
    if (seen.has(nk)) continue;
    seen.add(nk);
    pinned.push({ key: `ph:${label}`, label, display: label, item });
  }

  const rest: BillingPlaceholderOption[] = [];
  const pushRest = (key: string, label: string, display: string, item: BillableItem) => {
    const nk = n(label);
    if (!nk || seen.has(nk)) return;
    seen.add(nk);
    rest.push({ key, label, display, item });
  };

  const serviceRows = rows.filter((i) => i.type === 'service_item' && String(i.itemLabel || i.name || '').trim());
  for (const i of serviceRows) {
    const lab = String(i.itemLabel || i.name || '').trim();
    if (STATIC_LABEL_KEYS.has(n(lab))) continue;
    const sid = (i as { serviceItemId?: number }).serviceItemId;
    pushRest(`svc:${sid ?? n(lab)}`, lab, lab, i);
  }

  const byBannerMat = new Map<number, BillableItem>();
  for (const r of rows) {
    if (r.type !== 'banner_roll' || r.materialId == null) continue;
    if (!byBannerMat.has(r.materialId)) byBannerMat.set(r.materialId, r);
  }
  for (const r of byBannerMat.values()) {
    const lab = String(r.itemLabel || r.materialName || '').trim();
    if (lab) pushRest(`br:${r.materialId}`, lab, lab, r);
  }

  const byStickerMat = new Map<number, BillableItem>();
  for (const r of rows) {
    if (r.type !== 'sticker_roll' || r.materialId == null) continue;
    if (!byStickerMat.has(r.materialId)) byStickerMat.set(r.materialId, r);
  }
  for (const r of byStickerMat.values()) {
    const lab = String(r.itemLabel || r.materialName || '').trim();
    if (lab) pushRest(`sr:${r.materialId}`, lab, lab, r);
  }

  const byFrameGroup = new Map<string, BillableItem>();
  for (const r of rows) {
    if (r.type !== 'frame') continue;
    const gk = String((r as BillableItem).frameGroupKey || '');
    if (!gk) continue;
    if (!byFrameGroup.has(gk)) byFrameGroup.set(gk, r);
  }
  for (const [gk, r] of byFrameGroup) {
    const lab = frameLineDisplayLabel(r);
    pushRest(`fr:${gk}`, lab, lab, r);
  }

  /** Settings → custom sections (stamp, cloth, …): one picker row per billable `custom` line. */
  for (const r of rows) {
    if (r.type !== 'custom') continue;
    const lab = getItemListDisplayLabel(r).trim();
    if (!lab) continue;
    const nk = n(lab);
    if (seen.has(nk)) continue;
    seen.add(nk);
    const sec = String(r.sectionId ?? '');
    const sid = r.sizeId ?? '';
    rest.push({ key: `cus:${sec}:${sid}`, label: lab, display: lab, item: r });
  }

  rest.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return [...pinned, ...rest];
}
