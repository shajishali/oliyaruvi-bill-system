import { useEffect, useState } from 'react';
import { api } from '../../api/client';

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

function buildPrintHtml(bill, settings, format) {
  const shop = settings.shop_name || 'Oliyaruvi Printers';
  const address = settings.address || 'Enter your shop address here';
  const contact = settings.contact || 'Enter contact number';

  const rows = (bill.items || []).map(
    (item) =>
      `<tr>
        <td>${item.item_name}</td>
        <td>${item.size || '-'}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">₹${parseFloat(item.unit_price).toFixed(2)}</td>
        <td class="num">₹${parseFloat(item.subtotal).toFixed(2)}</td>
      </tr>`
  ).join('');

  const styles = format === 'thermal' ? THERMAL_STYLES : A4_STYLES;

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
          <th>Item</th><th>Size</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">
      ${bill.discount > 0 ? `<div class="bill-info"><span>Discount</span><span class="num">-₹${parseFloat(bill.discount).toFixed(2)}</span></div>` : ''}
      <div class="total-row bill-info"><span>Total</span><span class="num">₹${parseFloat(bill.total).toFixed(2)}</span></div>
      <div class="bill-info">Payment: ${bill.payment_method}</div>
      ${bill.notes ? `<div class="bill-info">Notes: ${bill.notes}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

export default function PrintBill({ bill, onClose }) {
  const [settings, setSettings] = useState({ shop_name: '', address: '', contact: '' });
  const [printFormat, setPrintFormat] = useState('a4');

  useEffect(() => {
    api.settings().then(setSettings);
  }, []);

  const handlePrint = () => {
    const shop = settings.shop_name || 'Oliyaruvi Printers';
    const address = settings.address || 'Enter your shop address here';
    const contact = settings.contact || 'Enter contact number';

    const html = buildPrintHtml(bill, { shop_name: shop, address, contact }, printFormat);

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 100);
  };

  const shop = settings.shop_name || 'Oliyaruvi Printers';
  const address = settings.address || 'Enter your shop address here';
  const contact = settings.contact || 'Enter contact number';

  const isThermal = printFormat === 'thermal';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 flex justify-between items-center border-b shrink-0">
          <h3 className="text-lg font-semibold">Print Preview</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Paper:</label>
              <select
                value={printFormat}
                onChange={(e) => setPrintFormat(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm"
              >
                <option value="a4">A4</option>
                <option value="thermal">Thermal (80mm)</option>
              </select>
            </div>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
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
              <span>Bill #: {bill.bill_number}</span>
              <span>Date: {bill.bill_date}</span>
            </div>
            <div className={`mb-3 ${isThermal ? 'text-[10px]' : 'text-sm'}`}>Customer: {bill.customer_name}</div>
            <table className={`w-full border-collapse ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1.5 text-left">Item</th>
                  <th className="border p-1.5 text-left">Size</th>
                  <th className="border p-1.5 text-right">Qty</th>
                  <th className="border p-1.5 text-right">Unit</th>
                  <th className="border p-1.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(bill.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="border p-1.5">{item.item_name}</td>
                    <td className="border p-1.5">{item.size || '-'}</td>
                    <td className="border p-1.5 text-right">{item.quantity}</td>
                    <td className="border p-1.5 text-right">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                    <td className="border p-1.5 text-right">₹{parseFloat(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t-2 border-black pt-3 mt-3">
              {bill.discount > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span>Discount</span>
                  <span>-₹{parseFloat(bill.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg mt-2">
                <span>Total</span>
                <span>₹{parseFloat(bill.total).toFixed(2)}</span>
              </div>
              <div className="text-sm mt-2">Payment: {bill.payment_method}</div>
              {bill.notes && <div className="text-sm mt-1">Notes: {bill.notes}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
