import { useState } from 'react';
import { normalizeSizeForSave } from '../../utils/sizeFormat';

interface AddItemModalProps {
  itemType: 'frame' | 'photo';
  onClose: () => void;
  onConfirm: (data: { size_name: string; frame_type?: string; stock_qty: number; low_stock_threshold: number }) => Promise<void>;
  onError?: (message: string) => void;
}

export default function AddItemModal({ itemType, onClose, onConfirm, onError }: AddItemModalProps) {
  const [sizeName, setSizeName] = useState('');
  const [frameType, setFrameType] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [threshold, setThreshold] = useState(5);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeName.trim()) return;
    const qty = parseInt(String(stockQty)) || 0;
    setSubmitError('');
    setSaving(true);
    try {
      const data: { size_name: string; frame_type?: string; stock_qty: number; low_stock_threshold: number } = {
        size_name: normalizeSizeForSave(sizeName),
        stock_qty: qty,
        low_stock_threshold: threshold,
      };
      if (itemType === 'frame') data.frame_type = frameType.trim() || 'Standard';
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Add {itemType === 'frame' ? 'Frame' : 'Photo'} Size</h3>
        {submitError && (
          <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 text-sm">
            {submitError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Size Name</label>
            <input
              type="text"
              value={sizeName}
              onChange={(e) => setSizeName(e.target.value)}
              placeholder={itemType === 'frame' ? 'e.g. 12x18' : 'e.g. 4x6'}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
              required
            />
          </div>
          {itemType === 'frame' && (
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Type</label>
              <input
                type="text"
                value={frameType}
                onChange={(e) => setFrameType(e.target.value)}
                placeholder="e.g. Wood, Metal, Plastic (leave empty for Standard)"
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Initial Qty</label>
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
              onChange={(e) => setThreshold(parseInt(e.target.value) || 5)}
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
