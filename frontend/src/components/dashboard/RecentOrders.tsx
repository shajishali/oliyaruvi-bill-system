import { Link } from 'react-router-dom';
import type { Bill } from '../../types';

interface RecentOrdersProps {
  bills: Bill[];
}

export default function RecentOrders({ bills }: RecentOrdersProps) {
  const statusColor = (method: string) => {
    if (method === 'Cash') return 'bg-emerald-500/30 text-emerald-300';
    if (method === 'Bank') return 'bg-red-950/60 text-red-200';
    return 'bg-red-950/60 text-red-200';
  };

  if (!bills?.length) {
    return (
      <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-5 shadow-xl">
        <h3 className="font-semibold text-white mb-4">Latest Orders</h3>
        <p className="text-red-300/70 text-sm">No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-5 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-white">Latest Orders</h3>
        <Link to="/app/billing" className="text-sm text-red-400 hover:text-red-300 font-medium">
          See all →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-red-200/80 border-b border-red-950/50">
              <th className="pb-3 font-medium">Customer</th>
              <th className="pb-3 font-medium">Bill #</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Date</th>
              <th className="pb-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="border-b border-red-950/40 hover:bg-red-950/30 transition-colors">
                <td className="py-3 font-medium text-white">{b.customer_name}</td>
                <td className="py-3 text-red-200/80">{b.bill_number}</td>
                <td className="py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(b.payment_method)}`}>
                    {b.payment_method}
                  </span>
                </td>
                <td className="py-3 text-red-200/80">{b.bill_date}</td>
                <td className="py-3 text-right font-medium text-white">Rs.{parseFloat(String(b.total)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
