import { useState } from 'react';
import { formatSizeDisplay } from '../../utils/sizeFormat';

interface StockItem {
  id: number;
  size_name?: string;
  frame_type?: string;
  stock_qty?: number;
  unit_price?: number;
  low_stock_threshold?: number;
}

interface UpdateStockModalProps {
  item: StockItem | null;
  itemType: string;
  onClose: () => void;
  onConfirm: (data: { stock_qty: number; unit_price: number; low_stock_threshold: number; frame_type?: string }) => void | Promise<void>;
}

export default function UpdateStockModal({ item, itemType, onClose, onConfirm }: UpdateStockModalProps) {
  const [stockQty, setStockQty] = useState(item?.stock_qty ?? 0);
  const [unitPrice, setUnitPrice] = useState(item?.unit_price ?? 0);
  const [threshold, setThreshold] = useState(item?.low_stock_threshold ?? 5);
  const [frameType, setFrameType] = useState(item?.frame_type ?? 'Standard');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(String(stockQty));
    const price = parseFloat(String(unitPrice));
    const thresh = parseInt(String(threshold));
    if (isNaN(qty) || qty < 0 || isNaN(price) || price < 0 || isNaN(thresh) || thresh < 0) return;
    const data: { stock_qty: number; unit_price: number; low_stock_threshold: number; frame_type?: string } = {
      stock_qty: qty, unit_price: price, low_stock_threshold: thresh,
    };
    if (itemType === 'frame') data.frame_type = frameType.trim() || 'Standard';
    setSubmitting(true);
    try {
      await onConfirm(data);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Update Stock</h3>
        <p className="text-sm text-red-200/90 mb-4">
          {formatSizeDisplay(item?.size_name) || item?.size_name} {itemType === 'frame' && item?.frame_type ? `(${item.frame_type})` : ''} {itemType === 'frame' ? '(Frame)' : '(Photo)'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {itemType === 'frame' && (
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Type</label>
              <input
                type="text"
                value={frameType}
                onChange={(e) => setFrameType(e.target.value)}
                placeholder="e.g. Wood, Metal, Plastic"
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Stock Quantity</label>
            <input
              type="number"
              min="0"
              value={stockQty}
              onChange={(e) => setStockQty(parseInt(e.target.value) || 0)}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Unit Price (Rs.) – for billing</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Low Stock Threshold</label>
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
              required
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-red-950/60 text-red-200 rounded-lg hover:bg-red-900/70">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
