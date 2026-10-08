import { NavLink } from 'react-router-dom';
import { HomeIcon, BillIcon, StockIcon, SettingsIcon, BellIcon, PriceIcon, DayBookIcon, SalaryIcon } from './Icons';
import ShopLogo from '../ShopLogo';

const navItems = [
  { to: '/app', label: 'Dashboard', Icon: HomeIcon },
  { to: '/app/billing', label: 'Billing', Icon: BillIcon },
  { to: '/app/day-book', label: 'Day book', Icon: DayBookIcon },
  { to: '/app/stock', label: 'Stock', Icon: StockIcon },
  { to: '/app/prices', label: 'Prices', Icon: PriceIcon },
  { to: '/app/notifications', label: 'Notifications', Icon: BellIcon },
  { to: '/app/salary', label: 'Salary', Icon: SalaryIcon },
  { to: '/app/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function Sidebar() {
  return (
    <aside className="w-52 bg-black/90 backdrop-blur-sm border-r border-red-950/60 min-h-screen flex flex-col shadow-xl">
      <div className="p-5 border-b border-red-950/50">
        <div className="flex flex-col items-center gap-2">
          <ShopLogo className="h-14 w-auto object-contain" />
          <h1 className="font-semibold text-white text-center text-sm uppercase tracking-wide">OLIYARUVI PRINTERS</h1>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ to, label, Icon }, idx) => (
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
            <Icon />
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
