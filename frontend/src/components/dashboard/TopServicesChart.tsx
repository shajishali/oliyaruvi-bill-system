import type { TopService } from '../../types';

interface TopServicesChartProps {
  data: TopService[];
}

export default function TopServicesChart({ data }: TopServicesChartProps) {
  const total = (data || []).reduce((sum, r) => sum + (parseFloat(String(r.total_revenue)) || 0), 0);
  const items = (data || []).slice(0, 6).map((r) => ({
    name: r.item_name,
    type: r.service_type,
    revenue: parseFloat(String(r.total_revenue)) || 0,
    pct: total > 0 ? Math.round(((parseFloat(String(r.total_revenue)) || 0) / total) * 100) : 0,
  }));

  const typeIcons: Record<string, string> = {
    banner: '🖼️',
    frame: '🖼️',
    photo: '📷',
  };

  return (
    <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-5 shadow-xl">
      <h3 className="font-semibold text-white mb-4">Service Breakdown</h3>
      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${i === 0 ? 'bg-red-600/90 text-white shadow-md' : 'bg-black/50 hover:bg-red-950/60'}`}>
              <span className="text-lg">{typeIcons[item.type] || '📦'}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${i === 0 ? 'text-white' : 'text-white'}`}>{item.name}</p>
                <p className={`text-xs ${i === 0 ? 'text-red-100' : 'text-red-300/70'}`}>{item.type}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-semibold ${i === 0 ? 'text-white' : 'text-white'}`}>{item.pct}%</p>
                <p className={`text-xs ${i === 0 ? 'text-red-100' : 'text-red-300/70'}`}>Rs.{item.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-red-300/70 text-sm py-4">No sales data yet</p>
        )}
      </div>
    </div>
  );
}
