import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { SalaryMonth } from '../../types';

function currentMonth() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function todayInput() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function showDate(value: string | null | undefined) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function showMonth(value: string) {
  const [year, month] = value.split('-');
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const index = Number(month) - 1;
  return names[index] ? `${names[index]} ${year}` : value;
}

function money(value: number) {
  return `Rs.${(Number(value) || 0).toFixed(2)}`;
}

function durationLabel(start: string, end: string) {
  if (!start || !end) return '';
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1) return 'End date is before the start date';
  return days === 1 ? '1 day' : `${days} days`;
}

const fieldClass = 'w-full border border-red-800 rounded-lg px-3 py-2 bg-black text-white placeholder-red-300';

export default function SalaryManagement() {
  const [month, setMonth] = useState(currentMonth);
  const [record, setRecord] = useState<SalaryMonth | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [personName, setPersonName] = useState('');
  const [monthlyPerson, setMonthlyPerson] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [monthlyPaidOn, setMonthlyPaidOn] = useState(todayInput);
  const [monthlyNotes, setMonthlyNotes] = useState('');
  const [projectPerson, setProjectPerson] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectStart, setProjectStart] = useState('');
  const [projectEnd, setProjectEnd] = useState('');
  const [projectAmount, setProjectAmount] = useState('');
  const [projectPaidOn, setProjectPaidOn] = useState(todayInput);
  const [projectNotes, setProjectNotes] = useState('');

  const load = useCallback(async (nextMonth = month) => {
    const next = await api.salary.month(nextMonth);
    setRecord(next);
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    api.salary.month(month)
      .then((next) => {
        if (!cancelled) setRecord(next);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

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

  const people = record?.people || [];
  const projectDuration = durationLabel(projectStart, projectEnd);

  const paidOnLabel = (personId: number) => {
    const dates = [...new Set(
      (record?.payments || [])
        .filter((payment) => payment.person_id === personId && payment.paid_on)
        .map((payment) => payment.paid_on),
    )].sort();
    return dates.map(showDate).join(', ');
  };

  return (
    <section className="mb-6 bg-black/95 rounded-xl border border-red-950/60 p-6 shadow-xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-white">Salary</h3>
          <p className="text-sm text-red-100 mt-1">Record each month's pay, or a project payment with its dates.</p>
        </div>
        <label className="text-sm font-medium text-white">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="ml-2 border border-red-800 rounded-lg px-3 py-2 bg-black text-white"
          />
        </label>
      </div>
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <div className="mb-5">
        <h4 className="text-sm font-medium text-white mb-2">{showMonth(month)} summary</h4>
        {!record?.summary.length ? (
          <p className="text-sm text-red-100">No salary recorded for this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-red-950/50">
                  <th className="text-left p-2 border border-red-900/60 text-red-100">Person</th>
                  <th className="text-left p-2 border border-red-900/60 text-red-100">Date</th>
                  <th className="text-right p-2 border border-red-900/60 text-red-100">Monthly</th>
                  <th className="text-right p-2 border border-red-900/60 text-red-100">Project</th>
                  <th className="text-right p-2 border border-red-900/60 text-red-100">Total</th>
                </tr>
              </thead>
              <tbody>
                {record.summary.map((row) => (
                  <tr key={row.person_id}>
                    <td className="p-2 border border-red-900/60 text-white">{row.person_name}</td>
                    <td className="p-2 border border-red-900/60 text-white whitespace-nowrap">{paidOnLabel(row.person_id)}</td>
                    <td className="p-2 border border-red-900/60 text-right text-white">{money(row.monthly)}</td>
                    <td className="p-2 border border-red-900/60 text-right text-white">{money(row.project)}</td>
                    <td className="p-2 border border-red-900/60 text-right text-white font-medium">{money(row.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="p-2 border border-red-900/60 text-white font-medium">All people</td>
                  <td className="p-2 border border-red-900/60"></td>
                  <td className="p-2 border border-red-900/60 text-right text-white">{money(record.monthlyTotal)}</td>
                  <td className="p-2 border border-red-900/60 text-right text-white">{money(record.projectTotal)}</td>
                  <td className="p-2 border border-red-900/60 text-right text-amber-200 font-semibold">{money(record.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <form
          className="space-y-2 border border-red-900/50 rounded-lg p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = personName.trim();
            if (!name) return;
            run(async () => {
              await api.salary.addPerson(name);
              setPersonName('');
            });
          }}
        >
          <h4 className="text-sm font-medium text-white">People</h4>
          <input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Person name" className={fieldClass} />
          <button type="submit" disabled={busy || !personName.trim()} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">Add person</button>
          <ul className="space-y-1">
            {people.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-2 text-sm text-white">
                <span>{person.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Remove ${person.name} from the salary list? Past payments stay.`)) return;
                    run(() => api.salary.removePerson(person.id).then(() => undefined));
                  }}
                  className="text-red-200 hover:text-white"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </form>

        <form
          className="space-y-2 border border-red-900/50 rounded-lg p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.salary.addPayment({
                person_id: Number(monthlyPerson),
                pay_kind: 'monthly',
                pay_month: month,
                paid_on: monthlyPaidOn,
                amount: Number(monthlyAmount),
                notes: monthlyNotes,
              });
              setMonthlyAmount('');
              setMonthlyNotes('');
            });
          }}
        >
          <h4 className="text-sm font-medium text-white">Monthly salary</h4>
          <p className="text-sm text-red-100">For {showMonth(month)}</p>
          <select value={monthlyPerson} onChange={(e) => setMonthlyPerson(e.target.value)} className={fieldClass} required>
            <option value="">Choose person</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <input value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="Amount paid" className={fieldClass} required />
          <label className="block text-sm text-red-100">
            Paid on
            <input type="date" value={monthlyPaidOn} onChange={(e) => setMonthlyPaidOn(e.target.value)} className={`${fieldClass} mt-1`} required />
          </label>
          <input value={monthlyNotes} onChange={(e) => setMonthlyNotes(e.target.value)} placeholder="Note, optional" className={fieldClass} />
          <button type="submit" disabled={busy || !people.length} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">Save monthly pay</button>
        </form>

        <form
          className="space-y-2 border border-red-900/50 rounded-lg p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.salary.addPayment({
                person_id: Number(projectPerson),
                pay_kind: 'project',
                project_name: projectName,
                started_on: projectStart,
                ended_on: projectEnd,
                paid_on: projectPaidOn,
                amount: Number(projectAmount),
                notes: projectNotes,
              });
              setProjectName('');
              setProjectStart('');
              setProjectEnd('');
              setProjectAmount('');
              setProjectNotes('');
            });
          }}
        >
          <h4 className="text-sm font-medium text-white">Project pay</h4>
          <select value={projectPerson} onChange={(e) => setProjectPerson(e.target.value)} className={fieldClass} required>
            <option value="">Choose person</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" className={fieldClass} required />
          <label className="block text-sm text-red-100">
            Started
            <input type="date" value={projectStart} onChange={(e) => setProjectStart(e.target.value)} className={`${fieldClass} mt-1`} required />
          </label>
          <label className="block text-sm text-red-100">
            Ended
            <input type="date" value={projectEnd} onChange={(e) => setProjectEnd(e.target.value)} className={`${fieldClass} mt-1`} required />
          </label>
          {projectDuration && <p className="text-sm text-amber-200">Duration: {projectDuration}</p>}
          <input value={projectAmount} onChange={(e) => setProjectAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="Amount paid" className={fieldClass} required />
          <label className="block text-sm text-red-100">
            Paid on
            <input type="date" value={projectPaidOn} onChange={(e) => setProjectPaidOn(e.target.value)} className={`${fieldClass} mt-1`} required />
          </label>
          <input value={projectNotes} onChange={(e) => setProjectNotes(e.target.value)} placeholder="Note, optional" className={fieldClass} />
          <button type="submit" disabled={busy || !people.length} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">Save project pay</button>
        </form>
      </div>

      <h4 className="text-sm font-medium text-white mb-2">Payments in {showMonth(month)}</h4>
      {!record?.payments.length ? (
        <p className="text-sm text-red-100">No payments in this month.</p>
      ) : (
        <ul className="space-y-2">
          {record.payments.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-start justify-between gap-2 border border-red-900/50 rounded-lg px-3 py-2">
              <div>
                <p className="text-white font-medium">
                  {payment.person_name} · {money(payment.amount)}
                  <span className="text-red-100 font-normal"> · paid {showDate(payment.paid_on)}</span>
                </p>
                <p className="text-sm text-red-100">
                  {payment.pay_kind === 'monthly'
                    ? `Monthly salary for ${showMonth(payment.pay_month || month)}`
                    : `${payment.project_name} · ${showDate(payment.started_on)} to ${showDate(payment.ended_on)} · ${durationLabel(payment.started_on || '', payment.ended_on || '')}`}
                  {payment.notes ? ` · ${payment.notes}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Remove this ${money(payment.amount)} payment for ${payment.person_name}?`)) return;
                  run(() => api.salary.deletePayment(payment.id).then(() => undefined));
                }}
                className="text-sm text-red-200 hover:text-white"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
