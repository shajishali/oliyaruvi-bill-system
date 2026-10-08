import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { normalizeSizeForSave } from '../../utils/sizeFormat';
import { focusNextOnEnter, preventMouseUpWhenSelecting, selectIfEmptyOrZero } from '../../utils/modalFormHelpers';
import { buildSuggestions, ChoiceList, type StockChoice } from './previousChoices';

export type { StockChoice };

interface AddItemModalProps {
  itemType: 'frame' | 'photo' | 'photocopy' | 'custom';
  suggestions?: StockChoice[];
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

export default function AddItemModal({ itemType, suggestions = [], onClose, onConfirm, onError }: AddItemModalProps) {
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
  const typeQuery = itemType === 'frame' ? frameType : customItemType;
  const choices = buildSuggestions(
    suggestions,
    typeQuery,
    sizeName,
    itemType === 'photo' || itemType === 'photocopy' ? null : itemType === 'frame' ? 'Standard' : '',
  );

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
    if (!sizeName.trim()) {
      setSubmitError('Enter a size.');
      sizeInputRef.current?.focus();
      return;
    }
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
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4"
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
        className="bg-neutral-950 rounded-xl shadow-xl border border-red-950/60 max-w-lg w-full p-6 relative z-[1] max-h-[90vh] overflow-y-auto"
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
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => e.stopPropagation()}
          className="space-y-4"
          noValidate
          autoComplete="off"
        >
          {(itemType === 'frame') && (
            <div>
              <label htmlFor="add-item-frame-type" className="block text-sm font-medium text-red-200/90 mb-1">Type</label>
              <input
                id="add-item-frame-type"
                ref={typeInputRef}
                type="text"
                value={frameType}
                onChange={(e) => setFrameType(e.target.value)}
                onKeyDown={(e) => focusNextOnEnter(e, sizeInputRef)}
                placeholder="Type a new name, or pick one below"
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white placeholder-red-400/70 focus:outline-none focus:border-red-600"
              />
              <ChoiceList
                label="Previous types"
                options={choices.typeOptions}
                selected={frameType}
                onPick={(value) => {
                  setFrameType(value);
                  sizeInputRef.current?.focus();
                }}
              />
              {choices.typeIsNew && <p className="mt-2 text-sm text-amber-200">New type “{choices.typedType}” will be saved when you click Add.</p>}
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
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white placeholder-red-400/70 focus:outline-none focus:border-red-600"
              />
              <ChoiceList
                label="Previous types"
                options={choices.typeOptions}
                selected={customItemType}
                onPick={(value) => {
                  setCustomItemType(value);
                  sizeInputRef.current?.focus();
                }}
              />
              {choices.typeIsNew && <p className="mt-2 text-sm text-amber-200">New type “{choices.typedType}” will be saved when you click Add.</p>}
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
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white placeholder-red-400/70 focus:outline-none focus:border-red-600"
              required
            />
            <ChoiceList
              label={typeQuery.trim() ? 'Sizes for this type' : 'Previous sizes'}
              options={choices.sizeOptions}
              selected={sizeName}
              onPick={(value) => {
                setSizeName(value);
                qtyInputRef.current?.focus();
              }}
            />
            {typeQuery.trim() && (
              <ChoiceList
                label="Other sizes"
                options={choices.otherSizeOptions}
                selected={sizeName}
                onPick={(value) => {
                  setSizeName(value);
                  qtyInputRef.current?.focus();
                }}
              />
            )}
            {choices.sizeIsNew && <p className="mt-2 text-sm text-amber-200">New size “{sizeName.trim()}” will be saved when you click Add.</p>}
            {choices.alreadyExists && (
              <p className="mt-2 text-sm text-red-200">This type and size is already in stock. You can still add another row, or choose a different size.</p>
            )}
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
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white placeholder-red-400/70 focus:outline-none focus:border-red-600"
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
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white placeholder-red-400/70 focus:outline-none focus:border-red-600"
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
