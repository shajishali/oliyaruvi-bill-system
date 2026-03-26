import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { normalizeSizeForSave } from '../../utils/sizeFormat';
import { focusNextOnEnter, preventMouseUpWhenSelecting, selectIfEmptyOrZero } from '../../utils/modalFormHelpers';

interface AddItemModalProps {
  itemType: 'frame' | 'photo' | 'photocopy' | 'custom';
  onClose: () => void;
  onConfirm: (data: {
    size_name: string;
    frame_type?: string;
    subitem_name?: string;
    stock_qty: number;
    low_stock_threshold?: number;
    /** Custom section stock row label (Type column) */
    item_type?: string;
  }) => Promise<void>;
  onError?: (message: string) => void;
}

export default function AddItemModal({ itemType, onClose, onConfirm, onError }: AddItemModalProps) {
  const [sizeName, setSizeName] = useState('');
  const [customItemType, setCustomItemType] = useState('');
  const [frameType, setFrameType] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [threshold, setThreshold] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const typeInputRef = useRef<HTMLInputElement>(null);
  const customTypeInputRef = useRef<HTMLInputElement>(null);
  const sizeInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const thresholdInputRef = useRef<HTMLInputElement>(null);

  // Modal is portaled to body so it is not inside Layout's framer-motion wrapper (transform breaks fixed + can steal clicks).
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      if (itemType === 'frame') typeInputRef.current?.focus();
      else if (itemType === 'custom') customTypeInputRef.current?.focus();
      else sizeInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [itemType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeName.trim()) return;
    const qty = parseInt(String(stockQty)) || 0;
    setSubmitError('');
    setSaving(true);
    try {
      const thresh = threshold === '' || threshold === null ? -1 : parseInt(String(threshold));
      const data: {
        size_name: string;
        frame_type?: string;
        subitem_name?: string;
        stock_qty: number;
        low_stock_threshold: number;
        item_type?: string;
      } = {
        size_name: normalizeSizeForSave(sizeName),
        stock_qty: qty,
        low_stock_threshold: (thresh >= 0 && !isNaN(thresh)) ? thresh : -1,
      };
      if (itemType === 'frame') {
        data.frame_type = frameType.trim() || 'Standard';
      }
      if (itemType === 'custom') {
        const it = customItemType.trim();
        if (it) data.item_type = it;
      }
      await onConfirm(data);
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
        className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-md w-full p-6 relative z-[1]"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4 text-white">
          {itemType === 'custom' ? 'Add item' : `Add ${itemType === 'frame' ? 'Frame' : itemType === 'photocopy' ? 'Photocopy' : 'Photo'} size`}
        </h3>
        {submitError && (
          <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 text-sm">
            {submitError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate autoComplete="off">
          {(itemType === 'frame') && (
            <div>
              <label htmlFor="add-item-frame-type" className="block text-sm font-medium text-red-200/90 mb-1">Type</label>
              <input
                id="add-item-frame-type"
                ref={typeInputRef}
                type="text"
                value={frameType}
                onChange={(e) => setFrameType(e.target.value)}
                placeholder="e.g. Wood, Metal, Plastic (leave empty for Standard)"
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 focus:outline-none focus:border-red-600"
              />
            </div>
          )}
          {itemType === 'custom' && (
            <div>
              <label htmlFor="add-item-custom-type" className="block text-sm font-medium text-red-200/90 mb-1">
                Type <span className="text-red-400/60 font-normal">(optional)</span>
              </label>
              <input
                id="add-item-custom-type"
                ref={customTypeInputRef}
                type="text"
                value={customItemType}
                onChange={(e) => setCustomItemType(e.target.value)}
                onKeyDown={(e) => focusNextOnEnter(e, sizeInputRef)}
                placeholder="e.g. Normal, Large, B/W"
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 focus:outline-none focus:border-red-600"
              />
            </div>
          )}
          <div>
            <label htmlFor="add-item-size" className="block text-sm font-medium text-red-200/90 mb-1">{itemType === 'frame' ? 'Size' : 'Size Name'}</label>
            <input
              id="add-item-size"
              ref={sizeInputRef}
              type="text"
              value={sizeName}
              onChange={(e) => setSizeName(e.target.value)}
              onKeyDown={(e) => focusNextOnEnter(e, qtyInputRef)}
              placeholder={itemType === 'frame' ? 'e.g. 6 inches, 12x18 (match Settings)' : itemType === 'photocopy' ? 'e.g. A4' : itemType === 'custom' ? 'e.g. A4, 12x18' : 'e.g. 4x6'}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 focus:outline-none focus:border-red-600"
              required
            />
          </div>
          <div>
            <label htmlFor="add-item-qty" className="block text-sm font-medium text-red-200/90 mb-1">Initial Qty</label>
            <input
              id="add-item-qty"
              ref={qtyInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value.replace(/\D/g, ''))}
              onFocus={selectIfEmptyOrZero}
              onMouseUp={preventMouseUpWhenSelecting}
              onKeyDown={(e) => focusNextOnEnter(e, thresholdInputRef)}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label htmlFor="add-item-threshold" className="block text-sm font-medium text-red-200/90 mb-1">Low Stock At <span className="text-red-400/60 font-normal">(optional)</span></label>
            <input
              id="add-item-threshold"
              ref={thresholdInputRef}
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
