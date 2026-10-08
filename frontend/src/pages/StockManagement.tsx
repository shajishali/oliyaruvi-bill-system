import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import StockTable from '../components/stock/StockTable';
import StockModal from '../components/stock/StockModal';
import StockTransactionLog from '../components/stock/StockTransactionLog';
import AddItemModal, { type StockChoice } from '../components/stock/AddItemModal';
import AddBannerStockModal from '../components/stock/AddBannerStockModal';
import AddStickerStockModal from '../components/stock/AddStickerStockModal';
import AddCustomRollItemModal from '../components/stock/AddCustomRollItemModal';
import { api } from '../api/client';
import BranchTransfers from '../components/stock/BranchTransfers';
import { STOCK_SECTIONS_KEY, STOCK_CUSTOM_LABELS_KEY } from '../constants/stockSections';
import { requestAdminPermission } from '../components/admin/AdminPermission';

type SectionId = 'frames' | 'photos' | 'log' | string;

interface StockItem {
  id: number;
  size_name?: string;
  subitem_name?: string;
  material_name?: string;
  frame_type?: string;
  item_type?: string;
  stock_type?: string;
  print_type?: string;
  unit_price?: number | null;
  price_unit?: string;
  stock_qty?: number;
  feet_remaining?: number;
  low_stock_threshold?: number;
}

function rollChoices(rows: StockItem[], typeKey: 'stock_type' | 'item_type'): StockChoice[] {
  return rows.map((row) => {
    const size = (row.size_name || '').trim();
    const bare = size.replace(/\s*feet?\s*/gi, '').replace(/\s*ft\s*/gi, '').trim();
    const width = parseFloat(bare);
    return {
      type: (row[typeKey] || '').trim(),
      size,
      sizeLabel: Number.isNaN(width) ? size : `${width} ft`,
    };
  }).filter((row) => row.size);
}

function getSectionLabel(id: string, customLabels: Record<string, string>): string {
  if (id === 'frames') return 'frames';
  if (id === 'photos') return 'photos';
  if (id === 'banner') return 'banner';
  if (id === 'sticker') return 'sticker';
  if (id === 'log') return 'Transaction Log';
  return customLabels[id] ?? id;
}

function resolveTypedSection(input: string): SectionId | null {
  const t = input.trim().toLowerCase();
  if (t === 'photos' || t === 'photo') return 'photos';
  if (t === 'frames' || t === 'frame') return 'frames';
  if (t === 'banner' || t === 'banners') return 'banner';
  if (t === 'sticker' || t === 'stickers') return 'sticker';
  if (t === 'log' || t === 'transaction log' || t === 'transaction') return 'log';
  return null;
}

// NOTE: kept for backwards compatibility in older code paths.
function getCustomStockType(sectionId: string, customLabels: Record<string, string>): 'frame' | 'photo' | 'photocopy' | 'banner' | 'sticker' | null {
  const label = getSectionLabel(sectionId, customLabels).trim().toLowerCase();
  if (!label) return null;
  if (label.includes('banner')) return 'banner';
  if (label.includes('sticker')) return 'sticker';
  if (label.includes('frame')) return 'frame';
  if (label.includes('photocopy') || label.includes('copy')) return 'photocopy';
  if (label.includes('photo')) return 'photo';
  return null;
}

function getDefaultSections(): SectionId[] {
  try {
    const stored = localStorage.getItem(STOCK_SECTIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      return parsed.filter((s) => s && typeof s === 'string');
    }
  } catch {
    /* ignore */
  }
  return [];
}

function getDefaultCustomLabels(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STOCK_CUSTOM_LABELS_KEY);
    if (stored) return JSON.parse(stored) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

export default function StockManagement() {
  const [enabledSections, setEnabledSections] = useState<SectionId[]>(getDefaultSections);
  const [sectionsReady, setSectionsReady] = useState(() => {
    try { return localStorage.getItem(STOCK_SECTIONS_KEY) != null; } catch { return false; }
  });
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(getDefaultCustomLabels);
  const [activeTab, setActiveTab] = useState<SectionId | null>(() => {
    const defaults = getDefaultSections();
    return defaults[0] ?? null;
  });
  const [frames, setFrames] = useState<StockItem[]>([]);
  const [photos, setPhotos] = useState<StockItem[]>([]);
  const [photocopy, setPhotocopy] = useState<StockItem[]>([]);
  const [customSectionsMeta, setCustomSectionsMeta] = useState<Record<string, 'count' | 'roll'>>({});
  const [transactions, setTransactions] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionInput, setNewSectionInput] = useState('');

  const [stockModal, setStockModal] = useState<{ type: string; item: StockItem; itemType: string; isRollType?: boolean } | null>(null);
  const [addModal, setAddModal] = useState<'frame' | 'photo' | 'photocopy' | null>(null);
  const [addBannerModal, setAddBannerModal] = useState(false);
  const [addStickerModal, setAddStickerModal] = useState(false);
  /** Custom tabs (e.g. clothes): open simple Size/Qty/Low stock modal for this section id */
  const [customAddSectionId, setCustomAddSectionId] = useState<string | null>(null);
  const [customAddSectionKind, setCustomAddSectionKind] = useState<'count' | 'roll' | null>(null);
  const [customBySection, setCustomBySection] = useState<Record<string, StockItem[]>>({});

  const [pendingSection, setPendingSection] = useState<{ sectionId: string; label: string; isCustom: boolean } | null>(null);
  const [customSectionTypeChoiceOpen, setCustomSectionTypeChoiceOpen] = useState(false);
  const [pendingCustomSectionType, setPendingCustomSectionType] = useState<'count' | 'roll'>('count');
  const [pendingCustomSectionAffectsSales, setPendingCustomSectionAffectsSales] = useState(true);
  const [bannerStock, setBannerStock] = useState<StockItem[]>([]);
  const [stickerStock, setStickerStock] = useState<StockItem[]>([]);

  useEffect(() => {
    if (!sectionsReady) return;
    localStorage.setItem(STOCK_SECTIONS_KEY, JSON.stringify(enabledSections));
  }, [enabledSections, sectionsReady]);

  useEffect(() => {
    if (!sectionsReady) return;
    localStorage.setItem(STOCK_CUSTOM_LABELS_KEY, JSON.stringify(customLabels));
  }, [customLabels, sectionsReady]);

  useEffect(() => {
    if (enabledSections.length === 0) {
      setActiveTab(null);
      return;
    }
    if (!activeTab || !enabledSections.includes(activeTab)) {
      setActiveTab(enabledSections[0]);
    }
  }, [enabledSections, activeTab]);

  const removeSectionFromBar = async (sectionId: SectionId) => {
    if (!(await requestAdminPermission())) return;
    const label = getSectionLabel(sectionId, customLabels);
    const isCustom = String(sectionId).startsWith('custom-');
    const msg = isCustom
      ? `Remove section "${label}" and delete all stock rows in it?`
      : `Remove "${label}" from the stock bar? (Your data is not deleted; add the section again with + Add Section if needed.)`;
    if (!window.confirm(msg)) return;
    setError('');
    try {
      if (isCustom) await api.stock.deleteCustomSection(String(sectionId));
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    if (isCustom) {
      setCustomLabels((prev) => {
        const next = { ...prev };
        delete next[String(sectionId)];
        return next;
      });
    }
    setEnabledSections((prev) => {
      const next = prev.filter((s) => s !== sectionId);
      setActiveTab((cur) => {
        if (cur !== sectionId) return cur;
        return next[0] ?? null;
      });
      return next;
    });
    if (customAddSectionId === sectionId) {
      setCustomAddSectionId(null);
      setCustomAddSectionKind(null);
    }
    fetchData();
  };

  const addSectionFromInput = () => {
    const trimmed = newSectionInput.trim();
    if (!trimmed) return;

    const resolved = resolveTypedSection(trimmed);
    if (resolved) {
      setPendingSection({
        sectionId: resolved,
        label: getSectionLabel(resolved, customLabels),
        isCustom: false,
      });
      setPendingCustomSectionType(defaultSectionKindFromLabel(getSectionLabel(resolved, customLabels)));
      setPendingCustomSectionAffectsSales(true);
      setCustomSectionTypeChoiceOpen(true);
    } else {
      const customId = 'custom-' + Date.now();
      setPendingSection({ sectionId: customId, label: trimmed, isCustom: true });
      const defaultKind = defaultSectionKindFromLabel(trimmed);
      setPendingCustomSectionType(defaultKind);
      setPendingCustomSectionAffectsSales(true);
      setCustomSectionTypeChoiceOpen(true);
    }
    setNewSectionInput('');
    setAddSectionOpen(false);
  };

  const defaultSectionKindFromLabel = (label: string): 'count' | 'roll' => {
    const t = label.trim().toLowerCase();
    if (t.includes('cloth')) return 'roll';
    if (t.includes('sticker') || t.includes('banner')) return 'roll';
    if (t.includes('photocopy') || t.includes('photo') || t.includes('frame') || t.includes('copy')) return 'count';
    return 'count';
  };

  const openAddModal = (type: 'frame' | 'photo' | 'photocopy') => {
    setError('');
    setCustomAddSectionId(null);
    setCustomAddSectionKind(null);
    setAddModal(type);
  };

  const openAddModalForCustom = (sectionId: string) => {
    setError('');
    setAddModal(null);
    setCustomAddSectionId(null);
    const label = getSectionLabel(sectionId, customLabels);
    const kind = customSectionsMeta[sectionId] ?? defaultSectionKindFromLabel(label);
    setCustomAddSectionKind(kind);
    setCustomAddSectionId(sectionId);
  };

  const confirmPendingCustomSection = async () => {
    if (!pendingSection) return;
    const { sectionId, label, isCustom } = pendingSection;
    setError('');
    try {
      if (isCustom) {
        await api.stock.createCustomSection({
          section_id: sectionId,
          label,
          section_type: pendingCustomSectionType,
          affects_sales: pendingCustomSectionAffectsSales,
        });
        setCustomLabels((prev) => ({ ...prev, [sectionId]: label }));
      }
      setEnabledSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
      setActiveTab(sectionId);
      if (isCustom) await fetchData();
      setPendingSection(null);
      setCustomSectionTypeChoiceOpen(false);
      setPendingCustomSectionType('count');
      setPendingCustomSectionAffectsSales(true);
      setNewSectionInput('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancelPendingCustomSection = () => {
    setPendingSection(null);
    setCustomSectionTypeChoiceOpen(false);
    setPendingCustomSectionType('count');
    setPendingCustomSectionAffectsSales(true);
  };

  const handleAddBannerStock = async (data: {
    size_name: string;
    stock_qty: number;
    low_stock_threshold?: number;
    stock_type?: string;
    print_type?: string;
    unit_price?: number | null;
    price_unit?: 'per_sqft' | 'per_qty';
  }) => {
    try {
      await api.stock.createBanner({
        size_name: data.size_name,
        stock_qty: data.stock_qty,
        low_stock_threshold: data.low_stock_threshold ?? -1,
        stock_type: (data.stock_type || '').trim(),
        print_type: (data.print_type || '').trim(),
        ...(typeof data.unit_price === 'number' && !isNaN(data.unit_price)
          ? { unit_price: data.unit_price, price_unit: data.price_unit ?? 'per_sqft' }
          : {}),
      });
      fetchData();
      setAddBannerModal(false);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const handleAddStickerStock = async (data: {
    size_name: string;
    stock_qty: number;
    low_stock_threshold?: number;
    stock_type?: string;
  }) => {
    try {
      await api.stock.createSticker({
        size_name: data.size_name,
        stock_qty: data.stock_qty,
        low_stock_threshold: data.low_stock_threshold ?? -1,
        stock_type: (data.stock_type || '').trim(),
      });
      fetchData();
      setAddStickerModal(false);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const fetchData = (silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      api.stock.frames(),
      api.stock.photos(),
      api.stock.photocopy().catch(() => []),
      api.stock.customItems().catch(() => []),
      api.stock.customSections().catch(() => []),
      api.stock.transactions({ limit: '50' }),
      api.stock.banners().catch(() => []),
      api.stock.stickers().catch(() => []),
    ])
      .then(([f, p, pc, ci, cs, t, bs, ss]) => {
        setFrames(f as StockItem[]);
        setPhotos(p as StockItem[]);
        setPhotocopy(pc as StockItem[]);
        const customRows = Array.isArray(ci)
          ? (ci as {
              id: number;
              section_id: string;
              size_name?: string;
              stock_qty?: number;
              low_stock_threshold?: number;
              updated_at?: string;
              item_type?: string;
            }[])
          : [];
        const map: Record<string, StockItem[]> = {};
        for (const r of customRows) {
          const sid = r.section_id;
          if (!sid) continue;
          if (!map[sid]) map[sid] = [];
          map[sid].push({
            id: r.id,
            size_name: r.size_name,
            item_type: r.item_type,
            stock_qty: r.stock_qty,
            feet_remaining: (r as { feet_remaining?: number }).feet_remaining,
            low_stock_threshold: r.low_stock_threshold,
            updated_at: r.updated_at,
          });
        }
        setCustomBySection(map);
        const metaMap: Record<string, 'count' | 'roll'> = {};
        for (const s of (Array.isArray(cs) ? cs : [])) {
          const sid = (s as { section_id: string; section_type?: string }).section_id;
          const stype = (s as { section_type?: string }).section_type;
          if (!sid || (stype !== 'count' && stype !== 'roll')) continue;
          metaMap[sid] = stype as 'count' | 'roll';
        }
        setCustomSectionsMeta(metaMap);
        setTransactions(Array.isArray(t) ? t : []);
        setBannerStock(Array.isArray(bs) ? bs : []);
        setStickerStock(Array.isArray(ss) ? ss : []);
        let savedSections = true;
        try { savedSections = localStorage.getItem(STOCK_SECTIONS_KEY) != null; } catch { savedSections = true; }
        if (!savedSections) {
          const next: SectionId[] = [];
          if (Array.isArray(f) && f.length) next.push('frames');
          if (Array.isArray(p) && p.length) next.push('photos');
          if (Array.isArray(bs) && bs.length) next.push('banner');
          if (Array.isArray(ss) && ss.length) next.push('sticker');
          const labels: Record<string, string> = {};
          for (const section of (Array.isArray(cs) ? cs : []) as { section_id?: string; label?: string }[]) {
            if (!section.section_id) continue;
            next.push(section.section_id);
            if (section.label) labels[section.section_id] = section.label;
          }
          if (next.length) {
            setEnabledSections(next);
            setCustomLabels((prev) => ({ ...labels, ...prev }));
            setActiveTab(next[0]);
          }
          setSectionsReady(true);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isLowStock = (item: StockItem, itemType?: string) => {
    if (!item) return false;
    const isCustomTab = typeof activeTab === 'string' && activeTab.startsWith('custom-');
    const label = isCustomTab ? getSectionLabel(activeTab, customLabels).toLowerCase() : '';
    const type = itemType ?? (activeTab === 'banner' || label === 'banner' ? 'banner' : activeTab === 'sticker' || label === 'sticker' ? 'sticker' : '');

    const thresh = item.low_stock_threshold ?? 0;
    if (thresh < 0) return false; // No low-stock tracking

    // Custom roll sections: low_stock_threshold is stored in feet.
    if (isCustomTab && customSectionsMeta[activeTab] === 'roll') {
      const feet = (item as { feet_remaining?: number }).feet_remaining ?? ((item.stock_qty ?? 0) * 150);
      return feet <= (thresh || 10);
    }

    if (type === 'banner' || type === 'sticker') {
      const feet = (item as { feet_remaining?: number }).feet_remaining ?? ((item.stock_qty ?? 0) * 150);
      return feet <= (thresh || 10);
    }
    return (item.stock_qty ?? 0) <= thresh;
  };

  const handleEditStock = (item: StockItem, itemType: string, isRollType = false) => {
    void (async () => {
      if (!(await requestAdminPermission({ force: true }))) return;
      setStockModal({ type: 'edit', item, itemType, isRollType });
    })();
  };

  const handleRemoveBannerOrSticker = async (item: StockItem, type: 'banner' | 'sticker') => {
    if (!(await requestAdminPermission())) return;
    const label = type === 'banner' ? 'banner size' : 'sticker size';
    if (!window.confirm(`Remove this ${label} (${item.size_name ?? item.material_name})? You can add it again later.`)) return;
    setError('');
    try {
      if (type === 'banner') await api.stock.deleteBanner(item.id);
      else await api.stock.deleteSticker(item.id);
      fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemoveFrameOrPhoto = async (item: StockItem, type: 'frame' | 'photo') => {
    if (!(await requestAdminPermission())) return;
    const label = type === 'frame' ? 'frame size' : 'photo size';
    const name = item.size_name ?? item.material_name ?? '';
    if (!window.confirm(`Remove this ${label} (${name})? You can add it again later.`)) return;
    setError('');
    try {
      if (type === 'frame') await api.stock.deleteFrame(item.id);
      else await api.stock.deletePhoto(item.id);
      fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemovePhotocopy = async (item: StockItem) => {
    if (!(await requestAdminPermission())) return;
    const name = item.size_name ?? item.material_name ?? '';
    if (!window.confirm(`Remove this photocopy size (${name})? You can add it again later.`)) return;
    setError('');
    try {
      await api.stock.deletePhotocopy(item.id);
      fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddCustomSectionItem = async (data: {
    size_name: string;
    frame_type?: string;
    stock_qty: number;
    low_stock_threshold?: number;
    item_type?: string;
  }) => {
    if (!customAddSectionId) return;
    try {
      await api.stock.createCustomSectionItem(customAddSectionId, {
        size_name: data.size_name,
        stock_qty: data.stock_qty,
        low_stock_threshold: data.low_stock_threshold,
        ...(data.item_type != null && String(data.item_type).trim() !== ''
          ? { item_type: String(data.item_type).trim() }
          : {}),
      });
      fetchData();
      setCustomAddSectionId(null);
      setCustomAddSectionKind(null);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const handleAddCustomSectionRollItem = async (data: {
    size_name: string;
    stock_qty: number;
    low_stock_threshold?: number;
    item_type?: string;
  }) => {
    if (!customAddSectionId) return;
    try {
      await api.stock.createCustomSectionItem(customAddSectionId, {
        size_name: data.size_name,
        stock_qty: data.stock_qty, // stored as rolls
        low_stock_threshold: data.low_stock_threshold, // feet threshold
        ...(data.item_type != null && String(data.item_type).trim() !== ''
          ? { item_type: String(data.item_type).trim() }
          : {}),
      });
      fetchData();
      setCustomAddSectionId(null);
      setCustomAddSectionKind(null);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const handleRemoveCustomSectionItem = async (item: StockItem) => {
    if (!(await requestAdminPermission())) return;
    const name = item.size_name ?? item.material_name ?? '';
    if (!window.confirm(`Remove "${name}" from this section? You can add it again later.`)) return;
    setError('');
    try {
      await api.stock.deleteCustomSectionItem(item.id);
      fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddItem = async (data: { size_name: string; frame_type?: string; subitem_name?: string; stock_qty: number; low_stock_threshold?: number }) => {
    if (!addModal) return;
    try {
      if (addModal === 'frame') {
        await api.stock.createFrame(data);
      } else if (addModal === 'photo') {
        await api.stock.createPhoto(data);
      } else {
        await api.stock.createPhotocopy(data);
      }
      fetchData();
      setAddModal(null);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const handleSaveBannerRow = async (
    id: number,
    data: {
      size_name: string;
      stock_qty: number;
      feet_remaining: number;
      low_stock_threshold: number;
      stock_type: string;
      print_type?: string;
      unit_price?: number | null;
      price_unit?: 'per_sqft' | 'per_qty';
    }
  ) => {
    if (!(await requestAdminPermission())) return;
    setError('');
    try {
      await api.stock.updateBanner(id, {
        size_name: data.size_name,
        stock_qty: data.stock_qty,
        feet_remaining: data.feet_remaining,
        low_stock_threshold: data.low_stock_threshold,
        stock_type: data.stock_type,
        print_type: data.print_type ?? '',
        unit_price: data.unit_price === null || data.unit_price === undefined ? null : data.unit_price,
        price_unit: data.price_unit ?? 'per_sqft',
      });
      fetchData();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const handleSaveStickerRow = async (
    id: number,
    data: {
      size_name: string;
      stock_qty: number;
      feet_remaining: number;
      low_stock_threshold: number;
      stock_type: string;
    }
  ) => {
    if (!(await requestAdminPermission())) return;
    setError('');
    try {
      await api.stock.updateSticker(id, data);
      fetchData();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const handleStockModalConfirm = async ({
    quantity,
    reason,
    transaction_type,
    size_name,
    frame_type,
  }: {
    quantity: number;
    reason: string | null;
    transaction_type?: string;
    size_name?: string;
    frame_type?: string;
  }) => {
    if (!stockModal) return;
    if (!(await requestAdminPermission())) return;
    const { type, item, itemType } = stockModal;
    const txType = transaction_type || (type === 'edit' ? 'add' : type);
    try {
      if (itemType === 'frame' && size_name) {
        await api.stock.updateFrame(item.id, {
          size_name,
          frame_type: frame_type ?? item.frame_type ?? '',
        });
      }
      if (quantity > 0) {
        await api.stock.addTransaction({
          item_type: itemType,
          item_id: item.id,
          transaction_type: txType,
          quantity,
          reason,
        });
      }
      fetchData();
      setStockModal(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const frameNames: Record<number, string> = Object.fromEntries(frames.map((f) => [f.id, f.size_name ?? '']));
  const photoNames: Record<number, string> = Object.fromEntries(photos.map((p) => [p.id, p.size_name ?? '']));
  const photocopyNames: Record<number, string> = Object.fromEntries(photocopy.map((p) => [p.id, p.size_name ?? '']));
  const bannerNames: Record<number, string> = Object.fromEntries(bannerStock.map((b) => [b.id, b.size_name ?? '']));
  const stickerNames: Record<number, string> = Object.fromEntries(stickerStock.map((s) => [s.id, s.size_name ?? '']));
  const customNames: Record<number, string> = Object.fromEntries(
    Object.values(customBySection)
      .flat()
      .map((it) => [it.id, it.size_name ?? ''] as const)
  );

  // Custom tabs are always backed by `custom_section_stock` (count/roll handled via `customSectionsMeta`).
  // We intentionally do NOT map custom labels like "photocopy" to built-in stock tables.
  const activeCustomType = null as null;

  return (
    <>
      <Header title="Stock Management" />
      <div className="p-6">
        <p className="text-sm text-red-300/75 mb-4">Editing or deleting stock needs admin permission. Adding stock does not.</p>
        <BranchTransfers onStockChanged={() => fetchData(true)} />

        {error && (
          <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-300 hover:text-white ml-2">✕</button>
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap items-center">
          {enabledSections.map((tab) => (
            <div
              key={tab}
              className={`inline-flex items-stretch rounded-lg overflow-hidden border ${
                activeTab === tab ? 'border-red-500/80' : 'border-red-950/50'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium ${
                  activeTab === tab ? 'bg-red-600 text-white' : 'bg-black/60 text-red-200/90 hover:bg-red-950/60'
                }`}
              >
                {getSectionLabel(tab, customLabels)}
              </button>
              <button
                type="button"
                title={`Remove section: ${getSectionLabel(tab, customLabels)}`}
                aria-label={`Remove section ${getSectionLabel(tab, customLabels)}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void removeSectionFromBar(tab);
                }}
                className="px-2.5 py-2 text-sm font-bold bg-red-950/70 text-red-200 hover:bg-red-900/90 border-l border-red-900/50"
              >
                ×
              </button>
            </div>
          ))}
          <div className="relative">
            <button
              onClick={() => setAddSectionOpen((o) => !o)}
              className="px-4 py-2 rounded-lg font-medium bg-emerald-600/80 text-white hover:bg-emerald-600 border border-emerald-500/50"
            >
              + Add Section
            </button>
            {addSectionOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => { setAddSectionOpen(false); setNewSectionInput(''); }} />
                <div className="absolute left-0 top-full mt-1 z-20 flex gap-2 p-2 border border-red-950/50 rounded-lg bg-black/95 shadow-xl">
                  <input
                    type="text"
                    value={newSectionInput}
                    onChange={(e) => setNewSectionInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addSectionFromInput()}
                    placeholder="Type section name (e.g. Photos, Transaction Log)"
                    className="px-3 py-2 rounded-lg border border-red-900/50 bg-black/60 text-white placeholder-red-400/50 text-sm min-w-[220px]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={addSectionFromInput}
                    disabled={!newSectionInput.trim()}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-red-300/70">Loading...</p>
        ) : (
          <>
            {activeTab === 'frames' && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">Frame Sizes</h3>
                  <button onClick={() => openAddModal('frame')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    + Add Item
                  </button>
                </div>
                <StockTable
                  items={frames}
                  itemType="frame"
                  onEdit={(item) => handleEditStock(item, 'frame')}
                  onRemove={(item) => handleRemoveFrameOrPhoto(item, 'frame')}
                  isLowStock={isLowStock}
                />
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">Photo Sizes</h3>
                  <button onClick={() => openAddModal('photo')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    + Add Item
                  </button>
                </div>
                <StockTable
                  items={photos}
                  itemType="photo"
                  onEdit={(item) => handleEditStock(item, 'photo')}
                  onRemove={(item) => handleRemoveFrameOrPhoto(item, 'photo')}
                  isLowStock={isLowStock}
                />
              </div>
            )}

            {activeTab === 'banner' && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <div className="flex justify-between items-center mb-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-white">Banner rolls (physical stock)</h3>
                    <p className="text-xs text-red-300/75 mt-1 max-w-3xl">
                      Each row is one <span className="text-red-200/90">roll width</span> (e.g. 6 ft, 8 ft). Material pricing is in <span className="text-red-200/90">Settings → Banner</span>. On Billing you pick the material and roll width.
                    </p>
                  </div>
                  <button onClick={() => { setError(''); setAddBannerModal(true); }} className="shrink-0 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    + Add Item
                  </button>
                </div>
                <StockTable
                  items={bannerStock}
                  itemType="banner"
                  onSaveRollRow={handleSaveBannerRow}
                  onRemove={(item) => handleRemoveBannerOrSticker(item, 'banner')}
                  isLowStock={isLowStock}
                />
              </div>
            )}

            {activeTab === 'sticker' && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <div className="flex justify-between items-center mb-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-white">Sticker rolls (physical stock)</h3>
                    <p className="text-xs text-red-300/75 mt-1 max-w-3xl">
                      Each row is one <span className="text-red-200/90">roll width</span>. Sticker material pricing is in <span className="text-red-200/90">Settings → Sticker</span>. On Billing you choose the material and roll width.
                    </p>
                  </div>
                  <button onClick={() => { setError(''); setAddStickerModal(true); }} className="shrink-0 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    + Add Item
                  </button>
                </div>
                <StockTable
                  items={stickerStock}
                  itemType="sticker"
                  onSaveRollRow={handleSaveStickerRow}
                  onRemove={(item) => handleRemoveBannerOrSticker(item, 'sticker')}
                  isLowStock={isLowStock}
                />
              </div>
            )}

            {activeTab === 'log' && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <h3 className="font-semibold mb-4 text-white">Stock Transaction Log</h3>
                <StockTransactionLog
                  transactions={transactions}
                  frameNames={frameNames}
                  photoNames={photoNames}
                  photocopyNames={photocopyNames}
                  customNames={customNames}
                  bannerNames={bannerNames}
                  stickerNames={stickerNames}
                />
              </div>
            )}

            {!activeTab && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <h3 className="font-semibold text-white mb-2">No stock sections yet</h3>
                <p className="text-red-300/75 text-sm">
                  Use <span className="text-red-200/90 font-medium">+ Add Section</span> to start fresh.
                </p>
              </div>
            )}

            {typeof activeTab === 'string' && activeTab.startsWith('custom-') && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">{getSectionLabel(activeTab, customLabels)}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void removeSectionFromBar(activeTab);
                      }}
                      className="px-4 py-2 bg-red-950/80 text-red-200 rounded-lg hover:bg-red-900/90 text-sm border border-red-900/50"
                    >
                      Close Section
                    </button>
                    <button onClick={() => openAddModalForCustom(activeTab)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                      + Add Item
                    </button>
                  </div>
                </div>
                <StockTable
                  items={customBySection[activeTab] ?? []}
                  itemType="custom"
                  customRollMode={customSectionsMeta[activeTab] === 'roll'}
                  onEdit={(item) => handleEditStock(item, 'custom', customSectionsMeta[activeTab] === 'roll')}
                  onRemove={handleRemoveCustomSectionItem}
                  isLowStock={isLowStock}
                />
              </div>
            )}
          </>
        )}

        {customSectionTypeChoiceOpen && pendingSection && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold mb-3 text-white">Section Type</h3>
              <p className="text-sm text-red-300/70 mb-4">
                Section: <span className="text-red-200/90 font-medium">{pendingSection.label}</span>
              </p>
              <div className="flex gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setPendingCustomSectionType('count')}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                    pendingCustomSectionType === 'count' ? 'bg-emerald-600 text-white' : 'bg-red-950/60 text-red-200'
                  }`}
                >
                  Count Type
                </button>
                <button
                  type="button"
                  onClick={() => setPendingCustomSectionType('roll')}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                    pendingCustomSectionType === 'roll' ? 'bg-emerald-600 text-white' : 'bg-red-950/60 text-red-200'
                  }`}
                >
                  Roll Type
                </button>
              </div>
              <p className="text-sm text-red-300/70 mb-2">Does this section affect sales?</p>
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setPendingCustomSectionAffectsSales(true)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                    pendingCustomSectionAffectsSales ? 'bg-emerald-600 text-white' : 'bg-red-950/60 text-red-200'
                  }`}
                >
                  Yes – items sold to customers
                </button>
                <button
                  type="button"
                  onClick={() => setPendingCustomSectionAffectsSales(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                    !pendingCustomSectionAffectsSales ? 'bg-emerald-600 text-white' : 'bg-red-950/60 text-red-200'
                  }`}
                >
                  No – maintenance only (e.g. ink)
                </button>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button
                  type="button"
                  onClick={cancelPendingCustomSection}
                  className="px-4 py-2 bg-red-950/60 text-red-200 rounded-lg hover:bg-red-900/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void confirmPendingCustomSection(); }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {stockModal && (
          <StockModal
            type={stockModal.type}
            item={stockModal.item}
            itemType={stockModal.itemType}
            isRollType={stockModal.isRollType}
            onClose={() => setStockModal(null)}
            onConfirm={handleStockModalConfirm}
          />
        )}

        {addModal && (
          <AddItemModal
            itemType={addModal}
            suggestions={
              addModal === 'frame'
                ? frames.map((row) => ({ type: (row.frame_type || 'Standard').trim() || 'Standard', size: (row.size_name || '').trim() })).filter((row) => row.size)
                : addModal === 'photo'
                  ? photos.map((row) => ({ size: (row.size_name || '').trim() })).filter((row) => row.size)
                  : photocopy.map((row) => ({ size: (row.size_name || '').trim() })).filter((row) => row.size)
            }
            onClose={() => setAddModal(null)}
            onConfirm={handleAddItem}
            onError={(msg) => setError(msg)}
          />
        )}

        {customAddSectionId && customAddSectionKind === 'count' && (
          <AddItemModal
            key={`${customAddSectionId}-count`}
            itemType="custom"
            suggestions={(customBySection[customAddSectionId] || []).map((row): StockChoice => ({
              type: (row.item_type || '').trim(),
              size: (row.size_name || '').trim(),
            })).filter((row) => row.size)}
            onClose={() => { setCustomAddSectionId(null); setCustomAddSectionKind(null); }}
            onConfirm={handleAddCustomSectionItem}
            onError={(msg) => setError(msg)}
          />
        )}
        {customAddSectionId && customAddSectionKind === 'roll' && (
          <AddCustomRollItemModal
            key={`${customAddSectionId}-roll`}
            suggestions={rollChoices(customBySection[customAddSectionId] || [], 'item_type')}
            onClose={() => { setCustomAddSectionId(null); setCustomAddSectionKind(null); }}
            onConfirm={handleAddCustomSectionRollItem}
            onError={(msg) => setError(msg)}
          />
        )}

        {addBannerModal && (
          <AddBannerStockModal
            suggestions={rollChoices(bannerStock, 'stock_type')}
            onClose={() => setAddBannerModal(false)}
            onConfirm={handleAddBannerStock}
            onError={(msg) => setError(msg)}
          />
        )}

        {addStickerModal && (
          <AddStickerStockModal
            suggestions={rollChoices(stickerStock, 'stock_type')}
            onClose={() => setAddStickerModal(false)}
            onConfirm={handleAddStickerStock}
            onError={(msg) => setError(msg)}
          />
        )}
      </div>
    </>
  );
}
