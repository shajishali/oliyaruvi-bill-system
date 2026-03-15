import { useState } from 'react';

interface AddStickerStockModalProps {
  onClose: () => void;
  onConfirm: (data: { size_name: string; stock_qty: number; low_stock_threshold: number }) => Promise<void>;
  onError?: (message: string) => void;
}

export default function AddStickerStockModal({ onClose, onConfirm, onError }: AddStickerStockModalProps) {
  const [sizeName, setSizeName] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [threshold, setThreshold] = useState(10);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeName.trim()) return;
    const qty = parseInt(String(stockQty)) || 0;
    setSubmitError('');
    setSaving(true);
    try {
      await onConfirm({
        size_name: sizeName.trim(),
        stock_qty: qty,
        low_stock_threshold: threshold,
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Add Sticker Size</h3>
        {submitError && (
          <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 text-sm">
            {submitError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Size (feet)</label>
            <input
              type="text"
              value={sizeName}
              onChange={(e) => setSizeName(e.target.value)}
              placeholder="e.g. 6 feet, 8 feet, 10 feet"
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Qty (sticker rolls)</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Low Stock At</label>
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value) || 10)}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-red-950/60 text-red-200 rounded-lg hover:bg-red-900/70">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
