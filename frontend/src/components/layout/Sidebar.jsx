import { NavLink } from 'react-router-dom';
import { HomeIcon, BillIcon, StockIcon, ChartIcon, SettingsIcon } from './Icons';

const navItems = [
  { to: '/', label: 'Dashboard', Icon: HomeIcon },
  { to: '/billing', label: 'Billing', Icon: BillIcon },
  { to: '/stock', label: 'Stock', Icon: StockIcon },
  { to: '/reports', label: 'Reports', Icon: ChartIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function Sidebar() {
  return (
    <aside className="w-52 bg-white/95 backdrop-blur-sm border-r border-slate-200/80 min-h-screen flex flex-col shadow-sm">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
            <span className="text-white font-bold text-sm">OP</span>
          </div>
          <div>
            <h1 className="font-semibold text-gray-800">Oliyaruvi</h1>
            <p className="text-xs text-gray-500">Printers</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
