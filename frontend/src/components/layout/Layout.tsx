import Sidebar from './Sidebar';
import NotificationToast from './NotificationToast';
import PageTransition from './PageTransition';
import { AdminPermissionHost } from '../admin/AdminPermission';

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-auto bg-transparent">
        <PageTransition />
      </main>
      <NotificationToast />
      <AdminPermissionHost />
    </div>
  );
}
