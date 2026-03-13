export default function TopServicesChart({ data }) {
  const total = (data || []).reduce((sum, r) => sum + (parseFloat(r.total_revenue) || 0), 0);
  const items = (data || []).slice(0, 6).map((r) => ({
    name: r.item_name,
    type: r.service_type,
    revenue: parseFloat(r.total_revenue) || 0,
    pct: total > 0 ? Math.round(((parseFloat(r.total_revenue) || 0) / total) * 100) : 0,
  }));

  const typeIcons = {
    banner: '🖼️',
    frame: '🖼️',
    photo: '📷',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-4">Service Breakdown</h3>
      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? 'bg-slate-700 text-white' : 'bg-gray-50'}`}>
              <span className="text-lg">{typeIcons[item.type] || '📦'}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${i === 0 ? 'text-white' : 'text-gray-800'}`}>{item.name}</p>
                <p className={`text-xs ${i === 0 ? 'text-slate-200' : 'text-gray-500'}`}>{item.type}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-semibold ${i === 0 ? 'text-white' : 'text-gray-800'}`}>{item.pct}%</p>
                <p className={`text-xs ${i === 0 ? 'text-slate-200' : 'text-gray-500'}`}>₹{item.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-sm py-4">No sales data yet</p>
        )}
      </div>
    </div>
  );
}
