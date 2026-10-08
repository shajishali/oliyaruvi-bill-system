import { useState, useEffect } from 'react';
import { formatSizeDisplay, getFirstNumberFromSize, normalizeRollWidthForSave } from '../../utils/sizeFormat';
import { requestAdminPermission } from '../admin/AdminPermission';

/** Display a roll width: always shows "N ft" (strips any existing "feet"/"ft" suffix first). */
function formatRollWidth(size: string | undefined | null): string {
  const s = String(size || '').trim().replace(/\s*feet?\s*/gi, '').replace(/\s*ft\s*/gi, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? (s || '-') : `${n} ft`;
}

interface StockItem {
  id: number;
  size_name?: string;
  material_name?: string;
  frame_type?: string;
  subitem_name?: string;
  /** Custom section stock: optional label (e.g. stamp type) */
  item_type?: string;
  /** Banner / sticker roll: optional label (e.g. vinyl, flex) */
  stock_type?: string;
  /** Banner roll: print type (e.g. normal, quality) */
  print_type?: string;
  stock_qty?: number;
  feet_remaining?: number;
  low_stock_threshold?: number;
  updated_at?: string;
  /** Banner stock: optional billing override (null/empty = use material price in Settings) */
  unit_price?: number | null;
  price_unit?: string;
}

type RollRowSavePayload = {
  size_name: string;
  stock_qty: number;
  feet_remaining: number;
  low_stock_threshold: number;
  stock_type: string;
  /** Banner tab only — always sent when saving a banner roll row */
  print_type?: string;
  unit_price?: number | null;
  price_unit?: 'per_sqft' | 'per_qty';
};

interface StockTableProps {
  items: StockItem[];
  itemType: 'frame' | 'photo' | 'photocopy' | 'custom' | 'banner' | 'sticker';
  /** Custom section with roll stock: same columns as banner (roll width, sqft, feet low-stock). */
  customRollMode?: boolean;
  /** Opens stock adjust modal (frames, photos, etc.). Not used for banner/sticker when `onSaveRollRow` is set. */
  onEdit?: (item: StockItem) => void;
  onRemove?: (item: StockItem) => void;
  isLowStock: (item: StockItem, itemType?: string) => boolean;
  /** Banner / sticker: inline edit row → PUT stock row */
  onSaveRollRow?: (id: number, data: RollRowSavePayload) => Promise<void>;
}

function getSqftAvailable(item: StockItem, isRollLike: boolean): number {
  if (!isRollLike) return 0;
  const width = getFirstNumberFromSize(item.size_name ?? item.material_name) || 6;
  const feet = (item as { feet_remaining?: number }).feet_remaining ?? (item.stock_qty ?? 0) * 150;
  return width * feet;
}

function typeColumnLabel(item: StockItem, itemType: StockTableProps['itemType']): string {
  if (itemType === 'banner' || itemType === 'sticker') {
    const t = String(item.stock_type || '').trim();
    return t || '—';
  }
  if (itemType === 'frame') {
    const sub = String(item.subitem_name || '').trim();
    const ft = String(item.frame_type || '').trim();
    const parts = [sub, ft].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Standard';
  }
  if (itemType === 'custom') {
    const it = String(item.item_type || '').trim();
    return it || '—';
  }
  return '—';
}

function sizeColumnLabel(
  item: StockItem,
  itemType: StockTableProps['itemType'],
  customRollMode?: boolean
): string {
  if (itemType === 'banner' || itemType === 'sticker' || (itemType === 'custom' && customRollMode)) {
    return formatRollWidth(item.size_name ?? item.material_name);
  }
  return formatSizeDisplay(item.size_name ?? item.material_name) || String(item.size_name ?? item.material_name ?? '').trim() || '—';
}

export default function StockTable({
  items,
  itemType,
  customRollMode = false,
  onEdit,
  onRemove,
  isLowStock,
  onSaveRollRow,
}: StockTableProps) {
  const isRollLike =
    itemType === 'banner' || itemType === 'sticker' || (itemType === 'custom' && customRollMode);
  const sizeHeader = isRollLike ? 'Roll width' : 'Size';
  const emptyColSpan = isRollLike ? 7 : 6;
  const isRollTable = itemType === 'banner' || itemType === 'sticker';
  const inlineRollEdit = isRollTable && typeof onSaveRollRow === 'function';

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{
    stock_type: string;
    print_type: string;
    size_name: string;
    stock_qty: string;
    feet_remaining: string;
    low_stock: string;
    /** Banner save payload — kept from row, not edited in table */
    unit_price: string;
    price_unit: 'per_sqft' | 'per_qty';
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingId != null && !items.some((i) => i.id === editingId)) {
      setEditingId(null);
      setDraft(null);
    }
  }, [items, editingId]);

  const beginRollEdit = (item: StockItem) => {
    void (async () => {
      if (!(await requestAdminPermission({ force: true }))) return;
      openRollEdit(item);
    })();
  };

  const openRollEdit = (item: StockItem) => {
    const feet = item.feet_remaining ?? (item.stock_qty ?? 0) * 150;
    setEditingId(item.id);
    setDraft({
      stock_type: String(item.stock_type ?? ''),
      print_type: String(item.print_type ?? ''),
      size_name: String(item.size_name ?? ''),
      unit_price:
        item.unit_price != null && item.unit_price !== '' ? String(item.unit_price) : '',
      price_unit: item.price_unit === 'per_qty' ? 'per_qty' : 'per_sqft',
      stock_qty: String(item.stock_qty ?? 0),
      feet_remaining: String(Math.round(feet)),
      low_stock: (item.low_stock_threshold ?? 0) < 0 ? '' : String(item.low_stock_threshold ?? ''),
    });
  };

  const cancelRollEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveRollEdit = async () => {
    if (!inlineRollEdit || editingId == null || !draft || !onSaveRollRow) return;
    const nw = normalizeRollWidthForSave(draft.size_name);
    if (!nw.trim()) return;
    const rolls = Math.max(0, parseInt(String(draft.stock_qty), 10) || 0);
    const feet = Math.max(0, parseFloat(String(draft.feet_remaining)) || 0);
    let low: number;
    if (draft.low_stock.trim() === '') low = -1;
    else {
      const t = parseInt(draft.low_stock, 10);
      low = !isNaN(t) && t >= 0 ? t : 10;
    }
    setSaving(true);
    try {
      const base = {
        size_name: nw,
        stock_qty: rolls,
        feet_remaining: feet,
        low_stock_threshold: low,
        stock_type: String(draft.stock_type || '').trim(),
      };
      // Banner: always send print_type so the API persists it (JSON omits undefined keys).
      if (itemType === 'banner') {
        const up = draft.unit_price.trim();
        const parsed = up === '' ? null : parseFloat(up);
        await onSaveRollRow(editingId, {
          ...base,
          print_type: String(draft.print_type ?? '').trim(),
          unit_price: parsed === null || isNaN(parsed) ? null : parsed,
          price_unit: draft.price_unit,
        });
      } else {
        await onSaveRollRow(editingId, base);
      }
      cancelRollEdit();
    } catch {
      /* Parent shows error; keep row in edit mode */
    } finally {
      setSaving(false);
    }
  };

  const draftSqft = (): number => {
    if (!draft) return 0;
    const w = getFirstNumberFromSize(draft.size_name) || 6;
    const ft = parseFloat(draft.feet_remaining) || 0;
    return Math.round(w * ft * 100) / 100;
  };

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-red-950/50">
          <th className="text-center p-3 border border-red-950/50 text-red-200">Type</th>
          <th className="text-center p-3 border border-red-950/50 text-red-200">{sizeHeader}</th>
          <th className="text-center p-3 border border-red-950/50 text-red-200">Qty</th>
          {isRollLike && (
            <th className="text-center p-3 border border-red-950/50 text-red-200">Sqft available</th>
          )}
          <th className="text-center p-3 border border-red-950/50 text-red-200">Last Updated</th>
          <th className="text-center p-3 border border-red-950/50 text-red-200">Low Stock At</th>
          <th className="text-center p-3 border border-red-950/50 text-red-200">Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={emptyColSpan} className="p-6 text-center text-red-300/70 border border-red-950/40">
              No items. Use &quot;+ Add Item&quot; to add.
            </td>
          </tr>
        ) : (
          items.map((item) => {
            const editing = inlineRollEdit && editingId === item.id && draft != null;

            if (editing && draft) {
              return (
                <tr
                  key={item.id}
                  className="border-b border-red-950/40 bg-red-950/25"
                >
                  <td className="p-2 border border-red-950/40 text-center">
                    <input
                      type="text"
                      value={draft.stock_type}
                      onChange={(e) => setDraft((d) => (d ? { ...d, stock_type: e.target.value } : d))}
                      placeholder="Type"
                      className="w-full min-w-[5rem] max-w-[8rem] mx-auto border border-red-700/60 rounded px-2 py-1.5 text-sm bg-black/70 text-white text-center"
                      aria-label="Type"
                    />
                  </td>
                  <td className="p-2 border border-red-950/40 text-center">
                    <input
                      type="text"
                      value={draft.size_name}
                      onChange={(e) => setDraft((d) => (d ? { ...d, size_name: e.target.value } : d))}
                      placeholder="e.g. 6, 8, 10"
                      className="w-full min-w-[5rem] max-w-[8rem] mx-auto border border-red-700/60 rounded px-2 py-1.5 text-sm bg-black/70 text-white text-center"
                      aria-label="Roll width"
                    />
                  </td>
                  <td className="p-2 border border-red-950/40 text-center align-top">
                    <div className="flex flex-col gap-1 items-center">
                      <label className="text-[10px] text-red-300/80 uppercase tracking-wide">Rolls</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={draft.stock_qty}
                        onChange={(e) => setDraft((d) => (d ? { ...d, stock_qty: e.target.value.replace(/\D/g, '') } : d))}
                        className="w-16 border border-red-700/60 rounded px-2 py-1 text-sm bg-black/70 text-white text-center"
                      />
                      <label className="text-[10px] text-red-300/80 uppercase tracking-wide mt-1">Feet total</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.feet_remaining}
                        onChange={(e) => setDraft((d) => (d ? { ...d, feet_remaining: e.target.value.replace(/[^\d.]/g, '') } : d))}
                        className="w-20 border border-red-700/60 rounded px-2 py-1 text-sm bg-black/70 text-white text-center"
                      />
                    </div>
                  </td>
                  {isRollLike && (
                    <td className="p-2 border border-red-950/40 text-center text-emerald-400/90 tabular-nums text-sm">
                      {draftSqft()} sqft
                    </td>
                  )}
                  <td className="p-2 border border-red-950/40 text-red-300/50 text-center text-xs">—</td>
                  <td className="p-2 border border-red-950/40 text-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={draft.low_stock}
                      onChange={(e) => setDraft((d) => (d ? { ...d, low_stock: e.target.value.replace(/\D/g, '') } : d))}
                      placeholder="feet"
                      className="w-16 border border-red-700/60 rounded px-2 py-1 text-sm bg-black/70 text-white text-center mx-auto"
                      title="Low stock alert threshold (feet). Leave empty to disable."
                    />
                  </td>
                  <td className="p-2 border border-red-950/40 text-center">
                    <span className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => { void saveRollEdit(); }}
                        className="px-3 py-1.5 bg-emerald-600/90 text-white rounded text-sm hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={cancelRollEdit}
                        className="px-3 py-1.5 bg-red-950/80 text-red-200 rounded text-sm hover:bg-red-900/80 border border-red-900/50"
                      >
                        Cancel
                      </button>
                    </span>
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={item.id}
                className={`hover:bg-red-950/30 border-b border-red-950/40 ${isLowStock(item, itemType) ? 'bg-red-950/40' : ''}`}
              >
                <td className="p-3 border border-red-950/40 text-red-200/90 text-center">{typeColumnLabel(item, itemType)}</td>
                <td className="p-3 border border-red-950/40 font-medium text-white text-center">{sizeColumnLabel(item, itemType, customRollMode)}</td>
                <td className="p-3 border border-red-950/40 text-center text-white">
                  <span className={isLowStock(item, itemType) ? 'text-red-400 font-semibold' : ''}>
                    {isRollLike
                      ? `${item.stock_qty ?? 0} roll${(item.stock_qty ?? 0) !== 1 ? 's' : ''} (${(item.feet_remaining ?? (item.stock_qty ?? 0) * 150).toFixed(0)} ft)`
                      : item.stock_qty}
                  </span>
                </td>
                {isRollLike && (
                  <td className="p-3 border border-red-950/40 text-center text-emerald-400/90 tabular-nums">
                    {Math.round(getSqftAvailable(item, isRollLike) * 100) / 100} sqft
                  </td>
                )}
                <td className="p-3 border border-red-950/40 text-red-200/90 text-center">
                  {item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                </td>
                <td className="p-3 border border-red-950/40 text-center text-red-200/90">
                  {(item.low_stock_threshold ?? 0) < 0
                    ? '-'
                    : isRollLike
                      ? `${item.low_stock_threshold} feet`
                      : item.low_stock_threshold}
                </td>
                <td className="p-3 border border-red-950/40 text-center">
                  <span className="flex justify-center gap-2 flex-wrap">
                    {inlineRollEdit ? (
                      <button
                        type="button"
                        onClick={() => beginRollEdit(item)}
                        className="px-3 py-1.5 bg-red-600/80 text-white rounded text-sm hover:bg-red-600"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEdit?.(item)}
                        className="px-3 py-1.5 bg-red-600/80 text-white rounded text-sm hover:bg-red-600"
                      >
                        Edit
                      </button>
                    )}
                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove(item)}
                        className="px-3 py-1.5 bg-red-950/80 text-red-300 rounded text-sm hover:bg-red-900/80 border border-red-900/50"
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
