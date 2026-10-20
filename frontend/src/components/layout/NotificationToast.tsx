import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import type { LowStockItem, Notification } from '../../types';
import { isLowStockRead } from '../../utils/lowStockRead';

export default function NotificationToast() {
  const location = useLocation();
  const [count, setCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [show, setShow] = useState(false);
  const prevCount = useRef(0);
  const primed = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNotificationsPage = location.pathname.startsWith('/app/notifications');

  const flash = () => {
    setShow(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShow(false), 8000);
  };

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

      const next = notifLen + lowLen;
      setLowStockCount(lowLen);
      setCount(next);

      const onNotifs = location.pathname.startsWith('/app/notifications');
      if (!primed.current) {
        primed.current = true;
        prevCount.current = next;
        // Show once on app load if there are unread items
        if (next > 0 && !onNotifs) flash();
      } else {
        const increased = next > prevCount.current;
        prevCount.current = next;
        if (next > 0 && increased && !onNotifs) flash();
      }
      if (next === 0) setShow(false);
    };

    fetchCounts().catch(() => {});
    const interval = setInterval(() => {
      fetchCounts().catch(() => {});
    }, 15000);
    const onChanged = () => {
      fetchCounts().catch(() => {});
    };
    window.addEventListener('oliyaruvi-low-stock-read', onChanged);
    window.addEventListener('oliyaruvi-notifications-changed', onChanged);
    return () => {
      mounted = false;
      clearInterval(interval);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      window.removeEventListener('oliyaruvi-low-stock-read', onChanged);
      window.removeEventListener('oliyaruvi-notifications-changed', onChanged);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (onNotificationsPage) {
      setShow(false);
      return;
    }
    // When leaving Notifications with unread still present, show toast again
    if (count > 0) flash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNotificationsPage]);

  if (!show || count === 0 || onNotificationsPage) return null;

  return (
    <Link
      to="/app/notifications"
      className="fixed bottom-5 right-5 bg-red-600 text-white px-4 py-3 rounded-xl shadow-2xl z-[13000] max-w-sm cursor-pointer hover:bg-red-500 transition-colors block border border-red-400/40"
    >
      <p className="font-semibold text-sm">
        {lowStockCount > 0 && count === lowStockCount
          ? `Low stock: ${lowStockCount} alert${lowStockCount > 1 ? 's' : ''}`
          : `You have ${count} new notification${count > 1 ? 's' : ''}`}
      </p>
      <p className="text-xs text-red-100 mt-0.5">Click to open Notifications</p>
    </Link>
  );
}
