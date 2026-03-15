import { useState } from 'react';
import Header from '../components/layout/Header';
import BillForm from '../components/billing/BillForm';
import BillList from '../components/billing/BillList';
import PrintBill from '../components/billing/PrintBill';
import type { Bill } from '../types';

export default function Billing() {
  const [activeTab, setActiveTab] = useState('new');
  const [printBill, setPrintBill] = useState<Bill | null>(null);

  return (
    <>
      <Header title="Billing" />
      <div className="p-4 pb-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'new' ? 'bg-red-600 text-white' : 'bg-black/60 text-red-200/90 hover:bg-red-950/60'
            }`}
          >
            New Bill
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'list' ? 'bg-red-600 text-white' : 'bg-black/60 text-red-200/90 hover:bg-red-950/60'
            }`}
          >
            Bill List
          </button>
        </div>

        {activeTab === 'new' && (
          <BillForm onBillCreated={(bill) => setPrintBill(bill)} />
        )}
        {activeTab === 'list' && (
          <BillList onPrint={(bill) => setPrintBill(bill)} />
        )}

        {printBill && (
          <PrintBill bill={printBill} onClose={() => setPrintBill(null)} onBillUpdated={setPrintBill} />
        )}
      </div>
    </>
  );
}
