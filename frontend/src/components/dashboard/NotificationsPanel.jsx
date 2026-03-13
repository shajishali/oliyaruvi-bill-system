import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api.notifications.list(true).then(setNotifications).catch(() => {});
  }, []);

  const markRead = async (id) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (_) {}
  };

  if (notifications.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-4">Notifications</h3>
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100"
          >
            <div>
              <p className="font-medium text-sm text-gray-800">{n.title}</p>
              {n.message && <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>}
            </div>
            <button
              onClick={() => markRead(n.id)}
              className="text-xs text-slate-600 hover:text-slate-800 font-medium shrink-0"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
