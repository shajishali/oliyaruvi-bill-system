import { FormEvent, useState } from 'react';
import Header from '../components/layout/Header';
import AdminGate from '../components/settings/AdminGate';
import SalaryManagement from '../components/settings/SalaryManagement';
import { ADMIN_AUTH_KEY, setAdminPassword } from '../constants/adminAuth';
import { api } from '../api/client';

export default function Salary() {
  const [adminPassword, setAdminPasswordValue] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    window.location.reload();
  };

  const saveAdminPassword = (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');
    if (adminPassword.length < 4) {
      setPasswordError('Admin password must be at least 4 characters.');
      return;
    }
    if (adminPassword !== adminPasswordConfirm) {
      setPasswordError('Admin password and confirmation do not match.');
      return;
    }
    setAdminPassword(adminPassword);
    setAdminPasswordValue('');
    setAdminPasswordConfirm('');
    setPasswordMessage('Admin password saved. Use it the next time you open Salary or Settings.');
    api.reports.logActivity('password_changed', { kind: 'admin' }).catch(() => {});
  };

  return (
    <AdminGate>
      <Header title="Salary" />
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-end mb-4">
          <button onClick={handleAdminLogout} className="px-3 py-1.5 text-sm font-medium text-red-800 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg">
            Logout (Admin)
          </button>
        </div>
        <form onSubmit={saveAdminPassword} className="mb-6 bg-black/95 rounded-xl border border-red-950/60 p-6 shadow-xl">
          <h3 className="font-semibold text-white">Admin password</h3>
          <p className="text-sm text-red-100 mt-1 mb-4">This password opens Salary and Settings. Set a new one here if you want to change it.</p>
          {passwordError && (
            <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50">{passwordError}</div>
          )}
          {passwordMessage && (
            <div className="mb-4 p-3 bg-emerald-600/30 text-emerald-200 rounded-lg border border-emerald-500/50">{passwordMessage}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPasswordValue(e.target.value)}
              className="w-full border border-red-800 rounded-lg px-3 py-2 bg-black text-white placeholder-red-300"
              placeholder="New admin password"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={adminPasswordConfirm}
              onChange={(e) => setAdminPasswordConfirm(e.target.value)}
              className="w-full border border-red-800 rounded-lg px-3 py-2 bg-black text-white placeholder-red-300"
              placeholder="Confirm admin password"
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
            Save admin password
          </button>
        </form>
        <SalaryManagement />
      </div>
    </AdminGate>
  );
}
