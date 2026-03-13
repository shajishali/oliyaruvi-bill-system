import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function BillList({ onPrint }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({ number: '', customer: '', from: '', to: '' });

  const fetchBills = () => {
    setLoading(true);
    const params = {};
    if (search.number) params.number = search.number;
    if (search.customer) params.customer = search.customer;
    if (search.from) params.from = search.from;
    if (search.to) params.to = search.to;
    api.bills
      .list(params)
      .then(setBills)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBills();
  };

  const viewBill = async (id) => {
    const bill = await api.bills.get(id);
    onPrint(bill);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Bill number"
          value={search.number}
          onChange={(e) => setSearch((s) => ({ ...s, number: e.target.value }))}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Customer name"
          value={search.customer}
          onChange={(e) => setSearch((s) => ({ ...s, customer: e.target.value }))}
          className="border rounded px-3 py-2"
        />
        <input
          type="date"
          placeholder="From"
          value={search.from}
          onChange={(e) => setSearch((s) => ({ ...s, from: e.target.value }))}
          className="border rounded px-3 py-2"
        />
        <input
          type="date"
          placeholder="To"
          value={search.to}
          onChange={(e) => setSearch((s) => ({ ...s, to: e.target.value }))}
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-lg">
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left p-2 border">Bill #</th>
              <th className="text-left p-2 border">Date</th>
              <th className="text-left p-2 border">Customer</th>
              <th className="text-right p-2 border">Total</th>
              <th className="text-left p-2 border">Payment</th>
              <th className="p-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="p-2 border">{b.bill_number}</td>
                <td className="p-2 border">{b.bill_date}</td>
                <td className="p-2 border">{b.customer_name}</td>
                <td className="p-2 border text-right">₹{parseFloat(b.total).toFixed(2)}</td>
                <td className="p-2 border">{b.payment_method}</td>
                <td className="p-2 border">
                  <button
                    onClick={() => viewBill(b.id)}
                    className="px-3 py-1 bg-sky-600 text-white rounded text-sm hover:bg-sky-700"
                  >
                    View / Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && bills.length === 0 && (
        <p className="text-gray-500 py-8 text-center">No bills found.</p>
      )}
    </div>
  );
}
