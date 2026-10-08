import { useEffect, useRef, useState } from 'react';
import Header from '../components/layout/Header';
import PrintBill from '../components/billing/PrintBill';
import { api } from '../api/client';
import type { Bill, DayBookReport } from '../types';
import { formatSizeDisplay } from '../utils/sizeFormat';

function todayInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function showDate(value: string) {
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function money(value: number) {
  return `Rs.${(Number(value) || 0).toFixed(2)}`;
}

type Place = 'orders' | 'received' | 'expenses' | 'top';

export default function DayBook() {
  const [date, setDate] = useState(todayInput);
  const [report, setReport] = useState<DayBookReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printBill, setPrintBill] = useState<Bill | null>(null);
  const [openingBill, setOpeningBill] = useState('');
  const [focusBill, setFocusBill] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const pendingPlace = useRef<Place | null>(null);
  const pendingBill = useRef('');
  const ordersRef = useRef<HTMLElement>(null);
  const receivedRef = useRef<HTMLElement>(null);
  const expensesRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.reports.dayBook(date)
      .then((next) => {
        if (!cancelled) setReport(next);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, refreshTick]);

  useEffect(() => {
    if (loading || !report || !pendingPlace.current) return;
    const place = pendingPlace.current;
    const billNumber = pendingBill.current;
    pendingPlace.current = null;
    pendingBill.current = '';
    setFocusBill(billNumber);
    const target = billNumber
      ? document.getElementById(`${place === 'received' ? 'daybook-received' : 'daybook-order'}-${billNumber}`)
      : place === 'received'
        ? receivedRef.current
        : place === 'expenses'
          ? expensesRef.current
          : place === 'top'
            ? topRef.current
            : ordersRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [loading, report]);

  const goToDay = (nextDate: string, place: Place = 'orders', billNumber = '') => {
    pendingPlace.current = place;
    pendingBill.current = billNumber;
    if (nextDate === date) {
      setFocusBill(billNumber);
      const target = billNumber
        ? document.getElementById(`${place === 'received' ? 'daybook-received' : 'daybook-order'}-${billNumber}`)
        : place === 'received'
          ? receivedRef.current
          : place === 'expenses'
            ? expensesRef.current
            : ordersRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setDate(nextDate);
  };

  const openBill = async (billNumber: string) => {
    if (openingBill) return;
    setOpeningBill(billNumber);
    try {
      const rows = await api.bills.list({ number: billNumber });
      const match = rows.find((bill) => bill.bill_number === billNumber) || rows[0];
      if (!match) return;
      setPrintBill(await api.bills.get(match.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOpeningBill('');
    }
  };

  return (
    <>
      <Header title="Day book" />
      <div className="p-4 pb-8">
        <div ref={topRef} className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-black/95 rounded-xl border border-red-950/60 px-4 py-3 shadow-xl">
          <div>
            <p className="text-sm text-white">Select a day to see the summary. Nothing is entered on this page.</p>
            <p className="text-sm text-red-100 mt-1">Click a date to open that day. Click a bill number to open the bill.</p>
          </div>
          <label className="text-sm font-medium text-white">
            Day
            <input
              type="date"
              value={date}
              onChange={(e) => goToDay(e.target.value || todayInput(), 'top')}
              className="ml-2 border border-red-800 rounded-lg px-3 py-2 bg-black text-white"
            />
          </label>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {loading && !report ? (
          <p className="text-red-100">Loading...</p>
        ) : report && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_17rem] gap-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <SummaryCard label="Orders" value={String(report.orderCount)} hint={`Order value ${money(report.orderTotal)}`} onClick={() => goToDay(report.date, 'orders')} />
                <SummaryCard label="Cash in" value={money(report.cash)} hint="Received on this day" onClick={() => goToDay(report.date, 'received')} />
                <SummaryCard label="Bank in" value={money(report.bank)} hint="Received on this day" onClick={() => goToDay(report.date, 'received')} />
                <SummaryCard label="Pending on these orders" value={money(report.pending)} hint="Still unpaid on bills from this day" onClick={() => goToDay(report.date, 'orders')} />
                <SummaryCard label="Expenses" value={money(report.expenseTotal)} hint="Spent this day" onClick={() => goToDay(report.date, 'expenses')} />
                <SummaryCard label="Money box" value={money(report.moneyBox)} hint="Today's collection minus expenses. Not profit." />
              </div>

              <section ref={ordersRef} className="bg-black/95 rounded-xl border border-red-950/60 p-4 shadow-xl">
                <h3 className="font-semibold text-white mb-3">Orders on {showDate(report.date)}</h3>
                {report.orders.length === 0 ? (
                  <p className="text-sm text-red-100">No orders on this day.</p>
                ) : (
                  <div className="space-y-3">
                    {report.orders.map((order) => (
                      <article id={`daybook-order-${order.bill_number}`} key={order.id} className={`border rounded-lg p-3 ${focusBill === order.bill_number ? 'border-amber-400 bg-amber-950/20' : 'border-red-900/60'}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-white font-medium">
                            <button type="button" onClick={() => openBill(order.bill_number)} className="underline decoration-amber-300 underline-offset-2 hover:text-amber-200 whitespace-nowrap">
                              {openingBill === order.bill_number ? 'Opening...' : order.bill_number}
                            </button>
                            <span className="text-red-100 font-normal"> · {order.customer_name}</span>
                            {order.customer_phone && <span className="text-red-100 font-normal"> · {order.customer_phone}</span>}
                          </p>
                          <p className="text-sm text-red-100">{showDate(order.bill_date)}</p>
                        </div>
                        <ul className="mt-2 space-y-0.5">
                          {order.items.map((item, index) => (
                            <li key={index} className="text-sm text-red-100">
                              {item.item_name}{item.size ? ` · ${formatSizeDisplay(item.size) || item.size}` : ''} · Qty {item.quantity} · {money(item.subtotal)}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span className="text-white">Total {money(order.total)}</span>
                          <span className="text-red-200/90">Cash {money(order.cash)}</span>
                          <span className="text-red-200/90">Bank {money(order.bank)}</span>
                          <span className={order.pending > 0.009 ? 'text-amber-300' : 'text-emerald-400'}>
                            Pending {money(order.pending)}
                          </span>
                        </div>
                        {order.laterPayments.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {order.laterPayments.map((payment, index) => (
                              <li key={index} className="text-sm text-amber-100">
                                {money(payment.amount)} {payment.payment_method} on{' '}
                                <button type="button" onClick={() => goToDay(payment.paid_at, 'received', order.bill_number)} className="underline decoration-amber-300 underline-offset-2 hover:text-white">
                                  {showDate(payment.paid_at)}
                                </button>
                                . {payment.reason}
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section ref={receivedRef} className="bg-black/95 rounded-xl border border-red-950/60 p-4 shadow-xl">
                <h3 className="font-semibold text-white mb-1">Money received on {showDate(report.date)}</h3>
                <p className="text-sm text-red-100 mb-3">Includes a balance paid on this day for an older bill. Click the bill to open it, or the bill date to open that day.</p>
                {report.received.length === 0 ? (
                  <p className="text-sm text-red-100">No money received on this day.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-red-950/50">
                          <th className="text-left p-2 border border-red-950/50 text-red-200">Bill</th>
                          <th className="text-left p-2 border border-red-950/50 text-red-200">Customer</th>
                          <th className="text-left p-2 border border-red-950/50 text-red-200">Bill date</th>
                          <th className="text-left p-2 border border-red-950/50 text-red-200">Method</th>
                          <th className="text-right p-2 border border-red-950/50 text-red-200">Amount</th>
                          <th className="text-left p-2 border border-red-950/50 text-red-200">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.received.map((payment, index) => (
                          <tr key={index} id={`daybook-received-${payment.bill_number}`} className={`border-b border-red-950/40 ${focusBill === payment.bill_number ? 'bg-amber-950/30' : ''}`}>
                            <td className="p-2 border border-red-950/40">
                              <button type="button" onClick={() => openBill(payment.bill_number)} className="text-white font-medium underline decoration-amber-300 underline-offset-2 hover:text-amber-200 whitespace-nowrap">
                                {openingBill === payment.bill_number ? 'Opening...' : payment.bill_number}
                              </button>
                            </td>
                            <td className="p-2 border border-red-950/40 text-white">{payment.customer_name}</td>
                            <td className="p-2 border border-red-950/40">
                              <button type="button" onClick={() => goToDay(payment.bill_date, 'orders', payment.bill_number)} className="text-white underline decoration-amber-300 underline-offset-2 hover:text-amber-200 whitespace-nowrap">
                                {showDate(payment.bill_date)}
                              </button>
                            </td>
                            <td className="p-2 border border-red-950/40 text-red-100">{payment.payment_method}</td>
                            <td className="p-2 border border-red-950/40 text-right text-white whitespace-nowrap">{money(payment.amount)}</td>
                            <td className="p-2 border border-red-950/40 text-sm text-red-100">{payment.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section ref={expensesRef} className="bg-black/95 rounded-xl border border-red-950/60 p-4 shadow-xl">
                <h3 className="font-semibold text-white mb-3">Expenses on {showDate(report.date)}</h3>
                {report.expenses.length === 0 ? (
                  <p className="text-sm text-red-100">No expenses on this day.</p>
                ) : (
                  <ul className="space-y-1">
                    {report.expenses.map((expense) => (
                      <li key={expense.id} className="flex justify-between gap-3 text-sm">
                        <span className="text-red-100">{expense.description || 'Expense'}</span>
                        <span className="text-white">{money(expense.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside className="bg-black/90 rounded-xl border border-red-950/60 p-3 shadow-xl h-fit xl:sticky xl:top-4">
              <h3 className="font-semibold text-white text-sm mb-2">Every day</h3>
              <p className="text-sm text-red-100 mb-2">Click a date to open that day.</p>
              <div className="max-h-[70vh] overflow-auto space-y-1">
                {report.days.length === 0 ? (
                  <p className="text-sm text-red-100">No days yet.</p>
                ) : report.days.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => goToDay(day.date, 'orders')}
                    className={`w-full text-left rounded-lg px-2 py-2 border ${day.date === report.date ? 'border-red-500 bg-red-950/40' : 'border-transparent hover:bg-red-950/30'}`}
                  >
                    <span className="block text-sm font-medium text-white underline decoration-red-400 underline-offset-2">{showDate(day.date)}</span>
                    <span className="block text-sm text-red-100">{day.orderCount} {day.orderCount === 1 ? 'order' : 'orders'} · In {money(day.collected)}</span>
                    <span className={`block text-xs ${day.pending > 0.009 ? 'text-amber-300' : 'text-emerald-400/90'}`}>Pending {money(day.pending)}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        )}
        {printBill && (
          <PrintBill
            bill={printBill}
            onClose={() => setPrintBill(null)}
            onBillUpdated={() => setRefreshTick((n) => n + 1)}
          />
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick?: () => void }) {
  const className = 'bg-black/95 rounded-xl border border-red-950/60 p-3 shadow-xl text-left w-full';
  const body = (
    <>
      <p className="text-sm text-red-100">{label}</p>
      <p className="text-xl font-semibold text-white mt-1">{value}</p>
      <p className="text-sm text-red-100 mt-1">{hint}</p>
    </>
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={`${className} hover:border-amber-400`}>
      {body}
    </button>
  );
}
