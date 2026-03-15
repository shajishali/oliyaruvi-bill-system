import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function NotificationToast() {
  const [count, setCount] = useState(0);
  const [show, setShow] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    api.notifications.list(true).then((n) => setCount(n.length)).catch(() => {});
    const interval = setInterval(() => {
      api.notifications.list(true).then((n) => setCount(n.length)).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (count > 0 && !shown) {
      setShow(true);
      setShown(true);
      const t = setTimeout(() => setShow(false), 4000);
      return () => clearTimeout(t);
    }
  }, [count, shown]);

  if (!show || count === 0) return null;

  return (
    <Link
      to="/app/notifications"
      className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-[100] max-w-sm cursor-pointer hover:bg-red-700 transition-colors block"
    >
      <p className="font-medium text-sm">You have {count} new notification{count > 1 ? 's' : ''}</p>
      <p className="text-xs text-red-100 mt-0.5">Click to go to Notifications page</p>
    </Link>
  );
}
