export default function RevenueCards({ daily, weekly, monthly, ordersToday }) {
  const cards = [
    { label: 'Today\'s Revenue', value: daily, sub: 'Daily income' },
    { label: 'Weekly Revenue', value: weekly, sub: 'Last 7 days' },
    { label: 'Monthly Revenue', value: monthly, sub: 'This month' },
    { label: 'Total Orders', value: ordersToday, sub: 'Orders today', isCount: true },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, sub, isCount }) => (
        <div key={label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow transition-shadow">
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-semibold text-gray-800">
            {isCount ? value : `₹${parseFloat(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
      ))}
    </div>
  );
}
