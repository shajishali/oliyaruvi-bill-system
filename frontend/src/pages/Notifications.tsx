import { useState, useEffect, useMemo } from 'react';
import Header from '../components/layout/Header';
import LowStockAlerts from '../components/stock/LowStockAlerts';
import { api } from '../api/client';
import type { LowStockItem, Notification } from '../types';
import { isLowStockRead, markLowStockRead } from '../utils/lowStockRead';
import { emitNotificationsChanged } from '../utils/notificationEvents';

export default function Notifications() {
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<number | null>(null);
  const [readTick, setReadTick] = useState(0);

  const fetchData = (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    // Load all recent notifications so mark-as-read keeps details visible
    Promise.all([api.reports.lowStock(), api.notifications.list(false)])
      .then(([low, notifs]) => {
        setLowStock(low);
        setNotifications(Array.isArray(notifs) ? notifs : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  const visibleLowStock = useMemo(
    () => lowStock.filter((item) => !isLowStockRead(item)),
    [lowStock, readTick]
  );

  const unread = useMemo(
    () => notifications.filter((n) => !n.is_read),
    [notifications]
  );
  const read = useMemo(
    () => notifications.filter((n) => !!n.is_read),
    [notifications]
  );

  const markLowRead = (item: LowStockItem) => {
    markLowStockRead(item);
    setReadTick((n) => n + 1);
    emitNotificationsChanged();
  };

  const markAllLowRead = () => {
    markLowStockRead(visibleLowStock);
    setReadTick((n) => n + 1);
    emitNotificationsChanged();
  };

  const markRead = async (id: number) => {
    if (dismissingId) return;
    setDismissingId(id);
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      emitNotificationsChanged();
    } catch (_) {}
    finally {
      setDismissingId(null);
    }
  };

  const renderNotif = (n: Notification, isUnread: boolean) => (
    <li
      key={n.id}
      className={`flex items-start justify-between gap-2 p-3 rounded-lg border ${
        isUnread
          ? 'bg-red-950/40 border-red-900/50'
          : 'bg-black/50 border-red-950/40 opacity-95'
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium text-sm text-white">{n.title}</p>
        {n.message && <p className="text-xs text-red-100 mt-0.5 whitespace-pre-wrap">{n.message}</p>}
        <p className="text-[11px] text-white/55 mt-1">
          {String(n.created_at || '').replace('T', ' ').slice(0, 16)}
          {!isUnread ? ' · Read' : ''}
        </p>
      </div>
      {isUnread ? (
        <button
          onClick={() => markRead(n.id)}
          disabled={dismissingId === n.id}
          className="shrink-0 rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {dismissingId === n.id ? '...' : 'Mark as read'}
        </button>
      ) : (
        <span className="shrink-0 text-[11px] text-emerald-300/90 px-2 py-1">Read</span>
      )}
    </li>
  );

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
            <p className="text-red-100 text-sm">No notifications yet.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-red-200 mb-2">
                  New ({unread.length})
                </h4>
                {unread.length === 0 ? (
                  <p className="text-sm text-white/70">No unread notifications.</p>
                ) : (
                  <ul className="space-y-2">{unread.map((n) => renderNotif(n, true))}</ul>
                )}
              </div>
              {read.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-red-200 mb-2">
                    Earlier ({read.length})
                  </h4>
                  <ul className="space-y-2">{read.map((n) => renderNotif(n, false))}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
