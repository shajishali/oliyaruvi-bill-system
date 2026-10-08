import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { Bill } from '../../types';
import PayBalanceModal from './PayBalanceModal';
import { requestAdminPermission } from '../admin/AdminPermission';

interface BillListProps {
  onPrint: (bill: Bill) => void;
  onEdit?: (bill: Bill) => void;
  onBillUpdated?: () => void;
  updatedBill?: Bill | null;
}

interface SearchState {
  number: string;
  customer: string;
  phone: string;
  from: string;
  to: string;
  pending_settlement: string;
}

function amountDue(bill: Bill) {
  return (parseFloat(String(bill.total)) || 0) - (bill.amount_paid ?? 0);
}

function dueFirst(rows: Bill[]) {
  return [...rows].sort((a, b) => {
    const aDue = amountDue(a) > 0.009 ? 0 : 1;
    const bDue = amountDue(b) > 0.009 ? 0 : 1;
    return aDue - bDue;
  }).slice(0, 8);
}

function BillMatchList({ bills, onPick, phoneFirst = false }: { bills: Bill[]; onPick: (bill: Bill) => void; phoneFirst?: boolean }) {
  return (
    <ul className="absolute top-full left-0 z-30 mt-1 w-72 border border-red-900/50 rounded-lg bg-black/95 shadow-lg max-h-52 overflow-auto">
      {bills.map((bill) => {
        const due = amountDue(bill);
        return (
          <li key={bill.id}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(bill)}
              className="w-full text-left px-3 py-2 hover:bg-red-950/50"
            >
              <span className="text-sm text-white font-medium">{phoneFirst ? (bill.customer_phone || 'No phone') : bill.customer_name}</span>
              <span className="ml-2 text-sm text-red-300/75">{phoneFirst ? bill.customer_name : bill.customer_phone}</span>
              <span className="block text-xs text-red-200/70">
                {bill.bill_number} · {bill.bill_date} · {due > 0.009 ? `Due Rs.${due.toFixed(2)}` : 'Paid'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function getPaymentStatus(b: Bill): 'paid' | 'partial' | 'pending' {
  const paid = b.amount_paid ?? 0;
  const total = parseFloat(String(b.total)) || 0;
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}

export default function BillList({ onPrint, onEdit, onBillUpdated, updatedBill }: BillListProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [viewingBillId, setViewingBillId] = useState<number | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);
  const [payBalanceBill, setPayBalanceBill] = useState<Bill | null>(null);
  const [markingPaidIds, setMarkingPaidIds] = useState<Set<number>>(new Set());
  const [markingAllPaid, setMarkingAllPaid] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState<SearchState>({ number: '', customer: '', phone: '', from: '', to: '', pending_settlement: '' });
  const [nameHits, setNameHits] = useState<Bill[]>([]);
  const [phoneHits, setPhoneHits] = useState<Bill[]>([]);
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);

  const fetchBills = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (search.number) params.number = search.number;
    if (search.customer) params.customer = search.customer;
    if (search.phone) params.phone = search.phone;
    if (search.from) params.from = search.from;
    if (search.to) params.to = search.to;
    if (search.pending_settlement === '1') params.pending_settlement = 'true';
    api.bills
      .list(params)
      .then(setBills)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBills();
  }, []);

  useEffect(() => {
    if (!updatedBill) return;
    setBills((prev) => prev.map((b) => (b.id === updatedBill.id ? { ...b, ...updatedBill } : b)));
  }, [updatedBill]);

  useEffect(() => {
    const q = search.customer.trim();
    if (q.length < 1) {
      setNameHits([]);
      return;
    }
    const timer = setTimeout(() => {
      api.bills.list({ customer: q }).then((rows) => setNameHits(dueFirst(rows))).catch(() => setNameHits([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [search.customer]);

  useEffect(() => {
    const q = search.phone.trim();
    if (q.length < 1) {
      setPhoneHits([]);
      return;
    }
    const timer = setTimeout(() => {
      api.bills.list({ phone: q }).then((rows) => setPhoneHits(dueFirst(rows))).catch(() => setPhoneHits([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [search.phone]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    const params: Record<string, string> = {};
    if (search.number) params.number = search.number;
    if (search.customer) params.customer = search.customer;
    if (search.phone) params.phone = search.phone;
    if (search.from) params.from = search.from;
    if (search.to) params.to = search.to;
    if (search.pending_settlement === '1') params.pending_settlement = 'true';
    api.bills.list(params).then(setBills).finally(() => setSearching(false));
  };

  const viewBill = async (id: number) => {
    if (viewingBillId) return;
    setViewingBillId(id);
    try {
      const bill = await api.bills.get(id);
      onPrint(bill);
    } finally {
      setViewingBillId(null);
    }
  };

  const editBill = async (id: number) => {
    if (loadingEditId) return;
    setLoadingEditId(id);
    try {
      const bill = await api.bills.get(id);
      onEdit?.(bill);
    } finally {
      setLoadingEditId(null);
    }
  };

  const handleBalancePaid = (updated: Bill) => {
    setBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setMarkingPaidIds((prev) => { const s = new Set(prev); s.delete(updated.id); return s; });
    onBillUpdated?.();
    onPrint(updated);
  };

  const markAsPaid = async (bill: Bill) => {
    const total = parseFloat(String(bill.total)) || 0;
    const paid = bill.amount_paid ?? 0;
    const balance = total - paid;
    if (balance <= 0) return;
    setMarkingPaidIds((prev) => new Set(prev).add(bill.id));
    try {
      const updated = await api.bills.payBalance(bill.id, balance, (bill.payment_method as 'Cash' | 'Bank') || 'Cash');
      setBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      onBillUpdated?.();
    } finally {
      setMarkingPaidIds((prev) => { const s = new Set(prev); s.delete(bill.id); return s; });
    }
  };

  const markAllAsPaid = async () => {
    const pending = bills.filter((b) => getPaymentStatus(b) !== 'paid');
    if (pending.length === 0) return;
    setMarkingAllPaid(true);
    try {
      for (const bill of pending) {
        const total = parseFloat(String(bill.total)) || 0;
        const paid = bill.amount_paid ?? 0;
        const balance = total - paid;
        if (balance > 0) {
          await api.bills.payBalance(bill.id, balance, (bill.payment_method as 'Cash' | 'Bank') || 'Cash');
        }
      }
      const params: Record<string, string> = {};
      if (search.number) params.number = search.number;
      if (search.customer) params.customer = search.customer;
      if (search.phone) params.phone = search.phone;
      if (search.from) params.from = search.from;
      if (search.to) params.to = search.to;
      if (search.pending_settlement === '1') params.pending_settlement = 'true';
      const refreshed = await api.bills.list(params);
      setBills(refreshed);
      onBillUpdated?.();
    } finally {
      setMarkingAllPaid(false);
    }
  };

  const deleteBill = async (bill: Bill) => {
    if (!(await requestAdminPermission())) return;
    if (!window.confirm(`Delete ${bill.bill_number}? This will rollback stock and payments.`)) return;
    setDeletingIds((prev) => new Set(prev).add(bill.id));
    try {
      await api.bills.delete(bill.id);
      setBills((prev) => prev.filter((b) => b.id !== bill.id));
      onBillUpdated?.();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setDeletingIds((prev) => {
        const s = new Set(prev);
        s.delete(bill.id);
        return s;
      });
    }
  };

  return (
    <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 p-6">
      <p className="text-sm text-red-300/75 mb-1">Deleting a bill needs admin permission.</p>
      <p className="text-sm text-red-300/75 mb-4">Type a name or mobile number and click the matching bill to open it and take the balance.</p>
      <form onSubmit={handleSearch} className={`flex flex-wrap gap-4 mb-6 items-center ${nameMenuOpen || phoneMenuOpen ? 'relative z-30' : ''}`}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={search.pending_settlement === '1'}
            onChange={(e) => setSearch((s) => ({ ...s, pending_settlement: e.target.checked ? '1' : '' }))}
            className="rounded border-red-900/50"
          />
          <span className="text-sm text-red-200/90">Pending advance settlement only</span>
        </label>
        <input
          type="text"
          placeholder="Bill number"
          value={search.number}
          onChange={(e) => setSearch((s) => ({ ...s, number: e.target.value }))}
          className="border border-red-900/50 rounded px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
        />
        <div className={nameMenuOpen && nameHits.length > 0 ? 'relative z-30' : 'relative'}>
          <input
            type="text"
            placeholder="Customer name"
            value={search.customer}
            onFocus={() => setNameMenuOpen(true)}
            onBlur={() => setTimeout(() => setNameMenuOpen(false), 150)}
            onChange={(e) => {
              setSearch((s) => ({ ...s, customer: e.target.value }));
              setNameMenuOpen(true);
            }}
            className="border border-red-900/50 rounded px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
          />
          {nameMenuOpen && nameHits.length > 0 && (
            <BillMatchList bills={nameHits} onPick={(bill) => { setNameMenuOpen(false); viewBill(bill.id); }} />
          )}
        </div>
        <div className={phoneMenuOpen && phoneHits.length > 0 ? 'relative z-30' : 'relative'}>
          <input
            type="tel"
            inputMode="tel"
            placeholder="Mobile number"
            value={search.phone}
            onFocus={() => setPhoneMenuOpen(true)}
            onBlur={() => setTimeout(() => setPhoneMenuOpen(false), 150)}
            onChange={(e) => {
              setSearch((s) => ({ ...s, phone: e.target.value.replace(/[^0-9+ -]/g, '') }));
              setPhoneMenuOpen(true);
            }}
            className="border border-red-900/50 rounded px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
          />
          {phoneMenuOpen && phoneHits.length > 0 && (
            <BillMatchList bills={phoneHits} phoneFirst onPick={(bill) => { setPhoneMenuOpen(false); viewBill(bill.id); }} />
          )}
        </div>
        <input
          type="date"
          placeholder="From"
          value={search.from}
          onChange={(e) => setSearch((s) => ({ ...s, from: e.target.value }))}
          className="border border-red-900/50 rounded px-3 py-2 bg-black/60 text-white"
        />
        <input
          type="date"
          placeholder="To"
          value={search.to}
          onChange={(e) => setSearch((s) => ({ ...s, to: e.target.value }))}
          className="border border-red-900/50 rounded px-3 py-2 bg-black/60 text-white"
        />
        <button type="submit" disabled={searching} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
          {searching ? 'Searching...' : 'Search'}
        </button>
        {!loading && bills.some((b) => getPaymentStatus(b) !== 'paid') && (
          <button
            type="button"
            onClick={markAllAsPaid}
            disabled={markingAllPaid}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {markingAllPaid ? 'Marking...' : 'Mark all as paid'}
          </button>
        )}
      </form>

      {loading ? (
        <p className="text-red-300/70">Loading...</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-red-950/50">
              <th className="text-left p-2 border border-red-950/50 text-red-200">Bill #</th>
              <th className="text-left p-2 border border-red-950/50 text-red-200">Date</th>
              <th className="text-left p-2 border border-red-950/50 text-red-200">Customer</th>
              <th className="text-left p-2 border border-red-950/50 text-red-200">Counter</th>
              <th className="text-left p-2 border border-red-950/50 text-red-200">Mobile</th>
              <th className="text-right p-2 border border-red-950/50 text-red-200">Total</th>
              <th className="text-left p-2 border border-red-950/50 text-red-200">
                Status
                <span className="ml-1 text-red-400/70 cursor-help" title="Paid = full amount received. Pending = no payment or advance with balance due.">ⓘ</span>
              </th>
              <th className="text-left p-2 border border-red-950/50 text-red-200">Payment</th>
              <th className="p-2 border border-red-950/50 text-red-200 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => {
              const status = getPaymentStatus(b);
              const paid = b.amount_paid ?? 0;
              const total = parseFloat(String(b.total)) || 0;
              const balance = total - paid;
              return (
              <tr key={b.id} className={`hover:bg-red-950/30 border-b border-red-950/40 ${status === 'partial' ? 'bg-amber-950/20' : ''}`}>
                <td className="p-2 border border-red-950/40 text-white">{b.bill_number}</td>
                <td className="p-2 border border-red-950/40 text-red-200/90">{b.bill_date}</td>
                <td className="p-2 border border-red-950/40">
                  <button type="button" onClick={() => viewBill(b.id)} className="text-white hover:underline text-left">{b.customer_name}</button>
                </td>
                <td className="p-2 border border-red-950/40 text-red-200/90">{b.counter_staff_name || '—'}</td>
                <td className="p-2 border border-red-950/40">
                  {b.customer_phone ? (
                    <button type="button" onClick={() => viewBill(b.id)} className="text-red-200/90 hover:underline text-left">{b.customer_phone}</button>
                  ) : (
                    <span className="text-red-200/90">-</span>
                  )}
                </td>
                <td className="p-2 border border-red-950/40 text-right text-white">Rs.{total.toFixed(2)}</td>
                <td className="p-2 border border-red-950/40">
                  {status === 'paid' && <span className="text-emerald-400 text-sm">Paid</span>}
                  {status === 'partial' && <span className="text-red-300/80 text-sm" title={`Advance: Rs.${paid.toFixed(2)} | Balance: Rs.${balance.toFixed(2)}`}>Pending – Rs.{balance.toFixed(2)} due</span>}
                  {status === 'pending' && <span className="text-red-300/80 text-sm" title={`Balance: Rs.${balance.toFixed(2)}`}>Pending – Rs.{balance.toFixed(2)} due</span>}
                </td>
                <td className="p-2 border border-red-950/40 text-red-200/90">{b.payment_method}</td>
                <td className="p-2 border border-red-950/40 text-center">
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {status !== 'paid' && (
                      <button
                        type="button"
                        onClick={() => status === 'partial' ? setPayBalanceBill(b) : markAsPaid(b)}
                        disabled={markingPaidIds.has(b.id)}
                        className={`px-3 py-1 rounded text-sm font-medium ${status === 'partial' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {status === 'partial' ? 'Pay balance' : markingPaidIds.has(b.id) ? '...' : 'Mark as paid'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => viewBill(b.id)}
                      disabled={viewingBillId === b.id}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {viewingBillId === b.id ? 'Loading...' : 'View / Print'}
                    </button>
                    <button
                      type="button"
                      onClick={() => editBill(b.id)}
                      disabled={loadingEditId === b.id}
                      className="px-3 py-1 bg-red-950/60 text-red-200 rounded text-sm hover:bg-red-900/70 disabled:opacity-50 disabled:cursor-not-allowed border border-red-900/50"
                    >
                      {loadingEditId === b.id ? 'Loading...' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBill(b)}
                      disabled={deletingIds.has(b.id)}
                      className="px-3 py-1 bg-red-950/60 text-red-200 rounded text-sm hover:bg-red-900/70 disabled:opacity-50 disabled:cursor-not-allowed border border-red-900/50"
                    >
                      {deletingIds.has(b.id) ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      )}
      {!loading && bills.length === 0 && (
        <p className="text-red-300/70 py-8 text-center">No bills found.</p>
      )}
      {payBalanceBill && (
        <PayBalanceModal
          bill={payBalanceBill}
          onClose={() => setPayBalanceBill(null)}
          onPaid={handleBalancePaid}
        />
      )}
    </div>
  );
}
