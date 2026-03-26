import { useState } from 'react';
import { formatSizeDisplay } from '../../utils/sizeFormat';

interface StockItem {
  id: number;
  size_name?: string;
  material_name?: string;
  stock_qty?: number;
  feet_remaining?: number;
}

interface StockModalProps {
  type: string;
  item: StockItem | null;
  itemType: string;
  isRollType?: boolean;
  onClose: () => void;
  onConfirm: (data: { quantity: number; reason: string | null; transaction_type?: string }) => void | Promise<void>;
}

export default function StockModal({ type, item, itemType, isRollType = false, onClose, onConfirm }: StockModalProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<'add' | 'reduce'>('add');

  const isEdit = type === 'edit';
  const isReduce = type === 'reduce' || type === 'adjust' || (isEdit && action === 'reduce');
  const isBanner = itemType === 'banner' || itemType === 'sticker' || isRollType;
  const feetRemaining = isBanner ? ((item as StockItem)?.feet_remaining ?? ((item?.stock_qty ?? 0) * 150)) : 0;
  const maxQty = isReduce ? (isBanner ? Math.floor(feetRemaining) : (item?.stock_qty ?? 0)) : (isBanner ? 999 : 9999);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(String(quantity)) || 0;
    if (qty <= 0) return;
    setSubmitting(true);
    try {
      const txType = isEdit ? action : (type === 'add' ? 'add' : 'reduce');
      await onConfirm({ quantity: qty, reason: reason.trim() || null, transaction_type: txType });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">
          {isEdit ? 'Edit Stock' : type === 'add' ? 'Add' : type === 'reduce' ? 'Reduce' : 'Adjust'} Stock
        </h3>
        <p className="text-sm text-red-200/90 mb-2">
          {formatSizeDisplay(item?.size_name || item?.material_name) || item?.size_name || item?.material_name} {itemType === 'frame' ? '(Frame)' : itemType === 'photo' ? '(Photo)' : itemType === 'photocopy' ? '(Photocopy)' : itemType === 'custom' ? '(Section item)' : itemType === 'banner' ? '(Banner roll)' : itemType === 'sticker' ? '(Sticker roll)' : ''}
        </p>
        {item && (
          <p className="text-sm text-red-300/70 mb-4">
            Current stock: {isBanner ? `${feetRemaining.toFixed(0)} ft` : item.stock_qty}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              type="number"
              min="1"
              max={maxQty}
              placeholder={isBanner ? (isReduce ? 'Feet' : 'Rolls') : '1'}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
              required
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
}
