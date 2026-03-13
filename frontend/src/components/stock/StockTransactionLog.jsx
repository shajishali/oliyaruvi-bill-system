export default function StockTransactionLog({ transactions, frameNames, photoNames }) {
  const getName = (type, id) => {
    if (type === 'frame') return frameNames[id] || `Frame #${id}`;
    if (type === 'photo') return photoNames[id] || `Photo #${id}`;
    return '-';
  };

  if (transactions.length === 0) {
    return <p className="text-gray-500 py-4">No transactions yet.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="text-left p-2 border">Date</th>
          <th className="text-left p-2 border">Item</th>
          <th className="text-left p-2 border">Type</th>
          <th className="text-right p-2 border">Qty</th>
          <th className="text-right p-2 border">Previous</th>
          <th className="text-right p-2 border">New</th>
          <th className="text-left p-2 border">Reason</th>
          <th className="text-left p-2 border">Source</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr key={tx.id} className="hover:bg-gray-50">
            <td className="p-2 border">{new Date(tx.created_at).toLocaleString()}</td>
            <td className="p-2 border">{getName(tx.item_type, tx.item_id)}</td>
            <td className="p-2 border capitalize">{tx.transaction_type}</td>
            <td className="p-2 border text-right">{tx.quantity}</td>
            <td className="p-2 border text-right">{tx.previous_qty}</td>
            <td className="p-2 border text-right">{tx.new_qty}</td>
            <td className="p-2 border text-gray-600">{tx.reason || '-'}</td>
            <td className="p-2 border capitalize">{tx.user_action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
