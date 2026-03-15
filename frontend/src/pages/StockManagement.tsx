import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import StockTable from '../components/stock/StockTable';
import StockModal from '../components/stock/StockModal';
import StockTransactionLog from '../components/stock/StockTransactionLog';
import AddItemModal from '../components/stock/AddItemModal';
import AddBannerStockModal from '../components/stock/AddBannerStockModal';
import AddStickerStockModal from '../components/stock/AddStickerStockModal';
import { api } from '../api/client';
import { STOCK_SECTIONS_KEY, STOCK_CUSTOM_LABELS_KEY } from '../constants/stockSections';

type SectionId = 'frames' | 'photos' | 'log' | string;

interface StockItem {
  id: number;
  size_name?: string;
  material_name?: string;
  frame_type?: string;
  stock_qty?: number;
  feet_remaining?: number;
  low_stock_threshold?: number;
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
  return ['frames', 'banner', 'sticker'];
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
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(getDefaultCustomLabels);
  const [activeTab, setActiveTab] = useState<SectionId>('frames');
  const [frames, setFrames] = useState<StockItem[]>([]);
  const [photos, setPhotos] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionInput, setNewSectionInput] = useState('');

  const [stockModal, setStockModal] = useState<{ type: string; item: StockItem; itemType: string } | null>(null);
  const [addModal, setAddModal] = useState<'frame' | 'photo' | null>(null);
  const [addBannerModal, setAddBannerModal] = useState(false);
  const [addStickerModal, setAddStickerModal] = useState(false);
  const [addTypeChoiceModal, setAddTypeChoiceModal] = useState(false);
  const [bannerStock, setBannerStock] = useState<StockItem[]>([]);
  const [stickerStock, setStickerStock] = useState<StockItem[]>([]);

  useEffect(() => {
    localStorage.setItem(STOCK_SECTIONS_KEY, JSON.stringify(enabledSections));
  }, [enabledSections]);

  useEffect(() => {
    localStorage.setItem(STOCK_CUSTOM_LABELS_KEY, JSON.stringify(customLabels));
  }, [customLabels]);

  const addSectionFromInput = () => {
    const trimmed = newSectionInput.trim();
    if (!trimmed) return;

    const resolved = resolveTypedSection(trimmed);
    if (resolved) {
      if (!enabledSections.includes(resolved)) {
        setEnabledSections((prev) => [...prev, resolved]);
      }
      setActiveTab(resolved);
    } else {
      const customId = 'custom-' + Date.now();
      setCustomLabels((prev) => ({ ...prev, [customId]: trimmed }));
      setEnabledSections((prev) => [...prev, customId]);
      setActiveTab(customId);
    }
    setNewSectionInput('');
    setAddSectionOpen(false);
  };

  const openAddModal = (type: 'frame' | 'photo') => {
    setError('');
    setAddModal(type);
  };

  const openAddModalForCustom = (sectionId: string) => {
    setError('');
    const label = getSectionLabel(sectionId, customLabels).toLowerCase();
    if (sectionId === 'banner' || label === 'banner') {
      setAddBannerModal(true);
    } else if (sectionId === 'sticker' || label === 'sticker') {
      setAddStickerModal(true);
    } else {
      setAddTypeChoiceModal(true);
    }
  };

  const handleAddBannerStock = async (data: { size_name: string; stock_qty: number; low_stock_threshold: number }) => {
    try {
      await api.stock.createBanner(data);
      fetchData();
      setAddBannerModal(false);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const handleAddStickerStock = async (data: { size_name: string; stock_qty: number; low_stock_threshold: number }) => {
    try {
      await api.stock.createSticker(data);
      fetchData();
      setAddStickerModal(false);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.stock.frames(),
      api.stock.photos(),
      api.stock.transactions({ limit: '50' }),
      api.stock.banners().catch(() => []),
      api.stock.stickers().catch(() => []),
    ])
      .then(([f, p, t, bs, ss]) => {
        setFrames(f as StockItem[]);
        setPhotos(p as StockItem[]);
        setTransactions(Array.isArray(t) ? t : []);
        setBannerStock(Array.isArray(bs) ? bs : []);
        setStickerStock(Array.isArray(ss) ? ss : []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isLowStock = (item: StockItem, itemType?: string) => {
    if (!item) return false;
    const label = activeTab.startsWith('custom-') ? getSectionLabel(activeTab, customLabels).toLowerCase() : '';
    const type = itemType ?? (activeTab === 'banner' || label === 'banner' ? 'banner' : activeTab === 'sticker' || label === 'sticker' ? 'sticker' : '');
    if (type === 'banner' || type === 'sticker') {
      const feet = (item as { feet_remaining?: number }).feet_remaining ?? ((item.stock_qty ?? 0) * 150);
      return feet <= (item.low_stock_threshold ?? 10);
    }
    return (item.stock_qty ?? 0) <= (item.low_stock_threshold ?? 0);
  };

  const handleEditStock = (item: StockItem, itemType: string) => {
    setStockModal({ type: 'edit', item, itemType });
  };

  const handleAddItem = async (data: { size_name: string; frame_type?: string; stock_qty: number; low_stock_threshold: number }) => {
    if (!addModal) return;
    try {
      if (addModal === 'frame') {
        await api.stock.createFrame(data);
      } else {
        await api.stock.createPhoto(data);
      }
      fetchData();
      setAddModal(null);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const handleStockModalConfirm = async ({ quantity, reason, transaction_type }: { quantity: number; reason: string | null; transaction_type?: string }) => {
    if (!stockModal) return;
    const { type, item, itemType } = stockModal;
    const txType = transaction_type || (type === 'edit' ? 'add' : type);
    try {
      await api.stock.addTransaction({
        item_type: itemType,
        item_id: item.id,
        transaction_type: txType,
        quantity,
        reason,
      });
      fetchData();
      setStockModal(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const frameNames: Record<number, string> = Object.fromEntries(frames.map((f) => [f.id, f.size_name ?? '']));
  const photoNames: Record<number, string> = Object.fromEntries(photos.map((p) => [p.id, p.size_name ?? '']));
  const bannerNames: Record<number, string> = Object.fromEntries(bannerStock.map((b) => [b.id, b.size_name ?? '']));
  const stickerNames: Record<number, string> = Object.fromEntries(stickerStock.map((s) => [s.id, s.size_name ?? '']));

  return (
    <>
      <Header title="Stock Management" />
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-300 hover:text-white ml-2">✕</button>
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap items-center">
          {enabledSections.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeTab === tab ? 'bg-red-600 text-white' : 'bg-black/60 text-red-200/90 hover:bg-red-950/60'
              }`}
            >
              {getSectionLabel(tab, customLabels)}
            </button>
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
                  isLowStock={isLowStock}
                />
              </div>
            )}

            {activeTab === 'banner' && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">Banner</h3>
                  <button onClick={() => { setError(''); setAddBannerModal(true); }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    + Add Item
                  </button>
                </div>
                <StockTable
                  items={bannerStock}
                  itemType="banner"
                  onEdit={(item) => handleEditStock(item, 'banner')}
                  isLowStock={isLowStock}
                />
              </div>
            )}

            {activeTab === 'sticker' && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">Sticker</h3>
                  <button onClick={() => { setError(''); setAddStickerModal(true); }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    + Add Item
                  </button>
                </div>
                <StockTable
                  items={stickerStock}
                  itemType="sticker"
                  onEdit={(item) => handleEditStock(item, 'sticker')}
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
                  bannerNames={bannerNames}
                  stickerNames={stickerNames}
                />
              </div>
            )}

            {activeTab.startsWith('custom-') && (
              <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">{getSectionLabel(activeTab, customLabels)}</h3>
                  <button onClick={() => openAddModalForCustom(activeTab)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    + Add Item
                  </button>
                </div>
                {getSectionLabel(activeTab, customLabels).toLowerCase() === 'banner' ? (
                  <StockTable
                    items={bannerStock}
                    itemType="banner"
                    onEdit={(item) => handleEditStock(item, 'banner')}
                    isLowStock={isLowStock}
                  />
                ) : getSectionLabel(activeTab, customLabels).toLowerCase() === 'sticker' ? (
                  <StockTable
                    items={stickerStock}
                    itemType="sticker"
                    onEdit={(item) => handleEditStock(item, 'sticker')}
                    isLowStock={isLowStock}
                  />
                ) : (
                  <StockTable
                    items={[]}
                    itemType="photo"
                    onEdit={() => {}}
                    isLowStock={() => false}
                  />
                )}
              </div>
            )}
          </>
        )}

        {stockModal && (
          <StockModal
            type={stockModal.type}
            item={stockModal.item}
            itemType={stockModal.itemType}
            onClose={() => setStockModal(null)}
            onConfirm={handleStockModalConfirm}
          />
        )}

        {addTypeChoiceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">Add Item</h3>
              <p className="text-sm text-red-300/70 mb-4">Choose item type to add:</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setAddTypeChoiceModal(false); setAddModal('frame'); }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Add as Frame
                </button>
                <button
                  onClick={() => { setAddTypeChoiceModal(false); setAddModal('photo'); }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Add as Photo
                </button>
              </div>
              <button
                onClick={() => setAddTypeChoiceModal(false)}
                className="mt-4 w-full px-4 py-2 bg-red-950/60 text-red-200 rounded-lg hover:bg-red-900/70"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {addModal && (
          <AddItemModal
            itemType={addModal}
            onClose={() => setAddModal(null)}
            onConfirm={handleAddItem}
            onError={(msg) => setError(msg)}
          />
        )}

        {addBannerModal && (
          <AddBannerStockModal
            onClose={() => setAddBannerModal(false)}
            onConfirm={handleAddBannerStock}
            onError={(msg) => setError(msg)}
          />
        )}

        {addStickerModal && (
          <AddStickerStockModal
            onClose={() => setAddStickerModal(false)}
            onConfirm={handleAddStickerStock}
            onError={(msg) => setError(msg)}
          />
        )}
      </div>
    </>
  );
}
