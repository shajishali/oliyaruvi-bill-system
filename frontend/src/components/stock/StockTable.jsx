export default function StockTable({ items, itemType, onAdd, onUpdate, onReduce, isLowStock }) {
  if (items.length === 0) {
    return <p className="text-gray-500 py-4">No items.</p>;
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="text-left p-3 border">Size</th>
          <th className="text-right p-3 border">Stock</th>
          <th className="text-right p-3 border">Price (₹)</th>
          <th className="text-right p-3 border">Low Stock At</th>
          <th className="p-3 border">Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            className={`hover:bg-gray-50 ${isLowStock(item) ? 'bg-red-50' : ''}`}
          >
            <td className="p-3 border font-medium">{item.size_name}</td>
            <td className="p-3 border text-right">
              <span className={isLowStock(item) ? 'text-red-600 font-semibold' : ''}>
                {item.stock_qty}
              </span>
            </td>
            <td className="p-3 border text-right">₹{parseFloat(item.unit_price).toFixed(2)}</td>
            <td className="p-3 border text-right">{item.low_stock_threshold}</td>
            <td className="p-3 border">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => onAdd(item)}
                  className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm hover:bg-green-200"
                >
                  Add
                </button>
                <button
                  onClick={() => onUpdate(item)}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200"
                >
                  Update
                </button>
                <button
                  onClick={() => onReduce(item)}
                  disabled={item.stock_qty <= 0}
                  className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reduce
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
