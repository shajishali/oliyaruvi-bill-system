import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import type { LowStockItem, Notification } from '../../types';
import { isLowStockRead } from '../../utils/lowStockRead';

export default function NotificationToast() {
  const location = useLocation();
  const [count, setCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [show, setShow] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchCounts = async () => {
      const [notifs, lowStock] = await Promise.allSettled([
        api.notifications.list(true) as Promise<Notification[]>,
        api.reports.lowStock() as Promise<LowStockItem[]>,
      ]);

      if (!mounted) return;

      const notifLen =
        notifs.status === 'fulfilled' && Array.isArray(notifs.value) ? notifs.value.length : 0;
      const lowLen =
        lowStock.status === 'fulfilled' && Array.isArray(lowStock.value)
          ? lowStock.value.filter((item) => !isLowStockRead(item)).length
          : 0;

      setLowStockCount(lowLen);
      setCount(notifLen + lowLen);
    };

    fetchCounts().catch(() => {});
    const interval = setInterval(() => {
      fetchCounts().catch(() => {});
    }, 60000);
    const onRead = () => {
      fetchCounts().catch(() => {});
    };
    window.addEventListener('oliyaruvi-low-stock-read', onRead);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('oliyaruvi-low-stock-read', onRead);
    };
  }, []);

  useEffect(() => {
    // Only show a new toast when we transition from "none" to "some".
    if (count === 0) setShown(false);

    if (count > 0 && !shown) {
      setShow(true);
      setShown(true);
      const t = setTimeout(() => setShow(false), 4000);
      return () => clearTimeout(t);
    }
  }, [count, shown]);

  useEffect(() => {
    // If user is already viewing notifications, hide the toast immediately.
    if (location.pathname.startsWith('/app/notifications')) {
      setShow(false);
      // Prevent it from re-showing right away when count is still > 0.
      setShown(true);
    }
  }, [location.pathname]);

  if (!show || count === 0) return null;

  return (
    <Link
      to="/app/notifications"
      className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-[100] max-w-sm cursor-pointer hover:bg-red-700 transition-colors block"
    >
      <p className="font-medium text-sm">
        {lowStockCount > 0
          ? `Low stock: ${lowStockCount} alert${lowStockCount > 1 ? 's' : ''}`
          : `You have ${count} new notification${count > 1 ? 's' : ''}`}
      </p>
      <p className="text-xs text-red-100 mt-0.5">Click to go to Notifications page</p>
    </Link>
  );
}
