import Sidebar from './Sidebar';
import NotificationToast from './NotificationToast';
import PageTransition from './PageTransition';
import { AdminPermissionHost } from '../admin/AdminPermission';
import { CounterProvider } from '../../contexts/CounterContext';
import CounterIdentifyHost from '../counter/CounterIdentifyHost';

export default function Layout() {
  return (
    <CounterProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 w-full flex flex-col overflow-auto bg-transparent">
          <PageTransition />
        </main>
        <NotificationToast />
        <AdminPermissionHost />
        <CounterIdentifyHost />
      </div>
    </CounterProvider>
  );
}
