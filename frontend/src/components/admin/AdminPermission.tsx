import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ADMIN_AUTH_KEY, ADMIN_USERNAME, getAdminPassword } from '../../constants/adminAuth';

type Pending = (ok: boolean) => void;

let pending: Pending | null = null;
let openDialog: ((open: boolean) => void) | null = null;

export function isAdminSession(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Ask for the admin password every time. Opening Settings does not skip this check. */
export function requestAdminPermission(_options?: { force?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const previous = pending;
    pending = (ok) => {
      previous?.(ok);
      resolve(ok);
    };
    openDialog?.(true);
  });
}

export function AdminPermissionHost() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    openDialog = (next) => {
      setOpen(next);
      if (next) {
        setUsername('');
        setPassword('');
        setError('');
      }
    };
    return () => {
      openDialog = null;
    };
  }, []);

  const finish = (ok: boolean) => {
    setOpen(false);
    const resolve = pending;
    pending = null;
    resolve?.(ok);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (username.trim() !== ADMIN_USERNAME) {
      setError('Invalid username');
      return;
    }
    if (password !== getAdminPassword()) {
      setError('Invalid password');
      return;
    }
    sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
    finish(true);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-6">
      <div className="max-w-md w-full bg-black/95 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl relative">
        <button
          type="button"
          onClick={() => finish(false)}
          className="absolute top-4 right-4 p-1.5 rounded text-red-300 hover:bg-red-950/60 hover:text-white"
          title="Cancel"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold text-white mb-2 text-center">Admin permission</h2>
        <p className="text-sm text-red-100 mb-4 text-center">
          Enter the admin password to allow this change. Each delete or edit asks again.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium text-white">
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              className="mt-1 w-full border border-red-800 rounded px-3 py-2 bg-black text-white placeholder-red-300"
            />
          </label>
          <label className="block text-sm font-medium text-white">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              autoComplete="current-password"
              className="mt-1 w-full border border-red-800 rounded px-3 py-2 bg-black text-white placeholder-red-300"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => finish(false)}
              className="flex-1 px-3 py-2 rounded-lg border border-red-900/50 text-red-200 hover:bg-red-950/60"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">
              Allow
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
