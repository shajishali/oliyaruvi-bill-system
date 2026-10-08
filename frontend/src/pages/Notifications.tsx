import { useState, useEffect, useMemo } from 'react';
import Header from '../components/layout/Header';
import LowStockAlerts from '../components/stock/LowStockAlerts';
import { api } from '../api/client';
import type { LowStockItem, Notification } from '../types';
import { isLowStockRead, markLowStockRead } from '../utils/lowStockRead';

export default function Notifications() {
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<number | null>(null);
  const [readTick, setReadTick] = useState(0);

  const fetchData = () => {
    setLoading(true);
    Promise.all([api.reports.lowStock(), api.notifications.list(true)])
      .then(([low, notifs]) => {
        setLowStock(low);
        setNotifications(notifs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const visibleLowStock = useMemo(
    () => lowStock.filter((item) => !isLowStockRead(item)),
    [lowStock, readTick]
  );

  const markLowRead = (item: LowStockItem) => {
    markLowStockRead(item);
    setReadTick((n) => n + 1);
  };

  const markAllLowRead = () => {
    markLowStockRead(visibleLowStock);
    setReadTick((n) => n + 1);
  };

  const markRead = async (id: number) => {
    if (dismissingId) return;
    setDismissingId(id);
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (_) {}
    finally {
      setDismissingId(null);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Notifications" />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-red-300/70">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Notifications" />
      <div className="p-6 space-y-6">
        <LowStockAlerts
          items={visibleLowStock}
          onMarkRead={markLowRead}
          onMarkAllRead={visibleLowStock.length > 1 ? markAllLowRead : undefined}
        />

        {visibleLowStock.length === 0 && (
          <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
            <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Low Stock Alerts
            </h4>
            <p className="text-red-100 text-sm">
              {lowStock.length === 0
                ? 'No low stock items. All inventory levels are healthy.'
                : 'Low stock alerts are marked as read. An alert shows again if that quantity changes.'}
            </p>
          </div>
        )}

        <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-5 shadow-xl">
          <h3 className="font-semibold text-white mb-4">System Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-red-300/70 text-sm">No new notifications.</p>
          ) : (
            <ul className="space-y-2">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start justify-between gap-2 p-3 bg-red-950/40 rounded-lg border border-red-900/50"
                >
                  <div>
                    <p className="font-medium text-sm text-white">{n.title}</p>
                    {n.message && <p className="text-xs text-red-300/70 mt-0.5">{n.message}</p>}
                  </div>
                  <button
                    onClick={() => markRead(n.id)}
                    disabled={dismissingId === n.id}
                    className="shrink-0 rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {dismissingId === n.id ? '...' : 'Mark as read'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
