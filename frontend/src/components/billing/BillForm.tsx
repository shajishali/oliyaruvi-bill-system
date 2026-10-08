import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';
import type { Bill, BillItem, BillableItem, Customer } from '../../types';
import { formatSizeDisplay, parseSizeDimensions } from '../../utils/sizeFormat';
import { dedupeBillableItems, sameProductGroupForSizePicker } from '../../utils/billableDisplay';
import { buildBillingPlaceholderOptions } from '../../constants/billingItemPlaceholderAllowlist';

interface BillFormProps {
  onBillCreated: (bill: Bill) => void;
  editingBill?: Bill | null;
  onEditSaved?: (bill: Bill) => void;
  onCancelEdit?: () => void;
}

type BillFormLineItem = BillItem & {
  service_type?: string;
  frame_id?: number;
  photo_id?: number;
  photocopy_id?: number;
  metadata?: Record<string, unknown>;
};

const parseBillItemMetadata = (metadata: BillItem['metadata']): Record<string, unknown> => {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return metadata;
};

interface EditNumberInputProps {
  value: number;
  min?: number;
  step?: number;
  widthClass: string;
  onValueChange: (value: number) => void;
}

function EditNumberInput({ value, min = 0, step = 1, widthClass, onValueChange }: EditNumberInputProps) {
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  const normalize = (next: number) => {
    const rounded = Number(next.toFixed(decimals));
    return Math.max(min, rounded);
  };
  const bump = (direction: 1 | -1) => onValueChange(normalize((Number(value) || 0) + direction * step));

  return (
    <div className={`inline-flex ${widthClass} overflow-hidden rounded border border-red-900/50 bg-black/60 focus-within:ring-1 focus-within:ring-red-700/70`}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onValueChange(normalize(parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0))}
        className="min-w-0 flex-1 bg-transparent px-2 py-1 text-right text-sm tabular-nums text-white outline-none"
      />
      <div className="flex w-7 shrink-0 flex-col border-l border-red-900/60 bg-white/90 text-black">
        <button
          type="button"
          onClick={() => bump(1)}
          className="h-1/2 leading-none text-[10px] hover:bg-red-100"
          aria-label="Increase"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => bump(-1)}
          className="h-1/2 border-t border-black/10 leading-none text-[10px] hover:bg-red-100"
          aria-label="Decrease"
        >
          -
        </button>
      </div>
    </div>
  );
}

export default function BillForm({ onBillCreated, editingBill, onEditSaved, onCancelEdit }: BillFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeCustomerSearchField, setActiveCustomerSearchField] = useState<'name' | 'phone'>('name');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
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
  /** Free-text size when not using roll dimensions, or override label after picking from list */
  const [manualSizeInput, setManualSizeInput] = useState('');
  /** Manual lines only: whether unit price is per sqft or per piece */
  const [manualPricingUnit, setManualPricingUnit] = useState<'per_sqft' | 'per_unit'>('per_unit');
  /** Stock row `stock_type` (banner/sticker tabs) — filters roll widths in Size */
  const [selectedStockTypeKey, setSelectedStockTypeKey] = useState('');
  const [savedBill, setSavedBill] = useState<Bill | null>(null);
  const [savedBillWasEdit, setSavedBillWasEdit] = useState(false);
  const addRowRef = useRef<HTMLTableRowElement>(null);
  const customerSectionRef = useRef<HTMLDivElement>(null);
  const addItemsSectionRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const itemTriggerRef = useRef<HTMLTableCellElement>(null);
  const sizeTriggerRef = useRef<HTMLTableCellElement>(null);
  const [itemDropdownRect, setItemDropdownRect] = useState<DOMRect | null>(null);
  const [sizeDropdownRect, setSizeDropdownRect] = useState<DOMRect | null>(null);

  const fetchBillableItems = (scrollToItems = true) => {
    setBillableItemsLoading(true);
    setBillableItemsError(null);
    return api.services.billableItems()
      .then((items) => {
        setBillableItems(items);
        setBillableItemsError(null);
        if (scrollToItems && items.length > 0) {
          addItemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return items;
      })
      .catch((err) => {
        setBillableItems([]);
        setBillableItemsError((err as Error).message || 'Failed to load items. Is the backend running on port 5000?');
        return [];
      })
      .finally(() => setBillableItemsLoading(false));
  };

  useEffect(() => {
    fetchBillableItems();
  }, []);

  // Re-fetch whenever the tab becomes visible (user switches back from another page/app)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchBillableItems(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const q = customerSearch.trim();
    if (q.length < 2) {
      setCustomers([]);
      return;
    }
    api.customers.search(q).then(setCustomers);
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

  useEffect(() => {
    if (!editingBill) return;

    setSavedBill(null);
    setError('');
    setCustomerName(editingBill.customer_name || '');
    setCustomerPhone(editingBill.customer_phone || '');
    setCustomerSearch('');
    setCustomers([]);
    setSelectedCustomer(
      editingBill.customer_id
        ? {
            id: editingBill.customer_id,
            name: editingBill.customer_name || '',
            phone: editingBill.customer_phone || null,
          }
        : null
    );
    setPaymentMethod(editingBill.payment_method || 'Cash');
    setNotes(editingBill.notes || '');
    setAdvanceStr('');
    setItems(
      (editingBill.items || []).map((item) => ({
        ...item,
        discount: item.item_discount ?? item.discount ?? 0,
        metadata: parseBillItemMetadata(item.metadata),
      }))
    );
    setSelectedItem(null);
    setSelectedSize(null);
    setSelectedStockTypeKey('');
    setItemSearch('');
    setManualSizeInput('');
    setQuantity('');
    setUnitPriceStr('');
    setItemDiscountStr('');
    addItemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingBill]);

  const advanceAmount = parseFloat(advanceStr) || 0;
  const subtotal = items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
  const total = subtotal;
  const advance = Math.min(total, Math.max(0, advanceAmount));
  const balance = total - advance;

  /** Item picker lists only catalog rows from Settings / Stock (no “manual” list entries). */
  const itemListOptions = useMemo(() => buildBillingPlaceholderOptions(billableItems), [billableItems]);

  const filteredItemOptions = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return itemListOptions;
    return itemListOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.display.toLowerCase().includes(q) ||
        o.groupLabel.toLowerCase().includes(q)
    );
  }, [itemListOptions, itemSearch]);

  const groupedItemOptions = useMemo(() => {
    const groups: { label: string; options: typeof filteredItemOptions }[] = [];
    for (const option of filteredItemOptions) {
      const group = option.groupLabel || 'Settings items';
      let existing = groups.find((g) => g.label === group);
      if (!existing) {
        existing = { label: group, options: [] };
        groups.push(existing);
      }
      existing.options.push(option);
    }
    return groups;
  }, [filteredItemOptions]);

  const manualEntryActive = !selectedItem && itemSearch.trim().length > 0;

  const isBannerOrSticker = (t?: string) =>
    t === 'banner' || t === 'banner_roll' || t === 'sticker_roll';
  const isBannerOrStickerOrCustomRoll = (t?: string, calcType?: string) =>
    isBannerOrSticker(t) || (t === 'custom' && calcType === 'sqft_direct');

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const rollStockKeyForItem = (item: BillableItem | BillFormLineItem | null | undefined) => {
    const meta = (item as { metadata?: Record<string, unknown> } | null | undefined)?.metadata;
    const bannerId =
      (item as { bannerStockId?: number } | null | undefined)?.bannerStockId ??
      (typeof meta?.banner_stock_id === 'number' ? meta.banner_stock_id : undefined);
    if (bannerId != null) return `banner:${bannerId}`;

    const stickerId =
      (item as { stickerStockId?: number } | null | undefined)?.stickerStockId ??
      (typeof meta?.sticker_stock_id === 'number' ? meta.sticker_stock_id : undefined);
    if (stickerId != null) return `sticker:${stickerId}`;

    const customId =
      (item as { customItemId?: number | null } | null | undefined)?.customItemId ??
      (typeof meta?.custom_item_id === 'number' ? meta.custom_item_id : undefined);
    if (
      customId != null &&
      (item as { service_type?: string; type?: string })?.service_type === 'custom' &&
      rollWidthForItem(item) > 0
    ) {
      return `custom:${customId}`;
    }
    if (customId != null && (item as { type?: string; calcType?: string })?.type === 'custom' && (item as { calcType?: string })?.calcType === 'sqft_direct') {
      return `custom:${customId}`;
    }

    return null;
  };

  const rollWidthForItem = (item: BillableItem | BillFormLineItem | null | undefined) => {
    const meta = (item as { metadata?: Record<string, unknown> } | null | undefined)?.metadata;
    const metaWidth = typeof meta?.width_ft === 'number' ? meta.width_ft : parseFloat(String(meta?.width_ft || ''));
    if (metaWidth > 0) return metaWidth;
    return (item as { widthFt?: number } | null | undefined)?.widthFt || 0;
  };

  const getBaseRollAvailableSqft = (item: BillableItem | null | undefined) => {
    if (!item || !isBannerOrStickerOrCustomRoll(item.type, item.calcType)) return 0;
    const width = item.widthFt || parseFloat(sizeWidthStr) || 0;
    const feet = item.feetRemaining ?? (item.stockQty ?? 0) * 150;
    return Math.max(0, width * feet);
  };

  const getPendingRollUsedSqft = (stockKey: string | null) => {
    if (!stockKey) return 0;
    return items.reduce((sum, item) => {
      if (rollStockKeyForItem(item) !== stockKey) return sum;
      return sum + (parseFloat(String(item.quantity)) || 0);
    }, 0);
  };

  const getRemainingRollAvailableSqft = (item: BillableItem | null | undefined) => {
    const base = getBaseRollAvailableSqft(item);
    const pending = getPendingRollUsedSqft(rollStockKeyForItem(item));
    return Math.max(0, round2(base - pending));
  };

  const groupRowsForItem = useMemo(() => {
    if (!selectedItem) return [];
    return billableItems.filter((i) => sameProductGroupForSizePicker(selectedItem, i));
  }, [billableItems, selectedItem]);

  /** Distinct Stock "Type" values (stock_type) for the selected material — from Stock page rows */
  const stockTypeOptions = useMemo(() => {
    if (!selectedItem || (selectedItem.type !== 'banner_roll' && selectedItem.type !== 'sticker_roll')) return [];
    const keys = new Set<string>();
    for (const r of groupRowsForItem) {
      if (r.type !== 'banner_roll' && r.type !== 'sticker_roll') continue;
      keys.add(String(r.stockTypeLabel || '').trim());
    }
    return Array.from(keys).sort((a, b) => (a || '\uFFFF').localeCompare(b || '\uFFFF'));
  }, [groupRowsForItem, selectedItem]);

  const showStockTypeColumn =
    selectedItem != null &&
    (selectedItem.type === 'banner_roll' || selectedItem.type === 'sticker_roll') &&
    stockTypeOptions.length > 0;

  const showTypeCol = useMemo(() => {
    if (showStockTypeColumn) return true;
    return items.some((i) => {
      const m = i.metadata as { stock_type_label?: string } | undefined;
      return m != null && String(m.stock_type_label || '').trim() !== '';
    });
  }, [showStockTypeColumn, items]);

  const sizesForItem = useMemo(() => {
    if (!selectedItem) return [];
    const base = dedupeBillableItems(groupRowsForItem);
    if (!showStockTypeColumn) return base;
    if (stockTypeOptions.length > 1 && selectedStockTypeKey === '') return [];
    return dedupeBillableItems(
      groupRowsForItem.filter((r) => String(r.stockTypeLabel || '').trim() === selectedStockTypeKey)
    );
  }, [groupRowsForItem, selectedItem, showStockTypeColumn, stockTypeOptions.length, selectedStockTypeKey]);

  function applyRollSizePick(pick: BillableItem | null) {
    setSelectedSize(pick);
    if (pick) {
      const isRoll =
        pick.type === 'banner_roll' ||
        pick.type === 'sticker_roll' ||
        (pick.type === 'custom' && pick.calcType === 'sqft_direct');
      if (isRoll) {
        const w = pick.widthFt ?? 0;
        const defaultLen = w > 0 ? w : 0;
        setSizeWidthStr(String(w));
        setSizeLengthStr(String(defaultLen));
        setQuantity(
          w > 0 && defaultLen > 0 ? String(Math.round(w * defaultLen * 100) / 100) : ''
        );
      }
      setUnitPriceStr(
        pick.calcType === 'sqft' || pick.calcType === 'sqft_direct'
          ? String(pick.pricePerSqft ?? pick.unitPrice ?? '')
          : String(pick.unitPrice ?? '')
      );
      setManualSizeInput(formatSizeDisplay(pick.sizeName) || pick.sizeName || '');
    } else {
      setUnitPriceStr('');
      setManualSizeInput('');
      setSizeWidthStr('');
      setSizeLengthStr('');
      setQuantity('');
    }
  }

  const getDefaultUnitPrice = () => {
    if (!selectedSize) return 0;
    if (selectedSize.calcType === 'sqft' || selectedSize.calcType === 'sqft_direct') {
      return Number(selectedSize.pricePerSqft ?? selectedSize.unitPrice ?? 0) || 0;
    }
    return selectedSize.unitPrice || 0;
  };

  const calcSubtotal = () => {
    const qty = parseFloat(String(quantity)) || 0;
    // Manual line: typed item name, no catalog row — qty × unit price − discount
    if (!selectedItem && itemSearch.trim()) {
      if (qty <= 0) return 0;
      const unitPrice = parseFloat(unitPriceStr) || 0;
      const itemDiscount = parseFloat(itemDiscountStr) || 0;
      return Math.max(0, qty * unitPrice - itemDiscount);
    }
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
    const st = calcSubtotal();
    if (st <= 0) return;

    const nameManual = itemSearch.trim();
    if (!selectedItem && nameManual) {
      const qty = parseFloat(String(quantity)) || 0;
      const unitPrice = parseFloat(unitPriceStr) || 0;
      if (qty <= 0 || unitPrice <= 0) return;
      const itemDiscount = parseFloat(itemDiscountStr) || 0;
      const newManual: BillFormLineItem = {
        service_type: 'manual',
        item_name: nameManual,
        size: manualSizeInput.trim() || '-',
        quantity: qty,
        unit_price: unitPrice,
        discount: itemDiscount,
        subtotal: st,
        metadata: { pricing_unit: manualPricingUnit },
      };
      setItems((prev) => [...prev, newManual]);
      setItemSearch('');
      setManualSizeInput('');
      setQuantity('');
      setUnitPriceStr('');
      setItemDiscountStr('');
      setManualPricingUnit('per_unit');
      return;
    }

    const qty = selectedItem?.calcType === 'sqft_direct' ? parseFloat(String(quantity)) : parseInt(String(quantity)) || 0;
    if (!selectedItem || !selectedSize || qty <= 0) return;
    const remainingSqft = getRemainingRollAvailableSqft(selectedSize);
    if (selectedItem.calcType === 'sqft_direct' && isBannerOrStickerOrCustomRoll(selectedItem.type, selectedItem.calcType) && qty > remainingSqft) {
      setError(`Only ${remainingSqft} sqft available for this stock row`);
      return;
    }

    const sizeDisplay = formatSizeDisplay(selectedSize.sizeName) || selectedSize.sizeName;
    const labelFromApi = selectedSize.itemLabel?.trim();
    let itemName: string;
    if (labelFromApi) {
      itemName = labelFromApi;
    } else if (selectedItem.type === 'banner' || selectedItem.type === 'banner_roll') {
      itemName = selectedSize.materialName || selectedItem.name;
    } else if (selectedItem.type === 'sticker_roll') {
      itemName = selectedSize.materialName || selectedItem.name;
    } else if (selectedItem.type === 'service' || selectedItem.type === 'service_item') {
      itemName = selectedItem.name;
    } else {
      itemName = `${selectedItem.name} ${sizeDisplay}`;
    }

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
    let metadata: { banner_stock_id?: number; sticker_stock_id?: number; width_ft?: number; custom_item_id?: number } | undefined;
    if (selectedItem.type === 'banner_roll' && bannerStockId) {
      metadata = {
        banner_stock_id: bannerStockId,
        width_ft: editedWidth,
        ...(selectedItem.calcType === 'fixed' ? { pricing_unit: 'per_qty' as const } : {}),
        ...(String(selectedSize.stockTypeLabel || '').trim()
          ? { stock_type_label: String(selectedSize.stockTypeLabel || '').trim() }
          : {}),
      };
    }
    else if (selectedItem.type === 'sticker_roll' && stickerStockId) {
      metadata = {
        sticker_stock_id: stickerStockId,
        width_ft: editedWidth,
        ...(String(selectedSize.stockTypeLabel || '').trim()
          ? { stock_type_label: String(selectedSize.stockTypeLabel || '').trim() }
          : {}),
      };
    }

    const sizeForRow =
      isBannerOrStickerOrCustomRoll(selectedItem.type, selectedItem.calcType) && selectedSize
        ? `${parseFloat(sizeWidthStr) || selectedSize.widthFt || 0} X ${parseFloat(sizeLengthStr) || (qty / (selectedSize.widthFt || 1) || 0)}`
        : manualSizeInput.trim() || formatSizeDisplay(selectedSize.sizeName) || selectedSize.sizeName;

    const customItemId = (selectedSize as { customItemId?: number | null }).customItemId;
    if (selectedItem.type === 'custom' && customItemId != null) {
      metadata = { ...metadata, custom_item_id: customItemId };
      if (selectedItem.calcType === 'sqft_direct') {
        metadata.width_ft = parseFloat(sizeWidthStr) || selectedSize.widthFt || 6;
      }
    }

    const newItem: BillFormLineItem = {
      service_type: selectedItem.type,
      item_name: itemName,
      size: sizeForRow,
      quantity: qty,
      unit_price: selectedItem.calcType === 'sqft_direct' ? unitPrice : basePrice,
      discount: itemDiscount,
      subtotal: st,
      frame_id: selectedItem.type === 'frame' ? (selectedSize.frameId ?? undefined) : undefined,
      photo_id: selectedItem.type === 'photo' ? selectedSize.sizeId : undefined,
      photocopy_id: selectedItem.type === 'photocopy' ? selectedSize.sizeId : undefined,
      metadata,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedItem(null);
    setSelectedSize(null);
    setSelectedStockTypeKey('');
    setQuantity('');
    setSizeWidthStr('');
    setSizeLengthStr('');
    setManualSizeInput('');
    setUnitPriceStr('');
    setItemDiscountStr('');
    setItemSearch('');
  };

  const updateExistingItem = (idx: number, patch: Partial<BillFormLineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, ...patch };
        const qty = parseFloat(String(next.quantity)) || 0;
        const unit = parseFloat(String(next.unit_price)) || 0;
        const discount = parseFloat(String(next.discount ?? next.item_discount ?? 0)) || 0;
        return {
          ...next,
          discount,
          subtotal: Math.max(0, qty * unit - discount),
        };
      })
    );
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const startManualItem = () => {
    setSelectedItem(null);
    setSelectedSize(null);
    setSelectedStockTypeKey('');
    setSizeWidthStr('');
    setSizeLengthStr('');
    setManualSizeInput('');
    setUnitPriceStr('');
    setItemDiscountStr('');
    if (!itemSearch.trim()) setItemSearch('Manual item');
    setManualPricingUnit('per_unit');
    setItemDropdownOpen(false);
    setSizeDropdownOpen(false);
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setCustomerSearch('');
    setCustomers([]);
  };

  const handleSaveCustomer = async () => {
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!name) {
      setError('Customer name is required');
      customerInputRef.current?.focus();
      return;
    }
    setQuickAddLoading(true);
    setError('');
    try {
      const c = selectedCustomer
        ? await api.customers.update(selectedCustomer.id, { name, phone: phone || null })
        : await api.customers.create({ name, phone: phone || null });
      selectCustomer(c);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleQuickAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    setQuickAddLoading(true);
    try {
      const c = await api.customers.create({ name: newCustomerName.trim(), phone: newCustomerPhone || null });
      selectCustomer(c);
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
      let billCustomer = selectedCustomer;
      const phone = customerPhone.trim();
      if (!billCustomer && phone) {
        billCustomer = await api.customers.create({ name, phone });
        selectCustomer(billCustomer);
      }
      if (
        billCustomer &&
        (billCustomer.name !== name || (billCustomer.phone || '') !== phone)
      ) {
        billCustomer = await api.customers.update(billCustomer.id, { name, phone: phone || null });
        selectCustomer(billCustomer);
      }
      const billPayload = {
        customer_id: billCustomer?.id || null,
        customer_name: name,
        customer_phone: phone || billCustomer?.phone || null,
        items,
        discount: 0,
        payment_method: paymentMethod,
        notes: notes || null,
      };
      const isEditing = !!editingBill;
      const bill = isEditing
        ? await api.bills.update(editingBill.id, billPayload)
        : await api.bills.create({
            customer_id: billCustomer?.id || null,
            ...billPayload,
            advance_amount: advance,
          });
      await fetchBillableItems(false);
      setSavedBillWasEdit(isEditing);
      setSavedBill(bill);
      if (isEditing) onEditSaved?.(bill);
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
        <p className="text-emerald-400 font-semibold text-lg mb-4">{savedBillWasEdit ? 'Bill updated' : 'Bill saved'}</p>
        <p className="text-red-200/90 text-sm mb-6">Bill #{savedBill.bill_number} has been {savedBillWasEdit ? 'updated' : 'saved'} successfully.</p>
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

      {editingBill && (
        <div className="bg-amber-950/40 border border-amber-700/40 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-amber-100 font-semibold text-sm">Editing {editingBill.bill_number}</p>
            <p className="text-amber-200/75 text-xs">Change customer details or bill items here, then save changes.</p>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-3 py-1.5 bg-black/50 text-amber-100 rounded-lg text-sm border border-amber-800/50 hover:bg-amber-950/60"
          >
            Cancel edit
          </button>
        </div>
      )}

      <div ref={customerSectionRef} className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Customer name</label>
            <div className="relative">
                <input
                  ref={customerInputRef}
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomerName(value);
                    setActiveCustomerSearchField('name');
                    setCustomerSearch(value);
                  }}
                  onBlur={() => setTimeout(() => setCustomers([]), 150)}
                  placeholder="Search or enter name"
                  className="w-full border border-red-900/50 rounded-lg px-3 py-1.5 text-sm bg-black/60 text-white placeholder-red-400/50"
                />
                {customers.length > 0 && !selectedCustomer && activeCustomerSearchField === 'name' && (
                  <ul className="absolute left-0 right-0 mt-1 border border-red-900/50 rounded-lg bg-black/95 shadow-lg max-h-44 overflow-auto z-10">
                    {customers.map((c) => (
                      <li
                        key={c.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCustomer(c)}
                        className="px-3 py-2 hover:bg-red-950/50 cursor-pointer text-white text-sm"
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.phone && <span className="ml-2 text-red-300/75">{c.phone}</span>}
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Mobile number</label>
            <div className="relative flex gap-2 items-center">
              <input
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9+ -]/g, '');
                  setCustomerPhone(value);
                  setActiveCustomerSearchField('phone');
                  setCustomerSearch(value);
                }}
                onBlur={() => setTimeout(() => setCustomers([]), 150)}
                placeholder="Search or enter mobile"
                className="w-full border border-red-900/50 rounded-lg px-3 py-1.5 text-sm bg-black/60 text-white placeholder-red-400/50"
              />
              {customers.length > 0 && !selectedCustomer && activeCustomerSearchField === 'phone' && (
                <ul className="absolute left-0 right-0 mt-1 border border-red-900/50 rounded-lg bg-black/95 shadow-lg max-h-44 overflow-auto z-10">
                  {customers.map((c) => (
                    <li
                      key={c.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCustomer(c)}
                      className="px-3 py-2 hover:bg-red-950/50 cursor-pointer text-white text-sm"
                    >
                      <span className="font-medium">{c.phone || 'No phone'}</span>
                      <span className="ml-2 text-red-300/75">{c.name}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={handleSaveCustomer}
                disabled={quickAddLoading || !customerName.trim()}
                className="px-3 py-1.5 bg-red-950/60 rounded-lg hover:bg-red-900/70 text-red-200 text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quickAddLoading ? 'Saving...' : selectedCustomer ? 'Update' : 'Save'}
              </button>
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
              <button type="button" onClick={() => fetchBillableItems()} className="px-2 py-1 text-xs bg-red-950/60 text-red-200 rounded hover:bg-red-900/70">
                Retry
              </button>
            </div>
          ) : billableItems.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-300/70">No items. Add materials in Settings and stock in Stock page. Ensure backend is running.</span>
              <button type="button" onClick={() => fetchBillableItems()} className="px-2 py-1 text-xs bg-red-950/60 text-red-200 rounded hover:bg-red-900/70">
                Refresh
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fetchBillableItems()} className="px-2 py-1 text-xs text-red-400 hover:text-red-300" title="Refresh items">
              ↻ Refresh
            </button>
          )}
        </div>
        <p className="text-xs text-red-300/70 mb-2">
          Pick from the lists when available, or type item and size manually. For manual lines, choose <strong className="text-red-200/90">Rs./sqft</strong> or{' '}
          <strong className="text-red-200/90">Rs./unit</strong>, then qty and rate, then Add.
        </p>
        {(selectedItem?.type === 'banner_roll' || selectedItem?.type === 'sticker_roll') && (
          <p className="text-xs text-amber-200/85 mb-2 rounded border border-amber-900/40 bg-amber-950/25 px-2 py-1.5">
            <span className="font-medium text-amber-100/95">Banner / sticker rolls:</span>{' '}
            <strong className="text-white">Item</strong> is the material rate from Settings.{' '}
            <strong className="text-white">Type</strong> is the physical stock type from the Stock page (e.g. normal, backlight).{' '}
            <strong className="text-white">Size</strong> is the roll width and length for that type.
          </p>
        )}

        <div className="border border-red-950/40 rounded-lg overflow-hidden">
          <div className="max-h-[240px] overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse min-w-[720px]">
              <thead className="sticky top-0 bg-red-950/50 z-10">
                <tr>
                  <th className="text-left p-2 border border-red-950/50 text-red-200 text-xs">Item</th>
                  {showTypeCol && (
                    <th className="text-left p-2 border border-red-950/50 text-red-200 text-xs">Type</th>
                  )}
                  <th className="text-left p-2 border border-red-950/50 text-red-200 text-xs">
                    {selectedItem?.type === 'banner_roll' || selectedItem?.type === 'sticker_roll' ? 'Roll width' : 'Size'}
                  </th>
                  {isBannerOrStickerOrCustomRoll(selectedItem?.type, selectedItem?.calcType) && (
                    <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">Sqft available</th>
                  )}
                  <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">
                    {manualEntryActive
                      ? manualPricingUnit === 'per_sqft'
                        ? 'Qty (sqft)'
                        : 'Qty (count)'
                      : isBannerOrStickerOrCustomRoll(selectedItem?.type, selectedItem?.calcType)
                        ? 'Qty(sqft)'
                        : 'Qty'}
                  </th>
                  <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">
                    {manualEntryActive ? 'Rate' : 'Unit Price'}
                  </th>
                  <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">Discount</th>
                  <th className="text-right p-2 border border-red-950/50 text-red-200 text-xs">Subtotal</th>
                  <th className="w-16 p-2 border border-red-950/50"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-red-950/30 border-b border-red-950/40">
                  <td className="p-2 border border-red-950/40 text-white text-sm">
                    {editingBill ? (
                      <input
                        type="text"
                        value={item.item_name}
                        onChange={(e) => updateExistingItem(idx, { item_name: e.target.value })}
                        className="w-full border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                      />
                    ) : (
                      item.item_name
                    )}
                  </td>
                  {showTypeCol && (
                    <td className="p-2 border border-red-950/40 text-red-200/90 text-sm">
                      {String((item.metadata as { stock_type_label?: string })?.stock_type_label || '').trim() || '—'}
                    </td>
                  )}
                  <td className="p-2 border border-red-950/40 text-red-200/90 text-sm">
                    {editingBill ? (
                      <input
                        type="text"
                        value={item.size || ''}
                        onChange={(e) => updateExistingItem(idx, { size: e.target.value })}
                        className="w-full border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                      />
                    ) : (
                      item.size || '-'
                    )}
                  </td>
                  {isBannerOrStickerOrCustomRoll(selectedItem?.type, selectedItem?.calcType) && (
                    <td className="p-2 border border-red-950/40 text-right tabular-nums text-red-300/90 text-sm">-</td>
                  )}
                  <td className="p-2 border border-red-950/40 text-right tabular-nums text-white text-sm">
                    {editingBill ? (
                      <EditNumberInput
                        min={0.01}
                        step={0.01}
                        value={item.quantity}
                        widthClass="w-28"
                        onValueChange={(value) => updateExistingItem(idx, { quantity: value })}
                      />
                    ) : (
                      item.quantity
                    )}
                  </td>
                  <td className="p-2 border border-red-950/40 text-right tabular-nums text-white text-sm">
                    {editingBill ? (
                      <EditNumberInput
                        min={0}
                        step={0.01}
                        value={item.unit_price}
                        widthClass="w-32"
                        onValueChange={(value) => updateExistingItem(idx, { unit_price: value })}
                      />
                    ) : (
                      item.service_type === 'manual' &&
                      (item.metadata as { pricing_unit?: string })?.pricing_unit === 'per_sqft'
                        ? `Rs.${item.unit_price?.toFixed(2)}/sqft`
                        : item.service_type === 'manual'
                          ? `Rs.${item.unit_price?.toFixed(2)}/unit`
                          : `Rs.${item.unit_price?.toFixed(2)}`
                    )}
                  </td>
                  <td className="p-2 border border-red-950/40 text-right tabular-nums text-red-300/90 text-sm">
                    {editingBill ? (
                      <EditNumberInput
                        min={0}
                        step={0.01}
                        value={item.discount || 0}
                        widthClass="w-28"
                        onValueChange={(value) => updateExistingItem(idx, { discount: value })}
                      />
                    ) : (
                      (item.discount || 0) > 0 ? `Rs.${(item.discount || 0).toFixed(2)}` : '-'
                    )}
                  </td>
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
                    setSelectedStockTypeKey('');
                    setManualSizeInput('');
                  }}
                  onFocus={() => setItemDropdownOpen(true)}
                  placeholder="Item name (type or pick from list)"
                  className="w-full border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white placeholder-red-400/50"
                />
                {itemDropdownOpen &&
                  itemDropdownRect &&
                  createPortal(
                    <ul
                      data-bill-dropdown
                      className="fixed border border-red-900/50 rounded-lg bg-black/95 shadow-xl max-h-80 overflow-auto z-[9999]"
                      style={{
                        top: itemDropdownRect.bottom + 4,
                        left: itemDropdownRect.left,
                        width: Math.max(itemDropdownRect.width, 320),
                      }}
                    >
                      <li className="px-2 py-2 border-b border-red-950/60">
                        <button
                          type="button"
                          onClick={startManualItem}
                          className="w-full text-left px-2 py-2 rounded bg-red-950/40 hover:bg-red-900/60 text-white"
                        >
                          <span className="block font-medium">Manual price</span>
                          <span className="block text-xs text-red-200/75">Type item, size, qty and rate yourself</span>
                        </button>
                      </li>
                      {groupedItemOptions.length === 0 ? (
                        <li className="px-3 py-2 text-red-300/80 text-sm">
                          No matches in settings — type the item name and size above, set qty and price, then Add.
                        </li>
                      ) : (
                        groupedItemOptions.map((optionGroup) => (
                          <li key={optionGroup.label}>
                            <div className="px-3 py-1.5 bg-red-950/50 text-red-200 text-xs font-semibold uppercase">
                              {optionGroup.label}
                            </div>
                            <ul>
                              {optionGroup.options.map((opt) => (
                          <li
                            key={opt.key}
                            onClick={() => {
                              const first = opt.item;
                              const group = billableItems.filter((i) => sameProductGroupForSizePicker(first, i));
                              const isRoll = first.type === 'banner_roll' || first.type === 'sticker_roll';
                              const typeKeys = isRoll
                                ? Array.from(
                                    new Set(
                                      group
                                        .filter((r) => r.type === 'banner_roll' || r.type === 'sticker_roll')
                                        .map((r) => String(r.stockTypeLabel || '').trim())
                                    )
                                  ).sort((a, b) => (a || '\uFFFF').localeCompare(b || '\uFFFF'))
                                : [];
                              const singleType = typeKeys.length === 1 ? typeKeys[0] : '';
                              setSelectedStockTypeKey(singleType);
                              setSelectedItem(first);
                              if (isRoll && typeKeys.length > 1) {
                                applyRollSizePick(null);
                              } else {
                                const filtered =
                                  isRoll && typeKeys.length > 0
                                    ? group.filter((r) => String(r.stockTypeLabel || '').trim() === singleType)
                                    : group;
                                const sizeChoices = dedupeBillableItems(filtered);
                                const pickSize = sizeChoices[0] ?? first;
                                applyRollSizePick(pickSize);
                              }
                              setItemSearch(opt.label);
                              setItemDropdownOpen(false);
                              setSizeDropdownOpen(isRoll && typeKeys.length > 1 ? false : true);
                            }}
                            className="px-3 py-2 hover:bg-red-950/50 cursor-pointer text-white"
                          >
                            {opt.display}
                          </li>
                              ))}
                            </ul>
                          </li>
                        ))
                      )}
                    </ul>,
                    document.body
                  )}
                </td>
                {showTypeCol && (
                  <td className="p-1.5 border border-red-950/40 text-left">
                    {showStockTypeColumn ? (
                      <select
                        value={selectedStockTypeKey}
                        onChange={(e) => {
                          const k = e.target.value;
                          setSelectedStockTypeKey(k);
                          if (stockTypeOptions.length > 1 && k === '') {
                            applyRollSizePick(null);
                            return;
                          }
                          const filtered = groupRowsForItem.filter((r) => String(r.stockTypeLabel || '').trim() === k);
                          const list = dedupeBillableItems(filtered);
                          applyRollSizePick(list[0] ?? null);
                          setSizeDropdownOpen(true);
                        }}
                        className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                        aria-label="Stock type"
                      >
                        {stockTypeOptions.length > 1 && <option value="">Type…</option>}
                        {stockTypeOptions.map((k) => (
                          <option key={k || '__empty'} value={k}>
                            {k === '' ? '—' : k}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-red-200/40 text-xs pl-1">—</span>
                    )}
                  </td>
                )}
                <td ref={sizeTriggerRef} className="p-1.5 border border-red-950/40 relative">
                  <div className="flex items-center gap-1">
                    {isBannerOrStickerOrCustomRoll(selectedItem?.type, selectedItem?.calcType) && selectedSize ? (
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
                        value={manualSizeInput}
                        onChange={(e) => setManualSizeInput(e.target.value)}
                        onFocus={() => {
                          if (selectedItem) setSizeDropdownOpen(true);
                        }}
                        placeholder={
                          selectedItem?.type === 'banner_roll' || selectedItem?.type === 'sticker_roll'
                            ? 'Roll width (from Stock; pick from list)'
                            : 'Size (type or pick from list)'
                        }
                        className="flex-1 min-w-0 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white placeholder-red-400/50"
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
                      {sizesForItem.map((s) => {
                        const remainingSqft = getRemainingRollAvailableSqft(s);
                        const width = s.widthFt || 0;
                        const feetRem = width > 0 ? remainingSqft / width : 0;
                        const st = String((s as { stockTypeLabel?: string }).stockTypeLabel || '').trim();
                        return (
                        <li
                          key={`${s.bannerStockId ?? s.stickerStockId ?? s.sizeId}-${s.materialId ?? 0}-${st}`}
                          onClick={() => {
                            applyRollSizePick(s);
                            setSizeDropdownOpen(false);
                            setItemDiscountStr('');
                          }}
                          className="px-3 py-2 hover:bg-red-950/50 cursor-pointer flex justify-between items-center gap-2 text-white"
                        >
                          <span>
                            {isBannerOrStickerOrCustomRoll(selectedItem?.type, selectedItem?.calcType)
                              ? `${s.widthFt ?? 0} ft roll${st ? ` - ${st}` : ''} - ${round2(feetRem)} ft / ${remainingSqft} sqft available`
                              : formatSizeDisplay(s.sizeName) || s.sizeName}{' '}
                            {!isBannerOrStickerOrCustomRoll(selectedItem?.type, selectedItem?.calcType) && '(in)'}
                          </span>
                          <span className="flex items-center gap-2 text-red-300/70 text-sm shrink-0">
                            {(s.stockQty !== undefined && selectedItem?.type !== 'banner_roll' && selectedItem?.type !== 'sticker_roll') && (
                              <span className="text-emerald-400/90">Stock: {s.stockQty}</span>
                            )}
                            {(s.calcType === 'sqft' || s.calcType === 'sqft_direct')
                              ? `Rs.${s.pricePerSqft ?? s.unitPrice}/sqft`
                              : `Rs.${s.unitPrice}`}
                          </span>
                        </li>
                        );
                      })}
                    </ul>,
                    document.body
                  )}
                </td>
                {isBannerOrStickerOrCustomRoll(selectedItem?.type, selectedItem?.calcType) && (
                  <td className="p-1.5 border border-red-950/40 text-right tabular-nums text-emerald-400/90 text-sm">
                    {selectedSize ? `${getRemainingRollAvailableSqft(selectedSize)} sqft` : '-'}
                  </td>
                )}
                <td className="p-1.5 border border-red-950/40 text-right">
                  <input
                    type="number"
                    min={
                      manualEntryActive
                        ? manualPricingUnit === 'per_sqft'
                          ? '0.01'
                          : '1'
                        : selectedItem?.calcType === 'sqft_direct'
                          ? '0.01'
                          : '1'
                    }
                    step={
                      manualEntryActive
                        ? manualPricingUnit === 'per_sqft'
                          ? '0.01'
                          : '1'
                        : selectedItem?.calcType === 'sqft_direct'
                          ? '0.01'
                          : '1'
                    }
                    placeholder={
                      manualEntryActive
                        ? manualPricingUnit === 'per_sqft'
                          ? 'Sqft'
                          : 'Count'
                        : selectedItem?.calcType === 'sqft_direct'
                          ? 'Sqft'
                          : '1'
                    }
                    value={quantity}
                    onChange={(e) => {
                      const raw = manualEntryActive
                        ? manualPricingUnit === 'per_sqft'
                          ? e.target.value.replace(/[^0-9.]/g, '')
                          : e.target.value.replace(/[^0-9]/g, '')
                        : selectedItem?.calcType === 'sqft_direct'
                          ? e.target.value.replace(/[^0-9.]/g, '')
                          : e.target.value.replace(/[^0-9]/g, '');
                      setQuantity(raw);
                      const q = parseFloat(raw) || 0;
                      const w =
                        parseFloat(sizeWidthStr) ||
                        (selectedSize?.widthFt ?? 0);
                      if (
                        q > 0 &&
                        w > 0 &&
                        selectedItem?.calcType === 'sqft_direct' &&
                        isBannerOrStickerOrCustomRoll(selectedItem.type, selectedItem.calcType)
                      ) {
                        setSizeLengthStr(String(Math.round((q / w) * 100) / 100));
                      }
                    }}
                    className="w-16 border border-red-900/50 rounded px-1 py-1 text-sm text-right tabular-nums bg-black/60 text-white placeholder-red-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="p-1.5 border border-red-950/40 text-right align-top">
                  {manualEntryActive ? (
                    <div className="flex flex-col items-end gap-1 max-w-[7.5rem] ml-auto">
                      <select
                        value={manualPricingUnit}
                        onChange={(e) => setManualPricingUnit(e.target.value as 'per_sqft' | 'per_unit')}
                        className="w-full border border-red-900/50 rounded px-1 py-1 text-[11px] bg-black/60 text-white"
                        aria-label="Manual line: price per sqft or per unit"
                      >
                        <option value="per_unit">Rs./unit (count)</option>
                        <option value="per_sqft">Rs./sqft</option>
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={unitPriceStr}
                        onChange={(e) => setUnitPriceStr(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder={manualPricingUnit === 'per_sqft' ? 'per sqft' : 'per unit'}
                        className="w-full border border-red-900/50 rounded px-1 py-1 text-xs text-right tabular-nums bg-black/60 text-white placeholder-red-400/50"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={unitPriceStr}
                      onChange={(e) => setUnitPriceStr(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder={
                        selectedSize
                          ? selectedSize.calcType === 'sqft'
                            ? 'per sqft'
                            : '0'
                          : '-'
                      }
                      className="w-16 border border-red-900/50 rounded px-1 py-1 text-xs text-right tabular-nums bg-black/60 text-white placeholder-red-400/50"
                    />
                  )}
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
                    disabled={(() => {
                      const q = parseFloat(String(quantity)) || 0;
                      const manualMode = !selectedItem && itemSearch.trim().length > 0;
                      if (manualMode) {
                        const up = parseFloat(unitPriceStr) || 0;
                        return q <= 0 || up <= 0 || currentSubtotal <= 0;
                      }
                      if (!selectedItem || !selectedSize || !quantity) return true;
                      if (
                        selectedItem.calcType === 'sqft_direct' &&
                        isBannerOrStickerOrCustomRoll(selectedItem.type, selectedItem.calcType) &&
                        q > getRemainingRollAvailableSqft(selectedSize)
                      ) {
                        return true;
                      }
                      if (selectedItem.calcType === 'sqft_direct' ? parseFloat(quantity) < 0.01 : parseInt(quantity, 10) < 1) return true;
                      return currentSubtotal <= 0;
                    })()}
                    className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </td>
              </tr>
              <tr className="bg-red-950/30 border-b border-red-950/40">
                <td className="p-2 border border-red-950/40" colSpan={isBannerOrStickerOrCustomRoll(selectedItem?.type, selectedItem?.calcType) ? 5 : 4}></td>
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
              {loading ? 'Saving...' : editingBill ? 'Save Changes' : 'Save Bill'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </form>
  );
}
