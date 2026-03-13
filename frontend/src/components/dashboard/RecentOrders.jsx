import { Link } from 'react-router-dom';

export default function RecentOrders({ bills }) {
  const statusColor = (method) => {
    if (method === 'Cash') return 'bg-emerald-100 text-emerald-800';
    if (method === 'Bank') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-700';
  };

  if (!bills?.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-md">
        <h3 className="font-semibold text-gray-800 mb-4">Latest Orders</h3>
        <p className="text-gray-500 text-sm">No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">Latest Orders</h3>
        <Link to="/billing" className="text-sm text-slate-600 hover:text-slate-800 font-medium">
          See all →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-3 font-medium">Customer</th>
              <th className="pb-3 font-medium">Bill #</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Date</th>
              <th className="pb-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="py-3 font-medium text-gray-800">{b.customer_name}</td>
                <td className="py-3 text-gray-600">{b.bill_number}</td>
                <td className="py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(b.payment_method)}`}>
                    {b.payment_method}
                  </span>
                </td>
                <td className="py-3 text-gray-600">{b.bill_date}</td>
                <td className="py-3 text-right font-medium text-gray-800">₹{parseFloat(b.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
