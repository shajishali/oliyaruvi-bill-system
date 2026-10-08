import { useState, useEffect, Fragment } from 'react';
import { formatSizeDisplay, normalizeSizeForSave, parseSizeDimensions } from '../utils/sizeFormat';
import Header from '../components/layout/Header';
import { api } from '../api/client';
import { PRICE_MANUAL_CATEGORIES_KEY, STOCK_CUSTOM_LABELS_KEY, STOCK_SECTIONS_KEY } from '../constants/stockSections';
import { requestAdminPermission } from '../components/admin/AdminPermission';
import { buildSuggestions, ChoiceList, type StockChoice } from '../components/stock/previousChoices';

type ManualPriceCategory = { id: string; label: string };
type PriceAudience = 'st' | 'local';

function normalizeAudience(value: unknown): PriceAudience {
  return String(value || '').trim().toLowerCase() === 'st' ? 'st' : 'local';
}

function audienceLabel(value: unknown): string {
  return normalizeAudience(value) === 'st' ? 'ST' : 'Local';
}

function FramePriceChoices({
  choices,
  typeValue,
  sizeValue,
  onPickType,
  onPickSize,
}: {
  choices: StockChoice[];
  typeValue: string;
  sizeValue: string;
  onPickType: (value: string) => void;
  onPickSize: (value: string) => void;
}) {
  const picks = buildSuggestions(choices, typeValue, sizeValue, '');
  if (!choices.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-red-900/50 bg-black/40 px-3 py-2">
      <ChoiceList label="Previous types" options={picks.typeOptions} selected={typeValue} onPick={onPickType} />
      {picks.typeIsNew && <p className="mt-2 text-sm text-amber-200">New type “{picks.typedType}” will be saved when you click Add.</p>}
      <ChoiceList
        label={typeValue.trim() ? 'Sizes for this type' : 'Previous sizes'}
        options={picks.sizeOptions}
        selected={sizeValue}
        onPick={onPickSize}
      />
      {typeValue.trim() && (
        <ChoiceList label="Other sizes" options={picks.otherSizeOptions} selected={sizeValue} onPick={onPickSize} />
      )}
      {picks.sizeIsNew && <p className="mt-2 text-sm text-amber-200">New size “{sizeValue.trim()}” will be saved when you click Add.</p>}
    </div>
  );
}

function AudienceSelect({
  value,
  onChange,
}: {
  value: PriceAudience;
  onChange: (value: PriceAudience) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value === 'st' ? 'st' : 'local')}
      className="border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
    >
      <option value="st">ST</option>
      <option value="local">Local</option>
    </select>
  );
}

function loadManualPriceCategories(): ManualPriceCategory[] {
  try {
    const raw = localStorage.getItem(PRICE_MANUAL_CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
      .map((x) => ({
        id: String(x.id ?? '').trim(),
        label: String(x.label ?? '').trim(),
      }))
      .filter((x) => x.id && x.label);
  } catch {
    return [];
  }
}

export default function Prices() {
  const [error, setError] = useState('');
  const [materials, setMaterials] = useState<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string; price_audience?: string }[]>([]);
  const [stickerMaterials, setStickerMaterials] = useState<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string; price_audience?: string }[]>([]);
  const [bannerSizes, setBannerSizes] = useState<{ id: number; material_id: number; size_name: string; width_ft: number; height_ft: number; material_name: string }[]>([]);
  const [newMaterialName, setNewMaterialName] = useState('');
  /** Count-type custom sections: must match Stock tab `size_name` for that section */
  const [newCustomSaleSize, setNewCustomSaleSize] = useState('');
  /** Frames: `size_name` in stock / billing (match Stock tab spelling) */
  const [newFrameSize, setNewFrameSize] = useState('');
  const [newMaterialPrice, setNewMaterialPrice] = useState('');
  const [newMaterialPricingType, setNewMaterialPricingType] = useState('Rs./unit');
  const [categoryForAdd, setCategoryForAdd] = useState<string>('');
  const [manualPriceCategories, setManualPriceCategories] = useState<ManualPriceCategory[]>(loadManualPriceCategories);
  const [newManualCategoryName, setNewManualCategoryName] = useState('');
  const [stockSections, setStockSections] = useState<string[]>([]);
  const [stockCustomLabels, setStockCustomLabels] = useState<Record<string, string>>({});
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [editingStickerId, setEditingStickerId] = useState<number | null>(null);
  const [editMaterialPrice, setEditMaterialPrice] = useState('');
  const [editMaterialPricingType, setEditMaterialPricingType] = useState<'per_sqft' | 'per_qty'>('per_sqft');
  const [addSizeMaterialId, setAddSizeMaterialId] = useState<number | null>(null);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeWidth, setNewSizeWidth] = useState('');
  const [newSizeHeight, setNewSizeHeight] = useState('');
  useEffect(() => {
    try {
      const rawSections = localStorage.getItem(STOCK_SECTIONS_KEY);
      const parsedSections = rawSections ? (JSON.parse(rawSections) as string[]) : [];
      setStockSections(Array.isArray(parsedSections) ? parsedSections.filter((x) => typeof x === 'string' && x.trim()) : []);
    } catch {
      setStockSections([]);
    }
    try {
      const rawLabels = localStorage.getItem(STOCK_CUSTOM_LABELS_KEY);
      const parsedLabels = rawLabels ? (JSON.parse(rawLabels) as Record<string, string>) : {};
      setStockCustomLabels(parsedLabels && typeof parsedLabels === 'object' ? parsedLabels : {});
    } catch {
      setStockCustomLabels({});
    }
  }, []);

  const [frames, setFrames] = useState<{ id: number; size_name: string; frame_type?: string; subitem_name?: string; unit_price: number; price_audience?: string }[]>([]);
  const [stockFrames, setStockFrames] = useState<{ size_name?: string; frame_type?: string; subitem_name?: string }[]>([]);
  const [serviceItems, setServiceItems] = useState<{ id: number; name: string; item_type?: string; qty_type: string; unit_price: number; price_audience?: string }[]>([]);
  const [customSections, setCustomSections] = useState<{ section_id: string; label: string; section_type: 'count' | 'roll'; affects_sales?: number; unit_price?: number }[]>([]);
  const [customSaleItems, setCustomSaleItems] = useState<{ id: number; section_id: string; item_name: string; item_type: string; qty_type: string; unit_price: number; size_name?: string; price_audience?: string }[]>([]);
  const [designBanner, setDesignBanner] = useState<{ id: number; size_name: string; unit_price: number; price_audience?: string }[]>([]);
  const [designPhoto, setDesignPhoto] = useState<{ id: number; size_name: string; unit_price: number; price_audience?: string }[]>([]);
  const [editingPrice, setEditingPrice] = useState<{ type: string; id: number | string } | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');
  /** Full-row edit fields (Settings price table) */
  const [editRowSubitem, setEditRowSubitem] = useState('');
  const [editRowSize, setEditRowSize] = useState('');
  const [editRowQtyType, setEditRowQtyType] = useState<'per_sqft' | 'per_unit'>('per_unit');
  const [editRowFrameType, setEditRowFrameType] = useState('Duro');
  const [editMaterialName, setEditMaterialName] = useState('');
  const [newPriceAudience, setNewPriceAudience] = useState<PriceAudience>('local');
  const [editPriceAudience, setEditPriceAudience] = useState<PriceAudience>('local');

  useEffect(() => {
    localStorage.setItem(PRICE_MANUAL_CATEGORIES_KEY, JSON.stringify(manualPriceCategories));
  }, [manualPriceCategories]);

  const clearEdits = () => {
    setEditingPrice(null);
    setEditPriceValue('');
    setEditRowSubitem('');
    setEditRowSize('');
    setEditRowQtyType('per_unit');
    setEditRowFrameType('Duro');
    setEditingMaterialId(null);
    setEditingStickerId(null);
    setEditMaterialPrice('');
    setEditMaterialName('');
    setEditMaterialPricingType('per_sqft');
    setEditPriceAudience('local');
  };

  const loadServiceItems = () => {
    api.services.bannerMaterials(true).then(setMaterials).catch(() => setMaterials([]));
    api.services.stickerMaterials(true).then(setStickerMaterials).catch(() => setStickerMaterials([]));
    api.services.bannerSizes().then(setBannerSizes).catch(() => setBannerSizes([]));
  };

  const loadAllPrices = () => {
    loadServiceItems();
    api.services.framePricing().then(setFrames).catch(() => setFrames([]));
    api.stock.frames().then((rows) => setStockFrames(rows as { size_name?: string; frame_type?: string; subitem_name?: string }[])).catch(() => setStockFrames([]));
    api.services.serviceItems().then(setServiceItems).catch(() => setServiceItems([]));
    api.stock.customSections().then(setCustomSections).catch(() => setCustomSections([]));
    api.stock.customSaleItems().then(setCustomSaleItems).catch(() => setCustomSaleItems([]));
    api.services.designBannerSizes().then(setDesignBanner).catch(() => setDesignBanner([]));
    api.services.designPhotoSizes().then(setDesignPhoto).catch(() => setDesignPhoto([]));
  };

  // Only show custom sections that affect sales (sold to customers). Maintenance-only sections (ink, etc.) stay in Stock only.
  const salesCustomSections = customSections.filter((s) => (s.affects_sales ?? 1) !== 0);
  const visibleSalesCustomSections = salesCustomSections.filter((s) => stockSections.includes(s.section_id));
  const hasFramesSection = stockSections.includes('frames');
  const hasBannerSection = stockSections.includes('banner');
  const hasStickerSection = stockSections.includes('sticker');
  const hasServicesSection = stockSections.includes('services');
  const addTypeOptions: { value: string; label: string }[] = [
    ...(hasFramesSection ? [{ value: 'frames', label: 'Frames' }] : []),
    ...(hasBannerSection ? [{ value: 'banner', label: 'Banner' }] : []),
    ...(hasStickerSection ? [{ value: 'sticker', label: 'Sticker' }] : []),
    ...(hasServicesSection ? [{ value: 'services', label: 'Services (no stock)' }] : []),
    ...visibleSalesCustomSections.map((sec) => ({
      value: sec.section_id,
      label: sec.label || stockCustomLabels[sec.section_id] || sec.section_id,
    })),
    ...manualPriceCategories.map((c) => ({
      value: `manual:${c.id}`,
      label: `${c.label} (no stock)`,
    })),
  ];
  const salesCustomSectionsWithPrice = salesCustomSections; // roll/count pricing now comes from separate sale rows
  const selectedCustomSectionForAdd = categoryForAdd.startsWith('custom-')
    ? visibleSalesCustomSections.find((s) => s.section_id === categoryForAdd)
    : null;
  const isSelectedCustomRollSale = (selectedCustomSectionForAdd?.section_type ?? '') === 'roll';

  const serviceItemsGeneral = serviceItems.filter((si) => !String(si.item_type || '').trim());
  const manualCategoryIdSet = new Set(manualPriceCategories.map((c) => c.id));
  const serviceItemsOtherType = serviceItems.filter((si) => {
    const t = String(si.item_type || '').trim();
    return t !== '' && !manualCategoryIdSet.has(t);
  });

  useEffect(() => {
    loadAllPrices();
  }, []);

  useEffect(() => {
    if (!addTypeOptions.length) {
      if (categoryForAdd !== '') setCategoryForAdd('');
      return;
    }
    if (!addTypeOptions.some((o) => o.value === categoryForAdd)) {
      setCategoryForAdd(addTypeOptions[0].value);
    }
  }, [categoryForAdd, addTypeOptions]);
  const runAdmin = (action: () => void) => {
    void (async () => {
      if (!(await requestAdminPermission({ force: true }))) return;
      action();
    })();
  };

  const addManualPriceCategory = () => {
    const label = newManualCategoryName.trim();
    if (!label) return;
    void (async () => {
      if (!(await requestAdminPermission())) return;
    const id = `price-${Date.now()}`;
    setManualPriceCategories((prev) => [...prev, { id, label }]);
    setNewManualCategoryName('');
    setCategoryForAdd(`manual:${id}`);
    setNewMaterialPricingType('Rs./unit');
    })();
  };

  const removeManualPriceCategory = (id: string) => {
    const label = manualPriceCategories.find((c) => c.id === id)?.label ?? id;
    void (async () => {
      if (!(await requestAdminPermission())) return;
      if (!window.confirm(`Remove "${label}" from the type list? Existing prices stay in the database.`)) return;
      setManualPriceCategories((prev) => prev.filter((c) => c.id !== id));
    })();
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await requestAdminPermission())) return;
    const subitemName = newMaterialName.trim();
    const price = parseFloat(newMaterialPrice) || 0;
    const pricingType = newMaterialPricingType.trim().toLowerCase().includes('sqft') ? 'per_sqft' : 'per_qty';
    const cat = categoryForAdd;
    try {
      if (cat === 'frames') {
        if (!subitemName) {
          setError('Enter Type before Add (e.g. Quality / Normal).');
          return;
        }
        const sz = newFrameSize.trim();
        if (!sz) {
          setError('Enter Size before Add (e.g. 6 inches, 8x12 — match the Stock page).');
          return;
        }
        await api.services.createFramePricing({
          size_name: normalizeSizeForSave(sz),
          frame_type: 'Duro',
          unit_price: price,
          subitem_name: subitemName,
          price_audience: newPriceAudience,
        });
        setNewFrameSize('');
      } else if (cat === 'banner') {
        await api.services.createBannerMaterial({
          material_name: subitemName,
          price_per_sqft: price,
          pricing_type: pricingType,
          price_audience: newPriceAudience,
        });
      } else if (cat === 'sticker') {
        await api.services.createStickerMaterial({
          material_name: subitemName,
          price_per_sqft: price,
          pricing_type: pricingType,
          price_audience: newPriceAudience,
        });
      } else if (cat === 'services') {
        const qtyType = pricingType === 'per_sqft' ? 'per_sqft' : 'per_unit';
        await api.services.createServiceItem({
          name: subitemName,
          item_type: '',
          qty_type: qtyType,
          unit_price: price,
          price_audience: newPriceAudience,
        });
      } else if (cat.startsWith('custom-')) {
        const sec = customSections.find((s) => s.section_id === cat);
        if (!sec) {
          setError('Custom section not found. Refresh the page and try again.');
          return;
        }
        if (!subitemName) {
          setError('Enter Type before Add.');
          return;
        }
        const isRoll = (sec.section_type ?? '') === 'roll' || pricingType === 'per_sqft';
        if (!isRoll) {
          const sz = newCustomSaleSize.trim();
          if (!sz) {
            setError('Enter Size (same spelling as on the Stock page for this section, e.g. 8x12) before Add.');
            return;
          }
        }
        // All custom sections (roll and count) store pricing in custom_section_sale_items.
        // Roll sections use per_sqft; count sections use per_unit.
        // Count sections: size_name matches custom_section_stock.size_name for billing/stock deduction.
        if (isRoll && (sec.section_type ?? '') !== 'roll') {
          await api.stock.updateCustomSection(cat, { section_type: 'roll' });
        }
        await api.stock.createCustomSaleItem({
          section_id: cat,
          item_name: subitemName,
          item_type: '',
          qty_type: isRoll ? 'per_sqft' : 'per_unit',
          unit_price: price,
          size_name: isRoll ? '' : normalizeSizeForSave(newCustomSaleSize.trim()),
          price_audience: newPriceAudience,
        });
        setNewCustomSaleSize('');
      } else if (cat.startsWith('manual:')) {
        const manualId = cat.slice('manual:'.length);
        if (!manualPriceCategories.some((c) => c.id === manualId)) {
          setError('That manual type was removed. Add it again or pick another Item name type.');
          return;
        }
        if (!subitemName) {
          setError('Enter Type before Add.');
          return;
        }
        const qtyType = pricingType === 'per_sqft' ? 'per_sqft' : 'per_unit';
        await api.services.createServiceItem({
          name: subitemName,
          item_type: manualId,
          qty_type: qtyType,
          unit_price: price,
          price_audience: newPriceAudience,
        });
      } else {
        setError('Select a valid Item name type (stock section, Services, manual type, or custom section).');
        return;
      }
      setNewMaterialName('');
      setNewMaterialPrice('');
      setNewMaterialPricingType('');
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateMaterial = async (id: number) => {
    if (!(await requestAdminPermission())) return;
    const name = editMaterialName.trim();
    if (!name) {
      setError('Type is required.');
      return;
    }
    const val = parseFloat(editMaterialPrice);
    if (isNaN(val) || val < 0) return;
    try {
      await api.services.updateBannerMaterial(id, {
        material_name: name,
        price_per_sqft: val,
        pricing_type: editMaterialPricingType,
        price_audience: editPriceAudience,
      });
      clearEdits();
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateStickerMaterial = async (id: number) => {
    if (!(await requestAdminPermission())) return;
    const name = editMaterialName.trim();
    if (!name) {
      setError('Type is required.');
      return;
    }
    const val = parseFloat(editMaterialPrice);
    if (isNaN(val) || val < 0) return;
    try {
      await api.services.updateStickerMaterial(id, {
        material_name: name,
        price_per_sqft: val,
        pricing_type: editMaterialPricingType,
        price_audience: editPriceAudience,
      });
      clearEdits();
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await requestAdminPermission())) return;
    if (!addSizeMaterialId || !newSizeName.trim()) return;
    const parts = parseSizeDimensions(newSizeName);
    const w = parts.length >= 2 ? parts[0] : parseFloat(newSizeWidth) || 0;
    const h = parts.length >= 2 ? parts[1] : parseFloat(newSizeHeight) || 0;
    try {
      await api.services.createBannerSize({
        material_id: addSizeMaterialId,
        size_name: normalizeSizeForSave(newSizeName),
        width_ft: w,
        height_ft: h,
      });
      setAddSizeMaterialId(null);
      setNewSizeName('');
      setNewSizeWidth('');
      setNewSizeHeight('');
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSavePrice = async (type: string, id: number | string) => {
    if (!(await requestAdminPermission())) return;
    const val = parseFloat(editPriceValue);
    if (isNaN(val) || val < 0) return;
    try {
      if (type === 'frame') {
        const sub = editRowSubitem.trim();
        const sz = editRowSize.trim();
        if (!sub || !sz) {
          setError('Type and size are required.');
          return;
        }
        await api.services.updateFramePricing(Number(id), {
          subitem_name: sub,
          size_name: normalizeSizeForSave(sz),
          frame_type: editRowFrameType || 'Duro',
          unit_price: val,
          price_audience: editPriceAudience,
        });
      } else if (type === 'service') {
        const name = editRowSubitem.trim();
        if (!name) {
          setError('Type is required.');
          return;
        }
        await api.services.updateServiceItem(Number(id), {
          name,
          qty_type: editRowQtyType,
          unit_price: val,
          price_audience: editPriceAudience,
        });
      } else if (type === 'custom') await api.stock.updateCustomSectionItem(Number(id), { unit_price: val });
      else if (type === 'custom-sale') {
        const row = customSaleItems.find((x) => x.id === Number(id));
        const isRoll = row?.qty_type === 'per_sqft';
        if (isRoll) {
          const name = editRowSubitem.trim();
          if (!name) {
            setError('Type is required.');
            return;
          }
          await api.stock.updateCustomSaleItem(Number(id), { item_name: name, unit_price: val, price_audience: editPriceAudience });
        } else {
          const name = editRowSubitem.trim();
          const sz = editRowSize.trim();
          if (!name || !sz) {
            setError('Type and size are required.');
            return;
          }
          await api.stock.updateCustomSaleItem(Number(id), {
            item_name: name,
            size_name: normalizeSizeForSave(sz),
            unit_price: val,
            price_audience: editPriceAudience,
          });
        }
      } else if (type === 'custom-section') await api.stock.updateCustomSection(String(id), { unit_price: val });
      else if (type === 'designBanner' || type === 'designPhoto') {
        const sz = editRowSize.trim();
        if (!sz) {
          setError('Size is required.');
          return;
        }
        const payload = { size_name: normalizeSizeForSave(sz), unit_price: val, price_audience: editPriceAudience };
        if (type === 'designBanner') await api.services.updateDesignBannerSize(Number(id), payload);
        else await api.services.updateDesignPhotoSize(Number(id), payload);
      }
      clearEdits();
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Roll sections are collapsed by default in Settings UI.

  const handleDeleteSize = async (id: number) => {
    if (!(await requestAdminPermission())) return;
    try {
      await api.services.deleteBannerSize(id);
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemove = async (type: string, id: number, name: string) => {
    if (!(await requestAdminPermission())) return;
    if (!window.confirm(`Remove "${name}"? This cannot be undone.`)) return;
    try {
      if (type === 'banner') await api.services.deleteBannerMaterial(id);
      else if (type === 'sticker') await api.services.deleteStickerMaterial(id);
      else if (type === 'frame') await api.services.deleteFramePricing(id);
      else if (type === 'service') await api.services.deleteServiceItem(id);
      else if (type === 'custom') await api.stock.deleteCustomSectionItem(id);
      else if (type === 'custom-sale') await api.stock.deleteCustomSaleItem(id);
      else if (type === 'designBanner') await api.services.deleteDesignBannerSize(id);
      else if (type === 'designPhoto') await api.services.deleteDesignPhotoSize(id);
      clearEdits();
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const renderAudienceCell = (editing: boolean, stored: unknown) => (
    <td className="p-2 text-red-300/80 whitespace-nowrap">
      {editing ? (
        <AudienceSelect value={editPriceAudience} onChange={setEditPriceAudience} />
      ) : (
        audienceLabel(stored)
      )}
    </td>
  );

  const renderServiceRows = (rows: { id: number; name: string; item_type?: string; qty_type: string; unit_price: number; price_audience?: string }[]) =>
    rows.map((si) => {
      const isPerSqft = si.qty_type === 'per_sqft';
      const editingSvc = editingPrice?.type === 'service' && editingPrice?.id === si.id;
      return (
        <tr key={`svc-${si.id}`} className="border-t border-red-950/40">
          <td className="p-2 pl-6 text-white whitespace-nowrap">
            {editingSvc ? (
              <input
                type="text"
                value={editRowSubitem}
                onChange={(e) => setEditRowSubitem(e.target.value)}
                className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
              />
            ) : (
              si.name
            )}
          </td>
          <td className="p-2 text-red-300/50 whitespace-nowrap text-sm">—</td>
          <td className="p-2 text-red-300/80 whitespace-nowrap">
            {editingSvc ? (
              <select value={editRowQtyType} onChange={(e) => setEditRowQtyType(e.target.value as 'per_sqft' | 'per_unit')} className="border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white">
                <option value="per_unit">Rs./unit</option>
                <option value="per_sqft">Rs./sqft</option>
              </select>
            ) : (
              isPerSqft ? 'Rs./sqft' : 'Rs./unit'
            )}
          </td>
          {renderAudienceCell(editingSvc, si.price_audience)}
          <td className="p-2 text-left tabular-nums">
            {editingSvc ? (
              <input type="number" min="0" step="0.01" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="w-24 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
            ) : (
              <span className="text-red-200/90 whitespace-nowrap">Rs.{si.unit_price}</span>
            )}
          </td>
          <td className="p-2 text-center">
            {editingSvc ? (
              <span className="flex items-center justify-center gap-1 flex-wrap">
                <button type="button" onClick={() => handleSavePrice('service', si.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                <span className="text-red-600/60">|</span>
                <button type="button" onClick={clearEdits} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1">
                <button type="button" onClick={() => runAdmin(() => { clearEdits(); setEditingPrice({ type: 'service', id: si.id }); setEditRowSubitem(si.name); setEditRowQtyType(si.qty_type === 'per_sqft' ? 'per_sqft' : 'per_unit'); setEditPriceAudience(normalizeAudience(si.price_audience)); setEditPriceValue(String(si.unit_price)); })} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                <span className="text-red-600/60">|</span>
                <button type="button" onClick={() => handleRemove('service', si.id, si.name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
              </span>
            )}
          </td>
        </tr>
      );
    });

  const framePriceChoices: StockChoice[] = [
    ...frames.map((row) => ({
      type: (row.subitem_name || row.frame_type || '').trim(),
      size: (row.size_name || '').trim(),
    })),
    ...stockFrames.map((row) => ({
      type: (row.subitem_name || row.frame_type || '').trim(),
      size: (row.size_name || '').trim(),
    })),
  ].filter((row) => row.type || row.size);

  return (
    <>
      <Header title="Prices" />
      <div className="p-6 max-w-6xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50" onClick={() => setError('')}>
            {error}
          </div>
        )}
        <div className="mt-6 bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-4">Edit All Prices</h3>
          <p className="text-sm text-red-300/75 mb-3">Adding, editing, or removing a price needs admin permission. You can still view every price.</p>
          <p className="text-sm text-red-300/75 mb-3 max-w-3xl">
            <span className="text-red-200/90 font-medium">Item name type</span> can be a section from the{' '}
            <span className="text-red-200/90">Stock</span> page (frames, banner, custom sections, etc.), or a type you add below for items that are not tracked in stock (printing prices, online fees, and similar).
          </p>
          <div className="mb-4 p-4 rounded-lg border border-red-950/50 bg-black/50 space-y-3">
            <div className="text-xs text-red-300/70 font-medium">Manual types (no stock)</div>
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="text"
                value={newManualCategoryName}
                onChange={(e) => setNewManualCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addManualPriceCategory())}
                placeholder="e.g. Printing prices, Online fees"
                className="min-w-[200px] flex-1 max-w-md px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white placeholder-red-400/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={addManualPriceCategory}
                disabled={!newManualCategoryName.trim()}
                className="px-4 py-2 bg-emerald-600/90 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/50"
              >
                Add type
              </button>
            </div>
            {manualPriceCategories.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {manualPriceCategories.map((c) => (
                  <li
                    key={c.id}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-red-950/50 text-red-200 text-xs border border-red-900/40"
                  >
                    <span>{c.label}</span>
                    <button
                      type="button"
                      title={`Remove ${c.label}`}
                      aria-label={`Remove type ${c.label}`}
                      onClick={() => removeManualPriceCategory(c.id)}
                      className="px-1.5 py-0.5 rounded hover:bg-red-900/80 text-red-100 font-bold leading-none"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={handleAddMaterial} className="space-y-3 mb-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-red-300/70 font-medium">Item name type</label>
                <select
                  value={categoryForAdd}
                  disabled={addTypeOptions.length === 0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCategoryForAdd(v);
                    setNewCustomSaleSize('');
                    setNewFrameSize('');
                    if (v === 'frames') setNewMaterialPricingType('Rs./unit');
                    else if (v === 'banner' || v === 'sticker') setNewMaterialPricingType('Rs./sqft');
                    else if (v === 'services') setNewMaterialPricingType('Rs./unit');
                    else if (v.startsWith('manual:')) setNewMaterialPricingType('Rs./unit');
                    else if (v.startsWith('custom-')) {
                      const sec = salesCustomSections.find((s) => s.section_id === v);
                      setNewMaterialPricingType(sec?.section_type === 'roll' ? 'Rs./sqft' : 'Rs./unit');
                    }
                  }}
                  className="min-w-[10rem] max-w-[14rem] px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addTypeOptions.length === 0 ? (
                    <option value="">Add a Stock section or a manual type above</option>
                  ) : (
                    addTypeOptions.map((sec) => (
                      <option key={sec.value} value={sec.value}>{sec.label}</option>
                    ))
                  )}
                </select>
              </div>
              {categoryForAdd === 'frames' ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-red-300/70 font-medium">Type</label>
                    <input
                      type="text"
                      value={newMaterialName}
                      onChange={(e) => setNewMaterialName(e.target.value)}
                      placeholder="e.g. Quality / Normal"
                      className="w-36 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white placeholder-red-400/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-red-300/70 font-medium">Size</label>
                    <input
                      type="text"
                      value={newFrameSize}
                      onChange={(e) => setNewFrameSize(e.target.value)}
                      placeholder="e.g. 6 inches, 8x12 (match Stock)"
                      className="w-44 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white placeholder-red-400/50 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-red-300/70 font-medium">Type</label>
                  <input
                    type="text"
                    value={newMaterialName}
                    onChange={(e) => setNewMaterialName(e.target.value)}
                    placeholder={
                      categoryForAdd.startsWith('manual:')
                        ? 'e.g. UPI fee, A4 colour'
                        : categoryForAdd.startsWith('custom-')
                          ? isSelectedCustomRollSale
                            ? 'e.g. Backlight print'
                            : 'e.g. Duro'
                          : 'e.g. Backlight print'
                    }
                    className="w-36 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white placeholder-red-400/50 focus:outline-none"
                  />
                </div>
              )}
              {selectedCustomSectionForAdd && !isSelectedCustomRollSale ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-red-300/70 font-medium">Size</label>
                  <input
                    type="text"
                    value={newCustomSaleSize}
                    onChange={(e) => setNewCustomSaleSize(e.target.value)}
                    placeholder="e.g. 8x12 (match Stock)"
                    className="w-40 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white placeholder-red-400/50 focus:outline-none"
                  />
                </div>
              ) : null}
              {isSelectedCustomRollSale ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-red-300/70 font-medium">Qty type</label>
                  <input type="text" readOnly value="Rs./sqft" className="w-28 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-red-950/40 text-red-200/80 cursor-not-allowed" />
                </div>
              ) : selectedCustomSectionForAdd && !isSelectedCustomRollSale ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-red-300/70 font-medium">Qty type</label>
                  <input type="text" readOnly value="Rs./unit" className="w-28 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-red-950/40 text-red-200/80 cursor-not-allowed" />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-red-300/70 font-medium">Qty type</label>
                  <select value={newMaterialPricingType} onChange={(e) => setNewMaterialPricingType(e.target.value)} className="w-28 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white focus:outline-none cursor-pointer">
                    <option value="">Select...</option>
                    <option value="Rs./sqft">Rs./sqft</option>
                    <option value="Rs./unit">Rs./unit</option>
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-red-300/70 font-medium">ST/Local</label>
                <AudienceSelect value={newPriceAudience} onChange={setNewPriceAudience} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-red-300/70 font-medium">Price</label>
                <input type="number" min="0" step="0.01" value={newMaterialPrice} onChange={(e) => setNewMaterialPrice(e.target.value)} placeholder="0" className="w-24 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-0">Add</label>
                <button type="submit" className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">Add</button>
              </div>
            </div>
            {categoryForAdd === 'frames' && (
              <FramePriceChoices
                choices={framePriceChoices}
                typeValue={newMaterialName}
                sizeValue={newFrameSize}
                onPickType={setNewMaterialName}
                onPickSize={setNewFrameSize}
              />
            )}
          </form>

          <div className="border border-red-950/40 rounded-lg overflow-hidden">
            <table className="w-full text-sm table-fixed border-collapse">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="bg-red-950/50">
                <tr>
                  <th className="text-left p-2.5 text-red-200 align-middle">Type</th>
                  <th className="text-left p-2.5 text-red-200 align-middle">Size</th>
                  <th className="text-left p-2.5 text-red-200 align-middle">Qty Type</th>
                  <th className="text-left p-2.5 text-red-200 align-middle whitespace-nowrap">ST/Local</th>
                  <th className="text-left p-2.5 text-red-200 align-middle">Price</th>
                  <th className="text-center p-2.5 text-red-200 align-middle">Edit | Remove</th>
                </tr>
              </thead>
              <tbody>
                {/* Banner */}
                {hasBannerSection && (
                  <tr className="bg-red-950/30">
                    <td colSpan={6} className="p-2 text-red-200 font-semibold">Banner</td>
                  </tr>
                )}
                {hasBannerSection && materials.map((m) => {
                  const isPerQty = m.pricing_type === 'per_qty';
                  const editingBanner = editingMaterialId === m.id;
                  return (
                    <tr key={`b-${m.id}`} className="border-t border-red-950/40">
                      <td className="p-2 pl-6 text-white whitespace-nowrap">
                        {editingBanner ? (
                          <input
                            type="text"
                            value={editMaterialName}
                            onChange={(e) => setEditMaterialName(e.target.value)}
                            className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                          />
                        ) : (
                          m.material_name
                        )}
                      </td>
                      <td className="p-2 text-red-300/50 whitespace-nowrap text-sm">—</td>
                      <td className="p-2 text-red-300/80 whitespace-nowrap">
                        {editingBanner ? (
                          <select value={editMaterialPricingType} onChange={(e) => setEditMaterialPricingType(e.target.value as 'per_sqft' | 'per_qty')} className="border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white">
                            <option value="per_sqft">Rs./sqft</option>
                            <option value="per_qty">Rs./unit</option>
                          </select>
                        ) : (
                          isPerQty ? 'Rs./unit' : 'Rs./sqft'
                        )}
                      </td>
                      {renderAudienceCell(editingBanner, m.price_audience)}
                      <td className="p-2 text-left tabular-nums">
                        {editingBanner ? (
                          <input type="number" min="0" step="0.01" value={editMaterialPrice} onChange={(e) => setEditMaterialPrice(e.target.value)} className="w-24 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                        ) : (
                          <span className="text-red-200/90 whitespace-nowrap">{isPerQty ? `Rs.${m.price_per_sqft}/unit` : `Rs.${m.price_per_sqft}/sqft`}</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {editingBanner ? (
                          <span className="flex items-center justify-center gap-1 flex-wrap">
                            <button type="button" onClick={() => handleUpdateMaterial(m.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                            <span className="text-red-600/60">|</span>
                            <button type="button" onClick={clearEdits} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => runAdmin(() => { clearEdits(); setEditingMaterialId(m.id); setEditMaterialName(m.material_name); setEditMaterialPrice(String(m.price_per_sqft)); setEditMaterialPricingType((m.pricing_type === 'per_qty' ? 'per_qty' : 'per_sqft')); setEditPriceAudience(normalizeAudience(m.price_audience)); })} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                            <span className="text-red-600/60">|</span>
                            <button type="button" onClick={() => handleRemove('banner', m.id, m.material_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Sticker */}
                {hasStickerSection && (
                  <tr className="bg-red-950/30">
                    <td colSpan={6} className="p-2 text-red-200 font-semibold">Sticker</td>
                  </tr>
                )}
                {hasStickerSection && stickerMaterials.map((m) => {
                  const isPerQty = m.pricing_type === 'per_qty';
                  const editingSticker = editingStickerId === m.id;
                  return (
                    <tr key={`s-${m.id}`} className="border-t border-red-950/40">
                      <td className="p-2 pl-6 text-white whitespace-nowrap">
                        {editingSticker ? (
                          <input
                            type="text"
                            value={editMaterialName}
                            onChange={(e) => setEditMaterialName(e.target.value)}
                            className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                          />
                        ) : (
                          m.material_name
                        )}
                      </td>
                      <td className="p-2 text-red-300/50 whitespace-nowrap text-sm">—</td>
                      <td className="p-2 text-red-300/80 whitespace-nowrap">
                        {editingSticker ? (
                          <select value={editMaterialPricingType} onChange={(e) => setEditMaterialPricingType(e.target.value as 'per_sqft' | 'per_qty')} className="border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white">
                            <option value="per_sqft">Rs./sqft</option>
                            <option value="per_qty">Rs./unit</option>
                          </select>
                        ) : (
                          isPerQty ? 'Rs./unit' : 'Rs./sqft'
                        )}
                      </td>
                      {renderAudienceCell(editingSticker, m.price_audience)}
                      <td className="p-2 text-left tabular-nums">
                        {editingSticker ? (
                          <input type="number" min="0" step="0.01" value={editMaterialPrice} onChange={(e) => setEditMaterialPrice(e.target.value)} className="w-24 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                        ) : (
                          <span className="text-red-200/90 whitespace-nowrap">{isPerQty ? `Rs.${m.price_per_sqft}/unit` : `Rs.${m.price_per_sqft}/sqft`}</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {editingSticker ? (
                          <span className="flex items-center justify-center gap-1 flex-wrap">
                            <button type="button" onClick={() => handleUpdateStickerMaterial(m.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                            <span className="text-red-600/60">|</span>
                            <button type="button" onClick={clearEdits} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => runAdmin(() => { clearEdits(); setEditingStickerId(m.id); setEditMaterialName(m.material_name); setEditMaterialPrice(String(m.price_per_sqft)); setEditMaterialPricingType((m.pricing_type === 'per_qty' ? 'per_qty' : 'per_sqft')); setEditPriceAudience(normalizeAudience(m.price_audience)); })} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                            <span className="text-red-600/60">|</span>
                            <button type="button" onClick={() => handleRemove('sticker', m.id, m.material_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Services (no stock) — general; use Stock → + Add Section → type "services" to show this in the dropdown */}
                {hasServicesSection && serviceItemsGeneral.length > 0 && (
                  <tr className="bg-red-950/30">
                    <td colSpan={6} className="p-2 text-red-200 font-semibold">Services (no stock)</td>
                  </tr>
                )}
                {hasServicesSection && renderServiceRows(serviceItemsGeneral)}
                {manualPriceCategories.map((cat) => {
                  const rows = serviceItems.filter((si) => String(si.item_type || '').trim() === cat.id);
                  if (rows.length === 0) return null;
                  return (
                    <Fragment key={`man-svc-${cat.id}`}>
                      <tr className="bg-red-950/30">
                        <td colSpan={6} className="p-2 text-red-200 font-semibold">{cat.label} (no stock)</td>
                      </tr>
                      {renderServiceRows(rows)}
                    </Fragment>
                  );
                })}
                {serviceItemsOtherType.length > 0 && (
                  <>
                    <tr className="bg-red-950/30">
                      <td colSpan={6} className="p-2 text-red-200 font-semibold">Other charges (no stock)</td>
                    </tr>
                    {renderServiceRows(serviceItemsOtherType)}
                  </>
                )}
                {/* Frames */}
                {hasFramesSection && (
                  <tr className="bg-red-950/30">
                    <td colSpan={6} className="p-2 text-red-200 font-semibold">Frames</td>
                  </tr>
                )}
                {hasFramesSection && [...frames].sort((a, b) => {
                  const sub = (a as { subitem_name?: string }).subitem_name || '';
                  const subB = (b as { subitem_name?: string }).subitem_name || '';
                  const c = sub.localeCompare(subB);
                  if (c !== 0) return c;
                  const parse = (s: string) => { const [w, h] = parseSizeDimensions(s); return w * 100 + h; };
                  return parse(a.size_name) - parse(b.size_name);
                }).map((f) => {
                  const sub = (f as { subitem_name?: string }).subitem_name?.trim() ? (f as { subitem_name: string }).subitem_name : '';
                  const editingFr = editingPrice?.type === 'frame' && editingPrice?.id === f.id;
                  return (
                    <tr key={`f-${f.id}`} className="border-t border-red-950/40">
                      <td className="p-2 pl-6 text-white whitespace-nowrap">
                        {editingFr ? (
                          <input
                            type="text"
                            value={editRowSubitem}
                            onChange={(e) => setEditRowSubitem(e.target.value)}
                            placeholder="Type"
                            className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                          />
                        ) : (
                          sub || '—'
                        )}
                      </td>
                      <td className="p-2 text-red-300/80 whitespace-nowrap">
                        {editingFr ? (
                          <input
                            type="text"
                            value={editRowSize}
                            onChange={(e) => setEditRowSize(e.target.value)}
                            placeholder="Size (match Stock)"
                            className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                          />
                        ) : (
                          f.size_name
                        )}
                      </td>
                      <td className="p-2 text-red-300/80 whitespace-nowrap align-top">
                        {editingFr ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-red-300/60">Rs./unit</span>
                            <select value={editRowFrameType} onChange={(e) => setEditRowFrameType(e.target.value)} className="border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white max-w-[7rem]">
                              <option value="Duro">Duro</option>
                              <option value="Standard">Standard</option>
                            </select>
                          </div>
                        ) : (
                          <span>{((f.frame_type || 'Duro').trim() || 'Duro')} · Rs./unit</span>
                        )}
                      </td>
                      {renderAudienceCell(editingFr, f.price_audience)}
                      <td className="p-2 text-left tabular-nums">
                        {editingFr ? (
                          <input type="number" min="0" step="0.01" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="w-24 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                        ) : (
                          <span className="text-red-200/90 whitespace-nowrap">Rs.{f.unit_price}</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {editingFr ? (
                          <span className="flex items-center justify-center gap-1 flex-wrap">
                            <button type="button" onClick={() => handleSavePrice('frame', f.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                            <span className="text-red-600/60">|</span>
                            <button type="button" onClick={clearEdits} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => runAdmin(() => {
                                clearEdits();
                                setEditingPrice({ type: 'frame', id: f.id });
                                setEditRowSubitem(sub);
                                setEditRowSize(f.size_name || '');
                                setEditRowFrameType((f.frame_type || 'Duro').trim() || 'Duro');
                                setEditPriceAudience(normalizeAudience(f.price_audience));
                                setEditPriceValue(String(f.unit_price));
                              })}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              Edit
                            </button>
                            <span className="text-red-600/60">|</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemove(
                                  'frame',
                                  f.id,
                                  (f as { subitem_name?: string }).subitem_name?.trim()
                                    ? `${(f as { subitem_name: string }).subitem_name} — ${formatSizeDisplay(f.size_name) || f.size_name}`
                                    : formatSizeDisplay(f.size_name) || f.size_name
                                )
                              }
                              className="text-red-500 hover:text-red-400 text-xs"
                            >
                              Remove
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Custom sections (sales only): show roll pricing as subitems */}
                {visibleSalesCustomSections.map((sec) => {
                  if (sec.section_type !== 'roll') {
                    // Count sections: pricing subitems stored in custom_section_sale_items (per_unit).
                    // Stock page is completely separate — no stock items shown here.
                    const countSaleRows = customSaleItems.filter(
                      (si) => si.section_id === sec.section_id && si.qty_type !== 'per_sqft'
                    );
                    return (
                      <Fragment key={`cs-${sec.section_id}`}>
                        <tr className="bg-red-950/30">
                          <td colSpan={6} className="p-2 text-red-200 font-semibold">{sec.label}</td>
                        </tr>
                        {countSaleRows.length === 0 ? (
                          <tr className="border-t border-red-950/40">
                            <td colSpan={6} className="p-2 pl-6 text-red-300/60 text-sm">
                              No rows yet. Add them above (Type + Size + price). Size must match the Stock tab.
                            </td>
                          </tr>
                        ) : (
                          countSaleRows
                            .slice()
                            .sort((a, b) => {
                              const c = (a.item_name || '').localeCompare(b.item_name || '');
                              return c !== 0 ? c : (a.size_name || '').localeCompare(b.size_name || '');
                            })
                            .map((si) => {
                              const editingCs = editingPrice?.type === 'custom-sale' && editingPrice?.id === si.id;
                              return (
                                <tr key={`csi-${si.id}`} className="border-t border-red-950/40">
                                  <td className="p-2 pl-6 text-white whitespace-nowrap">
                                    {editingCs ? (
                                      <input
                                        type="text"
                                        value={editRowSubitem}
                                        onChange={(e) => setEditRowSubitem(e.target.value)}
                                        className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                                      />
                                    ) : (
                                      si.item_name
                                    )}
                                  </td>
                                  <td className="p-2 text-red-300/80 whitespace-nowrap">
                                    {editingCs ? (
                                      <input
                                        type="text"
                                        value={editRowSize}
                                        onChange={(e) => setEditRowSize(e.target.value)}
                                        placeholder="Size (match Stock)"
                                        className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                                      />
                                    ) : (
                                      si.size_name ? formatSizeDisplay(si.size_name) || si.size_name : '—'
                                    )}
                                  </td>
                                  <td className="p-2 text-red-300/80 whitespace-nowrap">Rs./unit</td>
                                  {renderAudienceCell(editingCs, si.price_audience)}
                                  <td className="p-2 text-left tabular-nums">
                                    {editingCs ? (
                                      <input type="number" min="0" step="0.01" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="w-24 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                                    ) : (
                                      <span className="text-red-200/90 whitespace-nowrap">Rs.{si.unit_price}/unit</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-center">
                                    {editingCs ? (
                                      <span className="flex items-center justify-center gap-1 flex-wrap">
                                        <button type="button" onClick={() => handleSavePrice('custom-sale', si.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                                        <span className="text-red-600/60">|</span>
                                        <button type="button" onClick={clearEdits} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                                      </span>
                                    ) : (
                                      <span className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => runAdmin(() => {
                                            clearEdits();
                                            setEditingPrice({ type: 'custom-sale', id: si.id });
                                            setEditRowSubitem(si.item_name || '');
                                            setEditRowSize(si.size_name || '');
                                            setEditPriceAudience(normalizeAudience(si.price_audience));
                                            setEditPriceValue(String(si.unit_price));
                                          })}
                                          className="text-red-400 hover:text-red-300 text-xs"
                                        >
                                          Edit
                                        </button>
                                        <span className="text-red-600/60">|</span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemove(
                                              'custom-sale',
                                              si.id,
                                              si.size_name ? `${si.item_name} (${formatSizeDisplay(si.size_name) || si.size_name})` : si.item_name
                                            )
                                          }
                                          className="text-red-500 hover:text-red-400 text-xs"
                                        >
                                          Remove
                                        </button>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </Fragment>
                    );
                  }

                  const saleRows = customSaleItems.filter((si) => si.section_id === sec.section_id);

                  return (
                    <Fragment key={`cs-${sec.section_id}`}>
                      <tr className="bg-red-950/30">
                        <td colSpan={6} className="p-2 text-red-200 font-semibold">{sec.label}</td>
                      </tr>
                      {saleRows.length === 0 ? (
                        <tr className="border-t border-red-950/40">
                          <td colSpan={6} className="p-2 pl-6 text-red-300/60 text-sm">
                            No rows yet. Add them above (Type + price). Roll sizes come from Stock.
                          </td>
                        </tr>
                      ) : (
                        saleRows
                          .slice()
                          .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''))
                          .map((si) => {
                            const editingCr = editingPrice?.type === 'custom-sale' && editingPrice?.id === si.id;
                            return (
                              <tr key={`s-${si.id}`} className="border-t border-red-950/40">
                                <td className="p-2 pl-6 text-white whitespace-nowrap">
                                  {editingCr ? (
                                    <input
                                      type="text"
                                      value={editRowSubitem}
                                      onChange={(e) => setEditRowSubitem(e.target.value)}
                                      className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                                    />
                                  ) : (
                                    si.item_name
                                  )}
                                </td>
                                <td className="p-2 text-red-300/50 whitespace-nowrap text-sm">—</td>
                                <td className="p-2 text-red-300/80 whitespace-nowrap">Rs./sqft</td>
                                {renderAudienceCell(editingCr, si.price_audience)}
                                <td className="p-2 text-left tabular-nums">
                                  {editingCr ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editPriceValue}
                                      onChange={(e) => setEditPriceValue(e.target.value)}
                                      className="w-24 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                                    />
                                  ) : (
                                    <span className="text-red-200/90 whitespace-nowrap">Rs.{si.unit_price}/sqft</span>
                                  )}
                                </td>
                                <td className="p-2 text-center">
                                  {editingCr ? (
                                    <span className="flex items-center justify-center gap-1 flex-wrap">
                                      <button type="button" onClick={() => handleSavePrice('custom-sale', si.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                                      <span className="text-red-600/60">|</span>
                                      <button type="button" onClick={clearEdits} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                                    </span>
                                  ) : (
                                    <span className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => runAdmin(() => {
                                          clearEdits();
                                          setEditingPrice({ type: 'custom-sale', id: si.id });
                                          setEditRowSubitem(si.item_name || '');
                                          setEditPriceAudience(normalizeAudience(si.price_audience));
                                          setEditPriceValue(String(si.unit_price));
                                        })}
                                        className="text-red-400 hover:text-red-300 text-xs"
                                      >
                                        Edit
                                      </button>
                                      <span className="text-red-600/60">|</span>
                                      <button type="button" onClick={() => handleRemove('custom-sale', si.id, si.item_name)} className="text-red-500 hover:text-red-400 text-xs">
                                        Remove
                                      </button>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </Fragment>
                  );
                })}
                {!hasFramesSection && !hasBannerSection && !hasStickerSection && !hasServicesSection && visibleSalesCustomSections.length === 0 && manualPriceCategories.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-red-300/70">
                      No item types yet. Add sections on the Stock page and/or create manual types above (e.g. printing prices, online fees).
                    </td>
                  </tr>
                )}
                {/* Design Banner */}
                {designBanner.length > 0 && (
                  <>
                    <tr className="bg-red-950/30">
                      <td colSpan={6} className="p-2 text-red-200 font-semibold">Design for Banner</td>
                    </tr>
                    {designBanner.map((d) => {
                      const editingDb = editingPrice?.type === 'designBanner' && editingPrice?.id === d.id;
                      return (
                        <tr key={`db-${d.id}`} className="border-t border-red-950/40">
                          <td className="p-2 pl-6 text-white whitespace-nowrap">
                            {editingDb ? (
                              <input
                                type="text"
                                value={editRowSize}
                                onChange={(e) => setEditRowSize(e.target.value)}
                                className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                              />
                            ) : (
                              formatSizeDisplay(d.size_name) || d.size_name
                            )}
                          </td>
                          <td className="p-2 text-red-300/80 whitespace-nowrap">
                            {editingDb ? (
                              <input
                                type="text"
                                value={editRowSize}
                                onChange={(e) => setEditRowSize(e.target.value)}
                                className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                              />
                            ) : (
                              formatSizeDisplay(d.size_name) || d.size_name
                            )}
                          </td>
                          <td className="p-2 text-red-300/80 whitespace-nowrap">Rs./unit</td>
                          {renderAudienceCell(editingDb, d.price_audience)}
                          <td className="p-2 text-left tabular-nums">
                            {editingDb ? (
                              <input type="number" min="0" step="0.01" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="w-24 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                            ) : (
                              <span className="text-red-200/90 whitespace-nowrap">Rs.{d.unit_price}</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {editingDb ? (
                              <span className="flex items-center justify-center gap-1 flex-wrap">
                                <button type="button" onClick={() => handleSavePrice('designBanner', d.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                                <span className="text-red-600/60">|</span>
                                <button type="button" onClick={clearEdits} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-1">
                                <button type="button" onClick={() => runAdmin(() => { clearEdits(); setEditingPrice({ type: 'designBanner', id: d.id }); setEditRowSize(d.size_name || ''); setEditPriceAudience(normalizeAudience(d.price_audience)); setEditPriceValue(String(d.unit_price)); })} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                                <span className="text-red-600/60">|</span>
                                <button type="button" onClick={() => handleRemove('designBanner', d.id, formatSizeDisplay(d.size_name) || d.size_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
                {/* Design Photo */}
                {designPhoto.length > 0 && (
                  <>
                    <tr className="bg-red-950/30">
                      <td colSpan={6} className="p-2 text-red-200 font-semibold">Design for Photo</td>
                    </tr>
                    {designPhoto.map((d) => {
                      const editingDp = editingPrice?.type === 'designPhoto' && editingPrice?.id === d.id;
                      return (
                        <tr key={`dp-${d.id}`} className="border-t border-red-950/40">
                          <td className="p-2 pl-6 text-white whitespace-nowrap">
                            {editingDp ? (
                              <input
                                type="text"
                                value={editRowSize}
                                onChange={(e) => setEditRowSize(e.target.value)}
                                className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                              />
                            ) : (
                              formatSizeDisplay(d.size_name) || d.size_name
                            )}
                          </td>
                          <td className="p-2 text-red-300/80 whitespace-nowrap">
                            {editingDp ? (
                              <input
                                type="text"
                                value={editRowSize}
                                onChange={(e) => setEditRowSize(e.target.value)}
                                className="w-full max-w-[10rem] border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                              />
                            ) : (
                              formatSizeDisplay(d.size_name) || d.size_name
                            )}
                          </td>
                          <td className="p-2 text-red-300/80 whitespace-nowrap">Rs./unit</td>
                          {renderAudienceCell(editingDp, d.price_audience)}
                          <td className="p-2 text-left tabular-nums">
                            {editingDp ? (
                              <input type="number" min="0" step="0.01" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="w-24 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                            ) : (
                              <span className="text-red-200/90 whitespace-nowrap">Rs.{d.unit_price}</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {editingDp ? (
                              <span className="flex items-center justify-center gap-1 flex-wrap">
                                <button type="button" onClick={() => handleSavePrice('designPhoto', d.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                                <span className="text-red-600/60">|</span>
                                <button type="button" onClick={clearEdits} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-1">
                                <button type="button" onClick={() => runAdmin(() => { clearEdits(); setEditingPrice({ type: 'designPhoto', id: d.id }); setEditRowSize(d.size_name || ''); setEditPriceAudience(normalizeAudience(d.price_audience)); setEditPriceValue(String(d.unit_price)); })} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                                <span className="text-red-600/60">|</span>
                                <button type="button" onClick={() => handleRemove('designPhoto', d.id, formatSizeDisplay(d.size_name) || d.size_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
