interface RevenueCardsProps {
  daily: number;
  weekly: number;
  monthly: number;
  ordersToday: number;
  actualReceivedToday?: number;
  actualByCash?: number;
  actualByBank?: number;
}

export default function RevenueCards({ daily, weekly, monthly, ordersToday, actualReceivedToday, actualByCash, actualByBank }: RevenueCardsProps) {
  const cards = [
    { label: 'Actual received today', value: actualReceivedToday ?? daily, sub: actualByCash != null && actualByBank != null ? `Cash: Rs.${(actualByCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Bank: Rs.${(actualByBank || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Cash + Bank received', accent: 'emerald' as const },
    { label: 'Today\'s bill total', value: daily, sub: 'Bill total (incl. advance)', accent: 'emerald' as const },
    { label: 'Weekly Revenue', value: weekly, sub: 'Last 7 days', accent: 'sky' as const },
    { label: 'Monthly Revenue', value: monthly, sub: 'This month', accent: 'violet' as const },
    { label: 'Total Orders', value: ordersToday, sub: 'Orders today', isCount: true, accent: 'amber' as const },
  ];

  const accentStyles: Record<string, string> = {
    emerald: 'border-l-red-600',
    sky: 'border-l-red-500',
    violet: 'border-l-red-600',
    amber: 'border-l-red-700',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, sub, isCount, accent }) => (
        <div
          key={label}
          className={`bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 border-l-4 p-5 shadow-xl hover:shadow-2xl hover:border-red-800/50 transition-all duration-200 ${accentStyles[accent]}`}
        >
          <p className="text-sm text-red-200/90 mb-1 font-medium">{label}</p>
          <p className="text-2xl font-bold text-white">
            {isCount ? value : `Rs.${parseFloat(String(value || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-red-300/70 mt-1">{sub}</p>
        </div>
      ))}
    </div>
  );
}
