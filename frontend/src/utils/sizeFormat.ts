/** Show a size as it was saved, including a plus such as 10+15. */
export function formatSizeDisplay(size: string | undefined | null): string {
  if (!size) return '';
  let s = String(size);

  // Some catalog entries store a full label like "plastic momento 10 inches".
  // For bill printing we want to show only the measurement part: "10 inches".
  // We only apply this trimming when the string contains inch/feet markers to avoid
  // breaking values like "A4" or "8x6".
  if (/\b(inches?|ft|feet)\b/i.test(s) && /\d+(?:\.\d+)?/.test(s)) {
    const m = s.match(/(\d+(?:\.\d+)?[\s\S]*)/);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ');
  }

  // Some catalog entries store both name + dimension in the same field (e.g. "round 34X65").
  // For the Size column we want only the "34X65" part.
  const xDim = s.match(/(\d+(?:\.\d+)?\s*[xX×+]\s*\d+(?:\.\d+)?)/);
  if (xDim?.[1]) {
    return xDim[1].trim().replace(/\s*([xX×+])\s*/g, '$1');
  }

  return s;
}

/** Parse size dimensions - accepts both + and x (e.g. 8+6, 8x6, 5×3) */
export function parseSizeDimensions(size: string | undefined | null): [number, number] {
  if (!size) return [0, 0];
  const parts = String(size).split(/[+x×]/i).map((p) => parseFloat(p.trim()) || 0);
  return [parts[0] || 0, parts[1] || 0];
}

/** Keep the size text as typed, including 10+15. Drop wrapping quotes only. */
export function normalizeSizeForSave(size: string | undefined | null): string {
  if (!size) return '';
  let s = String(size).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Match backend `normalizeRollWidth`: store bare width number (e.g. "6 feet" → "6"). */
export function normalizeRollWidthForSave(raw: string | undefined | null): string {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s*feet?\s*/gi, '')
    .replace(/\s*ft\s*/gi, '')
    .trim();
  const n = parseFloat(s);
  return isNaN(n) ? s : String(n);
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
