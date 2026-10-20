import { FormEvent, useEffect, useMemo, useState } from 'react';
import Header from '../components/layout/Header';
import { api } from '../api/client';
import { requestAdminPermission } from '../components/admin/AdminPermission';
import type {
  BranchWorkDirection,
  BranchWorkEntry,
  BranchWorkMonth,
  BranchWorkStatus,
  ShopBranch,
} from '../types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function money(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  if (!d) return '—';
  try {
    return new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

const fieldClass =
  'mt-1 w-full border border-red-800/70 rounded-lg px-3 py-2 bg-black text-white text-sm placeholder-red-200/50 focus:outline-none focus:ring-2 focus:ring-red-500/70';

const emptyForm = {
  work_date: today(),
  direction: 'for_them' as BranchWorkDirection,
  branch_id: '',
  branch_name: '',
  description: '',
  amount: '',
  note: '',
};

export default function BranchWork() {
  const [month, setMonth] = useState(currentMonth);
  const [statusFilter, setStatusFilter] = useState<'all' | BranchWorkStatus>('open');
  const [branchFilter, setBranchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<BranchWorkMonth | null>(null);
  const [branches, setBranches] = useState<ShopBranch[]>([]);
  const [thisBranch, setThisBranch] = useState('This shop');

  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadBranches = async () => {
    try {
      const [branchRows, settings] = await Promise.all([
        api.branches.list(),
        api.settings.get().catch(() => null),
      ]);
      setBranches(Array.isArray(branchRows) ? branchRows : []);
      if (settings?.branch_name) setThisBranch(settings.branch_name.trim() || 'This shop');
    } catch {
      /* keep previous branch list */
    }
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { month };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (branchFilter) params.branch = branchFilter;
      if (search.trim()) params.q = search.trim();
      const [monthData] = await Promise.all([
        api.branchWork.list(params),
        loadBranches(),
      ]);
      setData(monthData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, statusFilter, branchFilter]);

  const entries = data?.entries || [];
  const summary = data?.summary;

  const branchOptions = useMemo(() => {
    const names = new Set<string>(branches.map((b) => b.name));
    for (const e of entries) if (e.branch_name) names.add(e.branch_name);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [branches, entries]);

  const openAdd = () => {
    setEditingId(null);
    setError('');
    setForm({ ...emptyForm, work_date: today() });
    setModal('add');
    void loadBranches();
  };

  const openEdit = (entry: BranchWorkEntry) => {
    setEditingId(entry.id);
    setError('');
    setForm({
      work_date: entry.work_date.slice(0, 10),
      direction: entry.direction,
      branch_id: entry.branch_id != null ? String(entry.branch_id) : '',
      branch_name: entry.branch_name || '',
      description: entry.description || '',
      amount: String(entry.amount ?? ''),
      note: entry.note || '',
    });
    setModal('edit');
    void loadBranches();
  };

  const normalizeWorkDate = (raw: string) => {
    const s = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmy) {
      return `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`;
    }
    return today();
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const description = form.description.trim();
    if (!description) {
      setError('Enter what work was done');
      return;
    }
    const amount = parseFloat(String(form.amount).replace(/,/g, ''));
    if (!(amount > 0)) {
      setError('Enter a valid amount');
      return;
    }
    const branchId = form.branch_id ? Number(form.branch_id) : null;
    const branchName = form.branch_name.trim();
    if ((!branchId || Number.isNaN(branchId)) && !branchName) {
      setError('Select the other branch');
      return;
    }
    const workDate = normalizeWorkDate(form.work_date);
    setSaving(true);
    setError('');
    try {
      const payload = {
        work_date: workDate,
        direction: form.direction,
        branch_id: branchId && !Number.isNaN(branchId) ? branchId : null,
        branch_name: branchName,
        description,
        amount,
        note: form.note.trim(),
      };
      if (modal === 'edit' && editingId != null) {
        await api.branchWork.update(editingId, payload);
      } else {
        await api.branchWork.create(payload);
      }
      setModal(null);
      setError('');
      await load(true);
    } catch (err) {
      const msg = (err as Error).message || 'Could not save';
      setError(
        /not found/i.test(msg)
          ? 'Save failed: server needs a full restart (close the app, then open again).'
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  const settleOne = async (entry: BranchWorkEntry) => {
    if (!window.confirm(`Mark settled: ${entry.description} (${money(entry.amount)})?`)) return;
    try {
      await api.branchWork.settle(entry.id, {
        settled_on: today(),
        settlement_note: `Settled ${today()}`,
      });
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const settleBranch = async (branchName: string) => {
    const ok = await requestAdminPermission();
    if (!ok) return;
    if (!window.confirm(`Settle all open entries for "${branchName}" in ${month}?`)) return;
    try {
      await api.branchWork.settleBranch({
        branch_name: branchName,
        month,
        settled_on: today(),
        settlement_note: `Month settle ${month}`,
      });
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const reopen = async (entry: BranchWorkEntry) => {
    const ok = await requestAdminPermission();
    if (!ok) return;
    try {
      await api.branchWork.reopen(entry.id);
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (entry: BranchWorkEntry) => {
    const ok = await requestAdminPermission();
    if (!ok) return;
    if (!window.confirm(`Delete this entry?\n${entry.description}`)) return;
    try {
      await api.branchWork.delete(entry.id);
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const pickBranch = (b: ShopBranch) => {
    setForm((f) => ({ ...f, branch_id: String(b.id), branch_name: b.name }));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <Header title="Branch accounts" />
      <div className="p-4 sm:p-6 w-full flex-1 flex flex-col min-h-0 gap-4">
        <div className="bg-black/90 border border-red-950/60 rounded-xl shadow-xl p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-sm text-white leading-relaxed">
              Record work done between <span className="font-semibold text-red-200">{thisBranch}</span> and other
              branches (banner print, finishing, etc.) with the cost amount.
            </p>
            <p className="text-xs text-amber-200/90 mt-1.5 leading-relaxed">
              This is not shop profit or income. Use it only to compare branch accounts at month-end and settle
              money between branches.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/80 text-red-100 rounded-lg border border-red-800 text-sm flex justify-between gap-2">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} className="text-white shrink-0">✕</button>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-white">
              Month
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-xs font-medium text-white">
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | BranchWorkStatus)}
                className={fieldClass}
              >
                <option value="open">Open (not settled)</option>
                <option value="settled">Settled</option>
                <option value="all">All</option>
              </select>
            </label>
            <label className="text-xs font-medium text-white">
              Branch
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className={fieldClass}
              >
                <option value="">All branches</option>
                {branchOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-white flex-1 min-w-[10rem]">
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void load();
                }}
                placeholder="Work details…"
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="px-3 py-2 rounded-lg bg-red-950/70 text-white text-sm border border-red-900/50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500"
            >
              + Add work
            </button>
          </div>

          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-emerald-200/80">They owe us</p>
                <p className="text-lg font-semibold text-white mt-0.5">{money(summary.they_owe_us)}</p>
                <p className="text-[11px] text-white/50 mt-1">Work we did for other branches</p>
              </div>
              <div className="rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-amber-200/80">We owe them</p>
                <p className="text-lg font-semibold text-white mt-0.5">{money(summary.we_owe_them)}</p>
                <p className="text-[11px] text-white/50 mt-1">Work they did for this shop</p>
              </div>
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-red-200/80">Net (open)</p>
                <p className="text-lg font-semibold text-white mt-0.5">
                  {summary.net >= 0 ? '+' : ''}{money(summary.net)}
                </p>
                <p className="text-[11px] text-white/50 mt-1">{summary.open_count} open entr{summary.open_count === 1 ? 'y' : 'ies'}</p>
              </div>
            </div>
          )}

          {summary && summary.branches.length > 0 && (
            <div className="rounded-lg border border-red-950/50 overflow-hidden">
              <div className="px-3 py-2 bg-red-950/40 border-b border-red-950/50">
                <p className="text-xs font-semibold text-white uppercase tracking-wide">By branch (open)</p>
              </div>
              <ul className="divide-y divide-red-950/40">
                {summary.branches.map((b) => (
                  <li key={b.branch_name} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{b.branch_name}</p>
                      <p className="text-xs text-white/60">
                        They owe {money(b.they_owe_us)} · We owe {money(b.we_owe_them)} · Net{' '}
                        <span className={b.net >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                          {b.net >= 0 ? '+' : ''}{money(b.net)}
                        </span>
                      </p>
                    </div>
                    {b.open_count > 0 && (
                      <button
                        type="button"
                        onClick={() => void settleBranch(b.branch_name)}
                        className="px-2.5 py-1 rounded-md bg-emerald-800 text-white text-xs font-medium hover:bg-emerald-700"
                      >
                        Settle open
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-black/90 border border-red-950/60 rounded-xl shadow-xl p-4 sm:p-5 flex-1 min-h-0 flex flex-col">
          <h2 className="text-sm font-semibold text-white mb-3">Work entries — {month}</h2>
          {loading ? (
            <p className="text-sm text-red-300/70 py-8 text-center">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-white/60 py-8 text-center">
              No entries for this filter. Add work when you print or finish jobs for another branch.
            </p>
          ) : (
            <ul className="space-y-2 overflow-y-auto min-h-0">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-red-950/50 bg-red-950/20 px-3 py-3 flex flex-wrap gap-3 items-start"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          entry.direction === 'for_them'
                            ? 'bg-emerald-900/70 text-emerald-100'
                            : 'bg-amber-900/70 text-amber-100'
                        }`}
                      >
                        {entry.direction === 'for_them' ? 'We did for them' : 'They did for us'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          entry.status === 'open'
                            ? 'bg-red-800/80 text-white'
                            : 'bg-neutral-700 text-white/80'
                        }`}
                      >
                        {entry.status}
                      </span>
                      <span className="text-xs text-white/55">{formatDate(entry.work_date)}</span>
                    </div>
                    <p className="text-sm font-medium text-white">{entry.description}</p>
                    <p className="text-xs text-red-200/90 mt-0.5">
                      Branch: {entry.branch_name}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </p>
                    {entry.status === 'settled' && entry.settled_on && (
                      <p className="text-[11px] text-emerald-300/80 mt-1">
                        Settled {formatDate(entry.settled_on)}
                        {entry.settlement_note ? ` — ${entry.settlement_note}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-semibold text-white tabular-nums">{money(entry.amount)}</p>
                    <div className="flex flex-wrap justify-end gap-1.5 mt-2">
                      {entry.status === 'open' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(entry)}
                            className="px-2 py-1 rounded text-xs text-white/90 hover:bg-red-950/60"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void settleOne(entry)}
                            className="px-2 py-1 rounded text-xs bg-emerald-800 text-white hover:bg-emerald-700"
                          >
                            Settle
                          </button>
                        </>
                      )}
                      {entry.status === 'settled' && (
                        <button
                          type="button"
                          onClick={() => void reopen(entry)}
                          className="px-2 py-1 rounded text-xs text-amber-200 hover:bg-red-950/60"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void remove(entry)}
                        className="px-2 py-1 rounded text-xs text-red-300 hover:bg-red-950/60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <form
            onSubmit={save}
            className="bg-neutral-950 border border-red-950/60 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[min(92vh,720px)]"
          >
            <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {modal === 'add' ? 'Add branch work' : 'Edit branch work'}
                </h3>
                <p className="text-[11px] text-white/55 mt-0.5">
                  Not shop income — only for month-end branch settle.
                </p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="text-white hover:text-red-200 text-lg leading-none">✕</button>
            </div>

            <div className="px-4 pb-3 space-y-2.5 overflow-y-auto min-h-0 flex-1">
              {error && (
                <div className="p-2 rounded-lg bg-red-950/90 border border-red-700 text-red-100 text-sm">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-white">
                  Date
                  <input
                    type="date"
                    value={form.work_date}
                    onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-xs font-medium text-white">
                  Amount (Rs) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className={fieldClass}
                  />
                </label>
              </div>

              <div>
                <p className="text-xs font-medium text-white mb-1">Who did the work?</p>
                <div className="flex rounded-lg border border-red-800/70 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, direction: 'for_them' }))}
                    className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-semibold ${
                      form.direction === 'for_them'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-black text-white/65'
                    }`}
                  >
                    We did for them
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, direction: 'for_us' }))}
                    className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-semibold ${
                      form.direction === 'for_us'
                        ? 'bg-amber-700 text-white'
                        : 'bg-black text-white/65'
                    }`}
                  >
                    They did for us
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-medium text-white">Other branch *</p>
                  <button
                    type="button"
                    onClick={() => void loadBranches()}
                    className="text-[11px] text-red-200 hover:text-white"
                  >
                    Refresh list
                  </button>
                </div>
                {branches.length === 0 ? (
                  <p className="text-xs text-amber-200/90 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2">
                    No branches loaded. Add them in Stock → Shop branches, then tap Refresh list — or type the name below.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto rounded-lg border border-red-900/40 bg-black p-2">
                    {branches.map((b) => {
                      const selected = form.branch_id === String(b.id) || form.branch_name.toLowerCase() === b.name.toLowerCase();
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => pickBranch(b)}
                          className={`rounded-md px-2.5 py-1.5 text-left text-xs font-medium border transition-colors ${
                            selected
                              ? 'bg-red-600 border-red-500 text-white'
                              : 'bg-neutral-950 border-red-900/50 text-white hover:bg-red-950/60'
                          }`}
                        >
                          <span className="block">{b.name}</span>
                          {(b.place || b.phone) && (
                            <span className="block text-[10px] font-normal text-white/55 mt-0.5">
                              {[b.place, b.phone].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <input
                  value={form.branch_name}
                  onChange={(e) => setForm((f) => ({ ...f, branch_name: e.target.value, branch_id: '' }))}
                  placeholder="Or type a branch name…"
                  className={`${fieldClass} mt-1.5`}
                />
              </div>

              <label className="block text-xs font-medium text-white">
                Work details *
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Banner print 10×5, flex, finishing…"
                  className={fieldClass}
                />
              </label>

              <label className="block text-xs font-medium text-white">
                Note
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Optional"
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-red-950/50 shrink-0 bg-neutral-950 rounded-b-2xl">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-red-950/70 text-white text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
