import { useState } from 'react';
import type { Bill } from '../../types';

interface PayBalanceModalProps {
  bill: Bill;
  onClose: () => void;
  onPaid: (updated: Bill) => void;
}

export default function PayBalanceModal({ bill, onClose, onPaid }: PayBalanceModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank'>(bill.payment_method === 'Bank' ? 'Bank' : 'Cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const paid = bill.amount_paid ?? 0;
  const total = parseFloat(String(bill.total)) || 0;
  const balance = total - paid;
  const maxAmount = balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (amt > maxAmount) {
      setError(`Amount cannot exceed Rs.${maxAmount.toFixed(2)}`);
      return;
    }
    setSubmitting(true);
    try {
      const { api } = await import('../../api/client');
      const updated = await api.bills.payBalance(bill.id, amt, paymentMethod);
      onPaid(updated);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Pay Balance</h3>
        <p className="text-sm text-red-200/90 mb-2">
          Bill #{bill.bill_number} – {bill.customer_name}
        </p>
        <p className="text-sm text-red-300/70 mb-4">
          Balance due: Rs.{balance.toFixed(2)}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Amount (Rs.)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={maxAmount}
              placeholder={balance.toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white placeholder-red-400/50"
              required
            />
            <p className="text-xs text-red-300/70 mt-1">Max: Rs.{maxAmount.toFixed(2)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-red-200/90 mb-1">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Bank')}
              className="w-full border border-red-900/50 rounded-lg px-3 py-2 bg-black/60 text-white"
            >
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-red-950/60 text-red-200 rounded-lg hover:bg-red-900/70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Record payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
