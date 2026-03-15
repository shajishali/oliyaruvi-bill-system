import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';
import type { Bill, BillItem, BillableItem, Customer } from '../../types';
import { formatSizeDisplay, formatBannerStickerSize, parseSizeDimensions } from '../../utils/sizeFormat';

interface BillFormProps {
  onBillCreated: (bill: Bill) => void;
}

type BillFormLineItem = BillItem & {
  service_type?: string;
  frame_id?: number;
  photo_id?: number;
};

export default function BillForm({ onBillCreated }: BillFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [items, setItems] = useState<BillFormLineItem[]>([]);
  const [advanceStr, setAdvanceStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [error, setError] = useState('');

  const [billableItems, setBillableItems] = useState<BillableItem[]>([]);
  const [billableItemsLoading, setBillableItemsLoading] = useState(true);
  const [billableItemsError, setBillableItemsError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<BillableItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<BillableItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitPriceStr, setUnitPriceStr] = useState('');
  const [itemDiscountStr, setItemDiscountStr] = useState('');
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [sizeWidthStr, setSizeWidthStr] = useState('');
  const [sizeLengthStr, setSizeLengthStr] = useState('');
  const [savedBill, setSavedBill] = useState<Bill | null>(null);
  const addRowRef = useRef<HTMLTableRowElement>(null);
  const customerSectionRef = useRef<HTMLDivElement>(null);
  const addItemsSectionRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const itemTriggerRef = useRef<HTMLTableCellElement>(null);
  const sizeTriggerRef = useRef<HTMLTableCellElement>(null);
  const [itemDropdownRect, setItemDropdownRect] = useState<DOMRect | null>(null);
  const [sizeDropdownRect, setSizeDropdownRect] = useState<DOMRect | null>(null);

  const fetchBillableItems = () => {
    setBillableItemsLoading(true);
    setBillableItemsError(null);
    api.services.billableItems()
      .then((items) => {
        setBillableItems(items);
        setBillableItemsError(null);
        if (items.length > 0) {
          addItemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      })
      .catch((err) => {
        setBillableItems([]);
        setBillableItemsError((err as Error).message || 'Failed to load items. Is the backend running on port 5000?');
      })
      .finally(() => setBillableItemsLoading(false));
  };

  useEffect(() => {
    fetchBillableItems();
  }, []);

  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomers([]);
      return;
    }
    api.customers.search(customerSearch).then(setCustomers);
  }, [customerSearch]);

  useEffect(() => {
    const closeDropdowns = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInAddRow = addRowRef.current?.contains(target);
      const el = target instanceof Element ? target : (target as Node).parentElement;
      const isInPortal = el?.closest?.('[data-bill-dropdown]');
      if (!isInAddRow && !isInPortal) {
        setItemDropdownOpen(false);
        setSizeDropdownOpen(false);
      }
    };
    document.addEventListener('click', closeDropdowns);
    return () => document.removeEventListener('click', closeDropdowns);
  }, []);

  useLayoutEffect(() => {
    if (itemDropdownOpen && itemTriggerRef.current) {
      setItemDropdownRect(itemTriggerRef.current.getBoundingClientRect());
    } else {
      setItemDropdownRect(null);
    }
  }, [itemDropdownOpen]);

  useLayoutEffect(() => {
    if (sizeDropdownOpen && sizeTriggerRef.current) {
      setSizeDropdownRect(sizeTriggerRef.current.getBoundingClientRect());
    } else {
      setSizeDropdownRect(null);
    }
  }, [sizeDropdownOpen]);

  // Sync size inputs for banner/sticker when selectedSize or quantity changes
  useEffect(() => {
    if (!selectedItem || !selectedSize) {
      setSizeWidthStr('');
      setSizeLengthStr('');
      return;
    }
    if (selectedItem.type !== 'banner' && selectedItem.type !== 'banner_roll' && selectedItem.type !== 'sticker_roll') {
      setSizeWidthStr('');
      setSizeLengthStr('');
      return;
    }
    const w = selectedSize.widthFt ?? 0;
    setSizeWidthStr(String(w));
    const qty = parseFloat(quantity) || 0;
    setSizeLengthStr(qty > 0 && w > 0 ? String(Math.round((qty / w) * 100) / 100) : String(w));
  }, [selectedItem?.type, selectedItem, selectedSize?.id, selectedSize?.widthFt, quantity]);

  const advanceAmount = parseFloat(advanceStr) || 0;
  const subtotal = items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
  const total = subtotal;
  const advance = Math.min(total, Math.max(0, advanceAmount));
  const balance = total - advance;

  const uniqueItemNames = [...new Set(billableItems.map((i) => i.name))].sort();
  const filteredItemNames = itemSearch
    ? uniqueItemNames.filter((n) => n.toLowerCase().includes(itemSearch.toLowerCase()))
    : uniqueItemNames;

  const isBannerOrSticker = (t?: string) =>
    t === 'banner' || t === 'banner_roll' || t === 'sticker_roll';

  const sizesForItem = selectedItem
    ? billableItems.filter(
        (i) =>
          i.type === selectedItem.type &&
          i.name === selectedItem.name &&
          (selectedItem.type !== 'banner' && selectedItem.type !== 'banner_roll' && selectedItem.type !== 'sticker_roll' || i.materialId === selectedItem.materialId) &&
          (selectedItem.type !== 'service' || i.materialId === selectedItem.materialId)
      )
    : [];

  const getDefaultUnitPrice = () => {
    if (!selectedSize) return 0;
    return (selectedSize.calcType === 'sqft' || selectedSize.calcType === 'sqft_direct') ? (selectedSize.pricePerSqft || 0) : (selectedSize.unitPrice || 0);
  };

  const calcSubtotal = () => {
    const qty = parseFloat(String(quantity)) || 0;
    if (!selectedItem || !selectedSize || qty <= 0) return 0;
    const unitPrice = parseFloat(unitPriceStr) || getDefaultUnitPrice();
    let base = 0;
    if (selectedItem.calcType === 'sqft_direct') {
      base = qty * unitPrice;
    } else if (selectedItem.calcType === 'sqft') {
      const [pw, ph] = parseSizeDimensions(selectedSize.sizeName);
      const w = selectedSize.widthFt || pw;
      const h = selectedSize.heightFt || ph;
      const sqft = w * h;
      base = sqft * qty * unitPrice;
    } else {
      base = qty * unitPrice;
    }
    const itemDiscount = parseFloat(itemDiscountStr) || 0;
    return Math.max(0, base - itemDiscount);
  };

  const currentSubtotal = calcSubtotal();

  const addItem = () => {
    const qty = selectedItem?.calcType === 'sqft_direct' ? parseFloat(String(quantity)) : parseInt(String(quantity)) || 0;
    if (!selectedItem || !selectedSize || qty <= 0) return;
    const st = calcSubtotal();
    if (st <= 0) return;

    let itemName = `${selectedItem.name}`;
    const sizeDisplay = formatSizeDisplay(selectedSize.sizeName) || selectedSize.sizeName;
    if (selectedItem.type === 'banner' || selectedItem.type === 'banner_roll') itemName = `Banner ${selectedSize.materialName || ''}`;
    else if (selectedItem.type === 'sticker_roll') itemName = `Sticker ${selectedSize.materialName || ''}`;
    else if (selectedItem.type === 'service') itemName = selectedItem.name;
    else itemName = `${selectedItem.name} ${sizeDisplay}`;

    const itemDiscount = parseFloat(itemDiscountStr) || 0;
    const unitPrice = parseFloat(unitPriceStr) || getDefaultUnitPrice();
    // For sqft_direct (banner roll): store unit_price as price per sqft; subtotal = qty * unit_price - discount
    let basePrice = 0;
    if (selectedItem.calcType === 'sqft_direct') {
      basePrice = qty * unitPrice;
    } else if (selectedItem.calcType === 'sqft') {
      const [pw, ph] = parseSizeDimensions(selectedSize.sizeName);
      const w = selectedSize.widthFt || pw;
      const h = selectedSize.heightFt || ph;
      const sqft = w * h;
      basePrice = sqft * unitPrice;
    } else {
      basePrice = unitPrice;
    }

    const bannerStockId = (selectedSize as { bannerStockId?: number }).bannerStockId;
    const stickerStockId = (selectedSize as { stickerStockId?: number }).stickerStockId;
    const widthFt = selectedSize.widthFt;

    const editedWidth = parseFloat(sizeWidthStr) || widthFt;
    let metadata: { banner_stock_id?: number; sticker_stock_id?: number; width_ft?: number } | undefined;
    if (selectedItem.type === 'banner_roll' && bannerStockId) metadata = { banner_stock_id: bannerStockId, width_ft: editedWidth };
    else if (selectedItem.type === 'sticker_roll' && stickerStockId) metadata = { sticker_stock_id: stickerStockId, width_ft: editedWidth };

    const sizeForRow =
      isBannerOrSticker(selectedItem.type) && selectedSize
        ? `${parseFloat(sizeWidthStr) || selectedSize.widthFt || 0} X ${parseFloat(sizeLengthStr) || (qty / (selectedSize.widthFt || 1) || 0)}`
        : formatSizeDisplay(selectedSize.sizeName) || selectedSize.sizeName;

    const newItem: BillFormLineItem = {
      service_type: selectedItem.type,
      item_name: itemName,
      size: sizeForRow,
      quantity: qty,
      unit_price: selectedItem.calcType === 'sqft_direct' ? unitPrice : basePrice,
      discount: itemDiscount,
      subtotal: st,
      frame_id: selectedItem.type === 'frame' ? selectedSize.sizeId : undefined,
      photo_id: selectedItem.type === 'photo' ? selectedSize.sizeId : undefined,
      metadata,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedItem(null);
    setSelectedSize(null);
    setQuantity('');
    setSizeWidthStr('');
    setSizeLengthStr('');
    setUnitPriceStr('');
    setItemDiscountStr('');
    setItemSearch('');
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleQuickAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    setQuickAddLoading(true);
    try {
      const c = await api.customers.create({ name: newCustomerName.trim(), phone: newCustomerPhone || null });
      setSelectedCustomer(c);
      setCustomerName(c.name);
      setShowQuickAdd(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = customerName.trim() || selectedCustomer?.name;
    if (!name) {
      setError('Customer name is required');
      customerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => customerInputRef.current?.focus(), 400);
      return;
    }
    if (items.length === 0) {
      setError('Add at least one item');
      addItemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => addRowRef.current?.querySelector<HTMLInputElement>('input')?.focus(), 400);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const bill = await api.bills.create({
        customer_id: selectedCustomer?.id || null,
        customer_name: name,
        items,
        discount: 0,
        payment_method: paymentMethod,
        notes: notes || null,
        advance_amount: advance,
      });
      setSavedBill(bill);
      setItems([]);
      setAdvanceStr('');
      setNotes('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (savedBill) {
    return (
      <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl max-w-md mx-auto">
        <p className="text-emerald-400 font-semibold text-lg mb-4">Bill saved</p>
        <p className="text-red-200/90 text-sm mb-6">Bill #{savedBill.bill_number} has been saved successfully.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              onBillCreated(savedBill);
              setSavedBill(null);
            }}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => setSavedBill(null)}
            className="flex-1 px-4 py-3 bg-red-950/60 text-red-200 rounded-lg font-medium hover:bg-red-900/70"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="p-2.5 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 text-sm">{error}</div>}

      <div ref={customerSectionRef} className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-red-200/90 mb-1">Customer</label>
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <input
                  ref={customerInputRef}
                  type="text"
                  value={customerSearch || customerName}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    if (!selectedCustomer) setCustomerName(e.target.value);
                  }}
                  onFocus={() => setSelectedCustomer(null)}
                  placeholder="Search or enter name"
                  className="w-full border border-red-900/50 rounded-lg px-3 py-1.5 text-sm bg-black/60 text-white placeholder-red-400/50"
                />
                {customers.length > 0 && !selectedCustomer && (
                  <ul className="absolute left-0 right-0 mt-1 border border-red-900/50 rounded-lg bg-black/95 shadow-lg max-h-36 overflow-auto z-10">
                    {customers.map((c) => (
                      <li
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerName(c.name);
                          setCustomerSearch('');
                        }}
                        className="px-3 py-2 hover:bg-red-950/50 cursor-pointer text-white text-sm"
                      >
                        {c.name} {c.phone && `(${c.phone})`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" onClick={() => setShowQuickAdd(true)} className="px-3 py-1.5 bg-red-950/60 rounded-lg hover:bg-red-900/70 text-red-200 text-sm whitespace-nowrap">
                Quick Add
              </button>
            </div>
          </div>
          {showQuickAdd && (
            <div className="sm:col-span-2 flex gap-2 items-center p-2 bg-red-950/20 rounded-lg">
              <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Name" className="border border-red-900/50 rounded px-3 py-1.5 text-sm bg-black/60 text-white placeholder-red-400/50" required />
              <input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="Phone" className="border border-red-900/50 rounded px-3 py-1.5 text-sm bg-black/60 text-white placeholder-red-400/50" />
              <button type="button" onClick={handleQuickAddCustomer} disabled={quickAddLoading} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">{quickAddLoading ? 'Adding...' : 'Add'}</button>
              <button type="button" onClick={() => setShowQuickAdd(false)} className="px-3 py-1.5 text-red-300 text-sm">Cancel</button>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-red-200/90 mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="w-full border border-red-900/50 rounded px-3 py-1.5 text-sm bg-black/60 text-white placeholder-red-400/50" />
          </div>
        </div>
      </div>

      <div ref={addItemsSectionRef} className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-white text-sm">Add Items</h3>
          {billableItemsLoading ? (
            <span className="text-xs text-amber-400/90">Loading items...</span>
          ) : billableItemsError ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">{billableItemsError}</span>
              <button type="button" onClick={fetchBillableItems} className="px-2 py-1 text-xs bg-red-950/60 text-red-200 rounded hover:bg-red-900/70">
                Retry
              </button>
            </div>
          ) : billableItems.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-300/70">No items. Add materials in Settings and stock in Stock page. Ensure backend is running.</span>
              <button type="button" onClick={fetchBillableItems} className="px-2 py-1 text-xs bg-red-950/60 text-red-200 rounded hover:bg-red-900/70">
                Refresh
              </button>
            </div>
          ) : (
            <button type="button" onClick={fetchBillableItems} className="px-2 py-1 text-xs text-red-400 hover:text-red-300" title="Refresh items">
              ↻ Refresh
            </button>
          )}
        </div>
        <p className="text-xs text-red-300/70 mb-2">Click Item → Size → Qty to add. Select from dropdowns.</p>

        <div className="border border-red-950/40 rounded-lg overflow-hidden">
          <div className="max-h-[240px] overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead className="sticky top-0 bg-red-950/50 z-10">
                <tr>
                  <th className="text-left p-2 border border-red-950/50 text-red-200 text-xs">Item</th>
                  <th className="text-left p-2 border border-red-950/50 text-red-200 text-xs">Size</th>
                  {isBannerOrSticker(selectedItem?.type) && (
                    <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">Sqft available</th>
                  )}
                  <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">
                    {isBannerOrSticker(selectedItem?.type) ? 'Qty(sqft)' : 'Qty'}
                  </th>
                  <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">Unit Price</th>
                  <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">Discount</th>
                  <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">Subtotal</th>
                  <th className="w-16 p-2 border border-red-950/50"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-red-950/30 border-b border-red-950/40">
                  <td className="p-2 border border-red-950/40 text-white text-sm">{item.item_name}</td>
                  <td className="p-2 border border-red-950/40 text-red-200/90 text-sm">
                    {item.size || '-'}
                  </td>
                  {isBannerOrSticker(selectedItem?.type) && (
                    <td className="p-2 border border-red-950/40 text-right tabular-nums text-red-300/90 text-sm">-</td>
                  )}
                  <td className="p-2 border border-red-950/40 text-right tabular-nums text-white text-sm">{item.quantity}</td>
                  <td className="p-2 border border-red-950/40 text-right tabular-nums text-white text-sm">Rs.{item.unit_price?.toFixed(2)}</td>
                  <td className="p-2 border border-red-950/40 text-right tabular-nums text-red-300/90 text-sm">{(item.discount || 0) > 0 ? `Rs.${(item.discount || 0).toFixed(2)}` : '-'}</td>
                  <td className="p-2 border border-red-950/40 text-right tabular-nums text-white text-sm">Rs.{item.subtotal?.toFixed(2)}</td>
                  <td className="p-2 border border-red-950/40">
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:underline text-xs">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              <tr ref={addRowRef} className="bg-red-950/20">
                <td ref={itemTriggerRef} className="p-1.5 border border-red-950/40 relative">
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
                  placeholder="Select item"
                  className="w-full border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white placeholder-red-400/50"
                />
                {itemDropdownOpen &&
                  itemDropdownRect &&
                  createPortal(
                    <ul
                      data-bill-dropdown
                      className="fixed border border-red-900/50 rounded-lg bg-black/95 shadow-xl max-h-40 overflow-auto z-[9999]"
                      style={{
                        top: itemDropdownRect.bottom + 4,
                        left: itemDropdownRect.left,
                        width: Math.max(itemDropdownRect.width, 200),
                      }}
                    >
                      {filteredItemNames.length === 0 ? (
                        <li className="px-3 py-2 text-red-300/80 text-sm">No items. Add materials and stock in Settings / Stock first.</li>
                      ) : (
                        filteredItemNames.map((name) => (
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
                                setQuantity('');
                                setUnitPriceStr((first.calcType === 'sqft' || first.calcType === 'sqft_direct') ? String(first.pricePerSqft ?? '') : String(first.unitPrice ?? ''));
                              }
                            }}
                            className="px-3 py-2 hover:bg-red-950/50 cursor-pointer text-white"
                          >
                            {name}
                          </li>
                        ))
                      )}
                    </ul>,
                    document.body
                  )}
                </td>
                <td ref={sizeTriggerRef} className="p-1.5 border border-red-950/40 relative">
                  <div className="flex items-center gap-1">
                    {isBannerOrSticker(selectedItem?.type) && selectedSize ? (
                      <div className="flex items-center gap-0.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => setSizeDropdownOpen((o) => !o)}
                          className="shrink-0 p-0.5 text-red-300/70 hover:text-red-200"
                          title="Change roll"
                        >
                          ▼
                        </button>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={sizeWidthStr}
                          onFocus={() => {
                            if (!sizeWidthStr.trim()) setSizeDropdownOpen(true);
                          }}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9.]/g, '');
                            setSizeWidthStr(v);
                            const w = parseFloat(v) || 0;
                            const len = parseFloat(sizeLengthStr) || 0;
                            if (w > 0 && len > 0) setQuantity(String(Math.round(w * len * 100) / 100));
                            const match = sizesForItem.find((s) => (s.widthFt ?? 0) === w);
                            if (match) setSelectedSize(match);
                            else if (!v.trim()) setSizeDropdownOpen(true);
                          }}
                          placeholder="Width"
                          className="w-10 border border-red-900/50 rounded px-1 py-1 text-sm text-right tabular-nums bg-black/60 text-white placeholder-red-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-red-200/90 text-sm shrink-0 px-0.5">X</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={sizeLengthStr}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9.]/g, '');
                            setSizeLengthStr(v);
                            const len = parseFloat(v) || 0;
                            const w = parseFloat(sizeWidthStr) || 0;
                            if (w > 0 && len > 0) setQuantity(String(Math.round(w * len * 100) / 100));
                          }}
                          placeholder="Length"
                          className="w-10 border border-red-900/50 rounded px-1 py-1 text-sm text-right tabular-nums bg-black/60 text-white placeholder-red-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={formatSizeDisplay(selectedSize?.sizeName) || ''}
                        readOnly
                        onFocus={() => selectedItem && setSizeDropdownOpen(true)}
                        onClick={() => selectedItem && setSizeDropdownOpen(true)}
                        placeholder="Size"
                        className="flex-1 min-w-0 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white cursor-pointer placeholder-red-400/50"
                      />
                    )}
                  {selectedSize && selectedSize.stockQty !== undefined && (
                    <span className="text-xs text-red-300/90 whitespace-nowrap shrink-0">
                      In stock: {selectedSize.stockQty}
                    </span>
                  )}
                </div>
                {sizeDropdownOpen &&
                  sizesForItem.length > 0 &&
                  sizeDropdownRect &&
                  createPortal(
                    <ul
                      data-bill-dropdown
                      className="fixed border border-red-900/50 rounded-lg bg-black/95 shadow-xl z-[9999] min-w-[280px] max-h-48 overflow-auto"
                      style={{
                        top: sizeDropdownRect.bottom + 4,
                        left: sizeDropdownRect.left,
                        width: Math.max(sizeDropdownRect.width, 280),
                      }}
                    >
                      {sizesForItem.map((s, idx) => (
                        <li
                          key={idx}
                          onClick={() => {
                            setSelectedSize(s);
                            setSizeDropdownOpen(false);
                            setQuantity('');
                            setItemDiscountStr('');
                            setUnitPriceStr((s.calcType === 'sqft' || s.calcType === 'sqft_direct') ? String(s.pricePerSqft ?? '') : String(s.unitPrice ?? ''));
                          }}
                          className="px-3 py-2 hover:bg-red-950/50 cursor-pointer flex justify-between items-center gap-2 text-white"
                        >
                          <span>
                            {isBannerOrSticker(selectedItem?.type)
                              ? `${s.widthFt ?? 0} feet roll (${Math.round(((s as { feetRemaining?: number }).feetRemaining ?? 0) * 100) / 100} sqft balance can print)`
                              : formatSizeDisplay(s.sizeName) || s.sizeName}{' '}
                            {!isBannerOrSticker(selectedItem?.type) && '(in)'}
                          </span>
                          <span className="flex items-center gap-2 text-red-300/70 text-sm shrink-0">
                            {(s.stockQty !== undefined && selectedItem?.type !== 'banner_roll' && selectedItem?.type !== 'sticker_roll') && (
                              <span className="text-emerald-400/90">Stock: {s.stockQty}</span>
                            )}
                            {(s.calcType === 'sqft' || s.calcType === 'sqft_direct') ? `Rs.${s.pricePerSqft}/sqft` : `Rs.${s.unitPrice}`}
                          </span>
                        </li>
                      ))}
                    </ul>,
                    document.body
                  )}
                </td>
                {isBannerOrSticker(selectedItem?.type) && (
                  <td className="p-1.5 border border-red-950/40 text-right tabular-nums text-emerald-400/90 text-sm">
                    {selectedSize ? `${Math.round(((selectedSize as { feetRemaining?: number }).feetRemaining ?? 0) * 100) / 100} sqft` : '-'}
                  </td>
                )}
                <td className="p-1.5 border border-red-950/40 text-right">
                  <input
                    type="number"
                    min={selectedItem?.calcType === 'sqft_direct' ? '0.01' : '1'}
                    step={selectedItem?.calcType === 'sqft_direct' ? '0.01' : '1'}
                    placeholder={selectedItem?.calcType === 'sqft_direct' ? 'Sqft' : '1'}
                    value={quantity}
                    onChange={(e) => setQuantity(selectedItem?.calcType === 'sqft_direct' ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-16 border border-red-900/50 rounded px-1 py-1 text-sm text-right tabular-nums bg-black/60 text-white placeholder-red-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="p-1.5 border border-red-950/40 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={unitPriceStr}
                    onChange={(e) => setUnitPriceStr(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={selectedSize ? (selectedSize.calcType === 'sqft' ? 'per sqft' : '0') : '-'}
                    className="w-16 border border-red-900/50 rounded px-1 py-1 text-xs text-right tabular-nums bg-black/60 text-white placeholder-red-400/50"
                  />
                </td>
                <td className="p-1.5 border border-red-950/40 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={itemDiscountStr}
                    onChange={(e) => setItemDiscountStr(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    className="w-14 border border-red-900/50 rounded px-1 py-1 text-xs text-right tabular-nums bg-black/60 text-white placeholder-red-400/50"
                  />
                </td>
                <td className="p-1.5 border border-red-950/40 text-right tabular-nums font-medium text-xs text-white">
                  Rs.{currentSubtotal.toFixed(2)}
                </td>
                <td className="p-1.5 border border-red-950/40">
                  <button
                    type="button"
                    onClick={() => {
                      addItem();
                      setItemDropdownOpen(false);
                      setSizeDropdownOpen(false);
                    }}
                    disabled={!selectedItem || !selectedSize || !quantity || (selectedItem?.calcType === 'sqft_direct' ? parseFloat(quantity) < 0.01 : parseInt(quantity) < 1)}
                    className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </td>
              </tr>
              <tr className="bg-red-950/30 border-b border-red-950/40">
                <td className="p-2 border border-red-950/40" colSpan={isBannerOrSticker(selectedItem?.type) ? 5 : 4}></td>
                <td className="p-2 border border-red-950/40 text-right tabular-nums font-semibold text-white text-sm">
                  Total
                </td>
                <td className="p-2 border border-red-950/40 text-right">
                  <div className="inline-block min-w-[4rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white tabular-nums font-semibold text-right">
                    Rs.{total.toFixed(2)}
                  </div>
                </td>
                <td className="p-2 border border-red-950/40"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 pt-3 border-t border-red-950/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Payment</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full max-w-[140px] border border-red-900/50 rounded px-3 py-1.5 text-sm bg-black/60 text-white">
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Advance (Rs.)</label>
              <input type="text" inputMode="decimal" value={advanceStr} onChange={(e) => setAdvanceStr(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" className="w-full max-w-[120px] border border-red-900/50 rounded px-3 py-1.5 text-sm text-right tabular-nums bg-black/60 text-white placeholder-red-400/50" />
              {advance > 0 && <span className="block text-xs text-amber-400/90 mt-0.5">Balance: Rs.{balance.toFixed(2)}</span>}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Saving...' : 'Save Bill'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </form>
  );
}
