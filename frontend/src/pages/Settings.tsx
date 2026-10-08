import { useState, useEffect, type FormEvent } from 'react';
import { formatSizeDisplay } from '../utils/sizeFormat';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Header from '../components/layout/Header';
import AdminGate from '../components/settings/AdminGate';
import { api } from '../api/client';
import ShopLogo from '../components/ShopLogo';
import type { ShopSettings, ActivityLogEntry } from '../types';
import { ADMIN_AUTH_KEY, setAdminPassword } from '../constants/adminAuth';
import { useAuth } from '../contexts/AuthContext';
import { buildShopReport, downloadShopReport, shopReportBase64, thisWeekRange, viewShopReport } from '../utils/shopReportPdf';


const ACTION_LABELS: Record<string, string> = {
  bill_created: 'Bill Created',
  bill_edited: 'Bill Edited',
  bill_balance_paid: 'Balance Paid',
  frame_created: 'Frame Added',
  photocopy_created: 'Photocopy Size Added',
  frame_updated: 'Frame Updated',
  photocopy_updated: 'Photocopy Size Updated',
  stock_transaction: 'Stock Transaction',
  settings_updated: 'Settings Updated',
  expense_added: 'Expense Added',
  expense_updated: 'Expense Updated',
  expense_deleted: 'Expense Deleted',
  password_changed: 'Password Changed',
  user_registered: 'User Registered',
  user_login: 'User Login',
  counter_started: 'Counter Started',
  counter_ended: 'Counter Ended',
  counter_staff_added: 'Counter Person Added',
  counter_staff_removed: 'Counter Person Removed',
  salary_person_added: 'Salary Person Added',
  salary_person_removed: 'Salary Person Removed',
  salary_paid: 'Salary Paid',
  salary_deleted: 'Salary Payment Removed',
  bill_deleted: 'Bill Deleted',
  photo_created: 'Photo Added',
  banner_created: 'Banner Added',
  sticker_created: 'Sticker Added',
  banner_deleted: 'Banner Removed',
  sticker_deleted: 'Sticker Removed',
  photocopy_deleted: 'Photocopy Removed',
  photo_updated: 'Photo Updated',
  banner_updated: 'Banner Updated',
  sticker_updated: 'Sticker Updated',
  custom_section_item_created: 'Custom Stock Added',
  custom_section_item_updated: 'Custom Stock Updated',
  custom_section_item_deleted: 'Custom Stock Removed',
  custom_section_cleared: 'Custom Section Cleared',
  price_added: 'Price Added',
  price_changed: 'Price Changed',
  price_removed: 'Price Removed',
  branch_created: 'Branch Added',
  branch_deleted: 'Branch Removed',
  branch_transfer: 'Branch Transfer',
  branch_transfer_edited: 'Transfer Edited',
  branch_transfer_undone: 'Transfer Undone',
};

function formatActivityDetails(a: ActivityLogEntry): string {
  if (!a.details || typeof a.details !== 'object') return '';
  const d = a.details as Record<string, unknown>;
  const parts: string[] = [];
  if (a.action_type === 'stock_transaction' && d.item_name) {
    parts.push(String(d.item_name));
  }
  if (d.bill_number) parts.push(`#${d.bill_number}`);
  if (d.staff_name) parts.push(String(d.staff_name));
  if (d.customer_name) parts.push(String(d.customer_name));
  if (d.total != null) parts.push(`Rs.${Number(d.total).toFixed(2)}`);
  if (d.old_total != null && d.new_total != null) {
    parts.push(`Rs.${Number(d.old_total).toFixed(2)} to Rs.${Number(d.new_total).toFixed(2)}`);
  }
  if (d.size_name) parts.push(formatSizeDisplay(String(d.size_name)) || String(d.size_name));
  if (d.transaction_type) parts.push(String(d.transaction_type));
  if (d.quantity != null) parts.push(`qty:${d.quantity}`);
  if (a.action_type === 'stock_transaction' && d.reason) parts.push(`(${d.reason})`);
  if (a.action_type?.startsWith('expense')) {
    if (d.expense_date) parts.push(String(d.expense_date));
    if (d.amount != null) parts.push(`Rs.${Number(d.amount).toFixed(2)}`);
    if (d.description) parts.push(String(d.description));
  }
  if (a.action_type === 'password_changed' && (d.username || d.email)) parts.push(String(d.username || d.email));
  if (a.action_type === 'user_registered') {
    if (d.name) parts.push(String(d.name));
    if (d.username || d.email) parts.push(String(d.username || d.email));
  }
  if (a.action_type === 'user_login' && (d.username || d.email)) parts.push(String(d.username || d.email));
  if (a.action_type?.startsWith('salary')) {
    if (d.project_name) parts.push(String(d.project_name));
    if (d.pay_kind) parts.push(String(d.pay_kind));
    if (d.pay_month) parts.push(String(d.pay_month));
    if (d.amount != null) parts.push(`Rs.${Number(d.amount).toFixed(2)}`);
  }
  return parts.join(' ');
}


export default function Settings() {
  const { listAccounts, setSystemPassword } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportLoading, setReportLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [preparingReport, setPreparingReport] = useState(false);
  const [mailMessage, setMailMessage] = useState('');
  const [mailError, setMailError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<ShopSettings>({
    shop_name: '',
    branch_name: '',
    address: '',
    contact: '',
    gstin: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    report_receiver_email: '',
  });

  useEffect(() => {
    api.settings
      .get()
      .then((s) => setForm({
        shop_name: s.shop_name || '',
        branch_name: s.branch_name || '',
        address: s.address || '',
        contact: s.contact || '',
        gstin: s.gstin || '',
        smtp_host: s.smtp_host || '',
        smtp_port: s.smtp_port || '587',
        smtp_user: s.smtp_user || '',
        smtp_password: s.smtp_password || '',
        report_receiver_email: s.report_receiver_email || '',
      }))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);



  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowed = file.type === 'image/jpeg' || file.type === 'image/png' || /\.(jpe?g|png)$/i.test(file.name);
    if (!allowed) {
      setError('Choose a JPEG or PNG image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be 2 MB or smaller.');
      return;
    }
    setError('');
    setUploadingLogo(true);
    try {
      await api.settings.uploadLogo(file);
      localStorage.setItem('shop-logo-v', String(Date.now()));
      window.dispatchEvent(new Event('shop-logo-updated'));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      await api.settings.update(form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sendWeeklyMail = async () => {
    setMailError('');
    setMailMessage('');
    const user = (form.smtp_user || '').trim();
    const receiver = (form.report_receiver_email || '').trim();
    if (!user || !receiver) {
      setMailError('Enter the Gmail address and the receiver email first.');
      return;
    }
    if (!(form.smtp_password || '').trim()) {
      setMailError('Enter the Gmail app password first.');
      return;
    }
    setSendingMail(true);
    try {
      const { from, to } = thisWeekRange();
      await api.settings.update(form);
      const pdf_base64 = shopReportBase64(await buildShopReport(from, to));
      const result = await api.settings.sendReport({
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_user: user,
        smtp_password: form.smtp_password,
        report_receiver_email: receiver,
        pdf_base64,
        from,
        to,
      });
      setMailMessage(result.message || `Report sent to ${receiver}`);
    } catch (err) {
      setMailError((err as Error).message || 'Could not send the email.');
    } finally {
      setSendingMail(false);
    }
  };

  const openWeeklyReport = async (mode: 'view' | 'download') => {
    setMailError('');
    setPreparingReport(true);
    try {
      const { from, to } = thisWeekRange();
      const doc = await buildShopReport(from, to);
      if (mode === 'view') viewShopReport(doc);
      else downloadShopReport(doc, from, to);
    } catch (err) {
      setMailError((err as Error).message || 'Could not prepare the report.');
    } finally {
      setPreparingReport(false);
    }
  };

  const fetchReport = () => {
    setReportLoading(true);
    api.reports.activity({ date: reportDate })
      .then(setActivities)
      .catch(() => setActivities([]))
      .finally(() => setReportLoading(false));
  };

  const exportCSV = () => {
    const headers = ['Time', 'Action', 'Details'];
    const rows = activities.map((a) => [
      new Date(a.created_at).toLocaleString('en-IN'),
      ACTION_LABELS[a.action_type] || a.action_type,
      formatActivityDetails(a),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-report-${reportDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveAsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Activity Report', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${reportDate} | Generated: ${new Date().toLocaleString('en-IN')}`, 14, 28);
    doc.setTextColor(0, 0, 0);

    const tableData = activities.map((a) => [
      new Date(a.created_at).toLocaleString('en-IN'),
      ACTION_LABELS[a.action_type] || a.action_type,
      formatActivityDetails(a),
    ]);

    autoTable(doc, {
      head: [['Time', 'Action', 'Details']],
      body: tableData,
      startY: 36,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [75, 25, 25] },
    });

    doc.save(`activity-report-${reportDate}.pdf`);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    window.location.reload();
  };

  const accounts = listAccounts();
  const [systemEmail, setSystemEmail] = useState(accounts[0]?.username || accounts[0]?.email || '');
  const [adminPassword, setAdminPasswordValue] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [systemPassword, setSystemPasswordValue] = useState('');
  const [systemPasswordConfirm, setSystemPasswordConfirm] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

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
    setPasswordMessage('Admin password saved. Use it the next time you open Settings or Salary.');
    api.reports.logActivity('password_changed', { kind: 'admin' }).catch(() => {});
  };

  const saveSystemPassword = (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');
    if (!systemEmail) {
      setPasswordError('Create the system account from the login screen first.');
      return;
    }
    if (systemPassword.length < 6) {
      setPasswordError('System password must be at least 6 characters.');
      return;
    }
    if (systemPassword !== systemPasswordConfirm) {
      setPasswordError('System password and confirmation do not match.');
      return;
    }
    const result = setSystemPassword(systemEmail, systemPassword);
    if (!result.success) {
      setPasswordError(result.error || 'Could not save the system password.');
      return;
    }
    setSystemPasswordValue('');
    setSystemPasswordConfirm('');
    setPasswordMessage('System password saved. Use it the next time you sign in.');
    api.reports.logActivity('password_changed', { kind: 'system', username: systemEmail }).catch(() => {});
  };


  return (
    <AdminGate>
      <Header title="Settings" />
      {loading && (
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-red-300/70">Loading...</div>
          </div>
        </div>
      )}
      {!loading && <>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-end mb-4">
          <button onClick={handleAdminLogout} className="px-3 py-1.5 text-sm font-medium text-red-800 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg">
            Logout (Admin)
          </button>
        </div>
        <div className="mb-6 bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-2">Passwords</h3>
          <p className="text-sm text-red-300/70 mb-4">
            Admin password opens Settings and Salary. System password is used to sign in to the billing screen.
          </p>
          {passwordError && (
            <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50">{passwordError}</div>
          )}
          {passwordMessage && (
            <div className="mb-4 p-3 bg-emerald-600/30 text-emerald-200 rounded-lg border border-emerald-500/50">{passwordMessage}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={saveAdminPassword} className="space-y-3">
              <h4 className="text-sm font-medium text-white">Admin password</h4>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPasswordValue(e.target.value)}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="New admin password"
                autoComplete="new-password"
              />
              <input
                type="password"
                value={adminPasswordConfirm}
                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="Confirm admin password"
                autoComplete="new-password"
              />
              <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                Save admin password
              </button>
            </form>
            <form onSubmit={saveSystemPassword} className="space-y-3">
              <h4 className="text-sm font-medium text-white">System password</h4>
              {accounts.length === 0 ? (
                <p className="text-sm text-red-300/70">Create the system account from the login screen first.</p>
              ) : accounts.length === 1 ? (
                <p className="text-sm text-red-200/80">{accounts[0].username || accounts[0].name}</p>
              ) : (
                <select
                  value={systemEmail}
                  onChange={(e) => setSystemEmail(e.target.value)}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
                >
                  {accounts.map((account) => (
                    <option key={account.username || account.email} value={account.username || account.email}>{account.name} · {account.username || account.email}</option>
                  ))}
                </select>
              )}
              <input
                type="password"
                value={systemPassword}
                onChange={(e) => setSystemPasswordValue(e.target.value)}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="New system password"
                autoComplete="new-password"
                disabled={accounts.length === 0}
              />
              <input
                type="password"
                value={systemPasswordConfirm}
                onChange={(e) => setSystemPasswordConfirm(e.target.value)}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="Confirm system password"
                autoComplete="new-password"
                disabled={accounts.length === 0}
              />
              <button type="submit" disabled={accounts.length === 0} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                Save system password
              </button>
            </form>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-4">Shop Details</h3>
          <p className="text-sm text-red-300/70 mb-6">
            These details appear on your printed bills. Update them to match your shop information.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50" onClick={() => setError('')}>
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-600/30 text-emerald-200 rounded-lg border border-emerald-500/50">
              Settings saved successfully.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Shop logo</label>
              <p className="text-xs text-red-300/60 mb-3">JPEG or PNG. The home page and sidebar update as soon as you choose a file.</p>
              <div className="flex items-center gap-4">
                <div className="h-16 min-w-16 rounded-lg border border-red-900/50 bg-black/40 flex items-center justify-center px-2">
                  <ShopLogo className="h-14 w-auto max-w-[8rem] object-contain" />
                </div>
                <label className={`px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 cursor-pointer ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingLogo ? 'Uploading...' : 'Upload JPEG or PNG'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Branch name</label>
              <input
                type="text"
                value={form.branch_name || ''}
                onChange={(e) => setForm((f) => ({ ...f, branch_name: e.target.value }))}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="e.g. Main branch"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Shop Name</label>
              <input
                type="text"
                value={form.shop_name}
                onChange={(e) => setForm((f) => ({ ...f, shop_name: e.target.value }))}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="OLIYARUVI PRINTERS"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Address</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={3}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50 resize-none"
                placeholder="Enter your shop address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Contact</label>
              <input
                type="text"
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="Phone number or email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">GSTIN (optional)</label>
              <input
                type="text"
                value={form.gstin || ''}
                onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
                className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="e.g. 33AAAAA0000A1Z5"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-2">Reports</h3>
          <p className="text-sm text-red-300/70 mb-4">
            View all actions in the billing system by date. Identify what happened in the shop, including any counter staff actions.
          </p>
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
            />
            <button
              onClick={fetchReport}
              disabled={reportLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reportLoading ? 'Loading...' : 'View Report'}
            </button>
            {activities.length > 0 && (
              <>
                <button
                  onClick={exportCSV}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Export CSV
                </button>
                <button
                  onClick={saveAsPDF}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Save as PDF
                </button>
              </>
            )}
          </div>
          {activities.length > 0 ? (
            <div className="border border-red-950/40 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-950/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-red-200">Time</th>
                    <th className="text-left p-2 text-red-200">Action</th>
                    <th className="text-left p-2 text-red-200">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id} className="border-b border-red-950/40 hover:bg-red-950/20">
                      <td className="p-2 text-red-200/90 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="p-2 text-white font-medium">
                        {ACTION_LABELS[a.action_type] || a.action_type}
                      </td>
                        <td className="p-2 text-red-300/80 text-xs">
                        {a.details && typeof a.details === 'object' && (
                          <span>
                            {a.action_type === 'stock_transaction' && a.details.item_name && (
                              <span className="text-amber-300/90 font-medium">{a.details.item_name as string}{' '}</span>
                            )}
                            {a.action_type?.startsWith('expense') && (
                              <>
                                {a.details.expense_date && <span className="text-amber-300/90">{a.details.expense_date as string} </span>}
                                {a.details.amount != null && <span>Rs.{Number(a.details.amount).toFixed(2)} </span>}
                                {a.details.description && <span>{a.details.description as string}</span>}
                              </>
                            )}
                            {a.details.bill_number && `#${a.details.bill_number} `}
                            {a.details.customer_name && `${a.details.customer_name} `}
                            {a.details.total != null && !a.action_type?.startsWith('expense') && `Rs.${Number(a.details.total).toFixed(2)} `}
                            {a.details.size_name && `${a.details.size_name} `}
                            {a.details.transaction_type && `${a.details.transaction_type} `}
                            {a.details.quantity != null && `qty:${a.details.quantity}`}
                            {a.action_type === 'stock_transaction' && a.details.reason && (
                              <span className="text-red-400/70"> ({a.details.reason as string})</span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !reportLoading && (
            <p className="text-red-300/60 text-sm">No activity for this date. Select a date and click View Report.</p>
          )}
        </div>
        </div>

        <div className="mt-6 bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-2">Weekly report email</h3>
          <p className="text-sm text-red-300/70 mb-6 max-w-3xl">
            Enter the Gmail SMTP details. View report and Download report open this week's PDF. Send to mail emails that same PDF. It covers this week's bills, deleted bills, balance payments, new stock, stock changes, price changes, expenses, salary, transfers, and profit.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-red-200/90 mb-1">SMTP host</label>
                <input
                  type="text"
                  value={form.smtp_host || ''}
                  onChange={(e) => setForm((f) => ({ ...f, smtp_host: e.target.value }))}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                  placeholder="smtp.gmail.com"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-200/90 mb-1">SMTP port</label>
                <input
                  type="text"
                  value={form.smtp_port || ''}
                  onChange={(e) => setForm((f) => ({ ...f, smtp_port: e.target.value }))}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                  placeholder="587"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-200/90 mb-1">SMTP email</label>
                <input
                  type="email"
                  value={form.smtp_user || ''}
                  onChange={(e) => setForm((f) => ({ ...f, smtp_user: e.target.value }))}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                  placeholder="your-shop@gmail.com"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-200/90 mb-1">SMTP app password</label>
                <input
                  type="password"
                  value={form.smtp_password || ''}
                  onChange={(e) => setForm((f) => ({ ...f, smtp_password: e.target.value }))}
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                  placeholder="Gmail app password"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-red-200/90 mb-1">Receiver email</label>
              <input
                type="email"
                value={form.report_receiver_email || ''}
                onChange={(e) => setForm((f) => ({ ...f, report_receiver_email: e.target.value }))}
                className="w-full max-w-md border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
                placeholder="owner@gmail.com"
                autoComplete="off"
              />
            </div>
            {mailError && (
              <div className="p-3 bg-red-950/80 text-red-100 rounded-lg border border-red-900/50 text-sm">{mailError}</div>
            )}
            {mailMessage && (
              <div className="p-3 bg-emerald-600/30 text-emerald-100 rounded-lg border border-emerald-500/50 text-sm">{mailMessage}</div>
            )}
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || sendingMail || preparingReport}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save email settings'}
              </button>
              <button
                type="button"
                onClick={() => openWeeklyReport('view')}
                disabled={saving || sendingMail || preparingReport}
                className="px-6 py-3 bg-red-950/50 text-red-100 rounded-lg font-medium hover:bg-red-950/70 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {preparingReport ? 'Preparing...' : 'View report'}
              </button>
              <button
                type="button"
                onClick={() => openWeeklyReport('download')}
                disabled={saving || sendingMail || preparingReport}
                className="px-6 py-3 bg-red-950/50 text-red-100 rounded-lg font-medium hover:bg-red-950/70 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download report
              </button>
              <button
                type="button"
                onClick={sendWeeklyMail}
                disabled={saving || sendingMail || preparingReport}
                className="px-6 py-3 bg-white text-red-800 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingMail ? 'Sending...' : 'Send to mail'}
              </button>
            </div>
          </form>
        </div>

      </div>
      </>}
    </AdminGate>
  );
}
