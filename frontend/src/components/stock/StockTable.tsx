import { formatSizeDisplay, getFirstNumberFromSize } from '../../utils/sizeFormat';

interface StockItem {
  id: number;
  size_name?: string;
  material_name?: string;
  frame_type?: string;
  stock_qty?: number;
  feet_remaining?: number;
  low_stock_threshold?: number;
  updated_at?: string;
}

interface StockTableProps {
  items: StockItem[];
  itemType: 'frame' | 'photo' | 'banner' | 'sticker';
  onEdit: (item: StockItem) => void;
  isLowStock: (item: StockItem, itemType?: string) => boolean;
}

function getSqftAvailable(item: StockItem, itemType: string): number {
  if (itemType !== 'banner' && itemType !== 'sticker') return 0;
  const width = getFirstNumberFromSize(item.size_name ?? item.material_name) || 6;
  const feet = (item as { feet_remaining?: number }).feet_remaining ?? (item.stock_qty ?? 0) * 150;
  return width * feet;
}

export default function StockTable({ items, itemType, onEdit, isLowStock }: StockTableProps) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-red-950/50">
          <th className="text-center p-3 border border-red-950/50 text-red-200">Size</th>
          {itemType === 'frame' && (
            <th className="text-center p-3 border border-red-950/50 text-red-200">Type</th>
          )}
          <th className="text-center p-3 border border-red-950/50 text-red-200">Qty</th>
          {(itemType === 'banner' || itemType === 'sticker') && (
            <th className="text-center p-3 border border-red-950/50 text-red-200">Sqft available</th>
          )}
          <th className="text-center p-3 border border-red-950/50 text-red-200">Last Updated</th>
          <th className="text-center p-3 border border-red-950/50 text-red-200">Low Stock At</th>
          <th className="text-center p-3 border border-red-950/50 text-red-200">Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={itemType === 'frame' ? 6 : itemType === 'banner' || itemType === 'sticker' ? 6 : 5} className="p-6 text-center text-red-300/70 border border-red-950/40">
              No items. Use &quot;+ Add Item&quot; to add.
            </td>
          </tr>
        ) : (
        items.map((item) => (
          <tr
            key={item.id}
            className={`hover:bg-red-950/30 border-b border-red-950/40 ${isLowStock(item) ? 'bg-red-950/40' : ''}`}
          >
            <td className="p-3 border border-red-950/40 font-medium text-white text-center">{formatSizeDisplay(item.size_name ?? item.material_name) || (item.size_name ?? item.material_name)}</td>
            {itemType === 'frame' && (
              <td className="p-3 border border-red-950/40 text-red-200/90 text-center">{item.frame_type || 'Standard'}</td>
            )}
            <td className="p-3 border border-red-950/40 text-center text-white">
              <span className={isLowStock(item, itemType) ? 'text-red-400 font-semibold' : ''}>
                {itemType === 'banner' || itemType === 'sticker'
                  ? `${item.stock_qty ?? 0} roll${(item.stock_qty ?? 0) !== 1 ? 's' : ''} (${(item.feet_remaining ?? (item.stock_qty ?? 0) * 150).toFixed(0)} ft)`
                  : item.stock_qty}
              </span>
            </td>
            {(itemType === 'banner' || itemType === 'sticker') && (
              <td className="p-3 border border-red-950/40 text-center text-emerald-400/90 tabular-nums">
                {Math.round(getSqftAvailable(item, itemType) * 100) / 100} sqft
              </td>
            )}
            <td className="p-3 border border-red-950/40 text-red-200/90 text-center">
              {item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
            </td>
            <td className="p-3 border border-red-950/40 text-center text-red-200/90">
              {itemType === 'banner' || itemType === 'sticker' ? `${item.low_stock_threshold ?? 10} feet` : item.low_stock_threshold}
            </td>
            <td className="p-3 border border-red-950/40 text-center">
              <button
                onClick={() => onEdit(item)}
                className="px-3 py-1.5 bg-red-600/80 text-white rounded text-sm hover:bg-red-600"
              >
                Edit
              </button>
            </td>
          </tr>
        ))
        )}
      </tbody>
    </table>
  );
}
