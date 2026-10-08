import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { focusNextOnEnter, preventMouseUpWhenSelecting, selectIfEmptyOrZero } from '../../utils/modalFormHelpers';
import { buildSuggestions, ChoiceList, type StockChoice } from './previousChoices';

interface AddCustomRollItemModalProps {
  suggestions?: StockChoice[];
  onClose: () => void;
  onConfirm: (data: {
    size_name: string;
    stock_qty: number;
    low_stock_threshold?: number;
    item_type?: string;
  }) => Promise<void>;
  onError?: (message: string) => void;
}

export default function AddCustomRollItemModal({ suggestions = [], onClose, onConfirm, onError }: AddCustomRollItemModalProps) {
  const [itemType, setItemType] = useState('');
  const [sizeName, setSizeName] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [threshold, setThreshold] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const typeRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const thresholdRef = useRef<HTMLInputElement>(null);
  const choices = buildSuggestions(suggestions, itemType, sizeName, '');

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      typeRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeName.trim()) return;
    const qty = parseInt(String(stockQty)) || 0;
    setSubmitError('');
    setSaving(true);
    try {
      const thresh = threshold === '' || threshold === null ? -1 : parseInt(String(threshold));
      await onConfirm({
        item_type: itemType.trim() || undefined,
        size_name: sizeName.trim(),
        stock_qty: qty,
        low_stock_threshold: (thresh >= 0 && !isNaN(thresh)) ? thresh : -1,
      });
      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      setSubmitError(msg);
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-custom-roll-title"
        className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-lg w-full p-6 relative z-[1] max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="add-custom-roll-title" className="text-lg font-semibold mb-4 text-white">
          Add Roll Item
        </h3>
        {submitError && (
          <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 text-sm">
            {submitError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate autoComplete="off">
          <div>
            <label htmlFor="add-custom-roll-type" className="block text-sm font-medium text-red-200/90 mb-1">
              Type <span className="text-red-400/60 font-normal">(optional)</span>
            </label>
            <input
              id="add-custom-roll-type"
              ref={typeRef}
              type="text"
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              onKeyDown={(e) => focusNextOnEnter(e, widthRef)}
              placeholder="Type a new name, or pick one below"
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 focus:outline-none focus:border-red-600"
            />
            <ChoiceList
              label="Previous types"
              options={choices.typeOptions}
              selected={itemType}
              onPick={(value) => {
                setItemType(value);
                widthRef.current?.focus();
              }}
            />
            {choices.typeIsNew && <p className="mt-2 text-sm text-amber-200">New type “{choices.typedType}” will be saved when you click Add.</p>}
          </div>
          <div>
            <label htmlFor="add-custom-roll-width" className="block text-sm font-medium text-red-200/90 mb-1">
              Size (feet)
            </label>
            <input
              id="add-custom-roll-width"
              ref={widthRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={sizeName}
              onChange={(e) => setSizeName(e.target.value)}
              onKeyDown={(e) => focusNextOnEnter(e, qtyRef)}
              placeholder="e.g. 6 feet, 8 feet, 10 feet"
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 focus:outline-none focus:border-red-600"
              required
            />
            <ChoiceList
              label={itemType.trim() ? 'Widths for this type' : 'Previous widths'}
              options={choices.sizeOptions}
              selected={sizeName}
              onPick={(value) => {
                setSizeName(value);
                qtyRef.current?.focus();
              }}
            />
            {itemType.trim() && (
              <ChoiceList
                label="Other widths"
                options={choices.otherSizeOptions}
                selected={sizeName}
                onPick={(value) => {
                  setSizeName(value);
                  qtyRef.current?.focus();
                }}
              />
            )}
            {choices.sizeIsNew && <p className="mt-2 text-sm text-amber-200">New width “{sizeName.trim()}” will be saved when you click Add.</p>}
            {choices.alreadyExists && (
              <p className="mt-2 text-sm text-red-200">This type and width is already in stock. Edit that row, or choose a different width.</p>
            )}
          </div>
          <div>
            <label htmlFor="add-custom-roll-qty" className="block text-sm font-medium text-red-200/90 mb-1">
              Qty (rolls)
            </label>
            <input
              id="add-custom-roll-qty"
              ref={qtyRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value.replace(/\D/g, ''))}
              onFocus={selectIfEmptyOrZero}
              onMouseUp={preventMouseUpWhenSelecting}
              onKeyDown={(e) => focusNextOnEnter(e, thresholdRef)}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label htmlFor="add-custom-roll-threshold" className="block text-sm font-medium text-red-200/90 mb-1">
              Low Stock At (feet) <span className="text-red-400/60 font-normal">(optional)</span>
            </label>
            <input
              id="add-custom-roll-threshold"
              ref={thresholdRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Leave empty to skip alerts"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 focus:outline-none focus:border-red-600"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-red-950/60 text-red-200 rounded-lg hover:bg-red-900/70 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
