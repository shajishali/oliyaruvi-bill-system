import { useState } from 'react';

export default function StockModal({ type, item, itemType, onClose, onConfirm }) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return;
    onConfirm({ quantity: qty, reason: reason.trim() || null });
    onClose();
  };

  const isReduce = type === 'reduce' || type === 'adjust';
  const maxQty = isReduce ? item?.stock_qty || 0 : 9999;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">
          {type === 'add' ? 'Add' : type === 'reduce' ? 'Reduce' : 'Adjust'} Stock
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          {item?.size_name || item?.material_name} {itemType === 'frame' ? '(Frame)' : itemType === 'photo' ? '(Photo)' : ''}
        </p>
        {item && (
          <p className="text-sm text-gray-500 mb-4">Current stock: {item.stock_qty}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              max={maxQty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
            {isReduce && maxQty > 0 && (
              <p className="text-xs text-gray-500 mt-1">Max: {maxQty}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isReduce ? 'e.g. Damage, wastage' : 'e.g. New purchase'}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
