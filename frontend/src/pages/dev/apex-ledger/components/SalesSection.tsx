import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { SalesOrder, Invoice, Customer, InventoryItem, LineItem } from '../types';
import SalesPage2 from './SalesPage2';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import { useAuth } from '../../../../context/AuthContext';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { 
  FileCheck, 
  AlertCircle, 
  ChevronRight, 
  Plus, 
  X,
  PlusCircle, 
  Trash2,
  BookmarkCheck,
  CheckCircle,
  HelpCircle,
  Edit,
  FileText,
  Sparkles,
  Paperclip
} from 'lucide-react';

interface SalesSectionProps {
  salesOrders: SalesOrder[];
  setSalesOrders: React.Dispatch<React.SetStateAction<SalesOrder[]>>;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  customers: Customer[];
  inventory: InventoryItem[];
}

export default function SalesSection({ 
  salesOrders, 
  setSalesOrders, 
  invoices, 
  setInvoices, 
  customers, 
  inventory 
}: SalesSectionProps) {
  const { company } = useCompanyAccess();
  const { user } = useAuth();
  const companyName = company?.name || 'Current Company';
  const currentUserName = user?.displayName || user?.email || 'Current user';
  
  // Slide Over for New SO
  const [isAddSOOpen, setIsAddSOOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [selectedItems, setSelectedItems] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([
    { productId: inventory[0]?.id || '', quantity: 1, unitPrice: inventory[0]?.salePrice || 0 }
  ]);
  const [soError, setSoError] = useState('');

  // Selected invoice details modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // High-Density Editor Screen State
  const [editorActive, setEditorActive] = useState(false);
  const [useErpLayout, setUseErpLayout] = useState(true);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [pendingDeleteInvoiceId, setPendingDeleteInvoiceId] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedCustomerIdForEditor, setSelectedCustomerIdForEditor] = useState(customers[0]?.id || '');
  const [editorDate, setEditorDate] = useState('');
  const [editorDueDate, setEditorDueDate] = useState('');
  const [editorCurrency, setEditorCurrency] = useState('SYP');
  const [editorExchangeRate, setEditorExchangeRate] = useState<number>(1);
  const [salesOrderRef, setSalesOrderRef] = useState('');
  const [invoiceTemplate, setInvoiceTemplate] = useState('Sales Invoice (Direct) - Copy');
  const [salesperson, setSalesperson] = useState('None');
  const [customerInvoiceNo, setCustomerInvoiceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [editorStatus, setEditorStatus] = useState<'Draft' | 'Approved' | 'Posted' | 'Paid' | 'Overdue'>('Draft');

  const [editorLines, setEditorLines] = useState<any[]>([]);
  const [editorCharges, setEditorCharges] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);

  const defaultAccountsLines = [
    {
      id: '1',
      code: '413',
      name: 'Sales discounts',
      discount: 0,
      discountPct: 0,
      additions: 0,
      additionPct: 0,
      notes: 'Line Discount allocation',
      parity: 1.00,
      equivalent: 0,
      category: 'Operating',
      costCenter: 'Sales Dept',
      contraAccount: '501 Purchases'
    },
    {
      id: '2',
      code: '423',
      name: 'Various Revenues',
      discount: 0,
      discountPct: 0,
      additions: 0,
      additionPct: 0,
      notes: 'Service charges and tax revenues',
      parity: 1.00,
      equivalent: 0,
      category: 'Financials',
      costCenter: 'HQ Internal',
      contraAccount: '111 Cash Safe'
    }
  ];

  const [accountsLines, setAccountsLines] = useState<any[]>(defaultAccountsLines);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);

  // Open high-density interactive editor
  const openInvoiceEditor = (inv: Invoice | null) => {
    if (inv) {
      setEditInvoiceId(inv.id);
      setInvoiceNumber(inv.invoiceNumber);
      setSelectedCustomerIdForEditor(inv.customerId);
      setEditorDate(inv.date);
      setEditorDueDate(inv.dueDate);
      setEditorStatus(inv.status);
      setEditorCurrency(inv.currency);
      setEditorExchangeRate((inv as any).exchangeRate || 1);
      setSalesOrderRef((inv as any).salesOrderRef || '');
      setInvoiceTemplate((inv as any).invoiceTemplate || 'Sales Invoice (Direct) - Copy');
      setSalesperson((inv as any).salesperson || 'None');
      setCustomerInvoiceNo((inv as any).customerInvoiceNo || '');
      setNotes((inv as any).notes || '');
      
      if (inv.items && inv.items.length > 0) {
        setEditorLines(inv.items.map(item => ({
          id: item.id,
          productId: item.productId || '',
          qty: item.quantity,
          uom: (item as any).uom || 'PCS',
          unitPrice: item.unitPrice,
          discountType: (item as any).discountType || 'No Discount',
          discount: (item as any).discount || 0,
          taxCode: (item as any).taxCode || 'No Tax',
          warehouse: (item as any).warehouse || 'MAIN - Main Warehouse'
        })));
      } else {
        setEditorLines([{
          id: '1',
          productId: inventory[0]?.id || '',
          qty: 1,
          uom: 'PCS',
          unitPrice: inventory[0]?.salePrice || 0,
          discountType: 'No Discount',
          discount: 0,
          taxCode: 'No Tax',
          warehouse: 'MAIN - Main Warehouse'
        }]);
      }
      setEditorCharges((inv as any).charges || []);
      setAttachments((inv as any).attachments || []);
      setAccountsLines((inv as any).accountsLines || defaultAccountsLines);
    } else {
      setEditInvoiceId(null);
      const nextInvNo = `SI-0000${invoices.length + 1}`;
      setInvoiceNumber(nextInvNo);
      setSelectedCustomerIdForEditor(customers[0]?.id || '');
      setEditorDate(new Date().toISOString().split('T')[0]);
      setEditorDueDate(new Date().toISOString().split('T')[0]);
      setEditorStatus('Draft');
      setEditorCurrency('SYP');
      setEditorExchangeRate(1);
      setSalesOrderRef('');
      setInvoiceTemplate('Sales Invoice (Direct) - Copy');
      setSalesperson('None');
      setCustomerInvoiceNo('');
      setNotes('');
      setEditorLines([{
        id: '1',
        productId: inventory[0]?.id || '',
        qty: 1,
        uom: 'PCS',
        unitPrice: inventory[0]?.salePrice || 0,
        discountType: 'No Discount',
        discount: 0,
        taxCode: 'No Tax',
        warehouse: 'MAIN - Main Warehouse'
      }]);
      setEditorCharges([]);
      setAttachments([]);
      setAccountsLines(defaultAccountsLines);
    }
    setEditorActive(true);
  };

  // Derive KPIs beautifully and dynamically from state!
  const totalRevenue = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const outstandingAR = invoices
    .filter(inv => inv.status === 'Posted' || inv.status === 'Overdue')
    .reduce((sum, inv) => sum + (inv.totalAmount - inv.amountPaid), 0);

  const overdueInvoicesCount = invoices.filter(inv => inv.status === 'Overdue').length;
  const postedInvoicesCount = invoices.filter(inv => inv.status === 'Posted').length;

  const fmt = (num: number) => num.toLocaleString('en-US');

  // Handle line item addition in SO Drawer
  const handleAddLineItem = () => {
    setSelectedItems(prev => [...prev, { productId: inventory[0]?.id || '', quantity: 1, unitPrice: inventory[0]?.salePrice || 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (selectedItems.length === 1) return;
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemProductChange = (index: number, prodId: string) => {
    const prod = inventory.find(p => p.id === prodId);
    setSelectedItems(prev => {
      const next = [...prev];
      next[index].productId = prodId;
      if (prod) {
        next[index].unitPrice = prod.salePrice;
      }
      return next;
    });
  };

  const handleItemQtyChange = (index: number, val: number) => {
    setSelectedItems(prev => {
      const next = [...prev];
      next[index].quantity = Math.max(1, val);
      return next;
    });
  };

  const handleItemPriceChange = (index: number, val: number) => {
    setSelectedItems(prev => {
      const next = [...prev];
      next[index].unitPrice = Math.max(0, val);
      return next;
    });
  };

  // Submit SO Creation
  const handleCreateSOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSoError('');

    if (selectedItems.length === 0) {
      setSoError('Please add at least one line item.');
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) {
      setSoError('Selected customer is invalid.');
      return;
    }

    // Map selected products to Line items
    const lines: LineItem[] = selectedItems.map((s, idx) => {
      const prod = inventory.find(p => p.id === s.productId);
      return {
        id: (idx + 1).toString(),
        productId: s.productId,
        description: prod ? prod.name : 'Unknown Product Component',
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        total: s.quantity * s.unitPrice
      };
    });

    const subtotal = lines.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = Math.round(subtotal * 0.05); // 5% tax rate
    const totalAmount = subtotal + taxAmount;

    const nextSONumber = `SO-2026-0${salesOrders.length + 1}`;
    const newSO: SalesOrder = {
      id: nextSONumber,
      soNumber: nextSONumber,
      customerId: selectedCustomerId,
      customerName: customer.name,
      date: new Date().toISOString().split('T')[0],
      items: lines,
      taxAmount,
      totalAmount,
      status: 'Approved',
      currency: 'SYP'
    };

    setSalesOrders(prev => [...prev, newSO]);

    // Automatically draft/post an invoice for this sales order to simulate active ERP workflows!
    const nextInvoiceNumber = `INV-2026-0${invoices.length + 1}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days credit term

    const newInvoice: Invoice = {
      id: nextInvoiceNumber,
      invoiceNumber: nextInvoiceNumber,
      customerId: selectedCustomerId,
      customerName: customer.name,
      date: newSO.date,
      dueDate: dueDate.toISOString().split('T')[0],
      items: lines,
      taxAmount,
      totalAmount,
      amountPaid: 0,
      status: 'Posted',
      currency: 'SYP'
    };

    setInvoices(prev => [...prev, newInvoice]);

    // Close and reset drawer
    setIsAddSOOpen(false);
    setSelectedItems([{ productId: inventory[0]?.id || '', quantity: 1, unitPrice: inventory[0]?.salePrice || 0 }]);
  };

  // Settle invoice directly (Change status from Posted/Overdue to Paid)
  const handleMarkAsPaid = (invoiceId: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id === invoiceId) {
        return {
          ...inv,
          status: 'Paid',
          amountPaid: inv.totalAmount
        };
      }
      return inv;
    }));
    // Also update selected modal if open
    setSelectedInvoice(prev => prev && prev.id === invoiceId ? { ...prev, status: 'Paid', amountPaid: prev.totalAmount } : prev);
  };

  // Interactive loaded lines handler (using sales orders lookup)
  const handleLoadSalesOrderLines = () => {
    if (!salesOrderRef) return;
    const so = salesOrders.find(s => s.soNumber === salesOrderRef);
    if (so) {
      setEditorLines(so.items.map((item, idx) => ({
        id: (idx + 1).toString(),
        productId: item.productId || '',
        qty: item.quantity,
        uom: 'PCS',
        unitPrice: item.unitPrice,
        discountType: 'No Discount',
        discount: 0,
        taxCode: 'No Tax',
        warehouse: 'MAIN - Main Warehouse'
      })));
      setSelectedCustomerIdForEditor(so.customerId);
    }
  };

  // Specific line pricing calculators
  const getLineCalculations = (line: any) => {
    const qty = Number(line.qty) || 0;
    const unitPrice = Number(line.unitPrice) || 0;
    const baseAmount = qty * unitPrice;
    
    let discountAmt = 0;
    if (line.discountType === 'Percentage') {
      discountAmt = baseAmount * ((Number(line.discount) || 0) / 100);
    } else if (line.discountType === 'Fixed') {
      discountAmt = Number(line.discount) || 0;
    }
    
    const taxableAmt = Math.max(0, baseAmount - discountAmt);
    
    let taxRate = 0;
    if (line.taxCode === 'VAT 5%') taxRate = 0.05;
    else if (line.taxCode === 'VAT 15%') taxRate = 0.15;
    else if (line.taxCode === 'Service 10%') taxRate = 0.10;
    
    const taxAmt = taxableAmt * taxRate;
    const totalAmt = taxableAmt + taxAmt;
    const baseVal = totalAmt / (Number(editorExchangeRate) || 1);

    return {
      discountAmt,
      lineTotal: totalAmt,
      tax: taxAmt,
      lineBase: baseVal,
      baseAmount
    };
  };

  // Cumulative totals compilers
  const getInvoiceTotals = () => {
    let subtotalSYP = 0;
    let taxSYP = 0;
    let chargesSYP = 0;

    editorLines.forEach(line => {
      const calcs = getLineCalculations(line);
      subtotalSYP += (Number(line.qty) * Number(line.unitPrice)) - calcs.discountAmt;
      taxSYP += calcs.tax;
    });

    editorCharges.forEach(charge => {
      const amt = Number(charge.amount) || 0;
      let chargeTaxRate = 0;
      if (charge.taxCode === 'VAT 5%') chargeTaxRate = 0.05;
      else if (charge.taxCode === 'VAT 15%') chargeTaxRate = 0.15;
      chargesSYP += amt;
      taxSYP += (amt * chargeTaxRate);
    });

    let totalDiscountFromAccounts = 0;
    let totalAdditionFromAccounts = 0;

    accountsLines.forEach(act => {
      if (Number(act.discount) > 0) {
        totalDiscountFromAccounts += Number(act.discount);
      } else if (Number(act.discountPct) > 0) {
        totalDiscountFromAccounts += subtotalSYP * (Number(act.discountPct) / 100);
      }

      if (Number(act.additions) > 0) {
        totalAdditionFromAccounts += Number(act.additions);
      } else if (Number(act.additionPct) > 0) {
        totalAdditionFromAccounts += subtotalSYP * (Number(act.additionPct) / 100);
      }
    });

    const grandTotalSYP = Math.max(0, subtotalSYP + chargesSYP + taxSYP - totalDiscountFromAccounts + totalAdditionFromAccounts);
    const exRate = Number(editorExchangeRate) || 1;

    return {
      subtotalSYP,
      taxSYP,
      chargesSYP,
      grandTotalSYP,
      subtotalBase: subtotalSYP / exRate,
      taxBase: taxSYP / exRate,
      chargesBase: chargesSYP / exRate,
      grandTotalBase: grandTotalSYP / exRate,
      totalDiscountFromAccounts,
      totalAdditionFromAccounts
    };
  };

  const totals = getInvoiceTotals();

  // Save/Publish the final invoice
  const handlePublishInvoice = (tgtStatus: 'Draft' | 'Approved' | 'Posted' | 'Paid' | 'Overdue') => {
    const cust = customers.find(c => c.id === selectedCustomerIdForEditor);
    if (!cust) return;

    const mappedItems: LineItem[] = editorLines.map((line, idx) => {
      const prod = inventory.find(p => p.id === line.productId);
      return {
        id: (idx + 1).toString(),
        productId: line.productId,
        description: prod ? prod.name : 'Unknown Product Component',
        quantity: Number(line.qty) || 1,
        unitPrice: Number(line.unitPrice) || 0,
        total: (Number(line.qty) * Number(line.unitPrice))
      };
    });

    const isNew = !editInvoiceId;
    const invId = isNew ? `INV-2026-0${invoices.length + 1}` : editInvoiceId;

    const finalInvoice: Invoice = {
      id: invId,
      invoiceNumber: invoiceNumber || invId,
      customerId: selectedCustomerIdForEditor,
      customerName: cust.name,
      date: editorDate,
      dueDate: editorDueDate || editorDate,
      items: mappedItems,
      taxAmount: totals.taxSYP,
      totalAmount: totals.grandTotalSYP,
      amountPaid: tgtStatus === 'Paid' ? totals.grandTotalSYP : 0,
      status: tgtStatus,
      currency: editorCurrency
    };

    // Stash custom extended parameters backward-compatibly
    (finalInvoice as any).exchangeRate = editorExchangeRate;
    (finalInvoice as any).salesOrderRef = salesOrderRef;
    (finalInvoice as any).invoiceTemplate = invoiceTemplate;
    (finalInvoice as any).salesperson = salesperson;
    (finalInvoice as any).customerInvoiceNo = customerInvoiceNo;
    (finalInvoice as any).notes = notes;
    (finalInvoice as any).charges = editorCharges;
    (finalInvoice as any).attachments = attachments;
    (finalInvoice as any).accountsLines = accountsLines;

    if (isNew) {
      setInvoices(prev => [...prev, finalInvoice]);
    } else {
      setInvoices(prev => prev.map(inv => inv.id === editInvoiceId ? finalInvoice : inv));
    }

    setEditorActive(false);
  };

  const handleConfirmDeleteInvoice = () => {
    if (!pendingDeleteInvoiceId) return;

    setInvoices(prev => prev.filter(inv => inv.id !== pendingDeleteInvoiceId));
    toast.success('Invoice deleted');
    setPendingDeleteInvoiceId(null);
    setEditorActive(false);
  };

  // IF editor mode is operating, render the pristine compact tabular view!
  if (editorActive) {
    if (useErpLayout) {
      return (
        <div className="space-y-3">
          {/* Layout switcher header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-indigo-950 border border-slate-700 px-4 py-2 rounded-lg shadow-sm text-white font-sans">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold">Display Layout:</span>
              <span className="text-xs font-black text-amber-350 font-mono">Page 2 — Comprehensive ERP Grid</span>
            </div>
            <button
              onClick={() => setUseErpLayout(false)}
              className="text-xs font-bold text-indigo-255 hover:text-white bg-white/10 hover:bg-white/20 py-1 px-2.5 rounded-md transition"
            >
              Switch to Standard Layout &rarr;
            </button>
          </div>
          <SalesPage2
            onClose={() => setEditorActive(false)}
            customers={customers}
            inventory={inventory}
            invoices={invoices}
            setInvoices={setInvoices}
            editInvoiceId={editInvoiceId}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4 font-sans">
        {/* Layout switcher header */}
        <div className="flex items-center justify-between bg-slate-100 border border-slate-205 px-4 py-2 rounded-lg text-slate-800">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span className="text-xs font-bold">Display Layout:</span>
            <span className="text-xs font-semibold text-slate-600">Standard Modern Theme</span>
          </div>
          <button
            onClick={() => setUseErpLayout(true)}
            className="text-xs font-bold text-blue-600 hover:bg-blue-50 py-1 px-2.5 rounded border border-blue-200 transition"
          >
            Switch to Page 2 (ERP Layout) &rarr;
          </button>
        </div>

        {/* Top interactive status bar */}
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200/85 text-xs gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase block">Sales Invoice Voucher</span>
              <h1 className="text-base font-black text-slate-800 font-mono flex items-center gap-1.5 leading-none">
                <FileText className="w-4 h-4 text-blue-600" />
                {invoiceNumber || 'SI-XXXXX'}
              </h1>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 mt-1 block">
              Customer: <span className="text-slate-800 font-bold">{customers.find(c => c.id === selectedCustomerIdForEditor)?.name || 'None selected'}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-[10px] text-zinc-500 flex items-center space-x-1 shadow-sm">
              <span className="text-zinc-400 font-bold">INVOICE DATE:</span>
              <span className="text-slate-800 font-black">{editorDate}</span>
            </div>
            <div className="px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-[10px] text-zinc-500 flex items-center space-x-1 shadow-sm">
              <span className="text-zinc-400 font-bold">DUE DATE:</span>
              <span className="text-slate-800 font-black">{editorDueDate || '-'}</span>
            </div>
            <div className="px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-[10px] text-zinc-500 flex items-center space-x-1 shadow-sm">
              <span className="text-zinc-400 font-bold">SO REF:</span>
              <span className="text-slate-800 font-black">{salesOrderRef || '-'}</span>
            </div>
            <div className="px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-[10px] text-zinc-500 flex items-center space-x-1 shadow-sm">
              <span className="text-zinc-400 font-bold">CURRENCY:</span>
              <span className="text-slate-800 font-black">{editorCurrency}</span>
            </div>
            <div className="px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-[10px] text-zinc-500 flex items-center space-x-1 shadow-sm">
              <span className="text-zinc-400 font-bold">EXCHANGE RATE:</span>
              <span className="text-slate-800 font-black">{editorExchangeRate}</span>
            </div>
            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded tracking-wider shadow-inner ${
              editorStatus === 'Draft' ? 'bg-slate-100 text-slate-600' :
              editorStatus === 'Posted' ? 'bg-blue-50 text-blue-700' :
              editorStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 font-extrabold' : 'bg-rose-50 text-rose-700 animate-pulse'
            }`}>
              {editorStatus}
            </span>
          </div>
        </div>

        {/* 1. Header Grid parameters */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm text-xs">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Sales Order (optional)</label>
              <div className="flex space-x-1">
                <select
                  value={salesOrderRef}
                  onChange={(e) => setSalesOrderRef(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 text-xs outline-none focus:border-blue-500"
                >
                  <option value="">No sales order</option>
                  {salesOrders.map(so => (
                    <option key={so.id} value={so.soNumber}>{so.soNumber}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleLoadSalesOrderLines}
                  disabled={!salesOrderRef}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold px-2 py-1 rounded text-xs disabled:opacity-50 transition"
                >
                  Load Lines
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Invoice Template</label>
              <select
                value={invoiceTemplate}
                onChange={(e) => setInvoiceTemplate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 text-xs outline-none focus:border-blue-500"
              >
                <option>Sales Invoice (Direct) - Copy</option>
                <option>Standard Tax Invoice</option>
                <option>Commercial Billing Layout</option>
              </select>
              <span className="text-[9px] text-slate-400 mt-0.5 block font-medium">Controls the print layout logo/footer</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Customer</label>
              <select
                value={selectedCustomerIdForEditor}
                onChange={(e) => {
                  setSelectedCustomerIdForEditor(e.target.value);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 text-xs outline-none focus:border-blue-500 font-semibold"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Salesperson</label>
              <select
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 text-xs outline-none focus:border-blue-500"
              >
                <option>None</option>
                <option>{currentUserName}</option>
                <option>Roni K.</option>
                <option>Youssef S.</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Customer Invoice #</label>
              <input
                type="text"
                value={customerInvoiceNo}
                onChange={(e) => setCustomerInvoiceNo(e.target.value)}
                placeholder="eg. PO-7492-99"
                className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Invoice Date</label>
              <input
                type="date"
                value={editorDate}
                onChange={(e) => setEditorDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 text-xs outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Due Date (optional)</label>
              <input
                type="date"
                value={editorDueDate}
                onChange={(e) => setEditorDueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 text-xs outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-bold">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Currency</label>
                <select
                  value={editorCurrency}
                  onChange={(e) => setEditorCurrency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-blue-550 font-black"
                >
                  <option value="SYP">SYP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5 font-sans">Exchange Rate</label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  value={editorExchangeRate}
                  onChange={(e) => setEditorExchangeRate(parseFloat(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div className="mt-2.5">
            <label className="block font-bold text-slate-700 mb-0.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={1}
              placeholder="Private bank terms, routing guarantees, loading/shipping terms..."
              className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 text-xs outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* 2. Compact Line Items Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-3 bg-blue-500 inline-block rounded-xs"></span>
              Line Items Table
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditorLines(prev => [...prev, {
                  id: (prev.length + 1).toString(),
                  productId: inventory[0]?.id || '',
                  qty: 1,
                  uom: 'PCS',
                  unitPrice: inventory[0]?.salePrice || 0,
                  discountType: 'No Discount',
                  discount: 0,
                  taxCode: 'No Tax',
                  warehouse: 'MAIN - Main Warehouse'
                }]);
              }}
              className="inline-flex items-center text-xs font-bold text-blue-600 border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded transition shadow-sm bg-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Item
            </button>
          </div>

          <div className="w-full overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-150 rounded-lg relative scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs select-none min-w-[1200px]">
              <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                <tr className="bg-slate-50 border-b border-slate-200 font-mono font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20" style={{ width: '280px' }}>Item</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20" style={{ width: '70px' }}>Qty</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20" style={{ width: '80px' }}>UOM</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20 text-right" style={{ width: '110px' }}>Unit Price (SYP)</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20" style={{ width: '120px' }}>Discount Type</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20" style={{ width: '80px' }}>Discount</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20" style={{ width: '110px' }}>Tax Code</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20" style={{ width: '200px' }}>Warehouse</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20 text-right">Discount Amt</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20 text-right">Line Total</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20 text-right">Tax</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20 text-right">Line Base</th>
                  <th className="py-2 px-2 sticky top-0 bg-slate-50 z-20 text-center" style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {editorLines.map((line, index) => {
                  const calcs = getLineCalculations(line);
                  return (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="py-1 px-1">
                        <select
                          value={line.productId}
                          onChange={(e) => {
                            const prodId = e.target.value;
                            const prod = inventory.find(i => i.id === prodId);
                            setEditorLines(lines => lines.map((l, i) => i === index ? {
                              ...l,
                              productId: prodId,
                              unitPrice: prod ? prod.salePrice : l.unitPrice
                            } : l));
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-1 py-1 text-slate-700 outline-none text-xs focus:border-blue-500"
                        >
                          {inventory.map(prod => (
                            <option key={prod.id} value={prod.id}>
                              [{prod.sku}] - {prod.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-1 px-1">
                        <input
                          type="number"
                          min="1"
                          value={line.qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setEditorLines(lines => lines.map((l, i) => i === index ? { ...l, qty: val } : l));
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 outline-none text-xs focus:border-blue-500 text-center font-bold"
                        />
                      </td>

                      <td className="py-1 px-1">
                        <select
                          value={line.uom}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditorLines(lines => lines.map((l, i) => i === index ? { ...l, uom: val } : l));
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-1 py-1 text-slate-700 outline-none text-xs focus:border-blue-500"
                        >
                          <option value="PCS">PCS</option>
                          <option value="LTR">LTR</option>
                          <option value="KG">KG</option>
                          <option value="BOX">BOX</option>
                          <option value="PKG">PKG</option>
                        </select>
                      </td>

                      <td className="py-1 px-1">
                        <input
                          type="number"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditorLines(lines => lines.map((l, i) => i === index ? { ...l, unitPrice: val } : l));
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 outline-none text-xs focus:border-blue-500 font-mono text-right font-medium"
                        />
                      </td>

                      <td className="py-1 px-1">
                        <select
                          value={line.discountType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditorLines(lines => lines.map((l, i) => i === index ? { ...l, discountType: val, discount: 0 } : l));
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-1 py-1 text-slate-700 outline-none text-xs focus:border-blue-550"
                        >
                          <option value="No Discount">No Discount</option>
                          <option value="Percentage">Percentage %</option>
                          <option value="Fixed">Fixed SYP</option>
                        </select>
                      </td>

                      <td className="py-1 px-1">
                        <input
                          type="number"
                          min="0"
                          disabled={line.discountType === 'No Discount'}
                          value={line.discount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditorLines(lines => lines.map((l, i) => i === index ? { ...l, discount: val } : l));
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-1 py-1 text-slate-705 outline-none text-xs focus:border-blue-550 font-mono disabled:opacity-40 text-center font-semibold"
                        />
                      </td>

                      <td className="py-1 px-1">
                        <select
                          value={line.taxCode}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditorLines(lines => lines.map((l, i) => i === index ? { ...l, taxCode: val } : l));
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-1 py-1 text-slate-705 outline-none text-xs focus:border-blue-550"
                        >
                          <option value="No Tax">No Tax</option>
                          <option value="VAT 5%">VAT 5%</option>
                          <option value="VAT 15%">VAT 15%</option>
                          <option value="Service 10%">Service 10%</option>
                        </select>
                      </td>

                      <td className="py-1 px-1">
                        <select
                          value={line.warehouse}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditorLines(lines => lines.map((l, i) => i === index ? { ...l, warehouse: val } : l));
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-1 py-1 text-slate-705 outline-none text-xs focus:border-blue-550"
                        >
                          <option value="MAIN - Main Warehouse">MAIN - Main Warehouse</option>
                          <option value="AL-BASEL - Al-Basel Yard">AL-BASEL - Al-Basel Yard</option>
                          <option value="TRANSIT - Transit Hub 3">TRANSIT - Transit Hub 3</option>
                        </select>
                      </td>

                      <td className="py-1 px-2 text-right font-mono text-slate-500 bg-slate-50/20 font-medium">
                        {fmt(calcs.discountAmt)}
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-bold text-slate-800 bg-slate-50/20">
                        {fmt(calcs.lineTotal)}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-emerald-600 bg-slate-50/20 font-bold">
                        {fmt(calcs.tax)}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-slate-500 bg-slate-50/20 font-medium">
                        {fmt(calcs.lineBase)}
                      </td>

                      <td className="py-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (editorLines.length === 1) return;
                            setEditorLines(prev => prev.filter((_, i) => i !== index));
                          }}
                          disabled={editorLines.length === 1}
                          className="text-slate-400 hover:text-rose-600 hover:bg-slate-100 p-1 rounded transition disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Charges / Additions */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-3 bg-amber-500 inline-block rounded-xs"></span>
              Charges / Additions
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditorCharges(prev => [...prev, {
                  id: (prev.length + 1).toString(),
                  name: 'shipping',
                  amount: 50,
                  taxCode: 'No Tax',
                  description: ''
                }]);
              }}
              className="inline-flex items-center text-xs font-bold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 rounded transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Charge
            </button>
          </div>

          {editorCharges.length === 0 ? (
            <div className="text-center py-3 border border-dashed border-slate-150 rounded-md text-slate-400 font-medium text-[11px]">
              No extra charges added. Add shipping, handling, or processing fees directly to invoice total.
            </div>
          ) : (
            <div className="space-y-1.5">
              {editorCharges.map((charge, index) => {
                const amt = Number(charge.amount) || 0;
                let taxRate = 0;
                if (charge.taxCode === 'VAT 5%') taxRate = 0.05;
                else if (charge.taxCode === 'VAT 15%') taxRate = 0.15;
                const taxAmt = amt * taxRate;
                const totalAmt = amt + taxAmt;

                return (
                  <div key={charge.id} className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-md">
                    <input
                      type="text"
                      placeholder="Shipping/Freight"
                      value={charge.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditorCharges(prev => prev.map((c, i) => i === index ? { ...c, name: val } : c));
                      }}
                      className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 w-44 font-semibold text-slate-700"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      min="0"
                      value={charge.amount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditorCharges(prev => prev.map((c, i) => i === index ? { ...c, amount: val } : c));
                      }}
                      className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 w-28 font-mono text-slate-700 font-bold"
                    />
                    <select
                      value={charge.taxCode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditorCharges(prev => prev.map((c, i) => i === index ? { ...c, taxCode: val } : c));
                      }}
                      className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 w-32"
                    >
                      <option value="No Tax">No Tax</option>
                      <option value="VAT 5%">VAT 5%</option>
                      <option value="VAT 15%">VAT 15%</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={charge.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditorCharges(prev => prev.map((c, i) => i === index ? { ...c, description: val } : c));
                      }}
                      className="flex-1 min-w-[150px] bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 outline-none text-xs focus:border-blue-500"
                    />
                    <div className="text-right text-xs font-bold text-slate-655 px-2 font-mono">
                      SYP {fmt(totalAmt)} <span className="text-[10px] text-zinc-400 font-normal">(Tax: SYP {fmt(taxAmt)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditorCharges(prev => prev.filter((_, i) => i !== index));
                      }}
                      className="text-slate-400 hover:text-rose-600 hover:bg-slate-100 p-1 rounded transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Account Ledger & Financial Taxes Allocation Grid */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-indigo-500 inline-block rounded-xs"></span>
              Account Ledger & Financial Taxes Allocation Grid
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAccountsLines(prev => prev.map(l => {
                    if (l.code === '413') {
                      return { ...l, discountPct: 2, discount: 0, notes: 'Discount 2% Promo applied' };
                    }
                    if (l.code === '423') {
                      return { ...l, additionPct: 5, additions: 0, notes: 'VAT Tax Template (5%) applied' };
                    }
                    return l;
                  }));
                }}
                className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-250 font-bold text-[10px] px-2 py-1 rounded transition flex items-center gap-1 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> Apply Syrian Tax Presets (5% VAT & 2% Dis)
              </button>
              
              <button
                type="button"
                onClick={() => setIsAttachmentModalOpen(true)}
                className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-250 font-bold text-[10px] px-2 py-1 rounded transition flex items-center gap-1 shadow-2xs"
              >
                <Paperclip className="w-3.5 h-3.5 text-indigo-500" /> Manage Attachments ({attachments.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[160px] overflow-y-auto scrollbar-thin border border-slate-150 rounded">
            <table className="w-full text-left border-collapse text-[10px] min-w-[950px]">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[8px] font-mono shadow-xs">
                <tr>
                  <th className="py-2 px-1.5 text-center" style={{ width: '35px' }}>#</th>
                  <th className="py-2 px-1.5" style={{ width: '160px' }}>Account allocation</th>
                  <th className="py-2 px-1.5" style={{ width: '90px' }}>Discount amt</th>
                  <th className="py-2 px-1.5" style={{ width: '90px' }}>Discount %</th>
                  <th className="py-2 px-1.5" style={{ width: '100px' }}>Additions (Tax)</th>
                  <th className="py-2 px-1.5" style={{ width: '90px' }}>Additions %</th>
                  <th className="py-2 px-1.5">Internal Accounting Notes</th>
                  <th className="py-2 px-1.5 text-center" style={{ width: '60px' }}>Parity</th>
                  <th className="py-2 px-1.5 text-right" style={{ width: '100px' }}>Equivalent</th>
                  <th className="py-2 px-1.5" style={{ width: '90px' }}>Category</th>
                  <th className="py-2 px-1.5" style={{ width: '100px' }}>Cost Center</th>
                  <th className="py-2 px-1.5" style={{ width: '110px' }}>Contra Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {accountsLines.map((line, index) => {
                  const isGreenBg = line.code === '423';
                  
                  // Calculate raw equivalent interactive component
                  const isDiscountRow = line.code === '413';
                  const equivalentAmt = isDiscountRow 
                    ? (Number(line.discount) || (totals.subtotalSYP * ((Number(line.discountPct) || 0) / 100)))
                    : (Number(line.additions) || (totals.subtotalSYP * ((Number(line.additionPct) || 0) / 100)));
                    
                  return (
                    <tr
                      key={line.id}
                      className={`hover:opacity-95 transition ${
                        isGreenBg ? 'bg-emerald-50/40 hover:bg-emerald-50' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-1 px-1.5 font-bold font-mono text-center text-slate-400">
                        {index + 1}
                      </td>

                      <td className="py-0.5 px-1.5 font-bold">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-1.5 py-0.5 rounded-sm font-mono text-[9px] ${isGreenBg ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'}`}>
                            {line.code}
                          </span>
                          <span className="text-slate-800 text-[10px]">{line.name}</span>
                        </div>
                      </td>

                      <td className="py-0.5 px-1">
                        <input
                          type="number"
                          min="0"
                          value={line.discount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setAccountsLines(prev => prev.map((l, i) => i === index ? { ...l, discount: val, discountPct: 0 } : l));
                          }}
                          placeholder="0"
                          className="w-full bg-white border border-slate-205 rounded py-0.5 px-1 font-mono text-center text-slate-800 font-bold"
                        />
                      </td>

                      <td className="py-0.5 px-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={line.discountPct || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setAccountsLines(prev => prev.map((l, i) => i === index ? { ...l, discountPct: val, discount: 0 } : l));
                          }}
                          placeholder="0.0%"
                          className="w-full bg-white border border-slate-205 rounded py-0.5 px-1 font-mono text-center text-slate-800 font-bold"
                        />
                      </td>

                      <td className="py-0.5 px-1">
                        <input
                          type="number"
                          min="0"
                          value={line.additions || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setAccountsLines(prev => prev.map((l, i) => i === index ? { ...l, additions: val, additionPct: 0 } : l));
                          }}
                          placeholder="0"
                          className="w-full bg-white border border-slate-205 rounded py-0.5 px-1 font-mono text-center text-slate-805 font-bold"
                        />
                      </td>

                      <td className="py-0.5 px-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={line.additionPct || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setAccountsLines(prev => prev.map((l, i) => i === index ? { ...l, additionPct: val, additions: 0 } : l));
                          }}
                          placeholder="0.0%"
                          className="w-full bg-white border border-slate-150 rounded py-0.5 px-1 font-mono text-center text-slate-805 font-bold"
                        />
                      </td>

                      <td className="py-0.5 px-1.5">
                        <input
                          type="text"
                          value={line.notes}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAccountsLines(prev => prev.map((l, i) => i === index ? { ...l, notes: val } : l));
                          }}
                          className="w-full bg-transparent border border-transparent font-medium text-slate-700 hover:border-slate-200 focus:bg-white focus:border-slate-300 rounded py-0.5 px-1 font-sans"
                          placeholder="Internal general ledger code note"
                        />
                      </td>

                      <td className="py-0.5 px-1.5 font-mono text-center text-slate-500 font-bold">
                        {line.parity.toFixed(2)}
                      </td>

                      <td className="py-0.5 px-1.5 text-right font-mono font-bold text-slate-700 bg-slate-50/50">
                        {equivalentAmt.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                      </td>

                      <td className="py-0.5 px-1.5 text-slate-500 italic font-mono">
                        {line.category}
                      </td>

                      <td className="py-0.5 px-1.5 text-slate-600">
                        {line.costCenter}
                      </td>

                      <td className="py-0.5 px-1.5 text-slate-600 font-mono">
                        {line.contraAccount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Elegant Modal Overlay for attachments */}
        {isAttachmentModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[1300] p-4 text-xs animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-4 py-3 flex items-center justify-between text-white font-sans">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-300" />
                  <span className="font-black text-xs uppercase tracking-wider">Manage Attachments & Vouchers</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAttachmentModalOpen(false)}
                  className="text-slate-300 hover:text-white p-1 hover:bg-white/10 rounded transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4 font-sans">
                <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-slate-500">
                  <div className="text-[10px] font-bold text-slate-805 mb-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Attachment Policy guidelines
                  </div>
                  <p className="text-[9px] leading-normal">
                    Attach supporting documents such as delivery orders, customer specification letters, bank transfers, or tax exemptions. Supports PNG, JPG, PDF, DOCX, XLSX up to 10 MB.
                  </p>
                </div>

                <div 
                  onClick={() => {
                    const dummyNames = ['delivery_ticket_0492.pdf', 'freight_quote_apex.png', 'customer_specification.docx', 'bank_wire_receipt.jpg'];
                    const randomName = dummyNames[Math.floor(Math.random() * dummyNames.length)];
                    const randomSize = (Math.random() * 2 + 0.1).toFixed(2) + ' MB';
                    setAttachments(prev => {
                      if (prev.length >= 8) return prev;
                      return [...prev, { name: randomName, size: randomSize }];
                    });
                  }}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/20 hover:bg-slate-50 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-1 group shadow-inner"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition">
                    <Plus className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="text-indigo-600 font-bold hover:underline text-xs mt-1">Upload New Document</span>
                  <span className="text-[9px] text-slate-400">Drag & drop your file here, or click to browse</span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">
                    Current files ({attachments.length})
                  </div>
                  <div className="max-h-[140px] overflow-y-auto scrollbar-thin space-y-1.5 border border-slate-100 p-1.5 rounded-lg bg-slate-50/50">
                    {attachments.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-[11px] italic">
                        No attachments uploaded yet. Click above to test simulate uploading.
                      </div>
                    ) : (
                      attachments.map((file, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 flex items-center justify-between text-xs font-semibold text-slate-700 shadow-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <div className="flex flex-col text-left">
                              <span className="font-mono text-[10px] text-slate-800 truncate max-w-[200px]" title={file.name}>{file.name}</span>
                              <span className="text-[9px] text-slate-400 font-normal leading-none font-mono">{file.size}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="bg-slate-50 hover:bg-rose-50 text-rose-55 hover:text-rose-700 p-1 rounded-md border border-slate-200 hover:border-rose-200 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-150 p-3 flex items-center justify-end font-sans">
                <button
                  type="button"
                  onClick={() => setIsAttachmentModalOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-4 rounded-md transition shadow-md text-xs"
                >
                  Close & Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Unified Sticky Totals & Action Foot-Rail */}
        <div className="sticky -bottom-6 left-0 right-0 bg-white border-t border-slate-200 px-6 py-4 z-30 -mx-6 -mb-6 mt-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4 backdrop-blur-md bg-opacity-95">
          <div className="flex flex-wrap items-center gap-2 order-2 xl:order-1">
            <button
              type="button"
              onClick={() => setEditorActive(false)}
              className="border border-slate-200 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-md font-bold text-xs transition bg-white shadow-xs"
            >
              Cancel / Return
            </button>
            {editInvoiceId && (
              <button
                type="button"
                onClick={() => setPendingDeleteInvoiceId(editInvoiceId)}
                className="border border-rose-200 text-rose-600 hover:bg-rose-50 px-3.5 py-2 rounded-md font-bold text-xs transition"
              >
                Delete Invoice
              </button>
            )}
            <button
              type="button"
              onClick={() => handlePublishInvoice('Draft')}
              className="border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-md font-bold text-xs transition"
            >
              Save Draft
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 order-1 xl:order-2 bg-slate-50/80 border border-slate-200/60 rounded-lg p-2 px-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold">
              <div className="text-[11px]">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-extrabold font-mono leading-none">Subtotal</span>
                <span className="font-mono font-bold text-slate-805">{fmt(totals.subtotalSYP)} SYP</span>
              </div>
              
              {totals.chargesSYP > 0 && (
                <div className="text-[11px]">
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-extrabold font-mono leading-none">Charges</span>
                  <span className="font-mono font-bold text-slate-805">{fmt(totals.chargesSYP)} SYP</span>
                </div>
              )}
              
              <div className="text-[11px]">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-extrabold font-mono leading-none">Tax Amount</span>
                <span className="font-mono font-bold text-slate-805">{fmt(totals.taxSYP)} SYP</span>
              </div>

              <div className="hidden sm:block h-5 w-px bg-slate-200"></div>

              <div className="text-[11px]">
                <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-extrabold font-mono leading-none">Grand Total (SYP)</span>
                <span className="font-mono text-sm font-black text-rose-600 leading-tight block">{fmt(totals.grandTotalSYP)} SYP</span>
              </div>

              {Number(editorExchangeRate) !== 1 && (
                <>
                  <div className="hidden sm:block h-5 w-px bg-slate-200"></div>
                  <div className="text-[11px]">
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-extrabold font-mono leading-none">Base ({editorCurrency})</span>
                    <span className="font-mono text-xs font-black text-emerald-600 leading-tight block">{fmt(totals.grandTotalBase)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="order-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePublishInvoice('Posted')}
              className="w-full xl:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md font-bold text-xs shadow-sm shadow-blue-200 transition-all flex items-center justify-center gap-1.5"
            >
              <FileCheck className="w-4 h-4 text-white" />
              Publish & Post (Auto-Accrual)
            </button>
          </div>
        </div>
        <ConfirmDialog
          isOpen={!!pendingDeleteInvoiceId}
          title="Delete invoice"
          message="This removes the invoice from the Apex candidate list. This action cannot be undone."
          confirmLabel="Delete invoice"
          cancelLabel="Keep invoice"
          tone="danger"
          onConfirm={handleConfirmDeleteInvoice}
          onCancel={() => setPendingDeleteInvoiceId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top action header matching screenshots */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Sales Overview Module</h1>
          <p className="text-xs text-slate-500">Track and publish invoices, monitor receivables, and configure sales order funnels.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => openInvoiceEditor(null)}
            className="inline-flex items-center text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 mr-1 text-white" />
            Create Invoice
          </button>
          <button 
            onClick={() => setIsAddSOOpen(true)}
            className="inline-flex items-center text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 mr-1 text-slate-500" />
            New SO
          </button>
          <button 
            className="text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded transition-all"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Dynamic Smart KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.015)]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL REVENUE</span>
          <div className="mt-2 flex items-baseline">
            <span className="text-lg font-black text-slate-800 font-mono tracking-tight">{fmt(totalRevenue)}</span>
            <span className="text-[10px] text-slate-400 ml-1.5 font-sans font-bold">SYP</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            Realized cash settlements
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.015)]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">OUTSTANDING AR</span>
          <div className="mt-2 flex items-baseline">
            <span className="text-lg font-black text-rose-600 font-mono tracking-tight">{fmt(outstandingAR)}</span>
            <span className="text-[10px] text-slate-400 ml-1.5 font-sans font-bold">SYP</span>
          </div>
          <div className="mt-2 text-[10px] text-rose-500 font-semibold">
            Due collection ledger status
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.015)]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">OVERDUE INVOICES</span>
          <div className="mt-2 flex items-baseline">
            <span className="text-lg font-black text-rose-700 font-mono tracking-tight">{overdueInvoicesCount}</span>
            <span className="text-xs text-zinc-400 ml-1.5 font-sans font-normal">Active items</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-400">
            Requiring immediate credit claims
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.015)]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">POSTED INVOICES</span>
          <div className="mt-2 flex items-baseline">
            <span className="text-lg font-black text-blue-605 font-mono tracking-tight">{postedInvoicesCount}</span>
            <span className="text-xs text-zinc-400 ml-1.5 font-sans font-normal">Invoices pending</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-400">
            Awaiting bank transfers
          </div>
        </div>
      </div>

      {/* Main double split list layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Sales Orders Box */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm">
            <div className="p-4 border-b border-zinc-150 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase text-slate-700 tracking-wider">Recent Sales Orders (SO)</h2>
              <span className="text-[11px] text-blue-600 font-semibold cursor-pointer hover:underline">View all</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-mono">SO Number</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-right">Draft SYP</th>
                    <th className="py-2.5 px-4 text-center">Workflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {salesOrders.map(so => (
                    <tr key={so.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{so.soNumber}</td>
                      <td className="py-3 px-3 tabular-nums text-slate-500">{so.date}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700 max-w-[180px] truncate">{so.customerName}</td>
                      <td className="py-3 px-3 tabular-nums font-bold text-right text-slate-900">{fmt(so.totalAmount)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          so.status === 'Invoiced' ? 'bg-emerald-50 text-emerald-700' :
                          so.status === 'Approved' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {so.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Sales Invoices Box */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm">
            <div className="p-4 border-b border-zinc-150 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase text-slate-700 tracking-wider">Recent Sales Invoices (INV)</h2>
              <span className="text-[11px] text-blue-600 font-semibold cursor-pointer hover:underline">View all</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-mono">Invoice Number</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-right">Invoice Sum</th>
                    <th className="py-2.5 px-4 text-center">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {invoices.map(inv => (
                    <tr 
                      key={inv.id} 
                      onClick={() => setSelectedInvoice(inv)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 tabular-nums text-slate-500">{inv.dueDate}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700 max-w-[180px] truncate">{inv.customerName}</td>
                      <td className="py-3 px-3 tabular-nums font-bold text-right text-slate-900">{fmt(inv.totalAmount)}</td>
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1.5 font-sans">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' :
                            inv.status === 'Posted' ? 'bg-blue-50 text-blue-700' :
                            inv.status === 'Overdue' ? 'bg-rose-50 text-rose-700 font-black animate-pulse' : 
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {inv.status}
                          </span>
                          {(inv.status === 'Posted' || inv.status === 'Overdue') && (
                            <button
                              onClick={() => handleMarkAsPaid(inv.id)}
                              title="Mark as paid"
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 hover:text-emerald-850 transition-colors"
                            >
                              <BookmarkCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openInvoiceEditor(inv)}
                            title="Edit In Direct Table Editor"
                            className="p-1 rounded text-blue-600 hover:bg-blue-50 hover:text-blue-850 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right sidebar: Top customers list */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm p-4 h-fit">
          <h2 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-4">Top Client Corporate Ledger</h2>
          <div className="space-y-4 font-sans">
            {customers.map((cust) => (
              <div key={cust.id} className="p-3 bg-zinc-50 rounded-lg border border-[#F1F3F5] hover:border-slate-300 transition-colors flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-xs block truncate max-w-[190px]">{cust.name}</span>
                  <span className="text-[10px] text-slate-400 font-medium block">{cust.company} · {cust.email}</span>
                </div>
                <div className="text-right">
                  <span className={`text-[11px] font-mono font-bold block ${cust.balance > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                    {cust.balance > 0 ? `${fmt(cust.balance)} SYP` : 'Clear Balance'}
                  </span>
                  <span className="text-[9px] text-[#A1A1AA] uppercase tracking-wider block">Balance</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice detailed viewer modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <span className="text-[10px] font-bold tracking-widest font-mono text-zinc-400 block uppercase">Tax Invoice Journal Post</span>
                <h3 className="text-sm font-black text-slate-800 mt-0.5">
                  ID: {selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between text-xs text-slate-500 mb-6 font-semibold">
              <div>
                <span className="block text-[10px] text-zinc-400">ISSUED DATE</span>
                <span className="text-slate-700 block mt-0.5 font-mono">{selectedInvoice.date}</span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-400">DUE MATURITY DATE</span>
                <span className="text-slate-700 block mt-0.5 font-mono">{selectedInvoice.dueDate}</span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-400">STATUS BADGE</span>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded font-mono font-black uppercase text-[10px] ${
                  selectedInvoice.status === 'Paid' ? 'bg-emerald-50 text-emerald-805' :
                  selectedInvoice.status === 'Posted' ? 'bg-blue-50 text-blue-805' : 'bg-rose-50 text-rose-805 animate-pulse'
                }`}>
                  {selectedInvoice.status}
                </span>
              </div>
            </div>

            {/* Client / Issuer detailed split card */}
            <div className="grid grid-cols-2 gap-4 border border-zinc-100 bg-zinc-50 p-4 rounded-lg mb-6">
              <div>
                <span className="text-[9px] font-bold text-zinc-400 block uppercase mb-1">FOR CLIENT DISCHARGE:</span>
                <span className="font-bold text-slate-800 text-xs block">{selectedInvoice.customerName}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Client ID: {selectedInvoice.customerId}</span>
              </div>
              <div className="text-right border-l border-zinc-200 pl-4">
                <span className="text-[9px] font-bold text-zinc-400 block uppercase mb-1">TAX ISSUER CORPORATE:</span>
                <span className="font-bold text-slate-800 text-xs block">{companyName}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Branch: active tenant</span>
              </div>
            </div>

            {/* Line items details */}
            <div className="space-y-3 flex-1">
              <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wide">Invoice Billable Items</span>
              <div className="border border-zinc-150 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 text-[10px] font-mono text-zinc-500 font-bold border-b border-zinc-200">
                      <th className="p-2">Description</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Price SYP</th>
                      <th className="p-2 text-right">Total SYP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-slate-700">
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-semibold text-slate-850">{item.description}</td>
                        <td className="p-2 text-center font-mono">{item.quantity}</td>
                        <td className="p-2 text-right font-mono">{fmt(item.unitPrice)}</td>
                        <td className="p-2 text-right font-mono font-bold">{fmt(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Aggregation summary */}
              <div className="flex justify-end pt-2">
                <div className="w-56 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Aggregated Taxable:</span>
                    <span className="font-mono font-bold">{fmt(selectedInvoice.totalAmount - selectedInvoice.taxAmount)} SYP</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Vat / Sales Tax (5%):</span>
                    <span className="font-mono font-bold">{fmt(selectedInvoice.taxAmount)} SYP</span>
                  </div>
                  <div className="flex justify-between text-slate-800 font-black text-sm border-t border-zinc-200 pt-2">
                    <span>Total Sum:</span>
                    <span className="font-mono">{fmt(selectedInvoice.totalAmount)} SYP</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action panel bottom */}
            <div className="border-t border-slate-100 pt-4 mt-6 space-y-2">
              <button
                onClick={() => {
                  setSelectedInvoice(null);
                  openInvoiceEditor(selectedInvoice);
                }}
                className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-xs font-bold shadow-sm transition-colors"
              >
                <Edit className="w-4 h-4 text-white" /> Open in High-Density Table Editor
              </button>
              {selectedInvoice.status !== 'Paid' && (
                <button
                  onClick={() => {
                    handleMarkAsPaid(selectedInvoice.id);
                  }}
                  className="w-full flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded text-xs font-bold shadow-sm transition-colors"
                >
                  <CheckCircle className="w-4 h-4 text-white" /> Settle Pending Payment (Mark Handed Cash)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide sheet for Create Sales Order (New SO) */}
      {isAddSOOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 font-sans animate-fade-in">
          <form 
            onSubmit={handleCreateSOSubmit}
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800">Draft New Sales Order</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Publish certified sales orders mapped into ledgers automatically.</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddSOOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {soError && (
              <div className="bg-rose-50 text-rose-700 p-3 rounded-md text-xs flex items-center gap-2 mb-4">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 inline" />
                <span>{soError}</span>
              </div>
            )}

            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Corporate Client</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full text-xs text-slate-705 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-2 outline-none"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-550 uppercase">Sales Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="flex items-center text-[10px] font-bold text-blue-600 hover:text-blue-800"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-0.5" /> Mapped item path
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 bg-slate-50 border border-[#E2E8F0] p-3 rounded-md relative group">
                      <div className="flex-1 space-y-2">
                        <div>
                          <select
                            value={item.productId}
                            onChange={(e) => handleItemProductChange(index, e.target.value)}
                            className="w-full text-xs text-slate-700 bg-white border border-[#E2E8F0] rounded p-1.5 outline-none"
                          >
                            {inventory.map(prod => (
                              <option key={prod.id} value={prod.id}>
                                [{prod.sku}] - {prod.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-zinc-400">Qty Units</label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={item.quantity}
                              onChange={(e) => handleItemQtyChange(index, Number(e.target.value))}
                              className="w-full text-xs text-slate-700 bg-white border border-[#E2E8F0] rounded p-1"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-400">Unit Price SYP</label>
                            <input
                              type="number"
                              min={0}
                              required
                              value={item.unitPrice}
                              onChange={(e) => handleItemPriceChange(index, Number(e.target.value))}
                              className="w-full text-xs text-slate-700 bg-white border border-[#E2E8F0] rounded p-1 font-mono text-xs tabular-nums"
                            />
                          </div>
                        </div>
                      </div>

                      {selectedItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(index)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-slate-100 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#FAFCFD] border border-[#E2E8F0] p-4 rounded-md space-y-1.5 text-xs text-slate-500 mt-4 mb-4">
              <div className="flex justify-between">
                <span>Calculated Subtotal:</span>
                <span className="font-mono text-slate-705 font-bold">
                  {fmt(selectedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))} SYP
                </span>
              </div>
              <div className="flex justify-between">
                <span>VAT / Sales Tax estimation (5%):</span>
                <span className="font-mono text-slate-705 font-bold">
                  {fmt(Math.round(selectedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 0.05))} SYP
                </span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-200/80 pt-2 font-black text-slate-805">
                <span>Certified Invoice Sum:</span>
                <span className="font-mono">
                  {fmt(Math.round(selectedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 1.05))} SYP
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsAddSOOpen(false)}
                className="flex-1 text-[11px] font-bold text-slate-655 bg-slate-50 hover:bg-slate-100 border border-slate-200 py-2 rounded-md"
              >
                Cancel / Reset
              </button>
              <button
                type="submit"
                className="flex-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 py-2 rounded-md shadow-sm"
              >
                Approve & Issue Invoice (Posted)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
