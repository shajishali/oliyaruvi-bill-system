import { useState, useRef, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { RevenueTrendPoint } from '../../types';

interface RevenueChartProps {
  data: RevenueTrendPoint[];
}

const CHART_HEIGHT = 224;

export default function RevenueChart({ data }: RevenueChartProps) {
  const [range, setRange] = useState(7);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.offsetWidth;
      if (w > 0) setWidth(w);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const allData = (data || []).map((r) => ({
    ...r,
    dateLabel: formatDate(r.date),
    revenue: parseFloat(String(r.revenue)) || 0,
  }));
  const chartData = allData.slice(-range);

  return (
    <div className="min-w-0 bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-5 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-white">Sales Revenue</h3>
        <select
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          className="text-sm border border-red-900/50 rounded-lg px-3 py-1.5 text-white bg-black/80 focus:ring-red-500 focus:border-red-500"
        >
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>
      <div ref={containerRef} className="w-full min-w-0" style={{ height: CHART_HEIGHT, minHeight: 200 }}>
        {chartData.length > 0 && width > 0 ? (
          <AreaChart width={width} height={CHART_HEIGHT} data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#7f1d1d" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#fca5a5' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#fca5a5' }} tickFormatter={(v) => `Rs.${v}`} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                formatter={(v) => [`Rs.${parseFloat(String(v)).toFixed(2)}`, 'Revenue']}
                labelFormatter={(l) => `Date: ${l}`}
                contentStyle={{ borderRadius: 8, border: '1px solid #7f1d1d', backgroundColor: '#0f0f0f' }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2} fill="url(#colorRevenue)" />
            </AreaChart>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-red-300/70 text-sm">No data for selected period</div>
        ) : null}
      </div>
    </div>
  );
}
