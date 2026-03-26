import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { focusNextOnEnter, preventMouseUpWhenSelecting, selectIfEmptyOrZero } from '../../utils/modalFormHelpers';

interface AddBannerStockModalProps {
  onClose: () => void;
  onConfirm: (data: {
    size_name: string;
    stock_qty: number;
    low_stock_threshold?: number;
    stock_type?: string;
    print_type?: string;
    unit_price?: number;
    price_unit?: 'per_sqft' | 'per_qty';
  }) => Promise<void>;
  onError?: (message: string) => void;
}

export default function AddBannerStockModal({ onClose, onConfirm, onError }: AddBannerStockModalProps) {
  const [stockType, setStockType] = useState('');
  const [sizeName, setSizeName] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [threshold, setThreshold] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const typeRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const thresholdRef = useRef<HTMLInputElement>(null);

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
        stock_type: stockType.trim() || undefined,
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
        aria-labelledby="add-banner-roll-title"
        className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-md w-full p-6 relative z-[1]"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="add-banner-roll-title" className="text-lg font-semibold mb-1 text-white">
          Add banner roll
        </h3>
        <p className="text-xs text-red-300/75 mb-4">
          One row per roll width. Material pricing is in Settings → Banner.
        </p>
        {submitError && (
          <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 text-sm">
            {submitError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate autoComplete="off">
          <div>
            <label htmlFor="add-banner-type" className="block text-sm font-medium text-red-200/90 mb-1">
              Type <span className="text-red-400/60 font-normal">(optional)</span>
            </label>
            <input
              id="add-banner-type"
              ref={typeRef}
              type="text"
              value={stockType}
              onChange={(e) => setStockType(e.target.value)}
              onKeyDown={(e) => focusNextOnEnter(e, widthRef)}
              placeholder="e.g. Flex, vinyl"
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label htmlFor="add-banner-width" className="block text-sm font-medium text-red-200/90 mb-1">
              Roll width (feet)
            </label>
            <input
              id="add-banner-width"
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
          </div>
          <div>
            <label htmlFor="add-banner-qty" className="block text-sm font-medium text-red-200/90 mb-1">
              Qty (banner rolls)
            </label>
            <input
              id="add-banner-qty"
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
            <label htmlFor="add-banner-threshold" className="block text-sm font-medium text-red-200/90 mb-1">
              Low Stock At <span className="text-red-400/60 font-normal">(optional)</span>
            </label>
            <input
              id="add-banner-threshold"
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
