import { FormEvent, useEffect, useMemo, useState } from 'react';
import Header from '../components/layout/Header';
import { api } from '../api/client';
import { requestAdminPermission } from '../components/admin/AdminPermission';
import type { Supplier, SupplierBill, SupplierBillDetail, SupplierDetail, SupplierPayMethod } from '../types';

type Tab = 'companies' | 'bills';

type BillLineDraft = {
  item_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
};

type AttachDraft = { name: string; mime: string; data: string } | null;

const emptyCompany = { name: '', phone: '', email: '', address: '', notes: '' };
const emptyLine = (): BillLineDraft => ({ item_name: '', quantity: '1', unit: '', unit_price: '' });
const PAY_OPTIONS: SupplierPayMethod[] = ['Cash', 'Bank', 'Card', 'Credit'];

function readFileAsAttachment(file: File): Promise<AttachDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64) {
        reject(new Error('Could not read the selected file'));
        return;
      }
      resolve({ name: file.name, mime: file.type || 'application/octet-stream', data: base64 });
    };
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  if (!d) return '-';
  try {
    return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

export default function Suppliers() {
  const [tab, setTab] = useState<Tab>('companies');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [billDate, setBillDate] = useState('');
  const [companies, setCompanies] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<SupplierBill[]>([]);

  const [companyModal, setCompanyModal] = useState<'add' | 'edit' | null>(null);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);

  const [detail, setDetail] = useState<SupplierDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [billModal, setBillModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [billForm, setBillForm] = useState({
    supplier_id: '',
    bill_date: today(),
    bill_number: '',
    payment_method: 'Cash' as SupplierPayMethod,
    amount_paid: '',
    total_amount: '',
    notes: '',
  });
  const [billLines, setBillLines] = useState<BillLineDraft[]>([emptyLine()]);
  const [attachment, setAttachment] = useState<AttachDraft>(null);
  const [existingAttachmentName, setExistingAttachmentName] = useState<string | null>(null);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [viewBill, setViewBill] = useState<SupplierBillDetail | null>(null);
  const [savingBill, setSavingBill] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '',
    payment_method: 'Cash' as SupplierPayMethod,
    paid_on: today(),
    notes: '',
    from_collection: false,
  });
  const [fromCollectionOnSave, setFromCollectionOnSave] = useState(false);
  const [savingPay, setSavingPay] = useState(false);

  const itemsTotal = useMemo(
    () =>
      billLines.reduce((sum, line) => {
        const qty = parseFloat(line.quantity) || 0;
        const price = parseFloat(line.unit_price) || 0;
        return sum + qty * price;
      }, 0),
    [billLines]
  );

  const billTotal = useMemo(() => {
    if (billForm.total_amount.trim() !== '') {
      return Math.max(0, parseFloat(billForm.total_amount) || 0);
    }
    return itemsTotal;
  }, [billForm.total_amount, itemsTotal]);

  const paidNow = useMemo(() => {
    if (billForm.amount_paid.trim() === '') {
      return billForm.payment_method === 'Credit' ? 0 : billTotal;
    }
    return Math.max(0, Math.min(billTotal, parseFloat(billForm.amount_paid) || 0));
  }, [billForm.amount_paid, billForm.payment_method, billTotal]);

  const balanceNow = Math.max(0, billTotal - paidNow);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [c, b] = await Promise.all([
        api.suppliers.list(search.trim() || undefined),
        api.suppliers.bills({
          ...(billDate ? { date: billDate } : {}),
          ...(search.trim() && tab === 'bills' ? { q: search.trim() } : {}),
        }),
      ]);
      setCompanies(c);
      setBills(b);
      if (detail) {
        const refreshed = await api.suppliers.get(detail.id);
        setDetail(refreshed);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, billDate, tab]);

  const openAddCompany = () => {
    setCompanyForm(emptyCompany);
    setEditingCompanyId(null);
    setCompanyModal('add');
  };

  const openEditCompany = (row: Supplier) => {
    setCompanyForm({
      name: row.name || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      notes: row.notes || '',
    });
    setEditingCompanyId(row.id);
    setCompanyModal('edit');
  };

  const saveCompany = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyForm.name.trim()) return;
    setSavingCompany(true);
    setError('');
    try {
      if (companyModal === 'edit' && editingCompanyId != null) {
        await api.suppliers.update(editingCompanyId, companyForm);
      } else {
        await api.suppliers.create(companyForm);
      }
      setCompanyModal(null);
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingCompany(false);
    }
  };

  const removeCompany = async (row: Supplier) => {
    if (!(await requestAdminPermission())) return;
    if (!window.confirm(`Remove company "${row.name}" and all its purchase bills?`)) return;
    try {
      await api.suppliers.delete(row.id);
      if (detail?.id === row.id) setDetail(null);
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openCompanyDetail = async (id: number) => {
    setDetailLoading(true);
    setError('');
    try {
      setDetail(await api.suppliers.get(id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const openAddBill = (supplierId?: number) => {
    setBillForm({
      supplier_id: supplierId != null ? String(supplierId) : '',
      bill_date: today(),
      bill_number: '',
      payment_method: 'Cash',
      amount_paid: '',
      total_amount: '',
      notes: '',
    });
    setBillLines([]);
    setAttachment(null);
    setExistingAttachmentName(null);
    setEditingBillId(null);
    setViewBill(null);
    setFromCollectionOnSave(false);
    setError('');
    setBillModal('add');
  };

  const openViewBill = async (id: number) => {
    setError('');
    try {
      const bill = await api.suppliers.getBill(id);
      setViewBill(bill);
      setPayForm({
        amount: bill.balance && bill.balance > 0 ? String(bill.balance) : '',
        payment_method: 'Cash',
        paid_on: today(),
        notes: '',
        from_collection: false,
      });
      setBillModal('view');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openEditBill = async (id: number) => {
    setError('');
    try {
      const bill = await api.suppliers.getBill(id);
      const method = (PAY_OPTIONS.includes(bill.payment_method as SupplierPayMethod)
        ? bill.payment_method
        : 'Cash') as SupplierPayMethod;
      setBillForm({
        supplier_id: String(bill.supplier_id),
        bill_date: bill.bill_date.slice(0, 10),
        bill_number: bill.bill_number,
        payment_method: method,
        amount_paid: String(bill.amount_paid ?? 0),
        total_amount: String(bill.total ?? 0),
        notes: bill.notes || '',
      });
      setBillLines(
        bill.items.map((i) => ({
          item_name: i.item_name,
          quantity: String(i.quantity),
          unit: i.unit || '',
          unit_price: String(i.unit_price),
        }))
      );
      setAttachment(null);
      setExistingAttachmentName(bill.has_attachment ? bill.attachment_name || 'Uploaded bill' : null);
      setEditingBillId(bill.id);
      setViewBill(null);
      setBillModal('edit');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onPickAttachment = async (file: File | null) => {
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Bill file must be under 5 MB');
      return;
    }
    try {
      setAttachment(await readFileAsAttachment(file));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveBill = async (e: FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    const supplier_id = parseInt(billForm.supplier_id, 10);
    if (!supplier_id) missing.push('company');
    if (!billForm.bill_date) missing.push('date');
    if (billTotal <= 0) missing.push('total bill amount');
    if (missing.length) {
      setError(`Please fill: ${missing.join(', ')}`);
      return;
    }
    const items = billLines
      .map((line) => ({
        item_name: line.item_name.trim(),
        quantity: parseFloat(line.quantity) || 0,
        unit: line.unit.trim() || undefined,
        unit_price: parseFloat(line.unit_price) || 0,
      }))
      .filter((i) => i.item_name && i.quantity > 0);
    setSavingBill(true);
    setError('');
    try {
      const payload = {
        supplier_id,
        bill_date: billForm.bill_date,
        bill_number: billForm.bill_number.trim() || undefined,
        payment_method: billForm.payment_method,
        amount_paid: paidNow,
        total: billTotal,
        notes: billForm.notes.trim() || null,
        items,
        ...(attachment
          ? { attachment_data: attachment.data, attachment_name: attachment.name, mime: attachment.mime }
          : {}),
      };
      if (billModal === 'edit' && editingBillId != null) {
        await api.suppliers.updateBill(editingBillId, payload);
      } else {
        await api.suppliers.createBill({
          ...payload,
          from_collection: paidNow > 0 && billForm.payment_method !== 'Credit' && fromCollectionOnSave,
        });
      }
      setBillModal(null);
      setAttachment(null);
      await load(true);
      if (detail && detail.id === supplier_id) {
        setDetail(await api.suppliers.get(supplier_id));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingBill(false);
    }
  };

  const saveBalancePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!viewBill) return;
    const amount = parseFloat(payForm.amount) || 0;
    if (amount <= 0) {
      setError('Enter the amount you are paying now');
      return;
    }
    if (payForm.payment_method === 'Credit') {
      setError('Choose Cash, Bank, or Card for a balance payment');
      return;
    }
    setSavingPay(true);
    setError('');
    try {
      const updated = await api.suppliers.payBill(viewBill.id, {
        amount,
        payment_method: payForm.payment_method,
        paid_on: payForm.paid_on,
        notes: payForm.notes.trim() || null,
        from_collection: payForm.from_collection,
      });
      setViewBill(updated);
      setPayForm({
        amount: updated.balance && updated.balance > 0 ? String(updated.balance) : '',
        payment_method: 'Cash',
        paid_on: today(),
        notes: '',
        from_collection: false,
      });
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingPay(false);
    }
  };

  const removeBill = async (id: number, label: string) => {
    if (!(await requestAdminPermission())) return;
    if (!window.confirm(`Delete purchase bill ${label}?`)) return;
    try {
      await api.suppliers.deleteBill(id);
      if (viewBill?.id === id) {
        setBillModal(null);
        setViewBill(null);
      }
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <Header title="Suppliers" />
      <div className="p-6 w-full flex-1 flex flex-col min-h-0">
        <p className="text-sm text-red-300/75 mb-4 shrink-0">
          Store companies you buy materials from, day-wise purchases, and supplier bills. Open a company anytime for contacts and history.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 flex justify-between items-center">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="text-red-300 hover:text-white ml-2">✕</button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4 items-center shrink-0">
          <button
            type="button"
            onClick={() => setTab('companies')}
            className={`px-4 py-2 rounded-lg font-medium ${tab === 'companies' ? 'bg-red-600 text-white' : 'bg-black/60 text-red-200 border border-red-950/50'}`}
          >
            Companies
          </button>
          <button
            type="button"
            onClick={() => setTab('bills')}
            className={`px-4 py-2 rounded-lg font-medium ${tab === 'bills' ? 'bg-red-600 text-white' : 'bg-black/60 text-red-200 border border-red-950/50'}`}
          >
            Purchase bills
          </button>
          <div className="flex-1" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'companies' ? 'Search company, phone…' : 'Search bill or company…'}
            className="px-3 py-2 rounded-lg border border-red-900/50 bg-black/60 text-white placeholder-red-400/50 text-sm min-w-[200px]"
          />
          {tab === 'bills' && (
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-red-900/50 bg-black/60 text-white text-sm"
              title="Filter by purchase date"
            />
          )}
          {tab === 'companies' ? (
            <button type="button" onClick={openAddCompany} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500">
              + Add company
            </button>
          ) : (
            <button type="button" onClick={() => openAddBill()} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500">
              + Add bill
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-red-300/70">Loading…</p>
        ) : tab === 'companies' ? (
          <div className="bg-black/80 border border-red-950/50 rounded-xl overflow-auto flex-1 min-h-0 w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-red-200/80 border-b border-red-950/50">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3 text-right">Bills</th>
                  <th className="px-4 py-3 text-right">Spent</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-red-300/60">No companies yet. Add the first supplier.</td>
                  </tr>
                ) : (
                  companies.map((row) => (
                    <tr key={row.id} className="border-b border-red-950/30 hover:bg-red-950/20">
                      <td className="px-4 py-3 text-white font-medium">
                        <button type="button" onClick={() => void openCompanyDetail(row.id)} className="text-left hover:text-red-200 underline-offset-2 hover:underline">
                          {row.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-red-100">{row.phone || '-'}</td>
                      <td className="px-4 py-3 text-red-100 max-w-[220px] truncate">{row.address || '-'}</td>
                      <td className="px-4 py-3 text-right text-red-100">{row.bill_count ?? 0}</td>
                      <td className="px-4 py-3 text-right text-red-100">{money(row.total_spent ?? 0)}</td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button type="button" onClick={() => void openCompanyDetail(row.id)} className="text-red-200 hover:text-white">View</button>
                        <button type="button" onClick={() => openEditCompany(row)} className="text-red-200 hover:text-white">Edit</button>
                        <button type="button" onClick={() => openAddBill(row.id)} className="text-emerald-300 hover:text-emerald-200">+ Bill</button>
                        <button type="button" onClick={() => void removeCompany(row)} className="text-red-400 hover:text-red-300">Remove</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-black/80 border border-red-950/50 rounded-xl overflow-auto flex-1 min-h-0 w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-red-200/80 border-b border-red-950/50">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Bill #</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Pay</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-red-300/60">No purchase bills yet.</td>
                  </tr>
                ) : (
                  bills.map((row) => (
                    <tr key={row.id} className="border-b border-red-950/30 hover:bg-red-950/20">
                      <td className="px-4 py-3 text-red-100">{formatDate(row.bill_date)}</td>
                      <td className="px-4 py-3 text-white font-medium">
                        {row.bill_number}
                        {row.has_attachment ? <span className="ml-2 text-xs text-emerald-300">file</span> : null}
                      </td>
                      <td className="px-4 py-3 text-red-100">{row.supplier_name}</td>
                      <td className="px-4 py-3 text-red-100">{row.payment_method}</td>
                      <td className="px-4 py-3 text-right text-white">{money(row.total)}</td>
                      <td className="px-4 py-3 text-right text-emerald-200">{money(row.amount_paid ?? 0)}</td>
                      <td className={`px-4 py-3 text-right ${(row.balance ?? 0) > 0 ? 'text-amber-300' : 'text-red-100'}`}>
                        {money(row.balance ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button type="button" onClick={() => void openViewBill(row.id)} className="text-red-200 hover:text-white">View</button>
                        <button type="button" onClick={() => void openEditBill(row.id)} className="text-red-200 hover:text-white">Edit</button>
                        <button type="button" onClick={() => void removeBill(row.id, row.bill_number)} className="text-red-400 hover:text-red-300">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Company detail drawer */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-[180] flex justify-end bg-black/60" onClick={() => setDetail(null)}>
          <div
            className="w-full max-w-lg h-full bg-neutral-950 border-l border-red-950/60 p-6 overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{detail?.name || 'Loading…'}</h3>
              <button type="button" onClick={() => setDetail(null)} className="text-red-300 hover:text-white">✕</button>
            </div>
            {detailLoading && !detail ? (
              <p className="text-red-300/70">Loading…</p>
            ) : detail ? (
              <>
                <div className="space-y-2 text-sm text-red-100 mb-6">
                  <p><span className="text-red-300/70">Phone:</span> {detail.phone || '-'}</p>
                  <p><span className="text-red-300/70">Email:</span> {detail.email || '-'}</p>
                  <p><span className="text-red-300/70">Address:</span> {detail.address || '-'}</p>
                  {detail.notes && <p><span className="text-red-300/70">Notes:</span> {detail.notes}</p>}
                  <p className="pt-2 text-white">Total spent: {money(detail.total_spent ?? 0)} · {detail.bill_count ?? 0} bills</p>
                </div>
                <div className="flex gap-2 mb-4">
                  <button type="button" onClick={() => openEditCompany(detail)} className="px-3 py-1.5 rounded-lg bg-red-950/60 text-red-100 text-sm">Edit details</button>
                  <button type="button" onClick={() => openAddBill(detail.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm">+ Add bill</button>
                </div>
                <h4 className="font-medium text-white mb-2">Purchase history</h4>
                <div className="space-y-2">
                  {(detail.bills || []).length === 0 ? (
                    <p className="text-sm text-red-300/60">No bills yet for this company.</p>
                  ) : (
                    detail.bills.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => void openViewBill(b.id)}
                        className="w-full text-left p-3 rounded-lg border border-red-950/50 bg-black/50 hover:bg-red-950/30"
                      >
                        <div className="flex justify-between text-sm">
                          <span className="text-white font-medium">{b.bill_number}</span>
                          <span className="text-white">{money(b.total)}</span>
                        </div>
                        <div className="text-xs text-red-300/70 mt-1">
                          {formatDate(b.bill_date)} · paid {money(b.amount_paid ?? 0)}
                          {(b.balance ?? 0) > 0 ? ` · balance ${money(b.balance ?? 0)}` : ' · settled'}
                          {b.has_attachment ? ' · file' : ''}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Company modal */}
      {companyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
          <form onSubmit={saveCompany} className="bg-neutral-950 border border-red-950/60 rounded-xl p-6 w-full max-w-md space-y-3">
            <h3 className="text-lg font-semibold text-white">{companyModal === 'edit' ? 'Edit company' : 'Add company'}</h3>
            <label className="block text-sm text-red-200">
              Company name *
              <input required value={companyForm.name} onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white" />
            </label>
            <label className="block text-sm text-red-200">
              Phone
              <input value={companyForm.phone} onChange={(e) => setCompanyForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1 w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white" />
            </label>
            <label className="block text-sm text-red-200">
              Email
              <input value={companyForm.email} onChange={(e) => setCompanyForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white" />
            </label>
            <label className="block text-sm text-red-200">
              Address
              <textarea value={companyForm.address} onChange={(e) => setCompanyForm((f) => ({ ...f, address: e.target.value }))} rows={2} className="mt-1 w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white" />
            </label>
            <label className="block text-sm text-red-200">
              Notes
              <textarea value={companyForm.notes} onChange={(e) => setCompanyForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCompanyModal(null)} className="px-4 py-2 rounded-lg bg-red-950/60 text-red-200">Cancel</button>
              <button type="submit" disabled={savingCompany} className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50">
                {savingCompany ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bill view */}
      {billModal === 'view' && viewBill && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-neutral-950 border border-red-950/60 rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{viewBill.bill_number}</h3>
                <p className="text-sm text-red-200/80">{viewBill.supplier_name} · {formatDate(viewBill.bill_date)}</p>
              </div>
              <button type="button" onClick={() => { setBillModal(null); setViewBill(null); }} className="text-red-300 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm mb-3">
              <div className="rounded-lg border border-red-950/50 p-2"><p className="text-red-300/70">Total</p><p className="text-white font-medium">{money(viewBill.total)}</p></div>
              <div className="rounded-lg border border-red-950/50 p-2"><p className="text-red-300/70">Paid</p><p className="text-emerald-200 font-medium">{money(viewBill.amount_paid ?? 0)}</p></div>
              <div className="rounded-lg border border-red-950/50 p-2"><p className="text-red-300/70">Balance</p><p className={`font-medium ${(viewBill.balance ?? 0) > 0 ? 'text-amber-300' : 'text-white'}`}>{money(viewBill.balance ?? 0)}</p></div>
            </div>
            {viewBill.notes && <p className="text-sm text-red-300/80 mb-3">{viewBill.notes}</p>}
            {viewBill.has_attachment && (
              <a
                href={api.suppliers.billAttachmentUrl(viewBill.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-block mb-3 text-sm text-emerald-300 hover:text-emerald-200 underline"
              >
                Open uploaded bill{viewBill.attachment_name ? ` (${viewBill.attachment_name})` : ''}
              </a>
            )}
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-red-200/70 border-b border-red-950/50 text-left">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewBill.items.map((item, idx) => (
                  <tr key={item.id ?? idx} className="border-b border-red-950/30 text-red-100">
                    <td className="py-2">{item.item_name}{item.unit ? ` (${item.unit})` : ''}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{money(item.unit_price)}</td>
                    <td className="py-2 text-right">{money(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 className="text-sm font-medium text-white mb-2">Payment history</h4>
            <div className="space-y-1 mb-4 text-sm">
              {(viewBill.payments || []).length === 0 ? (
                <p className="text-red-300/60">No payments recorded yet.</p>
              ) : (
                viewBill.payments!.map((p) => (
                  <div key={p.id} className="flex justify-between border-b border-red-950/30 py-1.5 text-red-100">
                    <span>{formatDate(p.paid_on)} · {p.payment_method}{p.notes ? ` · ${p.notes}` : ''}</span>
                    <span className="text-white">{money(p.amount)}</span>
                  </div>
                ))
              )}
            </div>

            {(viewBill.balance ?? 0) > 0 && (
              <form onSubmit={saveBalancePayment} className="mb-4 p-3 rounded-lg border border-amber-700/40 bg-amber-950/20 space-y-2">
                <h4 className="text-sm font-medium text-amber-100">Pay remaining balance</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') }))}
                    placeholder="Amount"
                    className="border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white text-sm"
                  />
                  <select
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value as SupplierPayMethod }))}
                    className="border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white text-sm"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                    <option value="Card">Card</option>
                  </select>
                  <input
                    type="date"
                    value={payForm.paid_on}
                    onChange={(e) => setPayForm((f) => ({ ...f, paid_on: e.target.value }))}
                    className="border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white text-sm"
                  />
                </div>
                <input
                  value={payForm.notes}
                  onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Note (optional)"
                  className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black text-white text-sm placeholder-red-400/50"
                />
                <label className="flex items-start gap-2 text-sm text-amber-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payForm.from_collection}
                    onChange={(e) => setPayForm((f) => ({ ...f, from_collection: e.target.checked }))}
                    className="mt-0.5 rounded border-amber-600"
                  />
                  <span>
                    Take from day collection — also add this payment to today’s expenses (Day book money box).
                    Leave unchecked if you do not want it in expenses.
                  </span>
                </label>
                <button type="submit" disabled={savingPay} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-500 disabled:opacity-50">
                  {savingPay ? 'Saving…' : 'Record payment'}
                </button>
              </form>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => void openEditBill(viewBill.id)} className="px-4 py-2 rounded-lg bg-red-950/60 text-red-200">Edit</button>
              <button type="button" onClick={() => void removeBill(viewBill.id, viewBill.bill_number)} className="px-4 py-2 rounded-lg bg-red-600 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Bill add/edit */}
      {(billModal === 'add' || billModal === 'edit') && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <form
            onSubmit={saveBill}
            className="bg-neutral-950 border border-red-950/60 rounded-xl w-full max-w-2xl max-h-[min(92vh,720px)] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-red-950/50 flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">
                {billModal === 'edit' ? 'Edit purchase bill' : 'Add purchase bill'}
              </h3>
              <button type="button" onClick={() => setBillModal(null)} className="text-red-300 hover:text-white text-lg leading-none px-1" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
              {error && (
                <div className="p-2.5 bg-red-950/80 text-red-200 rounded-lg border border-red-900/50 flex justify-between items-center text-sm sticky top-0 z-10">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError('')} className="text-red-300 hover:text-white ml-2">✕</button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <label className="block text-xs text-red-200 col-span-2 sm:col-span-3">
                  Company *
                  <select
                    value={billForm.supplier_id}
                    onChange={(e) => setBillForm((f) => ({ ...f, supplier_id: e.target.value }))}
                    className="mt-1 w-full border border-red-900/50 rounded-lg px-2.5 py-1.5 bg-black text-white text-sm"
                  >
                    <option value="">Choose company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-red-200">
                  Date *
                  <input
                    type="date"
                    value={billForm.bill_date}
                    onChange={(e) => setBillForm((f) => ({ ...f, bill_date: e.target.value }))}
                    className="mt-1 w-full border border-red-900/50 rounded-lg px-2.5 py-1.5 bg-black text-white text-sm"
                  />
                </label>
                <label className="block text-xs text-red-200">
                  Bill number
                  <input
                    value={billForm.bill_number}
                    onChange={(e) => setBillForm((f) => ({ ...f, bill_number: e.target.value }))}
                    placeholder="Auto if empty"
                    className="mt-1 w-full border border-red-900/50 rounded-lg px-2.5 py-1.5 bg-black text-white text-sm placeholder-red-400/50"
                  />
                </label>
                <label className="block text-xs text-red-200">
                  Payment
                  <select
                    value={billForm.payment_method}
                    onChange={(e) => {
                      const method = e.target.value as SupplierPayMethod;
                      setBillForm((f) => ({
                        ...f,
                        payment_method: method,
                        amount_paid: method === 'Credit' ? '0' : f.amount_paid,
                      }));
                    }}
                    className="mt-1 w-full border border-red-900/50 rounded-lg px-2.5 py-1.5 bg-black text-white text-sm"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                    <option value="Card">Card</option>
                    <option value="Credit">Credit (later)</option>
                  </select>
                </label>
                <label className="block text-xs text-red-200">
                  Total amount *
                  <input
                    type="text"
                    inputMode="decimal"
                    value={billForm.total_amount}
                    onChange={(e) => setBillForm((f) => ({ ...f, total_amount: e.target.value.replace(/[^0-9.]/g, '') }))}
                    placeholder={itemsTotal > 0 ? `From items: ${itemsTotal}` : 'e.g. 12000'}
                    className="mt-1 w-full border border-red-900/50 rounded-lg px-2.5 py-1.5 bg-black text-white text-sm placeholder-red-400/50"
                  />
                </label>
                <label className="block text-xs text-red-200">
                  Paid now
                  <input
                    type="text"
                    inputMode="decimal"
                    value={billForm.amount_paid}
                    onChange={(e) => setBillForm((f) => ({ ...f, amount_paid: e.target.value.replace(/[^0-9.]/g, '') }))}
                    placeholder={billForm.payment_method === 'Credit' ? '0' : 'Empty = full'}
                    className="mt-1 w-full border border-red-900/50 rounded-lg px-2.5 py-1.5 bg-black text-white text-sm placeholder-red-400/50"
                  />
                </label>
                <label className="block text-xs text-red-200 col-span-2 sm:col-span-3">
                  Notes
                  <input
                    value={billForm.notes}
                    onChange={(e) => setBillForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1 w-full border border-red-900/50 rounded-lg px-2.5 py-1.5 bg-black text-white text-sm placeholder-red-400/50"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-dashed border-red-800/60 bg-black/40 px-3 py-2 flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-red-200">Upload bill</p>
                  <p className="text-[11px] text-red-300/60">Optional · JPEG, PNG, PDF · max 5 MB</p>
                </div>
                <label className="shrink-0 cursor-pointer rounded-lg bg-red-600 hover:bg-red-500 px-3 py-1.5 text-xs text-white">
                  Choose file
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,application/pdf,.pdf"
                    onChange={(e) => void onPickAttachment(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                </label>
                {(attachment || existingAttachmentName) && (
                  <p className="w-full text-xs text-emerald-300 truncate">
                    {attachment ? attachment.name : existingAttachmentName}
                    {attachment && (
                      <button type="button" onClick={() => setAttachment(null)} className="ml-2 text-red-300 hover:text-red-200">Clear</button>
                    )}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-red-950/40 bg-black/30 px-3 py-2">
                <div className="flex justify-between items-center gap-2 mb-1.5">
                  <div>
                    <h4 className="text-xs font-medium text-white">Items bought</h4>
                    <p className="text-[11px] text-red-300/60">Optional if the bill file has the details</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBillLines((rows) => [...rows, emptyLine()])}
                    className="shrink-0 text-xs text-emerald-300 hover:text-emerald-200"
                  >
                    + Line
                  </button>
                </div>
                {billLines.length === 0 ? (
                  <p className="text-xs text-red-300/50 py-1">No lines — click + Line only if you want to type items.</p>
                ) : (
                  <div className="space-y-1.5">
                    {billLines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-[minmax(0,1.4fr)_3.5rem_3.5rem_4.5rem_1.75rem] gap-1.5 items-center">
                        <input
                          value={line.item_name}
                          onChange={(e) => setBillLines((rows) => rows.map((r, i) => (i === idx ? { ...r, item_name: e.target.value } : r)))}
                          placeholder="Item"
                          className="min-w-0 border border-red-900/50 rounded-md px-2 py-1 bg-black text-white text-xs placeholder-red-400/50"
                        />
                        <input
                          value={line.quantity}
                          onChange={(e) => setBillLines((rows) => rows.map((r, i) => (i === idx ? { ...r, quantity: e.target.value.replace(/[^0-9.]/g, '') } : r)))}
                          placeholder="Qty"
                          className="min-w-0 border border-red-900/50 rounded-md px-1.5 py-1 bg-black text-white text-xs"
                        />
                        <input
                          value={line.unit}
                          onChange={(e) => setBillLines((rows) => rows.map((r, i) => (i === idx ? { ...r, unit: e.target.value } : r)))}
                          placeholder="Unit"
                          className="min-w-0 border border-red-900/50 rounded-md px-1.5 py-1 bg-black text-white text-xs placeholder-red-400/50"
                        />
                        <input
                          value={line.unit_price}
                          onChange={(e) => setBillLines((rows) => rows.map((r, i) => (i === idx ? { ...r, unit_price: e.target.value.replace(/[^0-9.]/g, '') } : r)))}
                          placeholder="Price"
                          className="min-w-0 border border-red-900/50 rounded-md px-1.5 py-1 bg-black text-white text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setBillLines((rows) => rows.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 text-sm"
                          aria-label="Remove line"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-red-950/50 px-4 py-3 bg-neutral-950/95 space-y-2">
              {billModal === 'add' && billForm.payment_method !== 'Credit' && (
                <label className="flex items-start gap-2.5 text-sm text-amber-100 cursor-pointer rounded-lg border border-amber-700/40 bg-amber-950/25 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={fromCollectionOnSave}
                    onChange={(e) => setFromCollectionOnSave(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-500"
                  />
                  <span>
                    <span className="font-medium text-amber-50">Decrease from day collection</span>
                    <span className="block text-xs text-amber-100/80 mt-0.5">
                      Checked: paid amount is taken from today’s collection and added to expenses (money box goes down).
                      Unchecked: save the bill only — cash/bank collection stays the same.
                    </span>
                  </span>
                </label>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="text-white">
                    Total <span className="font-semibold">{money(billTotal)}</span>
                    {billForm.total_amount.trim() === '' && itemsTotal > 0 ? (
                      <span className="text-red-300/60"> (items)</span>
                    ) : null}
                  </span>
                  <span className="text-emerald-200">Paid <span className="font-semibold">{money(paidNow)}</span></span>
                  <span className={balanceNow > 0 ? 'text-amber-300' : 'text-red-200'}>
                    Balance <span className="font-semibold">{money(balanceNow)}</span>
                  </span>
                </div>
                <div className="flex gap-2 ml-auto">
                  <button type="button" onClick={() => setBillModal(null)} className="px-3.5 py-1.5 rounded-lg bg-red-950/60 text-red-200 text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingBill} className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50">
                    {savingBill ? 'Saving…' : 'Save bill'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
