import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Bill, BillItem, PaymentTransaction, ShopSettings } from '../../types';
import { formatSizeDisplay } from '../../utils/sizeFormat';
import PayBalanceModal from './PayBalanceModal';

function formatPaymentDate(paidAt: string): string {
  if (!paidAt) return '';
  const [y, m, d] = String(paidAt).split('-');
  return d && m && y ? `${d}/${m}/${y}` : paidAt;
}

interface PrintBillProps {
  bill: Bill;
  onClose: () => void;
  onBillUpdated?: (bill: Bill) => void;
}

const A4_STYLES = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #000; margin: 0; padding: 0; }
  .bill-page { max-width: 210mm; margin: 0 auto; padding: 10mm; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .shop-name { font-size: 22pt; font-weight: bold; letter-spacing: 0.5px; }
  .shop-details { font-size: 10pt; margin-top: 4px; color: #333; }
  .bill-info { display: flex; justify-content: space-between; margin: 12px 0; font-size: 10pt; }
  .bill-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  .bill-table th, .bill-table td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
  .bill-table th { background: #f5f5f5; font-weight: 600; }
  .bill-table .num { text-align: right; }
  .footer { margin-top: 16px; border-top: 2px solid #000; padding-top: 10px; font-size: 11pt; }
  .total-row { font-size: 14pt; font-weight: bold; margin: 8px 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

const THERMAL_STYLES = `
  @page { size: 80mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.2; color: #000; margin: 0; padding: 4px; max-width: 80mm; }
  .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 6px; }
  .shop-name { font-size: 14px; font-weight: bold; }
  .shop-details { font-size: 10px; margin-top: 2px; }
  .bill-info { display: flex; justify-content: space-between; margin: 4px 0; font-size: 10px; }
  .bill-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .bill-table th, .bill-table td { padding: 2px 4px; border: none; border-bottom: 1px dotted #666; }
  .bill-table .num { text-align: right; }
  .footer { margin-top: 8px; border-top: 1px dashed #000; padding-top: 4px; font-size: 10px; }
  .total-row { font-size: 12px; font-weight: bold; margin: 4px 0; }
`;

function parseItemMetadata(item: BillItem): Record<string, unknown> | null {
  const raw = (item as { metadata?: unknown }).metadata;
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

function formatBillUnitPriceCell(item: BillItem): string {
  const p = parseFloat(String(item.unit_price)).toFixed(2);
  const st = (item as { service_type?: string }).service_type;
  if (st !== 'manual') return `Rs.${p}`;
  const meta = parseItemMetadata(item);
  const pu = meta?.pricing_unit;
  if (pu === 'per_sqft') return `Rs.${p}/sqft`;
  if (pu === 'per_unit') return `Rs.${p}/unit`;
  return `Rs.${p}`;
}

function formatItemNameDisplay(itemName: string | undefined | null): string {
  if (!itemName) return '';
  const s = String(itemName).trim();

  // If item name contains dimensions like "round 34X65", show only the base item "round".
  const xDimRegex = /(\d+(?:\.\d+)?\s*[xX]\s*\d+(?:\.\d+)?)/;
  const idx = s.search(xDimRegex);
  if (idx < 0) return s;

  const prefix = s.slice(0, idx).trim();
  return prefix ? prefix : s;
}

function buildPrintHtml(
  bill: Bill,
  settings: Partial<ShopSettings>,
  format: 'a4' | 'thermal'
): string {
  const shop = settings.shop_name || 'OLIYARUVI PRINTERS';
  const address = settings.address || 'Enter your shop address here';
  const contact = settings.contact || 'Enter contact number';

  const rows = (bill.items || []).map(
    (item: BillItem) => {
      const discount = (item as { item_discount?: number }).item_discount ?? item.discount ?? 0;
      const itemDisplay = formatItemNameDisplay(item.item_name);
      const sizeDisplay = formatSizeDisplay(item.size) || item.size || '-';
      return `<tr>
        <td>${itemDisplay}</td>
        <td>${sizeDisplay}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatBillUnitPriceCell(item)}</td>
        <td class="num">${discount > 0 ? `-Rs.${discount.toFixed(2)}` : '-'}</td>
        <td class="num">Rs.${parseFloat(String(item.subtotal)).toFixed(2)}</td>
      </tr>`;
    }
  ).join('');

  const styles = format === 'thermal' ? THERMAL_STYLES : A4_STYLES;

  const txs = bill.payment_transactions || [];
  const isFullyPaid = (bill.amount_paid ?? 0) >= parseFloat(String(bill.total));
  const paymentRowsHtml = txs.length > 0
    ? txs.map((t: PaymentTransaction) => {
        const label = t.payment_type === 'advance' ? 'Advance' : 'Balance';
        const dateStr = formatPaymentDate(t.paid_at);
        return `<div class="bill-info"><span>${label} Rs.${parseFloat(String(t.amount)).toFixed(2)} on ${dateStr} (${t.payment_method})</span></div>`;
      }).join('') + (isFullyPaid
        ? `<div class="bill-info"><span>Status</span><span class="num">Paid</span></div>`
        : `<div class="bill-info"><span>Balance due</span><span class="num">Rs.${(parseFloat(String(bill.total)) - (bill.amount_paid ?? 0)).toFixed(2)}</span></div>`)
    : isFullyPaid
      ? `<div class="bill-info"><span>Status</span><span class="num">Paid</span></div>`
      : (bill.amount_paid ?? 0) > 0
        ? `<div class="bill-info"><span>Advance paid</span><span class="num">Rs.${parseFloat(String(bill.amount_paid)).toFixed(2)}</span></div><div class="bill-info"><span>Balance due</span><span class="num">Rs.${(parseFloat(String(bill.total)) - (bill.amount_paid ?? 0)).toFixed(2)}</span></div>`
        : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bill - ${bill.bill_number}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="bill-page">
    <div class="header">
      <div class="shop-name">${shop}</div>
      <div class="shop-details">${address}</div>
      <div class="shop-details">Contact: ${contact}</div>
    </div>
    <div class="bill-info">
      <span>Bill #: ${bill.bill_number}</span>
      <span>Date: ${bill.bill_date}</span>
    </div>
    <div class="bill-info">Customer: ${bill.customer_name}</div>
    <table class="bill-table">
      <thead>
        <tr>
          <th>Item</th><th>Size</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Discount</th><th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">
      ${bill.discount > 0 ? `<div class="bill-info"><span>Discount</span><span class="num">-Rs.${parseFloat(String(bill.discount)).toFixed(2)}</span></div>` : ''}
      <div class="total-row bill-info"><span>Total</span><span class="num">Rs.${parseFloat(String(bill.total)).toFixed(2)}</span></div>
      ${txs.length > 0 ? paymentRowsHtml : (bill.amount_paid ?? 0) >= parseFloat(String(bill.total)) ? `<div class="bill-info"><span>Status</span><span class="num">Paid</span></div>` : (bill.amount_paid ?? 0) > 0 ? `<div class="bill-info"><span>Advance paid</span><span class="num">Rs.${parseFloat(String(bill.amount_paid)).toFixed(2)}</span></div><div class="bill-info"><span>Balance due</span><span class="num">Rs.${(parseFloat(String(bill.total)) - (bill.amount_paid ?? 0)).toFixed(2)}</span></div>` : ''}
      ${txs.length > 0 ? '' : `<div class="bill-info">Payment: ${bill.payment_method}</div>`}
      ${bill.notes ? `<div class="bill-info">Notes: ${bill.notes}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

export default function PrintBill({ bill, onClose, onBillUpdated }: PrintBillProps) {
  const [settings, setSettings] = useState<ShopSettings>({ shop_name: '', address: '', contact: '' });
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');
  const [currentBill, setCurrentBill] = useState<Bill>(bill);
  const [printing, setPrinting] = useState(false);

  const paid = currentBill.amount_paid ?? 0;
  const total = parseFloat(String(currentBill.total)) || 0;
  const balance = total - paid;
  const isPaid = paid >= total;
  const [showPayBalance, setShowPayBalance] = useState(false);

  useEffect(() => {
    api.settings.get().then(setSettings);
  }, []);

  useEffect(() => {
    setCurrentBill(bill);
  }, [bill]);

  const handlePrint = () => {
    if (printing) return;
    setPrinting(true);
    const shop = settings.shop_name || 'OLIYARUVI PRINTERS';
    const billToPrint = currentBill;
    const address = settings.address || 'Enter your shop address here';
    const contact = settings.contact || 'Enter contact number';

    const html = buildPrintHtml(billToPrint, { shop_name: shop, address, contact }, printFormat);

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow!.focus();
    setTimeout(() => {
      iframe.contentWindow!.print();
      document.body.removeChild(iframe);
      setPrinting(false);
    }, 300);
  };

  const shop = settings.shop_name || 'OLIYARUVI PRINTERS';
  const address = settings.address || 'Enter your shop address here';
  const contact = settings.contact || 'Enter contact number';

  const isThermal = printFormat === 'thermal';

  const handleBalancePaid = (updated: Bill) => {
    setCurrentBill(updated);
    onBillUpdated?.(updated);
    setShowPayBalance(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-black/95 backdrop-blur-sm rounded-xl shadow-xl border border-red-950/60 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-red-950/50 shrink-0 min-h-[52px]">
          <h3 className="text-base font-semibold text-white leading-none flex items-center">Bill {currentBill.bill_number}</h3>
          <div className="flex flex-wrap items-center gap-3">
            {!isPaid && (
              <button
                type="button"
                onClick={() => setShowPayBalance(true)}
                className="h-9 px-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
              >
                Pay balance
              </button>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm text-red-200/90 whitespace-nowrap">Paper:</label>
              <select
                value={printFormat}
                onChange={(e) => setPrintFormat(e.target.value as 'a4' | 'thermal')}
                className="h-9 border border-red-900/50 rounded px-3 text-sm bg-black/60 text-white"
              >
                <option value="a4">A4 (Ricoh MPC 355 / office printer)</option>
                <option value="thermal">Thermal (80mm receipt)</option>
              </select>
            </div>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="h-9 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {printing ? 'Printing...' : 'Print'}
            </button>
            <button
              onClick={onClose}
              className="h-9 px-4 bg-red-950/60 text-red-200 rounded-lg hover:bg-red-900/70 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-red-950/20">
          <div
            className={`bg-white shadow-sm mx-auto ${isThermal ? 'max-w-[200px] font-mono text-xs' : 'max-w-[210mm] p-6'}`}
            style={isThermal ? { width: '80mm', minHeight: '200px' } : {}}
          >
            <div className="text-center border-b-2 border-black pb-2 mb-3">
              <div className={`font-bold ${isThermal ? 'text-sm' : 'text-xl'}`}>{shop}</div>
              <div className={`text-gray-600 mt-1 ${isThermal ? 'text-[10px]' : 'text-sm'}`}>{address}</div>
              <div className={`text-gray-600 ${isThermal ? 'text-[10px]' : 'text-sm'}`}>Contact: {contact}</div>
            </div>
            <div className={`flex justify-between mb-2 ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
              <span>Bill #: {currentBill.bill_number}</span>
              <span>Date: {currentBill.bill_date}</span>
            </div>
            <div className={`mb-3 ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
              Customer: {currentBill.customer_name}
              {currentBill.customer_phone ? ` · ${currentBill.customer_phone}` : ''}
            </div>
            <table className={`w-full border-collapse ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1.5 text-left">Item</th>
                  <th className="border p-1.5 text-left">Size</th>
                  <th className="border p-1.5 text-right">Qty</th>
                  <th className="border p-1.5 text-right">Unit</th>
                  <th className="border p-1.5 text-right">Discount</th>
                  <th className="border p-1.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(currentBill.items || []).map((item: BillItem, idx) => {
                  const itemDiscount = (item as { item_discount?: number }).item_discount ?? item.discount ?? 0;
                  const itemDisplay = formatItemNameDisplay(item.item_name);
                  const sizeDisplay = formatSizeDisplay(item.size) || item.size || '-';
                  return (
                  <tr key={idx}>
                    <td className="border p-1.5">{itemDisplay}</td>
                    <td className="border p-1.5">{sizeDisplay}</td>
                    <td className="border p-1.5 text-right">{item.quantity}</td>
                    <td className="border p-1.5 text-right">{formatBillUnitPriceCell(item)}</td>
                    <td className="border p-1.5 text-right">{itemDiscount > 0 ? `-Rs.${itemDiscount.toFixed(2)}` : '-'}</td>
                    <td className="border p-1.5 text-right">Rs.{parseFloat(String(item.subtotal)).toFixed(2)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t-2 border-black pt-3 mt-3">
              {currentBill.discount > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span>Discount</span>
                  <span>-Rs.{parseFloat(String(currentBill.discount)).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg mt-2">
                <span>Total</span>
                <span>Rs.{parseFloat(String(currentBill.total)).toFixed(2)}</span>
              </div>
              {(currentBill.payment_transactions?.length ?? 0) > 0 && (
                <div className="mt-2 space-y-1">
                  {currentBill.payment_transactions!.map((t, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{t.payment_type === 'advance' ? 'Advance' : 'Balance'} Rs.{parseFloat(String(t.amount)).toFixed(2)} on {formatPaymentDate(t.paid_at)} ({t.payment_method})</span>
                    </div>
                  ))}
                </div>
              )}
              {isPaid ? (
                <div className="flex justify-between text-emerald-700 font-semibold text-sm mt-1">
                  <span>Status</span>
                  <span>Paid</span>
                </div>
              ) : (
                <>
                  {paid > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span>Paid so far</span>
                      <span>Rs.{paid.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-amber-700 font-semibold text-sm mt-1">
                    <span>Balance due</span>
                    <span>Rs.{balance.toFixed(2)}</span>
                  </div>
                </>
              )}
              {(currentBill.payment_transactions?.length ?? 0) === 0 && (
                <div className="text-sm mt-2">Payment: {currentBill.payment_method}</div>
              )}
              {currentBill.notes && <div className="text-sm mt-1">Notes: {currentBill.notes}</div>}
            </div>
          </div>
        </div>
      </div>
      {showPayBalance && (
        <PayBalanceModal
          bill={currentBill}
          onClose={() => setShowPayBalance(false)}
          onPaid={handleBalancePaid}
        />
      )}
    </div>
  );
}
