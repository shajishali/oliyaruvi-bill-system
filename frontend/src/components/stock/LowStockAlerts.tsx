import { Link } from 'react-router-dom';
import type { LowStockItem } from '../../types';

interface LowStockAlertsProps {
  items: LowStockItem[];
  onMarkRead?: (item: LowStockItem) => void;
  onMarkAllRead?: () => void;
}

export default function LowStockAlerts({ items, onMarkRead, onMarkAllRead }: LowStockAlertsProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-4 shadow-xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="font-semibold text-amber-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Low Stock Alerts
        </h4>
        <div className="flex items-center gap-3">
          {onMarkAllRead && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-sm text-white font-medium hover:text-amber-200"
            >
              Mark all as read
            </button>
          )}
          <Link
            to="/app/stock"
            className="text-sm text-red-300 hover:text-white font-medium"
          >
            Manage Stock →
          </Link>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((item) => {
          const feetBased = item.feet_remaining != null || item.type === 'banner' || item.type === 'sticker';
          const leftText = feetBased ? `${(item.feet_remaining ?? item.stock_qty * 150).toFixed(0)} ft` : `${item.stock_qty}`;
          return (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/50 bg-amber-600/20 px-3 py-2"
            >
              <span className="text-sm font-medium text-amber-100">
                {item.name} ({item.type}): {leftText} left
              </span>
              {onMarkRead && (
                <button
                  type="button"
                  onClick={() => onMarkRead(item)}
                  className="shrink-0 rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600"
                >
                  Mark as read
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
