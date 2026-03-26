import { Link } from 'react-router-dom';
import type { LowStockItem } from '../../types';

interface LowStockAlertsProps {
  items: LowStockItem[];
}

export default function LowStockAlerts({ items }: LowStockAlertsProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-amber-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Low Stock Alerts
        </h4>
        <Link
          to="/app/stock"
          className="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          Manage Stock →
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const feetBased = item.feet_remaining != null || item.type === 'banner' || item.type === 'sticker';
          const leftText = feetBased ? `${(item.feet_remaining ?? item.stock_qty * 150).toFixed(0)} ft` : `${item.stock_qty}`;
          return (
            <span
              key={`${item.type}-${item.id}`}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-600/40 text-amber-200 border border-amber-500/50"
            >
              {item.name} ({item.type}): {leftText} left
            </span>
          );
        })}
      </div>
    </div>
  );
}
