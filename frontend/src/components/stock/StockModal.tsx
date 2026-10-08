import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatSizeDisplay } from '../../utils/sizeFormat';

interface StockItem {
  id: number;
  size_name?: string;
  material_name?: string;
  frame_type?: string;
  subitem_name?: string;
  stock_qty?: number;
  feet_remaining?: number;
}

interface StockModalProps {
  type: string;
  item: StockItem | null;
  itemType: string;
  isRollType?: boolean;
  onClose: () => void;
  onConfirm: (data: {
    quantity: number;
    reason: string | null;
    transaction_type?: string;
    size_name?: string;
    frame_type?: string;
  }) => void | Promise<void>;
}

export default function StockModal({ type, item, itemType, isRollType = false, onClose, onConfirm }: StockModalProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [sizeName, setSizeName] = useState(item?.size_name || '');
  const [frameType, setFrameType] = useState(item?.frame_type || '');
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<'add' | 'reduce'>('add');

  const isEdit = type === 'edit';
  const isReduce = type === 'reduce' || type === 'adjust' || (isEdit && action === 'reduce');
  const isBanner = itemType === 'banner' || itemType === 'sticker' || isRollType;
  const feetRemaining = isBanner ? ((item as StockItem)?.feet_remaining ?? ((item?.stock_qty ?? 0) * 150)) : 0;
  const maxQty = isReduce ? (isBanner ? Math.floor(feetRemaining) : (item?.stock_qty ?? 0)) : (isBanner ? 999 : 9999);

  const canRename = isEdit && itemType === 'frame';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(String(quantity), 10) || 0;
    const nextSize = sizeName.trim();
    if (canRename && !nextSize) return;
    if (qty <= 0 && !canRename) return;
    setSubmitting(true);
    try {
      const txType = isEdit ? action : (type === 'add' ? 'add' : 'reduce');
      await onConfirm({
        quantity: qty,
        reason: reason.trim() || null,
        transaction_type: txType,
        ...(canRename ? { size_name: nextSize } : {}),
        ...(canRename && itemType === 'frame' ? { frame_type: frameType.trim() } : {}),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-neutral-950 rounded-xl shadow-xl border border-red-950/60 max-w-md w-full p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4 text-white">
          {isEdit ? 'Edit stock' : type === 'add' ? 'Add stock' : type === 'reduce' ? 'Reduce stock' : 'Adjust stock'}
        </h3>
        {!canRename && (
          <p className="text-sm text-red-200/90 mb-2">
            {formatSizeDisplay(item?.size_name || item?.material_name) || item?.size_name || item?.material_name} {itemType === 'frame' ? '(Frame)' : itemType === 'photo' ? '(Photo)' : itemType === 'photocopy' ? '(Photocopy)' : itemType === 'custom' ? '(Section item)' : itemType === 'banner' ? '(Banner roll)' : itemType === 'sticker' ? '(Sticker roll)' : ''}
          </p>
        )}
        {item && (
          <p className="text-sm text-red-300/70 mb-4">
            Current stock: {isBanner ? `${feetRemaining.toFixed(0)} ft` : item.stock_qty}
          </p>
        )}
        <form onSubmit={handleSubmit} onKeyDown={(e) => e.stopPropagation()} className="space-y-4" noValidate>
          {canRename && itemType === 'frame' && (
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Type</label>
              <input
                type="text"
                value={frameType}
                onChange={(e) => setFrameType(e.target.value)}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white"
              />
            </div>
          )}
          {canRename && (
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Size</label>
              <input
                type="text"
                value={sizeName}
                onChange={(e) => setSizeName(e.target.value)}
                placeholder="e.g. 10+15"
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white"
                required
              />
            </div>
          )}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-2">Action</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAction('add')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium ${action === 'add' ? 'bg-emerald-600 text-white' : 'bg-red-950/60 text-red-200'}`}
                >
                  Increase
                </button>
                <button
                  type="button"
                  onClick={() => setAction('reduce')}
                  disabled={(isBanner ? feetRemaining : (item?.stock_qty ?? 0)) <= 0}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${action === 'reduce' ? 'bg-amber-600 text-white' : 'bg-red-950/60 text-red-200'}`}
                >
                  Decrease
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">
              {isBanner ? (isReduce ? 'Feet to reduce' : 'Rolls to add') : 'Quantity'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder={canRename ? 'Leave empty to keep the quantity' : (isBanner ? (isReduce ? 'Feet' : 'Rolls') : '1')}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white placeholder-red-400/50"
              required={!canRename}
            />
            {isReduce && maxQty > 0 && (
              <p className="text-xs text-red-300/70 mt-1">Max: {maxQty}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isReduce ? 'e.g. Damage, wastage' : 'e.g. New purchase'}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-red-950/60 text-red-200 rounded-lg hover:bg-red-900/70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
