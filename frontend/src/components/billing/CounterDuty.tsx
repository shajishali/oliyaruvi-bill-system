import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { CounterDay, CounterShift } from '../../types';

function todayInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clockFromLocal(stamp: string) {
  const [day, time = '00:00:00'] = stamp.trim().split(' ');
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const value = new Date(year, (month || 1) - 1, date || 1, hour || 0, minute || 0);
  if (Number.isNaN(value.getTime())) return stamp;
  return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function clockFromUtc(stamp: string) {
  const value = new Date(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
  if (Number.isNaN(value.getTime())) return stamp;
  return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function shiftRange(shift: CounterShift) {
  const start = clockFromLocal(shift.started_at);
  if (!shift.ended_at) return `${start} – now`;
  const end = clockFromLocal(shift.ended_at);
  if (shift.started_at.slice(0, 10) !== shift.ended_at.slice(0, 10)) {
    return `${start} – ${end} next day`;
  }
  return `${start} – ${end}`;
}

export default function CounterDuty({
  refreshToken = 0,
  onActiveChange,
}: {
  refreshToken?: number;
  onActiveChange?: (name: string | null) => void;
}) {
  const [day, setDay] = useState<CounterDay | null>(null);
  const [date, setDate] = useState(todayInput);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (nextDate = date) => {
    const record = await api.counter.day(nextDate);
    setDay(record);
    onActiveChange?.(record.active?.staff_name ?? null);
  }, [date, onActiveChange]);

  useEffect(() => {
    let cancelled = false;
    api.counter.day(date)
      .then((record) => {
        if (cancelled) return;
        setDay(record);
        onActiveChange?.(record.active?.staff_name ?? null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [date, refreshToken, onActiveChange]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const active = day?.active ?? null;

  return (
    <div className="mb-4 bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-4 shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white text-sm">Counter</h3>
          <p className="text-xs text-red-300/70 mt-0.5">One person at a time. Switch the name when the next person takes over.</p>
        </div>
        <label className="text-xs text-red-200/80">
          Day
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayInput())}
            className="ml-2 border border-red-900/50 rounded px-2 py-1 bg-black/60 text-white"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(day?.staff || []).map((person) => {
          const selected = active?.staff_id === person.id;
          return (
            <div key={person.id} className={`flex items-center rounded-lg overflow-hidden border ${selected ? 'border-red-500' : 'border-red-900/50'}`}>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => api.counter.start(person.id).then(() => undefined))}
                className={`px-3 py-1.5 text-sm font-medium ${selected ? 'bg-red-600 text-white' : 'bg-black/60 text-red-100 hover:bg-red-950/60'}`}
              >
                {person.name}
              </button>
              {!selected && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove ${person.name}`}
                  title={`Remove ${person.name}`}
                  onClick={() => {
                    if (!window.confirm(`Remove ${person.name} from the counter list? Past bills stay under this name.`)) return;
                    run(() => api.counter.removeStaff(person.id).then(() => undefined));
                  }}
                  className="px-2 py-1.5 text-sm text-red-300/80 bg-black/60 hover:bg-red-950/70 border-l border-red-900/50"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = name.trim();
            if (!next) return;
            run(async () => {
              await api.counter.addStaff(next);
              setName('');
            });
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add person"
            className="w-36 border border-red-900/50 rounded-lg px-3 py-1.5 text-sm bg-black/60 text-white placeholder-red-400/50"
          />
          <button type="submit" disabled={busy || !name.trim()} className="px-3 py-1.5 bg-red-950/60 rounded-lg text-red-200 text-sm hover:bg-red-900/70 disabled:opacity-50">
            Add
          </button>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {active ? (
          <p className="text-sm text-emerald-400">
            <span className="font-semibold">{active.staff_name}</span> is at the counter from {clockFromLocal(active.started_at)}
          </p>
        ) : (
          <p className="text-sm text-amber-300">Choose who is at the counter before saving a bill.</p>
        )}
        {active && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => api.counter.end().then(() => undefined))}
            className="px-3 py-1.5 text-sm rounded-lg border border-red-900/50 text-red-200 hover:bg-red-950/60 disabled:opacity-50"
          >
            End time
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <div className="mt-4 border-t border-red-950/50 pt-3">
        <p className="text-xs font-medium text-red-200/90 mb-2">Who was at the counter</p>
        {!day?.shifts.length ? (
          <p className="text-sm text-red-300/70">No counter time saved for this day.</p>
        ) : (
          <div className="space-y-3">
            {day.shifts.map((shift) => {
              const billCount = shift.bills?.length || 0;
              return (
              <div key={shift.id}>
                <p className="text-sm text-white">
                  <span className="font-medium">{shift.staff_name}</span>
                  <span className="text-red-200/80"> · {shiftRange(shift)}</span>
                  <span className="text-red-300/70"> · {billCount} {billCount === 1 ? 'bill' : 'bills'}</span>
                </p>
                {!!shift.bills?.length && (
                  <ul className="mt-1 ml-3 space-y-0.5">
                    {shift.bills.map((bill) => (
                      <li key={bill.id} className="text-xs text-red-200/80">
                        {bill.bill_number} · {clockFromUtc(bill.created_at)} · {bill.customer_name} · Rs.{Number(bill.total).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
