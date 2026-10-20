import { FormEvent, useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import { api } from '../api/client';
import { requestAdminPermission } from '../components/admin/AdminPermission';
import { emitNotificationsChanged } from '../utils/notificationEvents';
import type { ShopNote, ShopNoteMoneyDirection, ShopNoteType } from '../types';

const fieldClass =
  'mt-1 w-full border border-red-800/70 rounded-lg px-3 py-2 bg-black text-white text-sm placeholder-red-200/50 focus:outline-none focus:ring-2 focus:ring-red-500/70';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function money(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d?: string | null) {
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

const emptyForm = {
  note_type: 'plain' as ShopNoteType,
  title: '',
  body: '',
  remind_on: today(),
  money_direction: 'in' as ShopNoteMoneyDirection,
  amount: '',
  affect_collection: null as boolean | null,
  collection_date: today(),
};

export default function Notes() {
  const [notes, setNotes] = useState<ShopNote[]>([]);
  const [filter, setFilter] = useState<'all' | ShopNoteType>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.type = filter;
      if (search.trim()) params.q = search.trim();
      const rows = await api.notes.list(params);
      setNotes(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openAdd = () => {
    setEditingId(null);
    setError('');
    setForm({ ...emptyForm, remind_on: today(), collection_date: today() });
    setModal('add');
  };

  const openEdit = (n: ShopNote) => {
    setEditingId(n.id);
    setError('');
    setForm({
      note_type: n.note_type,
      title: n.title || '',
      body: n.body || '',
      remind_on: (n.remind_on || today()).slice(0, 10),
      money_direction: (n.money_direction as ShopNoteMoneyDirection) || 'in',
      amount: n.amount != null ? String(n.amount) : '',
      affect_collection: n.affect_collection ? true : n.note_type === 'money' ? false : null,
      collection_date: (n.collection_date || today()).slice(0, 10),
    });
    setModal('edit');
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title && !body) {
      setError('Enter a title or details');
      return;
    }
    if (form.note_type === 'reminder' && !form.remind_on) {
      setError('Pick the reminder date');
      return;
    }
    if (form.note_type === 'money') {
      const amount = parseFloat(String(form.amount).replace(/,/g, ''));
      if (!(amount > 0)) {
        setError('Enter a valid amount');
        return;
      }
      if (form.affect_collection === null) {
        setError('Choose Yes or No for day collection');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        note_type: form.note_type,
        title,
        body,
        remind_on: form.note_type === 'reminder' ? form.remind_on : null,
        money_direction: form.note_type === 'money' ? form.money_direction : null,
        amount: form.note_type === 'money' ? parseFloat(String(form.amount).replace(/,/g, '')) : null,
        affect_collection: form.note_type === 'money' ? !!form.affect_collection : false,
        collection_date: form.note_type === 'money' ? form.collection_date : null,
      };
      if (modal === 'edit' && editingId != null) {
        await api.notes.update(editingId, payload);
      } else {
        await api.notes.create(payload);
      }
      setModal(null);
      if (form.note_type === 'reminder') emitNotificationsChanged();
      await load(true);
    } catch (err) {
      const msg = (err as Error).message || 'Could not save';
      setError(/not found/i.test(msg)
        ? 'Save failed: restart the app so the Notes server route loads.'
        : msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n: ShopNote) => {
    const ok = await requestAdminPermission();
    if (!ok) return;
    if (!window.confirm(`Delete this note?\n${n.title || n.body || 'Note'}`)) return;
    try {
      await api.notes.delete(n.id);
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const typeLabel = (t: ShopNoteType) =>
    t === 'money' ? 'Money' : t === 'reminder' ? 'Reminder' : 'Info';

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <Header title="Notes" />
      <div className="p-4 sm:p-6 w-full flex-1 flex flex-col min-h-0 gap-4">
        <div className="bg-black/90 border border-red-950/60 rounded-xl shadow-xl p-4 sm:p-5 space-y-3">
          <p className="text-sm text-white leading-relaxed">
            Keep shop notes here: plain info, dated reminders (notifications start 3 days before), or money
            in/out for advances — with an optional change to day collection.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex rounded-lg border border-red-800/70 overflow-hidden">
              {([
                ['all', 'All'],
                ['plain', 'Info'],
                ['reminder', 'Reminders'],
                ['money', 'Money'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`px-3 py-2 text-xs font-semibold ${
                    filter === value ? 'bg-red-600 text-white' : 'bg-black text-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="text-xs font-medium text-white flex-1 min-w-[10rem]">
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void load();
                }}
                placeholder="Search notes…"
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
              + Add note
            </button>
          </div>
          {error && !modal && (
            <div className="p-3 bg-red-950/80 text-red-100 rounded-lg border border-red-800 text-sm flex justify-between gap-2">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} className="text-white shrink-0">✕</button>
            </div>
          )}
        </div>

        <div className="bg-black/90 border border-red-950/60 rounded-xl shadow-xl p-4 sm:p-5 flex-1 min-h-0 flex flex-col">
          {loading ? (
            <p className="text-sm text-red-300/70 py-8 text-center">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-white/60 py-8 text-center">No notes yet. Tap + Add note.</p>
          ) : (
            <ul className="space-y-2 overflow-y-auto min-h-0">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-red-950/50 bg-red-950/20 px-3 py-3 flex flex-wrap gap-3 items-start"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          n.note_type === 'money'
                            ? 'bg-emerald-900/70 text-emerald-100'
                            : n.note_type === 'reminder'
                              ? 'bg-amber-900/70 text-amber-100'
                              : 'bg-neutral-700 text-white/80'
                        }`}
                      >
                        {typeLabel(n.note_type)}
                      </span>
                      {n.note_type === 'reminder' && (
                        <span className="text-xs text-white/55">Due {formatDate(n.remind_on)}</span>
                      )}
                      {n.note_type === 'money' && (
                        <span className="text-xs text-white/55">
                          {n.money_direction === 'in' ? 'Money in' : 'Money out'}
                          {n.affect_collection ? ' · day collection changed' : ' · collection not changed'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white">{n.title || 'Untitled'}</p>
                    {n.body && <p className="text-xs text-red-100/90 mt-0.5 whitespace-pre-wrap">{n.body}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {n.note_type === 'money' && n.amount != null && (
                      <p className={`text-base font-semibold tabular-nums ${
                        n.money_direction === 'in' ? 'text-emerald-300' : 'text-amber-300'
                      }`}>
                        {n.money_direction === 'in' ? '+' : '−'}{money(n.amount)}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-1.5 mt-2">
                      <button type="button" onClick={() => openEdit(n)} className="px-2 py-1 rounded text-xs text-white/90 hover:bg-red-950/60">
                        Edit
                      </button>
                      <button type="button" onClick={() => void remove(n)} className="px-2 py-1 rounded text-xs text-red-300 hover:bg-red-950/60">
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
            className="bg-neutral-950 border border-red-950/60 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[min(92vh,740px)]"
          >
            <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {modal === 'add' ? 'Add note' : 'Edit note'}
                </h3>
                <p className="text-[11px] text-white/55 mt-0.5">
                  Info, reminder, or money — pick the type below.
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

              <div>
                <p className="text-xs font-medium text-white mb-1">Note type</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ['plain', 'Info only'],
                    ['reminder', 'Reminder'],
                    ['money', 'Money'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        note_type: value,
                        affect_collection: value === 'money' ? f.affect_collection : null,
                      }))}
                      className={`rounded-lg border px-2 py-2.5 text-xs font-semibold ${
                        form.note_type === value
                          ? 'border-red-500 bg-red-600 text-white'
                          : 'border-red-900/50 bg-black text-white/70'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-medium text-white">
                Title
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={
                    form.note_type === 'money'
                      ? 'e.g. Wedding advance — Kumar'
                      : form.note_type === 'reminder'
                        ? 'e.g. Deliver flex to temple'
                        : 'Short title'
                  }
                  className={fieldClass}
                />
              </label>

              <label className="block text-xs font-medium text-white">
                Details
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={2}
                  placeholder="Optional details…"
                  className={`${fieldClass} resize-none`}
                />
              </label>

              {form.note_type === 'reminder' && (
                <label className="block text-xs font-medium text-white">
                  Reminder date *
                  <input
                    type="date"
                    value={form.remind_on}
                    onChange={(e) => setForm((f) => ({ ...f, remind_on: e.target.value }))}
                    className={fieldClass}
                  />
                  <span className="mt-1 block text-[11px] text-amber-200/80">
                    Notifications start 3 days before this date and show each day until then.
                  </span>
                </label>
              )}

              {form.note_type === 'money' && (
                <>
                  <div>
                    <p className="text-xs font-medium text-white mb-1">Money movement *</p>
                    <div className="flex rounded-lg border border-red-800/70 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, money_direction: 'in' }))}
                        className={`flex-1 py-2.5 text-xs font-semibold ${
                          form.money_direction === 'in' ? 'bg-emerald-700 text-white' : 'bg-black text-white/65'
                        }`}
                      >
                        Money came in
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, money_direction: 'out' }))}
                        className={`flex-1 py-2.5 text-xs font-semibold ${
                          form.money_direction === 'out' ? 'bg-amber-700 text-white' : 'bg-black text-white/65'
                        }`}
                      >
                        Money went out
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
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
                    <label className="block text-xs font-medium text-white">
                      Collection date
                      <input
                        type="date"
                        value={form.collection_date}
                        onChange={(e) => setForm((f) => ({ ...f, collection_date: e.target.value }))}
                        className={fieldClass}
                      />
                    </label>
                  </div>

                  <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 space-y-2">
                    <p className="text-xs font-medium text-amber-100">
                      Change day collection for this amount?
                    </p>
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      {form.money_direction === 'in'
                        ? 'Yes = increase “Actual received” / money box (e.g. advance put in cash). No = note only.'
                        : 'Yes = decrease day collection (add as expense). No = note only — cashier kept the cash aside.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, affect_collection: true }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                          form.affect_collection === true
                            ? 'bg-emerald-700 border-emerald-500 text-white'
                            : 'bg-black border-red-900/50 text-white/70'
                        }`}
                      >
                        Yes, change collection
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, affect_collection: false }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                          form.affect_collection === false
                            ? 'bg-red-700 border-red-500 text-white'
                            : 'bg-black border-red-900/50 text-white/70'
                        }`}
                      >
                        No, note only
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-red-950/50 shrink-0 bg-neutral-950 rounded-b-2xl">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-red-950/70 text-white text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
