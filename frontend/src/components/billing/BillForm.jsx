import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';

export default function BillForm({ onBillCreated }) {
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [billableItems, setBillableItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const addRowRef = useRef(null);

  useEffect(() => {
    api.services.billableItems().then(setBillableItems).catch(() => setBillableItems([]));
  }, []);

  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomers([]);
      return;
    }
    api.customers.search(customerSearch).then(setCustomers);
  }, [customerSearch]);

  useEffect(() => {
    const closeDropdowns = (e) => {
      if (addRowRef.current && !addRowRef.current.contains(e.target)) {
        setItemDropdownOpen(false);
        setSizeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', closeDropdowns);
    return () => document.removeEventListener('mousedown', closeDropdowns);
  }, []);

  const subtotal = items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
  const total = Math.max(0, subtotal - (parseFloat(discount) || 0));

  const uniqueItemNames = [...new Set(billableItems.map((i) => i.name))].sort();
  const filteredItems = itemSearch
    ? billableItems.filter(
        (i) =>
          i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
          i.sizeName.toLowerCase().includes(itemSearch.toLowerCase()) ||
          `${i.name} ${i.sizeName}`.toLowerCase().includes(itemSearch.toLowerCase())
      )
    : billableItems;
  const filteredItemNames = itemSearch
    ? uniqueItemNames.filter((n) => n.toLowerCase().includes(itemSearch.toLowerCase()))
    : uniqueItemNames;

  const sizesForItem = selectedItem
    ? billableItems.filter(
        (i) =>
          i.type === selectedItem.type &&
          i.name === selectedItem.name &&
          (selectedItem.type !== 'banner' || i.materialId === selectedItem.materialId)
      )
    : [];

  const calcSubtotal = () => {
    if (!selectedItem || !selectedSize || !quantity || quantity < 1) return 0;
    const qty = parseInt(quantity) || 1;
    if (selectedItem.calcType === 'sqft') {
      const w = selectedSize.widthFt || parseFloat((selectedSize.sizeName || '').split('+')[0]) || 0;
      const h = selectedSize.heightFt || parseFloat((selectedSize.sizeName || '').split('+')[1]) || 0;
      const sqft = w * h;
      return sqft * qty * (selectedSize.pricePerSqft || 0);
    }
    return qty * (selectedSize.unitPrice || 0);
  };

  const currentSubtotal = calcSubtotal();

  const addItem = () => {
    if (!selectedItem || !selectedSize || quantity < 1) return;
    const qty = parseInt(quantity) || 1;
    const st = calcSubtotal();
    if (st <= 0) return;

    let itemName = `${selectedItem.name}`;
    if (selectedItem.type === 'banner') itemName = `Banner ${selectedSize.materialName || ''} ${selectedSize.sizeName}`;
    else itemName = `${selectedItem.name} ${selectedSize.sizeName}`;

    const newItem = {
      service_type: selectedItem.type,
      item_name: itemName,
      size: selectedSize.sizeName,
      quantity: qty,
      unit_price: st / qty,
      subtotal: st,
      frame_id: selectedItem.type === 'frame' ? selectedSize.id : undefined,
      photo_id: selectedItem.type === 'photo' ? selectedSize.id : undefined,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedItem(null);
    setSelectedSize(null);
    setQuantity(1);
    setItemSearch('');
  };

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleQuickAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    try {
      const c = await api.customers.create({ name: newCustomerName.trim(), phone: newCustomerPhone || null });
      setSelectedCustomer(c);
      setCustomerName(c.name);
      setShowQuickAdd(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = customerName.trim() || selectedCustomer?.name;
    if (!name) {
      setError('Customer name is required');
      return;
    }
    if (items.length === 0) {
      setError('Add at least one item');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const bill = await api.bills.create({
        customer_id: selectedCustomer?.id || null,
        customer_name: name,
        items,
        discount: parseFloat(discount) || 0,
        payment_method: paymentMethod,
        notes: notes || null,
      });
      onBillCreated(bill);
      setItems([]);
      setDiscount(0);
      setNotes('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3 pr-4 font-medium text-gray-700 w-32">Customer</td>
              <td className="py-3">
                <div className="flex gap-2 items-center">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={customerSearch || customerName}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        if (!selectedCustomer) setCustomerName(e.target.value);
                      }}
                      onFocus={() => setSelectedCustomer(null)}
                      placeholder="Search or enter name"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    />
                    {customers.length > 0 && !selectedCustomer && (
                      <ul className="absolute left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg max-h-40 overflow-auto z-10">
                        {customers.map((c) => (
                          <li
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerName(c.name);
                              setCustomerSearch('');
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          >
                            {c.name} {c.phone && `(${c.phone})`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowQuickAdd(true)} className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm whitespace-nowrap">
                    Quick Add
                  </button>
                </div>
              </td>
            </tr>
            {showQuickAdd && (
              <tr className="border-b border-gray-100 bg-gray-50">
                <td className="py-3 pr-4 font-medium text-gray-700"></td>
                <td className="py-3">
                  <div className="flex gap-2 items-center">
                    <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Name" className="border rounded px-3 py-2" required />
                    <input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="Phone" className="border rounded px-3 py-2" />
                    <button type="button" onClick={handleQuickAddCustomer} className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm">Add</button>
                    <button type="button" onClick={() => setShowQuickAdd(false)} className="px-3 py-2 text-gray-600 text-sm">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            <tr className="border-b border-gray-100">
              <td className="py-3 pr-4 font-medium text-gray-700">Discount (₹)</td>
              <td className="py-3">
                <input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="border border-gray-200 rounded px-3 py-2 w-28" />
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-3 pr-4 font-medium text-gray-700">Payment</td>
              <td className="py-3">
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="border border-gray-200 rounded px-3 py-2">
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                </select>
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-gray-700">Notes</td>
              <td className="py-3">
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="w-full border border-gray-200 rounded px-3 py-2" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Add Items</h3>
        <p className="text-sm text-gray-500 mb-4">Click Item → Size → Qty to add. Select from dropdowns.</p>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 border border-gray-100">Item</th>
              <th className="text-left p-3 border border-gray-100">Size</th>
              <th className="text-right p-3 border border-gray-100">Qty</th>
              <th className="text-right p-3 border border-gray-100">Unit Price</th>
              <th className="text-right p-3 border border-gray-100">Subtotal</th>
              <th className="w-20 p-3 border border-gray-100"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/50">
                <td className="p-3 border border-gray-100">{item.item_name}</td>
                <td className="p-3 border border-gray-100">{item.size || '-'}</td>
                <td className="p-3 border border-gray-100 text-right">{item.quantity}</td>
                <td className="p-3 border border-gray-100 text-right">₹{item.unit_price?.toFixed(2)}</td>
                <td className="p-3 border border-gray-100 text-right">₹{item.subtotal?.toFixed(2)}</td>
                <td className="p-3 border border-gray-100">
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:underline text-sm">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            <tr ref={addRowRef} className="bg-gray-50/50">
              <td className="p-2 border border-gray-100 relative">
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setItemDropdownOpen(true);
                    setSelectedItem(null);
                    setSelectedSize(null);
                  }}
                  onFocus={() => setItemDropdownOpen(true)}
                  placeholder="Click to select item"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                />
                {itemDropdownOpen && (
                  <ul className="absolute left-0 right-0 top-full mt-1 border rounded-lg bg-white shadow-lg max-h-40 overflow-auto z-20">
                    {filteredItemNames.map((name) => (
                      <li
                        key={name}
                        onClick={() => {
                          const first = billableItems.find((i) => i.name === name);
                          if (first) {
                            setSelectedItem(first);
                            setSelectedSize(first);
                            setItemSearch(name);
                            setItemDropdownOpen(false);
                            setSizeDropdownOpen(true);
                            setQuantity(1);
                          }
                        }}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="p-2 border border-gray-100 relative">
                <input
                  type="text"
                  value={selectedSize?.sizeName || ''}
                  readOnly
                  onFocus={() => selectedItem && setSizeDropdownOpen(true)}
                  onClick={() => selectedItem && setSizeDropdownOpen(true)}
                  placeholder="Select item first"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white cursor-pointer"
                />
                {sizeDropdownOpen && sizesForItem.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-1 border rounded-lg bg-white shadow-lg max-h-40 overflow-auto z-20">
                    {sizesForItem.map((s, idx) => (
                      <li
                        key={idx}
                        onClick={() => {
                          setSelectedSize(s);
                          setSizeDropdownOpen(false);
                          setQuantity(1);
                        }}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between"
                      >
                        <span>{s.sizeName} {selectedItem?.type === 'banner' ? '(ft)' : '(in)'}</span>
                        <span className="text-gray-500 text-sm">
                          {s.calcType === 'sqft' ? `₹${s.pricePerSqft}/sqft` : `₹${s.unitPrice}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="p-2 border border-gray-100">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 border border-gray-200 rounded px-2 py-1.5 text-sm text-right"
                />
              </td>
              <td className="p-2 border border-gray-100 text-right text-sm">
                {selectedSize ? (
                  selectedSize.calcType === 'sqft'
                    ? `₹${selectedSize.pricePerSqft}/sqft`
                    : `₹${selectedSize.unitPrice}`
                ) : (
                  '-'
                )}
              </td>
              <td className="p-2 border border-gray-100 text-right font-medium text-sm">
                ₹{currentSubtotal.toFixed(2)}
              </td>
              <td className="p-2 border border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    addItem();
                    setItemDropdownOpen(false);
                    setSizeDropdownOpen(false);
                  }}
                  disabled={!selectedItem || !selectedSize || quantity < 1}
                  className="px-3 py-1.5 bg-slate-700 text-white rounded text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse mt-4">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3 pr-4 font-medium text-gray-700">Subtotal</td>
              <td className="py-3 text-right">₹{subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-semibold text-gray-800">Total</td>
              <td className="py-3 text-right font-semibold text-gray-800">₹{total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6">
          <button type="submit" disabled={loading || items.length === 0} className="px-6 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Bill'}
          </button>
        </div>
      </div>
    </form>
  );
}
