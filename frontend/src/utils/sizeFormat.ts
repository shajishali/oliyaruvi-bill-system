/** Normalize size string for display: use x instead of + (e.g. 8+6 → 8x6) */
export function formatSizeDisplay(size: string | undefined | null): string {
  if (!size) return '';
  return String(size).replace(/\+/g, 'x');
}

/** Parse size dimensions - accepts both + and x (e.g. 8+6, 8x6, 5×3) */
export function parseSizeDimensions(size: string | undefined | null): [number, number] {
  if (!size) return [0, 0];
  const parts = String(size).split(/[+x×]/i).map((p) => parseFloat(p.trim()) || 0);
  return [parts[0] || 0, parts[1] || 0];
}

/** Normalize size for saving: use x instead of + */
export function normalizeSizeForSave(size: string | undefined | null): string {
  if (!size) return '';
  return String(size).trim().replace(/\+/g, 'x');
}

/** Extract first number from size (e.g. "6 ft", "6 X 10" → 6). Used for stock lookup. */
export function getFirstNumberFromSize(size: string | undefined | null): number {
  if (!size) return 0;
  const m = String(size).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/** Format size as "number X number" for banner/sticker (width X length). First number = roll width for stock lookup. */
export function formatBannerStickerSize(
  sizeName: string | undefined,
  widthFt?: number,
  qtySqft?: number
): string {
  const w = widthFt ?? (getFirstNumberFromSize(sizeName) || parseSizeDimensions(sizeName || '')[0] || 0);
  if (w <= 0) return formatSizeDisplay(sizeName) || String(sizeName || '');
  if (qtySqft != null && qtySqft > 0) {
    const length = qtySqft / w;
    return `${w} X ${Number.isInteger(length) ? length : Math.round(length * 100) / 100}`;
  }
  return `${w} X ${w}`;
}
