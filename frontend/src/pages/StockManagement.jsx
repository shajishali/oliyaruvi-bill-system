import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import StockTable from '../components/stock/StockTable';
import StockModal from '../components/stock/StockModal';
import UpdateStockModal from '../components/stock/UpdateStockModal';
import StockTransactionLog from '../components/stock/StockTransactionLog';
import LowStockAlerts from '../components/stock/LowStockAlerts';
import { api } from '../api/client';

export default function StockManagement() {
  const [activeTab, setActiveTab] = useState('frames');
  const [frames, setFrames] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [bannerMaterials, setBannerMaterials] = useState([]);
  const [designBannerSizes, setDesignBannerSizes] = useState([]);
  const [designPhotoSizes, setDesignPhotoSizes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stockModal, setStockModal] = useState(null);
  const [updateModal, setUpdateModal] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerEditValue, setBannerEditValue] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.stock.frames(),
      api.stock.photos(),
      api.services.bannerMaterials(),
      api.services.designBannerSizes().catch(() => []),
      api.services.designPhotoSizes().catch(() => []),
      api.stock.transactions({ limit: 50 }),
      api.reports.lowStock(),
    ])
      .then(([f, p, b, dB, dP, t, l]) => {
        setFrames(f);
        setPhotos(p);
        setBannerMaterials(b);
        setDesignBannerSizes(dB);
        setDesignPhotoSizes(dP);
        setTransactions(t);
        setLowStock(l);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isLowStock = (item) => item && item.stock_qty <= item.low_stock_threshold;

  const handleAddStock = (item, itemType) => {
    setStockModal({ type: 'add', item, itemType });
  };

  const handleReduceStock = (item, itemType) => {
    setStockModal({ type: 'reduce', item, itemType });
  };

  const handleUpdateStock = (item, itemType) => {
    setUpdateModal({ item, itemType });
  };

  const handleStockModalConfirm = async ({ quantity, reason }) => {
    const { type, item, itemType } = stockModal;
    try {
      await api.stock.addTransaction({
        item_type: itemType,
        item_id: item.id,
        transaction_type: type,
        quantity,
        reason,
      });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateModalConfirm = async (data) => {
    const { item, itemType } = updateModal;
    try {
      if (itemType === 'frame') {
        await api.stock.updateFrame(item.id, data);
      } else {
        await api.stock.updatePhoto(item.id, data);
      }
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBannerPriceSave = async (material) => {
    const val = parseFloat(bannerEditValue);
    if (isNaN(val) || val < 0) return;
    try {
      await api.services.updateBannerMaterial(material.id, { price_per_sqft: val });
      fetchData();
      setEditingBanner(null);
      setBannerEditValue('');
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditBanner = (m) => {
    setEditingBanner(m);
    setBannerEditValue(String(m.price_per_sqft));
  };

  const frameNames = Object.fromEntries(frames.map((f) => [f.id, f.size_name]));
  const photoNames = Object.fromEntries(photos.map((p) => [p.id, p.size_name]));

  return (
    <>
      <Header title="Stock Management" />
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg" onClick={() => setError('')}>
            {error}
          </div>
        )}

        <LowStockAlerts items={lowStock} />

        <div className="flex gap-2 mb-6 flex-wrap">
          {['frames', 'photos', 'banner', 'designBanner', 'designPhoto', 'log'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeTab === tab ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab === 'log' ? 'Transaction Log' : tab === 'designBanner' ? 'Design for Banner' : tab === 'designPhoto' ? 'Design for Photo' : tab}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <>
            {activeTab === 'frames' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Frame Sizes</h3>
                <StockTable
                  items={frames}
                  itemType="frame"
                  onAdd={(item) => handleAddStock(item, 'frame')}
                  onUpdate={(item) => handleUpdateStock(item, 'frame')}
                  onReduce={(item) => handleReduceStock(item, 'frame')}
                  isLowStock={isLowStock}
                />
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Photo Sizes</h3>
                <StockTable
                  items={photos}
                  itemType="photo"
                  onAdd={(item) => handleAddStock(item, 'photo')}
                  onUpdate={(item) => handleUpdateStock(item, 'photo')}
                  onReduce={(item) => handleReduceStock(item, 'photo')}
                  isLowStock={isLowStock}
                />
              </div>
            )}

            {activeTab === 'designBanner' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Design for Banner (Price per size - feet)</h3>
                <p className="text-sm text-gray-500 mb-4">Update prices for design charges by banner size.</p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left p-3 border">Size</th>
                      <th className="text-right p-3 border">Price (₹)</th>
                      <th className="p-3 border w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {designBannerSizes.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="p-3 border font-medium">{d.size_name} (ft)</td>
                        <td className="p-3 border text-right">₹{parseFloat(d.unit_price).toFixed(2)}</td>
                        <td className="p-3 border">
                          <button
                            onClick={() => { setEditingBanner(d); setBannerEditValue(String(d.unit_price)); }}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editingBanner && designBannerSizes.some((d) => d.id === editingBanner.id) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg flex gap-4 items-center">
                    <span>Edit {editingBanner.size_name}:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bannerEditValue}
                      onChange={(e) => setBannerEditValue(e.target.value)}
                      className="border rounded px-3 py-2 w-32"
                    />
                    <button
                      onClick={async () => {
                        const val = parseFloat(bannerEditValue);
                        if (!isNaN(val) && val >= 0) {
                          await api.services.updateDesignBannerSize(editingBanner.id, { unit_price: val });
                          fetchData();
                          setEditingBanner(null);
                        }
                      }}
                      className="px-4 py-2 bg-slate-700 text-white rounded-lg"
                    >
                      Save
                    </button>
                    <button onClick={() => setEditingBanner(null)} className="text-gray-600">Cancel</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'designPhoto' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Design for Photo (Price per size - inches)</h3>
                <p className="text-sm text-gray-500 mb-4">Update prices for design charges by photo size.</p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left p-3 border">Size</th>
                      <th className="text-right p-3 border">Price (₹)</th>
                      <th className="p-3 border w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {designPhotoSizes.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="p-3 border font-medium">{d.size_name} (in)</td>
                        <td className="p-3 border text-right">₹{parseFloat(d.unit_price).toFixed(2)}</td>
                        <td className="p-3 border">
                          <button
                            onClick={() => { setEditingBanner(d); setBannerEditValue(String(d.unit_price)); }}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editingBanner && designPhotoSizes.some((d) => d.id === editingBanner.id) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg flex gap-4 items-center">
                    <span>Edit {editingBanner.size_name}:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bannerEditValue}
                      onChange={(e) => setBannerEditValue(e.target.value)}
                      className="border rounded px-3 py-2 w-32"
                    />
                    <button
                      onClick={async () => {
                        const val = parseFloat(bannerEditValue);
                        if (!isNaN(val) && val >= 0) {
                          await api.services.updateDesignPhotoSize(editingBanner.id, { unit_price: val });
                          fetchData();
                          setEditingBanner(null);
                        }
                      }}
                      className="px-4 py-2 bg-slate-700 text-white rounded-lg"
                    >
                      Save
                    </button>
                    <button onClick={() => setEditingBanner(null)} className="text-gray-600">Cancel</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'banner' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Banner Materials (Price per sq ft)</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left p-3 border">Material</th>
                      <th className="text-right p-3 border">Price per sq ft (₹)</th>
                      <th className="p-3 border w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bannerMaterials.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="p-3 border font-medium">{m.material_name}</td>
                        <td className="p-3 border text-right">
                          {editingBanner?.id === m.id ? (
                            <div className="flex gap-2 items-center justify-end">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={bannerEditValue}
                                onChange={(e) => setBannerEditValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleBannerPriceSave(m)}
                                className="border rounded px-2 py-1 w-24 text-right"
                                autoFocus
                              />
                              <button
                                onClick={() => handleBannerPriceSave(m)}
                                className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm hover:bg-green-200"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <span>₹{parseFloat(m.price_per_sqft).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="p-3 border">
                          <button
                            onClick={() => (editingBanner?.id === m.id ? setEditingBanner(null) : startEditBanner(m))}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200"
                          >
                            {editingBanner?.id === m.id ? 'Cancel' : 'Edit'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'log' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold mb-4">Stock Transaction Log</h3>
                <StockTransactionLog
                  transactions={transactions}
                  frameNames={frameNames}
                  photoNames={photoNames}
                />
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

        {updateModal && (
          <UpdateStockModal
            item={updateModal.item}
            itemType={updateModal.itemType}
            onClose={() => setUpdateModal(null)}
            onConfirm={handleUpdateModalConfirm}
          />
        )}
      </div>
    </>
  );
}
