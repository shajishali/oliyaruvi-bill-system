import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, BillIcon, StockIcon, SettingsIcon, BellIcon, PriceIcon, DayBookIcon, SalaryIcon, SuppliersIcon, CalendarIcon, ChartIcon, NotesIcon } from './Icons';
import ShopLogo from '../ShopLogo';
import { useShopSettings } from '../../contexts/ShopSettingsContext';
import { api } from '../../api/client';
import type { LowStockItem, Notification } from '../../types';
import { isLowStockRead } from '../../utils/lowStockRead';

const navItems = [
  { to: '/app', label: 'Dashboard', Icon: HomeIcon },
  { to: '/app/billing', label: 'Billing', Icon: BillIcon },
  { to: '/app/day-book', label: 'Day book', Icon: DayBookIcon },
  { to: '/app/calendar', label: 'Calendar', Icon: CalendarIcon },
  { to: '/app/stock', label: 'Stock', Icon: StockIcon },
  { to: '/app/suppliers', label: 'Suppliers', Icon: SuppliersIcon },
  { to: '/app/branch-accounts', label: 'Branch accounts', Icon: ChartIcon },
  { to: '/app/notes', label: 'Notes', Icon: NotesIcon },
  { to: '/app/prices', label: 'Prices', Icon: PriceIcon },
  { to: '/app/notifications', label: 'Notifications', Icon: BellIcon, badge: true },
  { to: '/app/salary', label: 'Salary', Icon: SalaryIcon },
  { to: '/app/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function Sidebar() {
  const { shopName } = useShopSettings();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
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
      setUnreadCount(notifLen + lowLen);
    };

    refresh().catch(() => {});
    const interval = setInterval(() => {
      refresh().catch(() => {});
    }, 20000);
    const onChanged = () => {
      refresh().catch(() => {});
    };
    window.addEventListener('oliyaruvi-notifications-changed', onChanged);
    window.addEventListener('oliyaruvi-low-stock-read', onChanged);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('oliyaruvi-notifications-changed', onChanged);
      window.removeEventListener('oliyaruvi-low-stock-read', onChanged);
    };
  }, []);

  return (
    <aside className="w-52 bg-black/90 backdrop-blur-sm border-r border-red-950/60 min-h-screen flex flex-col shadow-xl">
      <div className="p-5 border-b border-red-950/50">
        <div className="flex flex-col items-center gap-2">
          <ShopLogo className="h-14 w-auto object-contain" />
          <h1 className="font-semibold text-white text-center text-sm uppercase tracking-wide break-words">{shopName}</h1>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ to, label, Icon, badge }, idx) => (
          <NavLink
            key={to}
            to={to}
            end={idx === 0}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-red-600 text-white'
                  : 'text-red-200/80 hover:bg-red-950/50 hover:text-white'
              }`
            }
          >
            <span className="relative inline-flex">
              <Icon />
              {badge && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-400 text-black text-[10px] font-bold leading-[1.1rem] text-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            <span className="font-medium flex-1">{label}</span>
            {badge && unreadCount > 0 && (
              <span className="text-[10px] font-semibold bg-white/20 text-white rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
