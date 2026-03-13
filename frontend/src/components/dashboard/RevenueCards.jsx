export default function RevenueCards({ daily, weekly, monthly, ordersToday }) {
  const cards = [
    { label: 'Today\'s Revenue', value: daily, sub: 'Daily income', accent: 'emerald' },
    { label: 'Weekly Revenue', value: weekly, sub: 'Last 7 days', accent: 'sky' },
    { label: 'Monthly Revenue', value: monthly, sub: 'This month', accent: 'violet' },
    { label: 'Total Orders', value: ordersToday, sub: 'Orders today', isCount: true, accent: 'amber' },
  ];

  const accentStyles = {
    emerald: 'border-l-emerald-500',
    sky: 'border-l-sky-500',
    violet: 'border-l-violet-500',
    amber: 'border-l-amber-500',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, sub, isCount, accent }) => (
        <div
          key={label}
          className={`bg-white rounded-xl border border-slate-100 border-l-4 p-5 shadow-md hover:shadow-lg transition-all duration-200 ${accentStyles[accent]}`}
        >
          <p className="text-sm text-slate-500 mb-1 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-800">
            {isCount ? value : `₹${parseFloat(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-slate-400 mt-1">{sub}</p>
        </div>
      ))}
    </div>
  );
}
