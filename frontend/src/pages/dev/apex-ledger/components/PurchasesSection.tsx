import React, { useState } from 'react';
import { PurchaseBill, Vendor } from '../types';
import { 
  Plus, 
  X, 
  CheckCircle 
} from 'lucide-react';

interface PurchasesSectionProps {
  bills: PurchaseBill[];
  setBills: React.Dispatch<React.SetStateAction<PurchaseBill[]>>;
  vendors: Vendor[];
}

export default function PurchasesSection({ bills, setBills, vendors }: PurchasesSectionProps) {
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || '');
  const [newBillNumber, setNewBillNumber] = useState('');
  const [billItemsStr, setBillItemsStr] = useState('');
  const [billAmount, setBillAmount] = useState<number>(0);
  const [billError, setBillError] = useState('');

  // Settle bill status to Paid
  const handleMarkAsPaid = (billId: string) => {
    setBills(prev => prev.map(bill => {
      if (bill.id === billId) {
        return { ...bill, status: 'Paid' };
      }
      return bill;
    }));
  };

  const handleCreateBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBillError('');

    if (!newBillNumber || billAmount <= 0) {
      setBillError('Please fill in a unique Bill Number and a positive amount.');
      return;
    }

    const vendor = vendors.find(v => v.id === selectedVendorId);
    if (!vendor) {
      setBillError('Selected vendor is invalid.');
      return;
    }

    const nextBill: PurchaseBill = {
      id: Math.random().toString(36).substring(2, 11),
      billNumber: newBillNumber,
      vendorId: selectedVendorId,
      vendorName: vendor.name,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [
        {
          id: '1',
          description: billItemsStr || 'General Supplier Materials / Goods COGS',
          quantity: 1,
          unitPrice: billAmount,
          total: billAmount
        }
      ],
      taxAmount: Math.round(billAmount * 0.05),
      totalAmount: Math.round(billAmount * 1.05),
      status: 'Approved',
      currency: 'SYP'
    };

    setBills(prev => [...prev, nextBill]);
    setIsAddBillOpen(false);

    // Resetform state
    setNewBillNumber('');
    setBillItemsStr('');
    setBillAmount(0);
  };

  const fmt = (num: number) => num.toLocaleString('en-US');

  // Derive sums
  const accountsPayableSum = bills
    .filter(b => b.status === 'Approved' || b.status === 'Draft')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const totalPaidBills = bills
    .filter(b => b.status === 'Paid')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Header action panel */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Purchases & Payables Module</h1>
          <p className="text-xs text-slate-500">Coordinate incoming trade vendor bills, monitor accounts payable, and register material source credits.</p>
        </div>
        <button
          onClick={() => setIsAddBillOpen(true)}
          className="inline-flex items-center text-xs font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] px-3.5 py-2 rounded shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-1 text-white" />
          Add Vendor Bill
        </button>
      </div>

      {/* Metric panels cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Accounts Payable Outstanding</span>
          <div className="mt-2 flex items-baseline">
            <span className="text-lg font-black text-slate-800 font-mono tracking-tight">{fmt(accountsPayableSum)}</span>
            <span className="text-[10px] text-slate-400 ml-1.5 font-sans font-bold">SYP</span>
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">Trade credit settlements queued</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Settled Expenditures FY</span>
          <div className="mt-2 flex items-baseline">
            <span className="text-lg font-black text-slate-850 font-mono tracking-tight">{fmt(totalPaidBills)}</span>
            <span className="text-[10px] text-slate-400 ml-1.5 font-sans font-bold">SYP</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-1 flex items-center gap-0.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 inline" /> Fully reconcile posted receipts
          </span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Vendor Nodes</span>
          <div className="mt-2 flex items-baseline">
            <span className="text-lg font-black text-blue-600 font-mono tracking-tight">{vendors.length}</span>
            <span className="text-xs text-zinc-400 ml-1.5 font-sans font-normal">Active partners</span>
          </div>
          <span className="text-[10px] text-zinc-400 block mt-1">Sourcing ledger channels</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Vendor and Purchase Bills logs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm">
            <div className="p-4 border-b border-zinc-150">
              <h2 className="text-xs font-black uppercase text-slate-700 tracking-wider">Historical Sourcing Bill Postings</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Bill Number</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Vendor / Supplier</th>
                    <th className="py-2.5 px-3 text-right">Raw Total SYP</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {bills.map(bill => (
                    <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-805">{bill.billNumber}</td>
                      <td className="py-3 px-3 tabular-nums text-slate-505">{bill.date}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700 max-w-[190px] truncate">{bill.vendorName}</td>
                      <td className="py-3 px-3 font-bold text-right font-mono text-slate-805">{fmt(bill.totalAmount)}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            bill.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' :
                            bill.status === 'Approved' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {bill.status}
                          </span>
                          {bill.status !== 'Paid' && (
                            <button
                              onClick={() => handleMarkAsPaid(bill.id)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-2 py-0.5 rounded transition-all"
                            >
                              Settle / Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Vendors profiles sidepanel */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm p-4 h-fit">
          <h2 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-4">Trade Suppliers Index</h2>
          <div className="space-y-4">
            {vendors.map((vend) => (
              <div key={vend.id} className="p-3 bg-zinc-50 rounded-lg border border-[#F1F3F5] flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-xs block truncate max-w-[190px]">{vend.name}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{vend.company} · {vend.email}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold block text-slate-800">
                    {fmt(vend.balance)} <span className="text-[9px] text-slate-405 font-sans font-normal block">Outstanding</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bill Drawer Module */}
      {isAddBillOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <form 
            onSubmit={handleCreateBillSubmit}
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800">Log incoming Trade Vendor Bill</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Map supply pricing and administrative costs perfectly into appropriate ledger structures.</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddBillOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {billError && (
              <div className="bg-rose-50 text-rose-700 p-2 text-xs rounded-md mb-4 font-semibold">
                {billError}
              </div>
            )}

            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-655 uppercase mb-1">Trade Vendor / Supplier</label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 outline-none"
                >
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.company})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-655 uppercase mb-1">Bill Reference ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BILL-SUP-99120"
                  value={newBillNumber}
                  onChange={(e) => setNewBillNumber(e.target.value)}
                  className="w-full text-xs text-slate-705 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-655 uppercase mb-1">Purchased items / services brief</label>
                <input
                  type="text"
                  placeholder="e.g. Mechanical anchors supply packaging tier-C"
                  value={billItemsStr}
                  onChange={(e) => setBillItemsStr(e.target.value)}
                  className="w-full text-xs text-slate-705 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-655 uppercase mb-1">Bill amount (Before Taxes) SYP</label>
                <input
                  type="number"
                  min={1}
                  required
                  placeholder="0.00"
                  value={billAmount || ''}
                  onChange={(e) => setBillAmount(Number(e.target.value))}
                  className="w-full text-xs text-slate-705 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 font-mono tabular-nums outline-none"
                />
              </div>

            </div>

            <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-md space-y-1 mt-4 mb-4 text-xs">
              <div className="flex justify-between">
                <span>Value:</span>
                <span className="font-mono text-slate-700 font-bold">{fmt(billAmount)} SYP</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 font-black text-slate-805">
                <span>Calculated bill sum (inc 5% vat):</span>
                <span className="font-mono">{fmt(Math.round(billAmount * 1.05))} SYP</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsAddBillOpen(false)}
                className="flex-1 text-[11px] font-bold text-slate-655 bg-slate-50 hover:bg-slate-100 border border-slate-200 py-2 rounded-md"
              >
                Cancel / Reset
              </button>
              <button
                type="submit"
                className="flex-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 py-2 rounded-md shadow-sm"
              >
                Approved Bill & Save
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
