import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { Notification } from '../../types';

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    api.notifications.list(true).then(setNotifications).catch(() => {});
  }, []);

  const markRead = async (id: number) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (_) {}
  };

  if (notifications.length === 0) return null;

  return (
    <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-5 shadow-xl">
      <h3 className="font-semibold text-white mb-4">Notifications</h3>
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-2 p-3 bg-red-950/40 rounded-lg border border-red-900/50"
          >
            <div>
              <p className="font-medium text-sm text-white">{n.title}</p>
              {n.message && <p className="text-xs text-red-300/70 mt-0.5">{n.message}</p>}
            </div>
            <button
              onClick={() => markRead(n.id)}
              className="text-xs text-red-600 hover:text-red-700 font-medium shrink-0"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
