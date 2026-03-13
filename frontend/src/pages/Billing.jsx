import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import BillForm from '../components/billing/BillForm';
import BillList from '../components/billing/BillList';
import PrintBill from '../components/billing/PrintBill';

export default function Billing() {
  const [activeTab, setActiveTab] = useState('new');
  const [printBill, setPrintBill] = useState(null);

  return (
    <>
      <Header title="Billing" />
      <div className="p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'new' ? 'bg-sky-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            New Bill
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'list' ? 'bg-sky-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
          <PrintBill bill={printBill} onClose={() => setPrintBill(null)} />
        )}
      </div>
    </>
  );
}
