interface Transaction {
  id: number;
  item_type: string;
  item_id: number;
  transaction_type: string;
  quantity: number;
  previous_qty: number;
  new_qty: number;
  reason?: string;
  user_action?: string;
  created_at: string;
}

interface StockTransactionLogProps {
  transactions: unknown[];
  frameNames: Record<number, string>;
  photoNames: Record<number, string>;
  bannerNames?: Record<number, string>;
  stickerNames?: Record<number, string>;
}

export default function StockTransactionLog({ transactions, frameNames, photoNames, bannerNames = {}, stickerNames = {} }: StockTransactionLogProps) {
  const getName = (type: string, id: number) => {
    if (type === 'frame') return frameNames[id] || `Frame #${id}`;
    if (type === 'photo') return photoNames[id] || `Photo #${id}`;
    if (type === 'banner') return bannerNames[id] || `Banner #${id}`;
    if (type === 'sticker') return stickerNames[id] || `Sticker #${id}`;
    return '-';
  };

  const txList = transactions as Transaction[];

  if (txList.length === 0) {
    return <p className="text-red-300/70 py-4">No transactions yet.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-red-950/50">
          <th className="text-left p-2 border border-red-950/50 text-red-200">Date</th>
          <th className="text-left p-2 border border-red-950/50 text-red-200">Item</th>
          <th className="text-left p-2 border border-red-950/50 text-red-200">Type</th>
          <th className="text-right p-2 border border-red-950/50 text-red-200">Qty</th>
          <th className="text-right p-2 border border-red-950/50 text-red-200">Previous</th>
          <th className="text-right p-2 border border-red-950/50 text-red-200">New</th>
          <th className="text-left p-2 border border-red-950/50 text-red-200">Reason</th>
          <th className="text-left p-2 border border-red-950/50 text-red-200">Source</th>
        </tr>
      </thead>
      <tbody>
        {txList.map((tx) => (
          <tr key={tx.id} className="hover:bg-red-950/30 border-b border-red-950/40">
            <td className="p-2 border border-red-950/40 text-red-200/90">{new Date(tx.created_at).toLocaleString()}</td>
            <td className="p-2 border border-red-950/40 text-white">{getName(tx.item_type, tx.item_id)}</td>
            <td className="p-2 border border-red-950/40 capitalize text-white">{tx.transaction_type}</td>
            <td className="p-2 border border-red-950/40 text-right text-white">{tx.quantity}</td>
            <td className="p-2 border border-red-950/40 text-right text-white">{tx.previous_qty}</td>
            <td className="p-2 border border-red-950/40 text-right text-white">{tx.new_qty}</td>
            <td className="p-2 border border-red-950/40 text-red-300/70">{tx.reason || '-'}</td>
            <td className="p-2 border border-red-950/40 capitalize text-red-200/90">{tx.user_action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
