import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Header from '../components/layout/Header';
import { api } from '../api/client';
import type { Customer, Program, ProgramHistoryEntry } from '../types';
import { emitNotificationsChanged } from '../utils/notificationEvents';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

const fieldClass = 'mt-1 w-full border border-red-800/70 rounded-lg px-3 py-2 bg-black text-white text-sm placeholder-red-200/50 focus:outline-none focus:ring-2 focus:ring-red-500/70';

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTimeLabel(value: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return '';
  const h = Number(m[1]);
  const minute = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minute} ${ampm}`;
}

function formatDateLabel(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function normalizeTimeText(text: string) {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) return '';
  const apMatch = raw.match(/\b(am|pm)\b/);
  const ap = apMatch ? apMatch[1] : '';
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (!digits) return null;

  let h: number;
  let min: number;
  if (digits.length <= 2) {
    h = Number(digits);
    min = 0;
  } else if (digits.length === 3) {
    h = Number(digits.slice(0, 1));
    min = Number(digits.slice(1));
  } else {
    h = Number(digits.slice(0, 2));
    min = Number(digits.slice(2));
  }
  if (Number.isNaN(h) || Number.isNaN(min) || min > 59) return null;

  if (ap === 'pm' && h < 12) h += 12;
  else if (ap === 'am' && h === 12) h = 0;
  else if (!ap && h >= 0 && h <= 23) {
    // keep 24h as typed
  } else if (!ap && h > 23) {
    return null;
  }
  if (h < 0 || h > 23) return null;
  return `${pad(h)}:${pad(min)}`;
}

const CLOCK_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const CLOCK_MINUTES = Array.from({ length: 60 }, (_, i) => i);

function parseClockValue(value: string) {
  const n = normalizeTimeText(value);
  if (!n) return { hour12: 6, minute: 0, isPm: false, set: false };
  const h = Number(n.slice(0, 2));
  const minute = Number(n.slice(3, 5));
  return {
    hour12: h % 12 || 12,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
    isPm: h >= 12,
    set: true,
  };
}

function toClockValue(hour12: number, minute: number, isPm: boolean) {
  let h24 = hour12 % 12;
  if (isPm) h24 += 12;
  return `${pad(h24)}:${pad(minute)}`;
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const parsed = parseClockValue(value);
  const [open, setOpen] = useState(false);
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [isPm, setIsPm] = useState(parsed.isPm);
  const minuteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = parseClockValue(value);
    setHour12(next.hour12);
    setMinute(next.minute);
    setIsPm(next.isPm);
  }, [value]);

  useEffect(() => {
    if (!open || !minuteRef.current) return;
    const active = minuteRef.current.querySelector<HTMLButtonElement>(`[data-minute="${minute}"]`);
    active?.scrollIntoView({ block: 'center' });
  }, [open, minute]);

  const apply = (h: number, m: number, pm: boolean) => {
    setHour12(h);
    setMinute(m);
    setIsPm(pm);
    onChange(toClockValue(h, m, pm));
  };

  const panel = open ? (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/75 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-red-800/70 bg-neutral-950 p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-red-200/80">{label}</p>
            <p className="text-2xl font-semibold text-white tabular-nums">
              {hour12}:{pad(minute)} {isPm ? 'PM' : 'AM'}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="px-2.5 py-1.5 rounded-md text-xs text-white/80 hover:bg-red-950/60"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-md bg-red-600 text-xs font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>

        <div className="flex rounded-lg border border-red-800/70 overflow-hidden mb-3">
          <button
            type="button"
            onClick={() => apply(hour12, minute, false)}
            className={`flex-1 py-2.5 text-sm font-semibold ${
              !isPm ? 'bg-red-600 text-white' : 'bg-black text-white/70'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => apply(hour12, minute, true)}
            className={`flex-1 py-2.5 text-sm font-semibold ${
              isPm ? 'bg-red-600 text-white' : 'bg-black text-white/70'
            }`}
          >
            PM
          </button>
        </div>

        <p className="text-[11px] uppercase tracking-wide text-red-200/80 mb-1.5">Hour</p>
        <div className="grid grid-cols-6 gap-2 mb-3">
          {CLOCK_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => apply(h, minute, isPm)}
              className={`h-10 rounded-full text-sm font-semibold ${
                hour12 === h
                  ? 'bg-red-600 text-white'
                  : 'bg-black border border-red-900/50 text-white hover:bg-red-950/50'
              }`}
            >
              {h}
            </button>
          ))}
        </div>

        <p className="text-[11px] uppercase tracking-wide text-red-200/80 mb-1.5">Minutes (00–59)</p>
        <div
          ref={minuteRef}
          className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-red-900/40 p-2 bg-black"
        >
          {CLOCK_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              data-minute={m}
              onClick={() => apply(hour12, m, isPm)}
              className={`h-9 rounded-md text-xs font-semibold tabular-nums ${
                minute === m
                  ? 'bg-emerald-700 text-white'
                  : 'bg-neutral-950 border border-red-900/40 text-white hover:bg-red-950/50'
              }`}
            >
              {pad(m)}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="block text-xs font-medium text-white">
      {label}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${fieldClass} mt-1 flex items-center justify-between text-left`}
      >
        <span className={value ? 'text-white font-medium' : 'text-red-200/50'}>
          {value ? formatTimeLabel(value) : 'Tap to pick time'}
        </span>
        <span className="text-red-200 text-xs font-semibold">Clock</span>
      </button>
      {open ? createPortal(panel, document.body) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const text = String(value || '').trim();
  return (
    <div className="rounded-lg bg-red-950/25 border border-red-900/40 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-red-200/80 mb-0.5">{label}</p>
      <p className={`text-sm ${text ? 'text-white' : 'text-white/45'}`}>{text || '—'}</p>
    </div>
  );
}

function customerMatches(customer: Customer, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (customer.name || '').toLowerCase();
  const phone = (customer.phone || '').toLowerCase();
  const digits = q.replace(/\D/g, '');
  const phoneDigits = phone.replace(/\D/g, '');
  if (name.includes(q) || phone.includes(q)) return true;
  if (digits && phoneDigits.includes(digits)) return true;
  return false;
}

function suggestCustomers(list: Customer[], query: string) {
  const q = query.trim();
  return list
    .filter((c) => customerMatches(c, q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, q ? 12 : 30);
}

function CustomerSuggestField({
  label,
  value,
  placeholder,
  customers,
  onChange,
  onPick,
}: {
  label: string;
  value: string;
  placeholder: string;
  customers: Customer[];
  onChange: (value: string) => void;
  onPick: (c: Customer) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const suggestions = useMemo(() => suggestCustomers(customers, value), [customers, value]);

  const updateRect = () => {
    const el = inputRef.current;
    if (!el) return;
    setRect(el.getBoundingClientRect());
  };

  const openMenu = () => {
    updateRect();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updateRect();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <div className="block text-xs font-medium text-white">
      {label}
      <input
        ref={inputRef}
        value={value}
        onFocus={openMenu}
        onClick={openMenu}
        onChange={(e) => {
          onChange(e.target.value);
          openMenu();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder}
        className={fieldClass}
        autoComplete="off"
      />
      {open && rect && createPortal(
        <ul
          className="fixed z-[12050] max-h-56 overflow-y-auto rounded-lg border border-red-700 bg-black shadow-2xl"
          style={{
            top: Math.min(rect.bottom + 4, window.innerHeight - 240),
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)),
            width: Math.max(rect.width, 280),
          }}
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-white/70">
              {customers.length === 0 ? 'No saved customers yet — type a new name' : 'No match — keep typing new name'}
            </li>
          ) : (
            suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-red-950/80 border-b border-red-950/40 last:border-0"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-red-200/90">{c.phone || 'No phone'}</span>
                </button>
              </li>
            ))
          )}
        </ul>,
        document.body
      )}
    </div>
  );
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return monthKey(d);
}

function daysInMonthGrid(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, (m || 1) - 1, 1);
  const startPad = first.getDay(); // Sun=0
  const count = new Date(y, m || 1, 0).getDate();
  const cells: { iso: string | null; day: number | null }[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ iso: null, day: null });
  for (let day = 1; day <= count; day++) {
    cells.push({ iso: `${ym}-${pad(day)}`, day });
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null });
  return cells;
}

function programOnDay(p: Program, iso: string) {
  const start = p.event_date.slice(0, 10);
  const end = (p.end_date || p.event_date).slice(0, 10);
  return iso >= start && iso <= end;
}

function emptyForm(date = todayIso()) {
  return {
    program_type: '',
    location: '',
    customer_id: '' as string,
    customer_name: '',
    phone: '',
    event_date: date,
    end_date: date,
    event_time: '',
    end_time: '',
    notes: '',
  };
}

function formFromProgram(p: Program) {
  return {
    program_type: p.program_type || '',
    location: p.location || '',
    customer_id: p.customer_id != null ? String(p.customer_id) : '',
    customer_name: p.customer_name || '',
    phone: p.phone || '',
    event_date: p.event_date.slice(0, 10),
    end_date: (p.end_date || p.event_date).slice(0, 10),
    event_time: p.event_time || '',
    end_time: p.end_time || '',
    notes: p.notes || '',
  };
}

export default function Calendar() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [programs, setPrograms] = useState<Program[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [history, setHistory] = useState<ProgramHistoryEntry[]>([]);
  const [detailHistory, setDetailHistory] = useState<ProgramHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(todayIso());
  const loadSeq = useRef(0);
  const viewingId = useRef<number | null>(null);

  const load = async (ym = month) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    try {
      const [rows, hist] = await Promise.all([
        api.programs.list({ month: ym }),
        api.programs.monthHistory(ym).catch(() => [] as ProgramHistoryEntry[]),
      ]);
      if (seq !== loadSeq.current) return;
      setPrograms(rows);
      setHistory(hist);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError((err as Error).message);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load(month);
  }, [month]);

  // Preload customers so Add/Edit popup list opens instantly on click
  useEffect(() => {
    let alive = true;
    api.customers.list()
      .then((rows) => {
        if (alive) setCustomers(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (alive) setCustomers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const pickCustomer = (c: Customer) => {
    setForm((f) => ({
      ...f,
      customer_id: String(c.id),
      customer_name: c.name || '',
      phone: c.phone || '',
    }));
  };

  const cells = useMemo(() => daysInMonthGrid(month), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, Program[]>();
    for (const p of programs) {
      for (const cell of cells) {
        if (!cell.iso) continue;
        if (programOnDay(p, cell.iso)) {
          const list = map.get(cell.iso) || [];
          list.push(p);
          map.set(cell.iso, list);
        }
      }
    }
    return map;
  }, [programs, cells]);

  const dayPrograms = selectedDay ? byDay.get(selectedDay) || [] : [];

  const openAdd = (date?: string) => {
    const d = date || selectedDay || todayIso();
    setForm(emptyForm(d));
    setEditingId(null);
    setModal('add');
  };

  const openView = (p: Program) => {
    setError('');
    setForm(formFromProgram(p));
    setEditingId(p.id);
    viewingId.current = p.id;
    setDetailHistory([]);
    setModal('view');
    const id = p.id;
    void api.programs.history(id)
      .then((h) => {
        if (viewingId.current === id) setDetailHistory(h);
      })
      .catch(() => {
        if (viewingId.current === id) setDetailHistory([]);
      });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.program_type.trim()) {
      setError('Enter the program type');
      return;
    }
    if (!form.event_date) {
      setError('Select a day on the calendar first');
      return;
    }
    const startTime = form.event_time.trim() ? normalizeTimeText(form.event_time) : '';
    const endTime = form.end_time.trim() ? normalizeTimeText(form.end_time) : '';
    if (form.event_time.trim() && startTime === null) {
      setError('Start time must look like 06:45');
      return;
    }
    if (form.end_time.trim() && endTime === null) {
      setError('End time must look like 10:30');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        program_type: form.program_type.trim(),
        location: form.location.trim() || null,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim() || null,
        event_date: form.event_date,
        end_date: form.end_date || form.event_date,
        event_time: startTime || null,
        end_time: endTime || null,
        notes: form.notes.trim() || null,
      };
      if (modal === 'edit' && editingId != null) {
        await api.programs.update(editingId, payload);
      } else {
        await api.programs.create(payload);
      }
      setModal(null);
      setDetailHistory([]);
      emitNotificationsChanged();
      await load(month);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (editingId == null) return;
    if (!window.confirm('Delete this program from the calendar?')) return;
    try {
      await api.programs.delete(editingId);
      setModal(null);
      emitNotificationsChanged();
      await load(month);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const today = todayIso();
  const programName = (entry: ProgramHistoryEntry) =>
    entry.program_type
    || programs.find((p) => p.id === entry.program_id)?.program_type
    || 'Program';

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <Header title="Calendar" />
      <div className="p-4 sm:p-6 w-full flex-1 flex flex-col min-h-0">
        <div className="bg-black/90 border border-red-950/60 rounded-xl shadow-xl p-4 sm:p-5 flex flex-col flex-1 min-h-0 gap-4">
        <p className="text-sm text-white shrink-0 leading-relaxed">
          Note programs, live events, and orders. From 3 days before until the event ends, a reminder appears in Notifications every day.
        </p>

        {error && (
          <div className="p-3 bg-red-950/80 text-red-100 rounded-lg border border-red-800 text-sm flex justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="text-white">✕</button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="px-3 py-1.5 rounded-lg bg-red-800 text-white hover:bg-red-700"
            >
              ←
            </button>
            <h3 className="text-lg font-semibold text-white min-w-[10rem] text-center">{monthLabel(month)}</h3>
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="px-3 py-1.5 rounded-lg bg-red-800 text-white hover:bg-red-700"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => setMonth(monthKey(new Date()))}
              className="ml-1 px-3 py-1.5 rounded-lg border border-red-500 text-white text-sm hover:bg-red-900/60"
            >
              Today
            </button>
          </div>
          <button
            type="button"
            onClick={() => openAdd()}
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500"
          >
            + Add program
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 min-h-0 flex-1">
          <div className="bg-neutral-950 border border-red-900/50 rounded-xl overflow-hidden flex flex-col min-h-0">
            <div className="grid grid-cols-7 border-b border-red-900/50 bg-red-950/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="px-1 py-2 text-center text-xs font-semibold text-white">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 auto-rows-fr min-h-[420px]">
              {cells.map((cell, idx) => {
                const list = cell.iso ? byDay.get(cell.iso) || [] : [];
                const isToday = cell.iso === today;
                const selected = cell.iso === selectedDay;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!cell.iso}
                    onClick={() => cell.iso && setSelectedDay(cell.iso)}
                    onDoubleClick={() => cell.iso && openAdd(cell.iso)}
                    className={`min-h-[72px] border border-red-950/40 p-1.5 text-left align-top transition-colors ${
                      !cell.iso
                        ? 'bg-black/50 cursor-default'
                        : selected
                          ? 'bg-red-950/70 ring-1 ring-inset ring-red-500'
                          : isToday
                            ? 'bg-red-950/40 hover:bg-red-950/55'
                            : 'bg-black/70 hover:bg-red-950/35'
                    }`}
                  >
                    {cell.day != null && (
                      <>
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            isToday ? 'bg-red-600 text-white' : 'text-white'
                          }`}
                        >
                          {cell.day}
                        </span>
                        <div className="mt-1 space-y-0.5 max-h-[4.5rem] overflow-hidden">
                          {list.slice(0, 3).map((p) => (
                            <span
                              key={p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void openView(p);
                              }}
                              className="block truncate rounded px-1 py-0.5 text-[10px] font-medium bg-emerald-900/55 text-emerald-50/90 hover:bg-emerald-800/80 hover:text-white"
                              title="Click for full details"
                            >
                              {p.program_type}
                            </span>
                          ))}
                          {list.length > 3 && (
                            <span className="block text-[10px] text-white/80">+{list.length - 3} more</span>
                          )}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-neutral-950 border border-red-900/50 rounded-xl p-4 flex flex-col min-h-0">
            <h4 className="text-sm font-semibold text-white mb-1">
              {selectedDay
                ? new Date(`${selectedDay}T00:00:00`).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })
                : 'Select a day'}
            </h4>
            <p className="text-xs text-white/85 mb-3">Click a program name for full details. Double-click a day to add.</p>
            <button
              type="button"
              disabled={!selectedDay}
              onClick={() => openAdd(selectedDay || undefined)}
              className="mb-3 w-full px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-40"
            >
              + Program on this day
            </button>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {loading ? (
                <p className="text-sm text-white/90">Loading…</p>
              ) : dayPrograms.length === 0 ? (
                <p className="text-sm text-white/90">No programs on this day.</p>
              ) : (
                dayPrograms.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void openView(p)}
                    className="w-full text-left rounded-lg border border-red-800/60 bg-red-950/40 p-3 hover:bg-red-950/60"
                  >
                    <p className="text-white font-medium text-sm truncate">{p.program_type}</p>
                    <p className="text-xs text-white/75 mt-0.5">Click for details</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-neutral-950 border border-red-900/50 rounded-xl p-4 shrink-0">
          <h4 className="text-sm font-semibold text-white mb-2">Edit history</h4>
          <p className="text-xs text-white/85 mb-3">Changes made to programs this month (also included in weekly reports).</p>
          {history.length === 0 ? (
            <p className="text-sm text-white/90">No edits yet.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((h) => (
                <li key={`${h.program_id}-${h.id}`} className="text-sm border-b border-red-900/40 pb-2">
                  <p className="text-white">
                    <span className="text-white/75 text-xs mr-2">
                      {String(h.changed_at).replace('T', ' ').slice(0, 16)}
                    </span>
                    {programName(h)} — {h.summary}
                  </p>
                  {h.changes?.length > 0 && (
                    <p className="text-xs text-white/80 mt-0.5">
                      {h.changes
                        .map((c) => `${c.field.replace(/_/g, ' ')}: ${c.from || '—'} → ${c.to || '—'}`)
                        .join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
      </div>

      {modal === 'view' && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4">
          <div className="bg-neutral-950 border border-red-900/50 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="shrink-0 px-5 pt-5 pb-4 border-b border-red-900/40 bg-gradient-to-b from-red-950/50 to-transparent">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-red-200/80 mb-1">Program</p>
                  <h3 className="text-xl font-semibold text-white capitalize leading-tight truncate">
                    {form.program_type || 'Program'}
                  </h3>
                  <p className="text-sm text-white/80 mt-1">
                    {formatDateLabel(form.event_date)}
                    {form.end_date && form.end_date !== form.event_date
                      ? ` → ${formatDateLabel(form.end_date)}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="shrink-0 h-8 w-8 rounded-full bg-red-950/60 text-white hover:bg-red-900"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-900/50 border border-emerald-700/50 px-3 py-1 text-sm text-emerald-100">
                <span className="font-medium">{formatTimeLabel(form.event_time) || 'Time TBD'}</span>
                {formatTimeLabel(form.end_time) && (
                  <>
                    <span className="text-emerald-300/70">→</span>
                    <span>{formatTimeLabel(form.end_time)}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <DetailRow label="Where" value={form.location} />
                <DetailRow label="Phone" value={form.phone} />
              </div>
              <DetailRow label="Customer" value={form.customer_name} />
              {form.notes?.trim() && (
                <div className="rounded-lg bg-black/50 border border-red-900/40 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-red-200/80 mb-0.5">Note</p>
                  <p className="text-sm text-white whitespace-pre-wrap">{form.notes}</p>
                </div>
              )}
              {detailHistory.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-semibold text-white mb-2">Edit history</h4>
                  <ul className="space-y-2 max-h-28 overflow-y-auto">
                    {detailHistory.map((h) => (
                      <li key={h.id} className="text-xs text-white/85 border-b border-red-950/40 pb-1.5">
                        <span className="text-white/60 mr-2">
                          {String(h.changed_at).replace('T', ' ').slice(0, 16)}
                        </span>
                        {h.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-2 px-5 py-4 border-t border-red-900/40 bg-black/60">
              <button
                type="button"
                onClick={remove}
                className="px-3 py-2 rounded-lg border border-red-700/70 text-red-100 text-sm hover:bg-red-950/70"
              >
                Delete
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg bg-neutral-900 border border-red-900/50 text-white text-sm hover:bg-neutral-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setModal('edit')}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500"
              >
                Edit
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {(modal === 'add' || modal === 'edit') && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={save}
            className="bg-neutral-950 border border-red-950/60 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">
                {modal === 'add' ? 'Add program' : 'Edit program'}
              </h3>
              <button type="button" onClick={() => setModal(null)} className="text-white hover:text-red-200">✕</button>
            </div>

            {error && (
              <div className="p-2 rounded-lg bg-red-950/80 border border-red-800 text-red-100 text-sm">
                {error}
              </div>
            )}

            <label className="block text-xs font-medium text-white">
              Program type *
              <input
                autoFocus
                value={form.program_type}
                onChange={(e) => setForm((f) => ({ ...f, program_type: e.target.value }))}
                placeholder="Wedding, Live, Order delivery…"
                className={fieldClass}
              />
            </label>
            <label className="block text-xs font-medium text-white">
              Where
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Venue / place"
                className={fieldClass}
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CustomerSuggestField
                label="Customer name"
                value={form.customer_name}
                placeholder="Click to pick saved customer"
                customers={customers}
                onChange={(customer_name) =>
                  setForm((f) => ({ ...f, customer_name, customer_id: '' }))
                }
                onPick={pickCustomer}
              />
              <CustomerSuggestField
                label="Phone"
                value={form.phone}
                placeholder="Click to pick / type phone"
                customers={customers}
                onChange={(phone) => setForm((f) => ({ ...f, phone, customer_id: '' }))}
                onPick={pickCustomer}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TimeInput
                label="Start time"
                value={form.event_time}
                onChange={(event_time) => setForm((f) => ({ ...f, event_time }))}
              />
              <TimeInput
                label="Approx. end time"
                value={form.end_time}
                onChange={(end_time) => setForm((f) => ({ ...f, end_time }))}
              />
            </div>
            <label className="block text-xs font-medium text-white">
              Note
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Small note"
                className={`${fieldClass} resize-none`}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {modal === 'edit' && (
                <button type="button" onClick={remove} className="px-3 py-2 rounded-lg bg-red-900 text-white text-sm hover:bg-red-800">
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg bg-red-950/70 text-white text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Save program'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
