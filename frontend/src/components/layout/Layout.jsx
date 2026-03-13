import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-auto bg-gradient-to-b from-slate-50/80 to-slate-100/60">
        <Outlet />
      </main>
    </div>
  );
}
