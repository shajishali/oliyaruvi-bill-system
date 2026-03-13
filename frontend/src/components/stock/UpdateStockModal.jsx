import { useState } from 'react';

export default function UpdateStockModal({ item, itemType, onClose, onConfirm }) {
  const [stockQty, setStockQty] = useState(item?.stock_qty ?? 0);
  const [unitPrice, setUnitPrice] = useState(item?.unit_price ?? 0);
  const [threshold, setThreshold] = useState(item?.low_stock_threshold ?? 5);

  const handleSubmit = (e) => {
    e.preventDefault();
    const qty = parseInt(stockQty);
    const price = parseFloat(unitPrice);
    const thresh = parseInt(threshold);
    if (qty < 0 || price < 0 || thresh < 0) return;
    onConfirm({ stock_qty: qty, unit_price: price, low_stock_threshold: thresh });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Update Stock</h3>
        <p className="text-sm text-gray-600 mb-4">
          {item?.size_name} {itemType === 'frame' ? '(Frame)' : '(Photo)'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
            <input
              type="number"
              min="0"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
