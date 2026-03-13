import { Link } from 'react-router-dom';

export default function LowStockAlerts({ items }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-amber-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Low Stock Alerts
        </h4>
        <Link
          to="/stock"
          className="text-sm text-slate-600 hover:text-slate-800 font-medium"
        >
          Manage Stock →
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={`${item.type}-${item.id}`}
            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-100"
          >
            {item.name} ({item.type}): {item.stock_qty} left
          </span>
        ))}
      </div>
    </div>
  );
}
