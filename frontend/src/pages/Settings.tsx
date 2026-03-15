import { useState, useEffect } from 'react';
import { formatSizeDisplay, normalizeSizeForSave, parseSizeDimensions } from '../utils/sizeFormat';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Header from '../components/layout/Header';
import AdminGate from '../components/settings/AdminGate';
import { api } from '../api/client';
import type { ShopSettings, ActivityLogEntry } from '../types';
import { ADMIN_AUTH_KEY } from '../constants/adminAuth';

const ACTION_LABELS: Record<string, string> = {
  bill_created: 'Bill Created',
  bill_balance_paid: 'Balance Paid',
  frame_created: 'Frame Added',
  photo_created: 'Photo Size Added',
  frame_updated: 'Frame Updated',
  photo_updated: 'Photo Size Updated',
  stock_transaction: 'Stock Transaction',
  settings_updated: 'Settings Updated',
};

function formatActivityDetails(a: ActivityLogEntry): string {
  if (!a.details || typeof a.details !== 'object') return '';
  const d = a.details as Record<string, unknown>;
  const parts: string[] = [];
  if (a.action_type === 'stock_transaction' && d.item_name) {
    parts.push(String(d.item_name));
  }
  if (d.bill_number) parts.push(`#${d.bill_number}`);
  if (d.customer_name) parts.push(String(d.customer_name));
  if (d.total != null) parts.push(`Rs.${Number(d.total).toFixed(2)}`);
  if (d.size_name) parts.push(formatSizeDisplay(String(d.size_name)) || String(d.size_name));
  if (d.transaction_type) parts.push(String(d.transaction_type));
  if (d.quantity != null) parts.push(`qty:${d.quantity}`);
  if (a.action_type === 'stock_transaction' && d.reason) parts.push(`(${d.reason})`);
  return parts.join(' ');
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportLoading, setReportLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [materials, setMaterials] = useState<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string }[]>([]);
  const [stickerMaterials, setStickerMaterials] = useState<{ id: number; material_name: string; price_per_sqft: number; pricing_type?: string }[]>([]);
  const [bannerSizes, setBannerSizes] = useState<{ id: number; material_id: number; size_name: string; width_ft: number; height_ft: number; material_name: string }[]>([]);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialItemType, setNewMaterialItemType] = useState('');
  const [newMaterialFrameType, setNewMaterialFrameType] = useState('');
  const [newMaterialPrice, setNewMaterialPrice] = useState('');
  const [newMaterialPricingType, setNewMaterialPricingType] = useState('');
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [editingStickerId, setEditingStickerId] = useState<number | null>(null);
  const [editMaterialPrice, setEditMaterialPrice] = useState('');
  const [editMaterialPricingType, setEditMaterialPricingType] = useState<'per_sqft' | 'per_qty'>('per_sqft');
  const [addSizeMaterialId, setAddSizeMaterialId] = useState<number | null>(null);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeWidth, setNewSizeWidth] = useState('');
  const [newSizeHeight, setNewSizeHeight] = useState('');
  const [form, setForm] = useState<ShopSettings>({
    shop_name: '',
    address: '',
    contact: '',
    gstin: '',
  });

  useEffect(() => {
    api.settings
      .get()
      .then((s) => setForm({ shop_name: s.shop_name || '', address: s.address || '', contact: s.contact || '', gstin: s.gstin || '' }))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const [frames, setFrames] = useState<{ id: number; size_name: string; frame_type?: string; unit_price: number }[]>([]);
  const [photos, setPhotos] = useState<{ id: number; size_name: string; unit_price: number }[]>([]);
  const [designBanner, setDesignBanner] = useState<{ id: number; size_name: string; unit_price: number }[]>([]);
  const [designPhoto, setDesignPhoto] = useState<{ id: number; size_name: string; unit_price: number }[]>([]);
  const [editingPrice, setEditingPrice] = useState<{ type: string; id: number } | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  const loadServiceItems = () => {
    api.services.bannerMaterials(true).then(setMaterials).catch(() => setMaterials([]));
    api.services.stickerMaterials(true).then(setStickerMaterials).catch(() => setStickerMaterials([]));
    api.services.bannerSizes().then(setBannerSizes).catch(() => setBannerSizes([]));
  };

  const loadAllPrices = () => {
    loadServiceItems();
    api.stock.frames().then(setFrames).catch(() => setFrames([]));
    api.stock.photos().then(setPhotos).catch(() => setPhotos([]));
    api.services.designBannerSizes().then(setDesignBanner).catch(() => setDesignBanner([]));
    api.services.designPhotoSizes().then(setDesignPhoto).catch(() => setDesignPhoto([]));
  };

  useEffect(() => {
    loadAllPrices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      await api.settings.update(form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const fetchReport = () => {
    setReportLoading(true);
    api.reports.activity({ date: reportDate })
      .then(setActivities)
      .catch(() => setActivities([]))
      .finally(() => setReportLoading(false));
  };

  const exportCSV = () => {
    const headers = ['Time', 'Action', 'Details'];
    const rows = activities.map((a) => [
      new Date(a.created_at).toLocaleString('en-IN'),
      ACTION_LABELS[a.action_type] || a.action_type,
      formatActivityDetails(a),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-report-${reportDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveAsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Activity Report', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${reportDate} | Generated: ${new Date().toLocaleString('en-IN')}`, 14, 28);
    doc.setTextColor(0, 0, 0);

    const tableData = activities.map((a) => [
      new Date(a.created_at).toLocaleString('en-IN'),
      ACTION_LABELS[a.action_type] || a.action_type,
      formatActivityDetails(a),
    ]);

    autoTable(doc, {
      head: [['Time', 'Action', 'Details']],
      body: tableData,
      startY: 36,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [75, 25, 25] },
    });

    doc.save(`activity-report-${reportDate}.pdf`);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    window.location.reload();
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialName.trim()) return;
    const price = parseFloat(newMaterialPrice) || 0;
    const itemType = newMaterialItemType.trim().toLowerCase();
    const frameType = newMaterialFrameType.trim() || 'Standard';
    const pricingType = newMaterialPricingType.trim().toLowerCase().includes('sqft') ? 'per_sqft' : 'per_qty';
    try {
      if (itemType === 'frame') {
        await api.stock.createFrame({
          size_name: normalizeSizeForSave(newMaterialName),
          frame_type: frameType,
          unit_price: price,
        });
      } else if (itemType === 'photo') {
        await api.stock.createPhoto({
          size_name: normalizeSizeForSave(newMaterialName),
          unit_price: price,
        });
      } else if (itemType === 'sticker') {
        await api.services.createStickerMaterial({
          material_name: newMaterialName.trim(),
          price_per_sqft: price,
          pricing_type: 'per_sqft',
        });
      } else {
        const name = newMaterialName.trim().toLowerCase();
        const autoType: 'per_sqft' | 'per_qty' = (name.includes('banner') || name.includes('backlight')) ? 'per_sqft' : pricingType;
        await api.services.createBannerMaterial({
          material_name: newMaterialName.trim(),
          price_per_sqft: price,
          pricing_type: autoType,
        });
      }
      setNewMaterialName('');
      setNewMaterialItemType('');
      setNewMaterialFrameType('');
      setNewMaterialPrice('');
      setNewMaterialPricingType('');
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateMaterial = async (id: number) => {
    try {
      await api.services.updateBannerMaterial(id, {
        price_per_sqft: parseFloat(editMaterialPrice),
        pricing_type: editMaterialPricingType,
      });
      setEditingMaterialId(null);
      setEditMaterialPrice('');
      setEditMaterialPricingType('per_sqft');
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateStickerMaterial = async (id: number) => {
    try {
      await api.services.updateStickerMaterial(id, {
        price_per_sqft: parseFloat(editMaterialPrice),
        pricing_type: editMaterialPricingType,
      });
      setEditingStickerId(null);
      setEditMaterialPrice('');
      setEditMaterialPricingType('per_sqft');
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddSize = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleSavePrice = async (type: string, id: number) => {
    const val = parseFloat(editPriceValue);
    if (isNaN(val) || val < 0) return;
    try {
      if (type === 'frame') await api.stock.updateFrame(id, { unit_price: val });
      else if (type === 'photo') await api.stock.updatePhoto(id, { unit_price: val });
      else if (type === 'designBanner') await api.services.updateDesignBannerSize(id, { unit_price: val });
      else if (type === 'designPhoto') await api.services.updateDesignPhotoSize(id, { unit_price: val });
      setEditingPrice(null);
      setEditPriceValue('');
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteSize = async (id: number) => {
    try {
      await api.services.deleteBannerSize(id);
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemove = async (type: string, id: number, name: string) => {
    if (!window.confirm(`Remove "${name}"? This cannot be undone.`)) return;
    try {
      if (type === 'banner') await api.services.deleteBannerMaterial(id);
      else if (type === 'sticker') await api.services.deleteStickerMaterial(id);
      else if (type === 'frame') await api.stock.deleteFrame(id);
      else if (type === 'photo') await api.stock.deletePhoto(id);
      else if (type === 'designBanner') await api.services.deleteDesignBannerSize(id);
      else if (type === 'designPhoto') await api.services.deleteDesignPhotoSize(id);
      setEditingMaterialId(null);
      setEditingStickerId(null);
      setEditingPrice(null);
      loadAllPrices();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <AdminGate>
        <Header title="Settings" />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-red-300/70">Loading...</div>
          </div>
        </div>
      </AdminGate>
    );
  }

  return (
    <AdminGate>
      <Header title="Settings" />
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-end mb-4">
          <button onClick={handleAdminLogout} className="px-3 py-1.5 text-sm font-medium text-red-800 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg">
            Logout (Admin)
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-4">Shop Details</h3>
          <p className="text-sm text-red-300/70 mb-6">
            These details appear on your printed bills. Update them to match your shop information.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50" onClick={() => setError('')}>
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-600/30 text-emerald-200 rounded-lg border border-emerald-500/50">
              Settings saved successfully.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Shop Name</label>
              <input
                type="text"
                value={form.shop_name}
                onChange={(e) => setForm((f) => ({ ...f, shop_name: e.target.value }))}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="OLLIYARUVI PRINTERS"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Address</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={3}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 resize-none"
                placeholder="Enter your shop address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Contact</label>
              <input
                type="text"
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="Phone number or email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">GSTIN (optional)</label>
              <input
                type="text"
                value={form.gstin || ''}
                onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="e.g. 33AAAAA0000A1Z5"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-2">Reports</h3>
          <p className="text-sm text-red-300/70 mb-4">
            View all actions in the billing system by date. Identify what happened in the shop, including any counter staff actions.
          </p>
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
            />
            <button
              onClick={fetchReport}
              disabled={reportLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reportLoading ? 'Loading...' : 'View Report'}
            </button>
            {activities.length > 0 && (
              <>
                <button
                  onClick={exportCSV}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Export CSV
                </button>
                <button
                  onClick={saveAsPDF}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Save as PDF
                </button>
              </>
            )}
          </div>
          {activities.length > 0 ? (
            <div className="border border-red-950/40 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-950/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-red-200">Time</th>
                    <th className="text-left p-2 text-red-200">Action</th>
                    <th className="text-left p-2 text-red-200">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id} className="border-b border-red-950/40 hover:bg-red-950/20">
                      <td className="p-2 text-red-200/90 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="p-2 text-white font-medium">
                        {ACTION_LABELS[a.action_type] || a.action_type}
                      </td>
                      <td className="p-2 text-red-300/80 text-xs">
                        {a.details && typeof a.details === 'object' && (
                          <span>
                            {a.action_type === 'stock_transaction' && a.details.item_name && (
                              <span className="text-amber-300/90 font-medium">{a.details.item_name as string}{' '}</span>
                            )}
                            {a.details.bill_number && `#${a.details.bill_number} `}
                            {a.details.customer_name && `${a.details.customer_name} `}
                            {a.details.total != null && `Rs.${Number(a.details.total).toFixed(2)} `}
                            {a.details.size_name && `${a.details.size_name} `}
                            {a.details.transaction_type && `${a.details.transaction_type} `}
                            {a.details.quantity != null && `qty:${a.details.quantity}`}
                            {a.action_type === 'stock_transaction' && a.details.reason && (
                              <span className="text-red-400/70"> ({a.details.reason as string})</span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !reportLoading && (
            <p className="text-red-300/60 text-sm">No activity for this date. Select a date and click View Report.</p>
          )}
        </div>
        </div>

        <div className="mt-6 bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-4">Edit All Prices</h3>

          <form onSubmit={handleAddMaterial} className="space-y-3 mb-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-red-300/70 font-medium">Item name</label>
                <input type="text" value={newMaterialName} onChange={(e) => setNewMaterialName(e.target.value)} placeholder="e.g. 8x6 or Backlight print" className="w-36 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white placeholder-red-400/50 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-red-300/70 font-medium">Item type</label>
                <div className="flex rounded-lg border border-red-900/50 overflow-hidden bg-black/60">
                  <input type="text" value={newMaterialItemType} onChange={(e) => setNewMaterialItemType(e.target.value)} placeholder="Banner, Frame, Photo" className="w-28 px-3 py-2 text-sm bg-transparent text-white placeholder-red-400/50 focus:outline-none" />
                  <select onChange={(e) => { const v = e.target.value; if (v) setNewMaterialItemType(v); }} className="px-3 py-2 text-sm bg-red-950/40 text-white border-l border-red-900/50 focus:outline-none cursor-pointer">
                    <option value="">▼</option>
                    <option value="Banner">Banner</option>
                    <option value="Sticker">Sticker</option>
                    <option value="Frame">Frame</option>
                    <option value="Photo">Photo</option>
                  </select>
                </div>
              </div>
              {newMaterialItemType.trim().toLowerCase() === 'frame' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-red-300/70 font-medium">Frame type</label>
                  <div className="flex rounded-lg border border-red-900/50 overflow-hidden bg-black/60">
                    <input type="text" value={newMaterialFrameType} onChange={(e) => setNewMaterialFrameType(e.target.value)} placeholder="Duro, Standard" className="w-24 px-3 py-2 text-sm bg-transparent text-white placeholder-red-400/50 focus:outline-none" />
                    <select onChange={(e) => { const v = e.target.value; if (v) setNewMaterialFrameType(v); }} className="px-3 py-2 text-sm bg-red-950/40 text-white border-l border-red-900/50 focus:outline-none cursor-pointer">
                      <option value="">▼</option>
                      <option value="Duro">Duro</option>
                      <option value="Standard">Standard</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-red-300/70 font-medium">Qty type</label>
                <select value={newMaterialPricingType} onChange={(e) => setNewMaterialPricingType(e.target.value)} className="w-28 px-3 py-2 text-sm rounded-lg border border-red-900/50 bg-black/60 text-white focus:outline-none cursor-pointer">
                  <option value="">Select...</option>
                  <option value="Rs./sqft">Rs./sqft</option>
                  <option value="Rs./unit">Rs./unit</option>
                </select>
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
          </form>

          <div className="border border-red-950/40 rounded-lg overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-red-950/50">
                <tr>
                  <th className="text-left p-2 text-red-200 whitespace-nowrap">Item</th>
                  <th className="text-left p-2 text-red-200 whitespace-nowrap">Item Type</th>
                  <th className="text-left p-2 text-red-200 whitespace-nowrap">Qty Type</th>
                  <th className="text-right p-2 text-red-200 whitespace-nowrap">Price</th>
                  <th className="text-center p-2 text-red-200 whitespace-nowrap">Edit | Remove</th>
                </tr>
              </thead>
              <tbody>
                {/* Banner */}
                <tr className="bg-red-950/30">
                  <td colSpan={5} className="p-2 text-red-200 font-semibold">Banner</td>
                </tr>
                {materials.map((m) => {
                  const isPerQty = m.pricing_type === 'per_qty';
                  return (
                    <tr key={`b-${m.id}`} className="border-t border-red-950/40">
                      <td className="p-2 pl-6 text-white whitespace-nowrap">{m.material_name}</td>
                      <td className="p-2 text-red-300/80 whitespace-nowrap">Banner</td>
                      <td className="p-2 text-red-300/80 whitespace-nowrap">
                        {editingMaterialId === m.id ? (
                          <select value={editMaterialPricingType} onChange={(e) => setEditMaterialPricingType(e.target.value as 'per_sqft' | 'per_qty')} className="border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white">
                            <option value="per_sqft">Rs./sqft</option>
                            <option value="per_qty">Rs./unit</option>
                          </select>
                        ) : (
                          isPerQty ? 'Rs./unit' : 'Rs./sqft'
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {editingMaterialId === m.id ? (
                          <span className="flex flex-nowrap items-center justify-end gap-1">
                            <input type="number" min="0" step="0.01" value={editMaterialPrice} onChange={(e) => setEditMaterialPrice(e.target.value)} className="w-20 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                            <button onClick={() => handleUpdateMaterial(m.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                            <button onClick={() => { setEditingMaterialId(null); setEditMaterialPrice(''); }} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                          </span>
                        ) : (
                          <span className="text-red-200/90 whitespace-nowrap">{isPerQty ? `Rs.${m.price_per_sqft}/unit` : `Rs.${m.price_per_sqft}/sqft`}</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {editingMaterialId !== m.id && (
                          <span className="flex items-center justify-center gap-1">
                            <button onClick={() => { setEditingMaterialId(m.id); setEditMaterialPrice(String(m.price_per_sqft)); setEditMaterialPricingType((m.pricing_type === 'per_qty' ? 'per_qty' : 'per_sqft')); }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                            <span className="text-red-600/60">|</span>
                            <button onClick={() => handleRemove('banner', m.id, m.material_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Sticker */}
                <tr className="bg-red-950/30">
                  <td colSpan={5} className="p-2 text-red-200 font-semibold">Sticker</td>
                </tr>
                {stickerMaterials.map((m) => {
                  const isPerQty = m.pricing_type === 'per_qty';
                  return (
                    <tr key={`s-${m.id}`} className="border-t border-red-950/40">
                      <td className="p-2 pl-6 text-white whitespace-nowrap">{m.material_name}</td>
                      <td className="p-2 text-red-300/80 whitespace-nowrap">Sticker</td>
                      <td className="p-2 text-red-300/80 whitespace-nowrap">
                        {editingStickerId === m.id ? (
                          <select value={editMaterialPricingType} onChange={(e) => setEditMaterialPricingType(e.target.value as 'per_sqft' | 'per_qty')} className="border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white">
                            <option value="per_sqft">Rs./sqft</option>
                            <option value="per_qty">Rs./unit</option>
                          </select>
                        ) : (
                          isPerQty ? 'Rs./unit' : 'Rs./sqft'
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {editingStickerId === m.id ? (
                          <span className="flex flex-nowrap items-center justify-end gap-1">
                            <input type="number" min="0" step="0.01" value={editMaterialPrice} onChange={(e) => setEditMaterialPrice(e.target.value)} className="w-20 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                            <button onClick={() => handleUpdateStickerMaterial(m.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                            <button onClick={() => { setEditingStickerId(null); setEditMaterialPrice(''); }} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                          </span>
                        ) : (
                          <span className="text-red-200/90 whitespace-nowrap">{isPerQty ? `Rs.${m.price_per_sqft}/unit` : `Rs.${m.price_per_sqft}/sqft`}</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {editingStickerId !== m.id && (
                          <span className="flex items-center justify-center gap-1">
                            <button onClick={() => { setEditingStickerId(m.id); setEditMaterialPrice(String(m.price_per_sqft)); setEditMaterialPricingType((m.pricing_type === 'per_qty' ? 'per_qty' : 'per_sqft')); }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                            <span className="text-red-600/60">|</span>
                            <button onClick={() => handleRemove('sticker', m.id, m.material_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Frames */}
                <tr className="bg-red-950/30">
                  <td colSpan={5} className="p-2 text-red-200 font-semibold">Frames</td>
                </tr>
                {[...frames].sort((a, b) => {
                  const parse = (s: string) => { const [w, h] = parseSizeDimensions(s); return w * 100 + h; };
                  return parse(a.size_name) - parse(b.size_name);
                }).map((f) => (
                  <tr key={`f-${f.id}`} className="border-t border-red-950/40">
                    <td className="p-2 pl-6 text-white whitespace-nowrap">{formatSizeDisplay(f.size_name) || f.size_name}</td>
                    <td className="p-2 text-red-300/80 whitespace-nowrap">{f.frame_type || 'Standard'}</td>
                    <td className="p-2 text-red-300/80 whitespace-nowrap">Rs./unit</td>
                    <td className="p-2 text-right">
                      {editingPrice?.type === 'frame' && editingPrice?.id === f.id ? (
                        <span className="flex flex-nowrap items-center justify-end gap-1">
                          <input type="number" min="0" step="0.01" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="w-20 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                          <button onClick={() => handleSavePrice('frame', f.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                          <button onClick={() => { setEditingPrice(null); setEditPriceValue(''); }} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                        </span>
                      ) : (
                        <span className="text-red-200/90 whitespace-nowrap">Rs.{f.unit_price}</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {!(editingPrice?.type === 'frame' && editingPrice?.id === f.id) && (
                        <span className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingPrice({ type: 'frame', id: f.id }); setEditPriceValue(String(f.unit_price)); }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                          <span className="text-red-600/60">|</span>
                          <button onClick={() => handleRemove('frame', f.id, formatSizeDisplay(f.size_name) || f.size_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Photos */}
                <tr className="bg-red-950/30">
                  <td colSpan={5} className="p-2 text-red-200 font-semibold">Photos</td>
                </tr>
                {photos.map((p) => (
                  <tr key={`p-${p.id}`} className="border-t border-red-950/40">
                    <td className="p-2 pl-6 text-white whitespace-nowrap">{formatSizeDisplay(p.size_name) || p.size_name}</td>
                    <td className="p-2 text-red-300/80 whitespace-nowrap">Photo</td>
                    <td className="p-2 text-red-300/80 whitespace-nowrap">Rs./unit</td>
                    <td className="p-2 text-right">
                      {editingPrice?.type === 'photo' && editingPrice?.id === p.id ? (
                        <span className="flex flex-nowrap items-center justify-end gap-1">
                          <input type="number" min="0" step="0.01" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="w-20 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                          <button onClick={() => handleSavePrice('photo', p.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                          <button onClick={() => { setEditingPrice(null); setEditPriceValue(''); }} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                        </span>
                      ) : (
                        <span className="text-red-200/90 whitespace-nowrap">Rs.{p.unit_price}</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {!(editingPrice?.type === 'photo' && editingPrice?.id === p.id) && (
                        <span className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingPrice({ type: 'photo', id: p.id }); setEditPriceValue(String(p.unit_price)); }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                          <span className="text-red-600/60">|</span>
                          <button onClick={() => handleRemove('photo', p.id, formatSizeDisplay(p.size_name) || p.size_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {photos.length === 0 && (
                  <tr className="border-t border-red-950/40">
                    <td colSpan={5} className="p-2 pl-6 text-red-300/60 text-sm">No photos.</td>
                  </tr>
                )}
                {/* Design Banner */}
                {designBanner.length > 0 && (
                  <>
                    <tr className="bg-red-950/30">
                      <td colSpan={5} className="p-2 text-red-200 font-semibold">Design for Banner</td>
                    </tr>
                    {designBanner.map((d) => (
                      <tr key={`db-${d.id}`} className="border-t border-red-950/40">
                        <td className="p-2 pl-6 text-white whitespace-nowrap">{formatSizeDisplay(d.size_name) || d.size_name}</td>
                        <td className="p-2 text-red-300/80 whitespace-nowrap">Design for Banner</td>
                        <td className="p-2 text-red-300/80 whitespace-nowrap">Rs./unit</td>
                        <td className="p-2 text-right">
                          {editingPrice?.type === 'designBanner' && editingPrice?.id === d.id ? (
                            <span className="flex flex-nowrap items-center justify-end gap-1">
                              <input type="number" min="0" step="0.01" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="w-20 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                              <button onClick={() => handleSavePrice('designBanner', d.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                              <button onClick={() => { setEditingPrice(null); setEditPriceValue(''); }} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                            </span>
                          ) : (
                            <span className="text-red-200/90 whitespace-nowrap">Rs.{d.unit_price}</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {!(editingPrice?.type === 'designBanner' && editingPrice?.id === d.id) && (
                            <span className="flex items-center justify-center gap-1">
                              <button onClick={() => { setEditingPrice({ type: 'designBanner', id: d.id }); setEditPriceValue(String(d.unit_price)); }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                              <span className="text-red-600/60">|</span>
                              <button onClick={() => handleRemove('designBanner', d.id, formatSizeDisplay(d.size_name) || d.size_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
                {/* Design Photo */}
                {designPhoto.length > 0 && (
                  <>
                    <tr className="bg-red-950/30">
                      <td colSpan={5} className="p-2 text-red-200 font-semibold">Design for Photo</td>
                    </tr>
                    {designPhoto.map((d) => (
                      <tr key={`dp-${d.id}`} className="border-t border-red-950/40">
                        <td className="p-2 pl-6 text-white whitespace-nowrap">{formatSizeDisplay(d.size_name) || d.size_name}</td>
                        <td className="p-2 text-red-300/80 whitespace-nowrap">Design for Photo</td>
                        <td className="p-2 text-red-300/80 whitespace-nowrap">Rs./unit</td>
                        <td className="p-2 text-right">
                          {editingPrice?.type === 'designPhoto' && editingPrice?.id === d.id ? (
                            <span className="flex flex-nowrap items-center justify-end gap-1">
                              <input type="number" min="0" step="0.01" value={editPriceValue} onChange={(e) => setEditPriceValue(e.target.value)} className="w-20 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white" />
                              <button onClick={() => handleSavePrice('designPhoto', d.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                              <button onClick={() => { setEditingPrice(null); setEditPriceValue(''); }} className="px-2 py-1 text-red-300 text-xs">Cancel</button>
                            </span>
                          ) : (
                            <span className="text-red-200/90 whitespace-nowrap">Rs.{d.unit_price}</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {!(editingPrice?.type === 'designPhoto' && editingPrice?.id === d.id) && (
                            <span className="flex items-center justify-center gap-1">
                              <button onClick={() => { setEditingPrice({ type: 'designPhoto', id: d.id }); setEditPriceValue(String(d.unit_price)); }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                              <span className="text-red-600/60">|</span>
                              <button onClick={() => handleRemove('designPhoto', d.id, formatSizeDisplay(d.size_name) || d.size_name)} className="text-red-500 hover:text-red-400 text-xs">Remove</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminGate>
  );
}
