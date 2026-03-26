import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../../api/client';
import type { DailyExpense, FinalRevenueReport } from '../../types';

type PeriodTab = 'monthly' | 'weekly' | 'daily';

function getMonthParam(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekRange(toDate: Date): { from: string; to: string } {
  const to = new Date(toDate);
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function DailyRevenueCard() {
  const now = new Date();
  const [period, setPeriod] = useState<PeriodTab>('monthly');
  const [month, setMonth] = useState(getMonthParam(now));
  const [weekTo, setWeekTo] = useState(now.toISOString().slice(0, 10));
  const [date, setDate] = useState(now.toISOString().slice(0, 10));
  const [report, setReport] = useState<FinalRevenueReport | null>(null);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newExpenseDate, setNewExpenseDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showReportTable, setShowReportTable] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const weekRange = getWeekRange(new Date(weekTo));
  const fromTo = period === 'monthly'
    ? (() => {
        const [y, m] = month.split('-').map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
      })()
    : period === 'weekly'
      ? weekRange
      : { from: date, to: date };

  const loadData = () => {
    setLoading(true);
    const params =
      period === 'monthly'
        ? { period: 'monthly', month }
        : period === 'weekly'
          ? { period: 'weekly', from: weekRange.from, to: weekRange.to }
          : { period: 'daily', date };
    Promise.all([
      api.reports.finalRevenue(params),
      api.expenses.list({ from: fromTo.from, to: fromTo.to }),
    ])
      .then(([rev, exps]) => {
        setReport(rev);
        setExpenses(exps);
      })
      .catch(() => {
        setReport(null);
        setExpenses([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [period, month, weekTo, date]);

  const effectiveExpenseDate =
    period === 'daily' ? date : newExpenseDate || fromTo.from;

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) return;
    setAdding(true);
    try {
      await api.expenses.create({
        expense_date: effectiveExpenseDate,
        amount: amt,
        description: newDescription.trim() || undefined,
      });
      setNewAmount('');
      setNewDescription('');
      if (period !== 'daily') setNewExpenseDate('');
      loadData();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateExpense = async (id: number) => {
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) return;
    try {
      await api.expenses.update(id, {
        amount: amt,
        description: editDescription.trim() || undefined,
      });
      setEditingId(null);
      setEditAmount('');
      setEditDescription('');
      loadData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.expenses.delete(id);
      loadData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const downloadPdf = () => {
    setDownloadingPdf(true);
    try {
      const income = report?.income ?? 0;
      const outcome = report?.outcome ?? 0;
      const finalRevenue = report?.finalRevenue ?? 0;
      const fromStr = report?.from ?? fromTo.from;
      const toStr = report?.to ?? fromTo.to;
      const periodTitle =
        period === 'monthly'
          ? `Month: ${month}`
          : period === 'weekly'
            ? `Week: ${fromStr} to ${toStr}`
            : `Date: ${date}`;
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Final Revenue Report', 14, 15);
      doc.setFontSize(10);
      doc.text(periodTitle, 14, 22);
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 28);

      autoTable(doc, {
        startY: 34,
        head: [['Period', 'From', 'To', 'Income (Rs.)', 'Expenses (Rs.)', 'Final Revenue (Rs.)']],
        body: [
          [
            period.charAt(0).toUpperCase() + period.slice(1),
            fromStr,
            toStr,
            income.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            outcome.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            finalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          ],
        ],
        theme: 'grid',
      });

      const tableEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
      const expensesStartY = tableEnd + 10;
      doc.setFontSize(12);
      doc.text('Expenses', 14, expensesStartY);
      autoTable(doc, {
        startY: expensesStartY + 6,
        head: [['Date', 'Amount (Rs.)', 'Description']],
        body: expenses.length
          ? expenses.map((e) => [
              e.expense_date,
              e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
              e.description || '—',
            ])
          : [['—', '—', 'No expenses']],
        theme: 'grid',
      });

      doc.save(`final-revenue-${period}-${fromStr}-${toStr}.pdf`);
    } catch (err) {
      alert((err as Error).message || 'Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const periodLabel =
    period === 'monthly'
      ? `${month.slice(0, 4)}-${month.slice(5)}`
      : period === 'weekly'
        ? `${weekRange.from} to ${weekRange.to}`
        : date;

  if (loading && !report) {
    return (
      <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
        <div className="animate-pulse text-red-300/70">Loading final revenue...</div>
      </div>
    );
  }

  return (
    <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 p-6 shadow-xl">
      <h3 className="font-semibold text-white mb-2">Final Revenue</h3>
      <p className="text-sm text-red-300/70 mb-4">
        Income (actual received) − Expenses = Final revenue. View by month, week, or day.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm text-red-200/90">Period:</span>
        {(['monthly', 'weekly', 'daily'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? 'bg-red-600 text-white'
                : 'bg-red-950/40 text-red-200/80 hover:bg-red-950/60'
            }`}
          >
            {p === 'monthly' ? 'Monthly' : p === 'weekly' ? 'Weekly' : 'Daily'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        {period === 'monthly' && (
          <label className="text-sm text-red-200/90 flex items-center gap-2">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
            />
          </label>
        )}
        {period === 'weekly' && (
          <label className="text-sm text-red-200/90 flex items-center gap-2">
            Week ending
            <input
              type="date"
              value={weekTo}
              onChange={(e) => setWeekTo(e.target.value)}
              className="border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
            />
          </label>
        )}
        {period === 'daily' && (
          <label className="text-sm text-red-200/90 flex items-center gap-2">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
            />
          </label>
        )}
      </div>

      {/* Summary and Report always visible so you can see Final Revenue and download PDF */}
      <p className="text-sm text-red-200/90 mb-3">
        Summary for <strong className="text-white">{periodLabel}</strong>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-950/30 rounded-lg p-4 border border-red-900/30">
          <p className="text-xs text-red-300/70 mb-1">Income</p>
          <p className="text-xl font-bold text-emerald-400">
            Rs.{(report?.income ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-red-950/30 rounded-lg p-4 border border-red-900/30">
          <p className="text-xs text-red-300/70 mb-1">Expenses</p>
          <p className="text-xl font-bold text-amber-400">
            Rs.{(report?.outcome ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-red-950/30 rounded-lg p-4 border border-red-900/30 border-l-4 border-l-emerald-500">
          <p className="text-xs text-red-300/70 mb-1">Final Revenue</p>
          <p className="text-xl font-bold text-white">
            Rs.{(report?.finalRevenue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="border-t border-red-950/40 pt-4 mb-4">
        <h4 className="text-sm font-medium text-red-200 mb-3">Report</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => setShowReportTable(!showReportTable)}
            className="px-3 py-2 bg-red-950/50 text-red-200 rounded-lg hover:bg-red-950/70 text-sm"
          >
            {showReportTable ? 'Hide table' : 'View report (table)'}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloadingPdf}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            {downloadingPdf ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
        {showReportTable && (
          <div className="overflow-x-auto rounded-lg border border-red-950/40">
            <table className="w-full text-sm">
              <thead className="bg-red-950/50">
                <tr>
                  <th className="text-left p-2 text-red-200">Period</th>
                  <th className="text-left p-2 text-red-200">From</th>
                  <th className="text-left p-2 text-red-200">To</th>
                  <th className="text-right p-2 text-red-200">Income (Rs.)</th>
                  <th className="text-right p-2 text-red-200">Expenses (Rs.)</th>
                  <th className="text-right p-2 text-red-200">Final Revenue (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-red-950/40 bg-red-950/20">
                  <td className="p-2 text-red-200 capitalize">{period}</td>
                  <td className="p-2 text-red-300/90">{report?.from ?? fromTo.from}</td>
                  <td className="p-2 text-red-300/90">{report?.to ?? fromTo.to}</td>
                  <td className="p-2 text-right text-emerald-400 font-medium">
                    {(report?.income ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-right text-amber-400 font-medium">
                    {(report?.outcome ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-right text-white font-bold">
                    {(report?.finalRevenue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 border-t border-red-950/40">
              <p className="text-xs text-red-300/70 p-2">Expenses in period</p>
              <table className="w-full text-sm">
                <thead className="bg-red-950/40">
                  <tr>
                    <th className="text-left p-2 text-red-200">Date</th>
                    <th className="text-right p-2 text-red-200">Amount (Rs.)</th>
                    <th className="text-left p-2 text-red-200">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-2 text-red-400/80 text-center">
                        No expenses in this period
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e) => (
                      <tr key={e.id} className="border-t border-red-950/30">
                        <td className="p-2 text-red-300/80">{e.expense_date}</td>
                        <td className="p-2 text-right text-amber-400">
                          {e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-red-300/80">{e.description || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-red-950/40 pt-4">
        <h4 className="text-sm font-medium text-red-200 mb-3">
          Add expense {period === 'daily' ? 'for this day' : `in ${periodLabel}`}
        </h4>
        <form onSubmit={handleAddExpense} className="flex flex-wrap gap-3 mb-4">
          {period !== 'daily' && (
            <input
              type="date"
              value={newExpenseDate || fromTo.from}
              min={fromTo.from}
              max={fromTo.to}
              onChange={(e) => setNewExpenseDate(e.target.value)}
              className="border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
            />
          )}
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="Amount (Rs.)"
            className="w-28 border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
            required
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 min-w-[120px] border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? 'Adding...' : 'Add Expense'}
          </button>
        </form>

        {expenses.length > 0 && (
          <div className="border border-red-950/40 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-950/50">
                <tr>
                  {period !== 'daily' && (
                    <th className="text-left p-2 text-red-200">Date</th>
                  )}
                  <th className="text-left p-2 text-red-200">Amount</th>
                  <th className="text-left p-2 text-red-200">Description</th>
                  <th className="text-right p-2 text-red-200 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-red-950/40 hover:bg-red-950/20">
                    {period !== 'daily' && (
                      <td className="p-2 text-red-300/80">{e.expense_date}</td>
                    )}
                    <td className="p-2">
                      {editingId === e.id ? (
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editAmount}
                          onChange={(ev) => setEditAmount(ev.target.value)}
                          className="w-24 border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                        />
                      ) : (
                        <span className="text-amber-400 font-medium">
                          Rs.{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === e.id ? (
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(ev) => setEditDescription(ev.target.value)}
                          className="w-full border border-red-900/50 rounded px-2 py-1 text-sm bg-black/60 text-white"
                        />
                      ) : (
                        <span className="text-red-300/80">{e.description || '—'}</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {editingId === e.id ? (
                        <span className="flex justify-end gap-1">
                          <button
                            onClick={() => handleUpdateExpense(e.id)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditAmount('');
                              setEditDescription('');
                            }}
                            className="px-2 py-1 text-red-300 text-xs"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingId(e.id);
                              setEditAmount(String(e.amount));
                              setEditDescription(e.description || '');
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(e.id)}
                            className="text-red-500 hover:text-red-400 text-xs"
                          >
                            Delete
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
