import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Customer, InventoryItem, Invoice, LineItem } from '../types';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import {
  Search,
  ChevronDown,
  ShieldAlert,
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  Printer,
  Sparkles,
  Database,
  Share2,
  FolderOpen
} from 'lucide-react';
import { useTranslation } from "react-i18next";

interface SalesPage2Props {
  onClose: () => void;
  customers: Customer[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  editInvoiceId: string | null;
  initialInvoiceData?: any;
}

export default function SalesPage2({
  onClose,
  customers,
  inventory,
  invoices,
  setInvoices,
  editInvoiceId
}: SalesPage2Props) {
    const { t } = useTranslation('common');
  // 1. Core Header fields state
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [currency, setCurrency] = useState('USD');
  const [parity, setParity] = useState('1.00000');
  const [parityExchange, setParityExchange] = useState('1.00000');
  const [warehouse, setWarehouse] = useState('1 virtual repository');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [payType, setPayType] = useState('On Credit');
  const [clientAccount, setClientAccount] = useState('1210001 - Client Trade Debtor');
  const [notes, setNotes] = useState('');
  const [securityLevel, setSecurityLevel] = useState('Standard');
  const [currentRecordIndex, setCurrentRecordIndex] = useState(1);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // 2. Main materials items table state (Preloads with 4 rows like an empty invoice grid or active items)
  const [materialsLines, setMaterialsLines] = useState<any[]>([
    { id: '1', productId: inventory[0]?.id || '', uom: 'PCS', qty: 1, unitPrice: inventory[0]?.salePrice || 0, lineNotes: '' },
    { id: '2', productId: '', uom: 'PCS', qty: 0, unitPrice: 0, lineNotes: '' },
    { id: '3', productId: '', uom: 'PCS', qty: 0, unitPrice: 0, lineNotes: '' },
    { id: '4', productId: '', uom: 'PCS', qty: 0, unitPrice: 0, lineNotes: '' }
  ]);

  // 3. Bottom Ledger Distribution Table state (Prepopulated with 2 rows from the screenshot)
  const [accountsLines, setAccountsLines] = useState<any[]>([
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
  ]);

  // Load existing invoice if editing
  useEffect(() => {
    if (editInvoiceId) {
      const inv = invoices.find(i => i.id === editInvoiceId);
      if (inv) {
        setSelectedCustomerId(inv.customerId || customers[0]?.id || '');
        setInvoiceDate(inv.date || new Date().toISOString().split('T')[0]);
        setCurrency(inv.currency || 'USD');
        setNotes((inv as any).notes || '');
        setPayType((inv as any).payType || 'On Credit');
        setWarehouse((inv as any).warehouse || '1 virtual repository');
        setClientAccount((inv as any).clientAccount || '1210001 - Client Trade Debtor');
        setParity((inv as any).exchangeRate?.toString() || '1.00000');
        
        if (inv.items && inv.items.length > 0) {
          const mapped = inv.items.map((item, idx) => ({
            id: (idx + 1).toString(),
            productId: item.productId || '',
            uom: (item as any).uom || 'PCS',
            qty: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
            lineNotes: (item as any).notes || ''
          }));
          // Padding up to 4 rows
          while (mapped.length < 4) {
            mapped.push({ id: (mapped.length + 1).toString(), productId: '', uom: 'PCS', qty: 0, unitPrice: 0, lineNotes: '' });
          }
          setMaterialsLines(mapped);
        }

        if ((inv as any).accountsLines) {
          setAccountsLines((inv as any).accountsLines);
        }
      }
    }
  }, [editInvoiceId, invoices, customers]);

  // Synchronize client details when client is selected
  useEffect(() => {
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (cust) {
      setClientAccount(`1210${cust.id.replace(/\D/g, '') || '001'} - ${cust.name} Ledger`);
    }
  }, [selectedCustomerId, customers]);

  // 4. Calculations Engine
  const calculateTotals = () => {
    let subtotal = 0;
    materialsLines.forEach(line => {
      if (line.productId) {
        const lineVal = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
        subtotal += lineVal;
      }
    });

    // Handle ledger level discounts & additions
    let totalDiscounts = 0;
    let totalAdditions = 0;
    accountsLines.forEach(act => {
      if (Number(act.discount) > 0) {
        totalDiscounts += Number(act.discount);
      } else if (Number(act.discountPct) > 0) {
        totalDiscounts += subtotal * (Number(act.discountPct) / 100);
      }

      if (Number(act.additions) > 0) {
        totalAdditions += Number(act.additions);
      } else if (Number(act.additionPct) > 0) {
        totalAdditions += subtotal * (Number(act.additionPct) / 100);
      }
    });

    const finalSum = subtotal - totalDiscounts + totalAdditions;
    const finalTotalSYP = finalSum * (parseFloat(parity) || 1.0);

    return {
      subtotal,
      totalDiscounts,
      totalAdditions,
      finalSum,
      finalTotalSYP
    };
  };

  const totals = calculateTotals();

  // 5. Handle CRUD Actions
  const handleAddNewItemLine = () => {
    setMaterialsLines(prev => [
      ...prev,
      { id: (prev.length + 1).toString(), productId: '', uom: 'PCS', qty: 0, unitPrice: 0, lineNotes: '' }
    ]);
  };

  const handleClearForm = () => {
    setSelectedCustomerId(customers[0]?.id || '');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setCurrency('USD');
    setNotes('');
    setParity('1.00000');
    setWarehouse('1 virtual repository');
    setPayType('On Credit');
    setMaterialsLines([
      { id: '1', productId: inventory[0]?.id || '', uom: 'PCS', qty: 1, unitPrice: inventory[0]?.salePrice || 0, lineNotes: '' },
      { id: '2', productId: '', uom: 'PCS', qty: 0, unitPrice: 0, lineNotes: '' },
      { id: '3', productId: '', uom: 'PCS', qty: 0, unitPrice: 0, lineNotes: '' },
      { id: '4', productId: '', uom: 'PCS', qty: 0, unitPrice: 0, lineNotes: '' }
    ]);
    setAccountsLines([
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
    ]);
  };

  const handleSaveInvoice = (status: 'Draft' | 'Posted' | 'Paid') => {
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (!cust) {
      toast.error(t('Please select a valid customer.'));
      return;
    }

    const mappedItems: LineItem[] = materialsLines
      .filter(line => line.productId !== '')
      .map((line, idx) => {
        const prod = inventory.find(p => p.id === line.productId);
        return {
          id: (idx + 1).toString(),
          productId: line.productId,
          description: prod ? prod.name : 'Unknown Product',
          quantity: Number(line.qty) || 1,
          unitPrice: Number(line.unitPrice) || 0,
          total: (Number(line.qty) || 0) * (Number(line.unitPrice) || 0)
        };
      });

    if (mappedItems.length === 0) {
      toast.error(t('Please choose at least one material/product.'));
      return;
    }

    const isNew = !editInvoiceId;
    const invId = isNew ? `INV-2026-0${invoices.length + 1}` : editInvoiceId;

    const finalInvoice: Invoice = {
      id: invId,
      invoiceNumber: editInvoiceId ? (invoices.find(i => i.id === editInvoiceId)?.invoiceNumber || invId) : `SI-ERP-0${invoices.length + 1}`,
      customerId: selectedCustomerId,
      customerName: cust.name,
      date: invoiceDate,
      dueDate: invoiceDate,
      items: mappedItems,
      taxAmount: totals.totalAdditions,
      totalAmount: totals.finalTotalSYP,
      amountPaid: status === 'Paid' ? totals.finalTotalSYP : 0,
      status: status,
      currency: currency
    };

    // Stash custom parameters for ERP layout
    (finalInvoice as any).warehouse = warehouse;
    (finalInvoice as any).payType = payType;
    (finalInvoice as any).clientAccount = clientAccount;
    (finalInvoice as any).exchangeRate = parseFloat(parity) || 1;
    (finalInvoice as any).notes = notes;
    (finalInvoice as any).accountsLines = accountsLines;
    (finalInvoice as any).isErpLayout = true;

    if (isNew) {
      setInvoices(prev => [...prev, finalInvoice]);
    } else {
      setInvoices(prev => prev.map(inv => inv.id === editInvoiceId ? finalInvoice : inv));
    }

    toast.success(`Invoice successfully ${status === 'Posted' ? 'Posted & Saved' : 'drafted'}!`);
    onClose();
  };

  const handleDeleteItem = () => {
    if (editInvoiceId) {
      setIsDeleteConfirmOpen(true);
      return;
    }

    handleClearForm();
    toast(t('New document form ready'), { icon: 'i' });
  };

  const handleConfirmDelete = () => {
    if (!editInvoiceId) {
      setIsDeleteConfirmOpen(false);
      return;
    }

    setInvoices(prev => prev.filter(inv => inv.id !== editInvoiceId));
    toast.success(t('Invoice deleted'));
    setIsDeleteConfirmOpen(false);
    onClose();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-h-[820px] bg-[#f8fafc] text-xs font-sans select-none overflow-hidden border border-slate-205 rounded-xl shadow-2xl">
      {/* 1. Header Toolbar Title */}
      <div className="bg-[#0f172a] text-white px-4 py-2 flex items-center justify-between border-b border-[#1e293b]">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span className="font-bold tracking-tight text-xs">{t(`Sales Voucher ERP Interface — Layout V2`)}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">
            {t(`RECORD MODE:`)} {editInvoiceId ? 'EDIT' : 'NEW'}
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition duration-150 p-1"
            title="Cancel and switch back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Form content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
        {/* ROW 1 of Controls */}
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
          <div className="xl:col-span-6">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t(`Client Selector`)}</span>
            <div className="relative flex rounded-md shadow-xs">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2.5 rounded-l-md outline-none text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.company} {t(`(ID:`)} {c.id})
                  </option>
                ))}
              </select>
              <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-t border-b border-r border-slate-200 px-3 rounded-r-md transition flex items-center">
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
            {(() => {
              const cust = customers.find(c => c.id === selectedCustomerId);
              if (!cust) return null;
              const limit = 5000000;
              const currentBalance = cust.balance || 0;
              const ratio = currentBalance / limit;
              const isOverDraft = currentBalance > limit;
              return (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] bg-slate-50 border border-slate-150 rounded py-1 px-2 text-slate-505 font-mono">
                  <span>{t(`Ledger Balance:`)} <strong className="text-slate-800">{currentBalance.toLocaleString('en-US')} {t(`SYP`)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>{t(`Credit Limit:`)} <strong className="text-slate-700">{limit.toLocaleString('en-US')} {t(`SYP`)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>{t(`Credit Vetting:`)} <strong className={isOverDraft ? 'text-rose-600 font-bold' : ratio > 0.75 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                    {isOverDraft ? '⚠️ RESTRICTED (EXCEEDS LIMIT)' : ratio > 0.75 ? '⚠️ CAUTION (NEAR LIMIT)' : '✓ HEALTHY (APPROVED)'}
                  </strong></span>
                </div>
              );
            })()}
          </div>

          <div className="xl:col-span-3">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-500" /> Security Level
            </span>
            <select
              value={securityLevel}
              onChange={(e) => setSecurityLevel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-md outline-none text-xs font-semibold focus:border-blue-500"
            >
              <option value="Standard">{t(`Standard Authorization`)}</option>
              <option value="High">{t(`L-2 Restricted Clearance`)}</option>
              <option value="Critical">{t(`L-3 Executive Board Verified`)}</option>
            </select>
          </div>

          <div className="xl:col-span-3 flex items-center justify-end space-x-1.5 pt-4 xl:pt-0">
            <button
              onClick={() => setCurrentRecordIndex(1)}
              className="border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold px-2 py-1.5 rounded transition shadow-2xs"
              title="First Document"
            >
              |&laquo;
            </button>
            <button
              onClick={() => setCurrentRecordIndex(prev => Math.max(1, prev - 1))}
              className="border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold px-2 py-1.5 rounded transition shadow-2xs"
              title="Previous"
            >
              &laquo;
            </button>
            <input
              type="text"
              value={currentRecordIndex}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setCurrentRecordIndex(val);
              }}
              className="w-10 text-center font-bold bg-amber-50 border border-amber-200 text-amber-900 py-1 rounded text-xs outline-none"
            />
            <button
              onClick={() => setCurrentRecordIndex(prev => prev + 1)}
              className="border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold px-2 py-1.5 rounded transition shadow-2xs"
              title="Next"
            >
              &raquo;
            </button>
            <button
              className="border border-slate-205 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold px-2 py-1.5 rounded transition shadow-2xs"
              title="Last Document"
            >
              &raquo;|
            </button>
          </div>
        </div>

        {/* ROW 2 of Controls */}
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-3">
            <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t(`Currency`)}</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-md outline-none text-xs font-semibold focus:border-blue-500"
            >
              <option value="USD">{t(`US Dollar (USD)`)}</option>
              <option value="SYP">{t(`Syrian Pound (SYP)`)}</option>
              <option value="EUR">{t(`Euro (EUR)`)}</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t(`Parity Multiplier`)}</span>
            <input
              type="number"
              step="any"
              min="0"
              value={parity}
              onChange={(e) => setParity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-md outline-none text-xs font-mono font-bold focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-2">
            <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t(`Exchange Parity`)}</span>
            <input
              type="number"
              step="any"
              min="0"
              value={parityExchange}
              onChange={(e) => setParityExchange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-md outline-none text-xs font-mono focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-5">
            <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t(`Warehouse Division`)}</span>
            <div className="relative flex rounded-md">
              <span className="bg-blue-600 text-white font-mono px-2 py-1.5 rounded-l-md flex items-center text-[10px] font-black">
                1
              </span>
              <input
                type="text"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-full bg-slate-50 border-t border-b border-r border-slate-200 py-1.5 px-2.5 rounded-r-md outline-none text-xs text-slate-800 focus:border-blue-500 focus:bg-white font-semibold"
              />
              <button 
                type="button"
                className="absolute right-0 top-0 h-full px-2 text-slate-400 hover:text-slate-600"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ROW 3 of Controls */}
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-3">
            <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t(`Voucher Date`)}</span>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-md outline-none text-xs font-mono font-black focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-3">
            <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t(`Payment Method`)}</span>
            <select
              value={payType}
              onChange={(e) => setPayType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-md outline-none text-xs font-semibold focus:border-blue-500"
            >
              <option value="On Credit">{t(`On Credit`)}</option>
              <option value="Cash Safe">{t(`Cash Drawer Transaction`)}</option>
              <option value="Bank Wire">{t(`Bank Wire Transfer`)}</option>
            </select>
          </div>

          <div className="lg:col-span-6">
            <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t(`Financial Client Account`)}</span>
            <div className="relative flex rounded-md">
              <input
                type="text"
                value={clientAccount}
                onChange={(e) => setClientAccount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-l-md outline-none text-xs text-slate-700 font-semibold focus:border-blue-500"
              />
              <button 
                type="button" 
                className="bg-slate-100 hover:bg-slate-200 text-[#475569] border border-l-0 border-slate-200 text-[10px] font-black px-2.5"
              >
                Detailed
              </button>
              <button 
                type="button" 
                className="bg-slate-50 hover:bg-slate-100 text-[#475569] border-t border-b border-r border-slate-200 px-2 rounded-r-md"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Notes block */}
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm">
          <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t(`Document Allocation Notes (Private / Internal)`)}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Commercial terms, bank details, delivery schedules..."
            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 resize-none"
          />
        </div>

        {/* 2. Compact Materials Line Items Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
              <span className="w-1 h-3 bg-blue-600 inline-block rounded-xs"></span>
              A. Core Materials / Inventory ledger Grid
            </h3>
            <button
              type="button"
              onClick={handleAddNewItemLine}
              className="inline-flex items-center text-[10px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded px-2 py-0.5 bg-white transition"
            >
              <Plus className="w-3 h-3 mr-0.5" /> Row Add
            </button>
          </div>

          <div className="overflow-x-auto max-h-[140px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-[11px] min-w-[900px]">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] font-mono shadow-xs">
                <tr>
                  <th className="py-1.5 px-2 bg-slate-100 text-center" style={{ width: '45px' }}>#</th>
                  <th className="py-1.5 px-2 bg-slate-100" style={{ width: '280px' }}>{t(`Material SKU & Name`)}</th>
                  <th className="py-1.5 px-2 bg-slate-100 text-center" style={{ width: '85px' }}>{t(`Unit`)}</th>
                  <th className="py-1.5 px-2 bg-slate-100 text-center" style={{ width: '70px' }}>{t(`Qty`)}</th>
                  <th className="py-1.5 px-2 bg-slate-100 text-right" style={{ width: '130px' }}>{t(`Unit Price (`)}{currency})</th>
                  <th className="py-1.5 px-2 bg-slate-100 text-right" style={{ width: '130px' }}>{t(`Total (`)}{currency})</th>
                  <th className="py-1.5 px-2 bg-slate-100">{t(`Specific Line Notes`)}</th>
                  <th className="py-1.5 px-2 bg-slate-100 text-center" style={{ width: '45px' }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {materialsLines.map((line, index) => {
                  const itemTotal = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
                  const isCyanBg = index % 2 === 1;
                  return (
                    <tr
                      key={line.id}
                      className={`hover:bg-slate-100/60 transition ${isCyanBg ? 'bg-[#e0fbfc]/30' : 'bg-white'}`}
                    >
                      <td className="py-1 px-1 text-center font-bold text-slate-400 font-mono">
                        {index + 1}
                      </td>

                      <td className="py-0.5 px-1">
                        <select
                          value={line.productId}
                          onChange={(e) => {
                            const prodId = e.target.value;
                            const prod = inventory.find(i => i.id === prodId);
                            setMaterialsLines(prev => prev.map((l, i) => i === index ? {
                              ...l,
                              productId: prodId,
                              unitPrice: prod ? prod.salePrice : 0,
                              qty: 1
                            } : l));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded py-1 px-1 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                        >
                          <option value="">{t(`-- Click to choose SKU / Material --`)}</option>
                          {inventory.map(prod => (
                            <option key={prod.id} value={prod.id}>
                              [{prod.sku}] — {prod.name}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const prod = inventory.find(i => i.id === line.productId);
                          if (!prod) return null;
                          const isLowStock = prod.qtyOnHand <= 15;
                          return (
                            <span className={`block text-[9px] mt-0.5 px-1.5 py-0.5 font-mono rounded ${isLowStock ? 'text-red-700 font-bold bg-rose-50/85 border border-rose-100' : 'text-slate-500 bg-slate-100/80 border border-slate-200/50'} inline-flex items-center gap-1`}>
                              <span>{t(`Stock On Hand:`)} <strong>{prod.qtyOnHand} {t(`pcs`)}</strong></span>
                              <span className="text-slate-300">|</span>
                              <span>{t(`Avg Cost:`)} <strong>${prod.avgCost.toFixed(2)}</strong></span>
                              {isLowStock && <span className="text-[8px] bg-red-600 text-white px-1 rounded-sm uppercase tracking-wider scale-95 font-sans">{t(`Low Critical`)}</span>}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="py-0.5 px-1">
                        <select
                          value={line.uom}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMaterialsLines(prev => prev.map((l, i) => i === index ? { ...l, uom: val } : l));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded py-1 px-1 text-center outline-none focus:border-blue-500"
                        >
                          <option value="PCS">{t(`Pieces (PCS)`)}</option>
                          <option value="KG">{t(`Kilograms (KG)`)}</option>
                          <option value="LTR">{t(`Liters (LTR)`)}</option>
                          <option value="BOX">{t(`Containers (BOX)`)}</option>
                        </select>
                      </td>

                      <td className="py-0.5 px-1">
                        <input
                          type="number"
                          min="0"
                          value={line.qty || ''}
                          onChange={(e) => {
                            const qty = parseFloat(e.target.value) || 0;
                            setMaterialsLines(prev => prev.map((l, i) => i === index ? { ...l, qty } : l));
                          }}
                          placeholder="0"
                          className="w-full font-mono font-bold text-center bg-slate-50 border border-slate-200 rounded py-0.5 px-1.5 outline-none focus:bg-white focus:border-blue-500"
                        />
                      </td>

                      <td className="py-0.5 px-1">
                        <input
                          type="number"
                          min="0"
                          value={line.unitPrice || ''}
                          onChange={(e) => {
                            const up = parseFloat(e.target.value) || 0;
                            setMaterialsLines(prev => prev.map((l, i) => i === index ? { ...l, unitPrice: up } : l));
                          }}
                          placeholder="0"
                          className="w-full font-mono text-right bg-slate-50 border border-slate-200 rounded py-0.5 px-1.5 outline-none focus:bg-white focus:border-blue-500"
                        />
                      </td>

                      <td className="py-0.5 px-1">
                        <div className="w-full font-mono font-black text-right text-slate-700 bg-slate-50/50 py-1 px-2 border border-dashed border-slate-150 rounded">
                          {itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>

                      <td className="py-0.5 px-1">
                        <input
                          type="text"
                          value={line.lineNotes}
                          onChange={(e) => {
                            const notesVal = e.target.value;
                            setMaterialsLines(prev => prev.map((l, i) => i === index ? { ...l, lineNotes: notesVal } : l));
                          }}
                          placeholder="batch tag, expiry reference, packing notes..."
                          className="w-full bg-slate-50 border border-slate-200 py-0.5 px-1 rounded outline-none focus:bg-white text-slate-700 placeholder:text-slate-350"
                        />
                      </td>

                      <td className="py-0.5 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (materialsLines.length > 1) {
                              setMaterialsLines(prev => prev.filter((_, i) => i !== index));
                            } else {
                              setMaterialsLines([{ id: '1', productId: '', uom: 'PCS', qty: 0, unitPrice: 0, lineNotes: '' }]);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 transition p-1"
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

        {/* 3. Account Ledger Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[#f1f5f9] px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
              <span className="w-1 h-3 bg-emerald-500 inline-block rounded-xs"></span>
              B. Account Ledger & Financial Taxes Allocation Grid
            </h3>
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
              className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold text-[9px] px-2 py-0.5 rounded transition flex items-center gap-1 shadow-2xs animate-fade-in"
            >
              <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse" /> Apply Syrian Tax Presets (5% VAT)
            </button>
          </div>

          <div className="overflow-x-auto max-h-[110px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-[10px] min-w-[1100px]">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[8px] font-mono shadow-xs">
                <tr>
                  <th className="py-1 px-1.5">#</th>
                  <th className="py-1 px-1.5" style={{ width: '180px' }}>{t(`Account allocation`)}</th>
                  <th className="py-1 px-1.5" style={{ width: '90px' }}>{t(`Discount amt`)}</th>
                  <th className="py-1 px-1.5" style={{ width: '90px' }}>{t(`Discount %`)}</th>
                  <th className="py-1 px-1.5" style={{ width: '100px' }}>{t(`Additions (Tax)`)}</th>
                  <th className="py-1 px-1.5" style={{ width: '90px' }}>{t(`Additions %`)}</th>
                  <th className="py-1 px-1.5">{t(`Internal Accounting Notes`)}</th>
                  <th className="py-1 px-1.5" style={{ width: '75px' }}>{t(`Parity`)}</th>
                  <th className="py-1 px-1.5" style={{ width: '110px' }}>{t(`Equivalent`)}</th>
                  <th className="py-1 px-1.5" style={{ width: '100px' }}>{t(`Category`)}</th>
                  <th className="py-1 px-1.5" style={{ width: '110px' }}>{t(`Cost Center`)}</th>
                  <th className="py-1 px-1.5" style={{ width: '110px' }}>{t(`Contra Account`)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {accountsLines.map((line, index) => {
                  const isGreenBg = line.code === '423';
                  return (
                    <tr
                      key={line.id}
                      className={`hover:opacity-90 transition ${
                        isGreenBg ? 'bg-[#ecfdf5] hover:bg-[#d1fae5]' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-1 px-1.5 font-bold font-mono text-center text-slate-400">
                        {index + 1}
                      </td>

                      <td className="py-0.5 px-1.5 font-bold">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-1.5 py-0.5 rounded-sm font-mono text-[9px] ${isGreenBg ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>
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
                          className="w-full bg-white border border-slate-200 rounded py-0.5 px-1 font-mono text-center text-slate-800"
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
                          className="w-full bg-white border border-slate-200 rounded py-0.5 px-1 font-mono text-center text-slate-800"
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
                          className="w-full bg-white border border-slate-200 rounded py-0.5 px-1 font-mono text-center text-slate-800"
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
                          className="w-full bg-white border border-slate-200 rounded py-0.5 px-1 font-mono text-center text-slate-800"
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
                          className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-300 rounded py-0.5 px-1 outline-none font-sans"
                        />
                      </td>

                      <td className="py-0.5 px-1.5 font-mono text-center text-slate-655 font-bold">
                        {line.parity.toFixed(2)}
                      </td>

                      <td className="py-0.5 px-1.5 text-right font-mono font-bold text-slate-700 bg-slate-50/50">
                        {((totals.subtotal * (parseFloat(parity) || 1)) + totals.totalAdditions).toLocaleString('en-US', { maximumFractionDigits: 1 })}
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
      </div>

      {/* 4. LARGE BOTTOM WIDGET SUMMARY MODULE */}
      <div className="bg-[#eceff1]/90 border-t border-slate-300 p-2.5 flex flex-col sm:flex-row items-stretch justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center min-w-[130px] self-center">
          <button className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold py-3.5 px-5 rounded-lg text-xs leading-none transition shadow-sm flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
            Invoice Info
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#78909c] text-white p-3.5 rounded-xl flex items-center justify-between shadow-inner">
            <div>
              <span className="block text-[8px] uppercase tracking-widest font-black text-slate-200">
                {t(`Sum (`)}{currency})
              </span>
              <span className="text-2xl font-black font-mono leading-none tracking-tight block mt-1">
                {totals.finalSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="font-sans font-bold text-xs bg-slate-800/20 px-2.5 py-1 rounded">
              CURR. SUM
            </div>
          </div>

          <div className="bg-[#0284c7] text-white p-3.5 rounded-xl flex items-center justify-between shadow-md">
            <div>
              <span className="block text-[8px] uppercase tracking-widest font-black text-[#e0f2fe]">
                Total SYP SYstem Ledger Equivalent
              </span>
              <span className="text-2xl font-black font-mono leading-none tracking-tight block mt-1">
                {totals.finalTotalSYP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="font-mono text-[9px] bg-slate-200/30 px-2 py-0.5 rounded-sm font-black border border-sky-400">
              LEDGER ACCT
            </div>
          </div>
        </div>
      </div>

      {/* 5. CONTROL TOOLBAR */}
      <div className="bg-[#f1f5f9] border-t border-slate-300 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button className="bg-white hover:bg-slate-100 text-slate-705 border border-slate-300 px-3 py-1.5 rounded-md font-bold text-xs transition flex items-center gap-1.5 shadow-2xs">
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" /> Documents
          </button>
          <button className="bg-white hover:bg-slate-100 text-slate-705 border border-slate-300 px-3 py-1.5 rounded-md font-bold text-xs transition flex items-center gap-1.5 shadow-2xs">
            <Share2 className="w-3.5 h-3.5 text-slate-500" /> Share
          </button>

          <div className="relative group">
            <button className="bg-white hover:bg-slate-100 text-slate-705 border border-slate-300 px-3 py-1.5 rounded-md font-bold text-xs transition flex items-center gap-1 shadow-2xs">
              {t(`Reports`)} <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-white border border-slate-200 rounded-md shadow-lg py-1 w-44 z-20">
              <button className="w-full text-left px-3 py-1 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold">{t(`Ledger Statement`)}</button>
              <button className="w-full text-left px-3 py-1 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold">{t(`Tax Assessment Form`)}</button>
              <button className="w-full text-left px-3 py-1 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold">{t(`Daily Accruals Log`)}</button>
            </div>
          </div>

          <div className="relative group">
            <button className="bg-white hover:bg-slate-100 text-slate-705 border border-slate-300 px-3 py-1.5 rounded-md font-bold text-xs transition flex items-center gap-1 shadow-2xs">
              {t(`Operations`)} <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-white border border-slate-200 rounded-md shadow-lg py-1 w-44 z-20">
              <button className="w-full text-left px-3 py-1 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold">{t(`Verify Accruals`)}</button>
              <button className="w-full text-left px-3 py-1 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold">{t(`Adjust Stock Level`)}</button>
            </div>
          </div>

          <div className="relative group">
            <button className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-md font-bold text-xs transition flex items-center gap-1 shadow-2xs">
              {t(`Display Mode`)} <ChevronDown className="w-3 h-3 text-blue-500" />
            </button>
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-white border border-slate-200 rounded-md shadow-lg py-1 w-32 z-20">
              <button className="w-full text-left px-3 py-1 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold">{t(`Dense List`)}</button>
              <button className="w-full text-left px-3 py-1 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold">{t(`Column Configurator`)}</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSaveInvoice('Posted')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-md transition flex items-center justify-center gap-1.5 shadow-sm text-xs"
          >
            <Plus className="w-3.5 h-3.5 text-white" /> Add (Publish)
          </button>

          <button
            type="button"
            onClick={() => {
              handleClearForm();
              toast(t('New document form ready'), { icon: 'i' });
            }}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold px-3.5 py-2 rounded-md transition flex items-center justify-center gap-1.5 shadow-2xs text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-500" /> New Document
          </button>

          <button
            type="button"
            onClick={() => handleSaveInvoice('Draft')}
            className="bg-slate-200 hover:bg-slate-250 text-slate-700 font-bold px-3.5 py-2 rounded-md transition flex items-center justify-center gap-1.5 shadow-2xs text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-605" /> Save Draft
          </button>

          <button
            type="button"
            onClick={handleDeleteItem}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3.5 py-2 rounded-md transition flex items-center justify-center gap-1.5 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Delete Record
          </button>

          <button
            type="button"
            onClick={() => toast(`Temporary preview mode in currency: ${currency}`, { icon: 'ℹ️' })}
            className="bg-white hover:bg-slate-100 text-slate-750 border border-slate-300 font-bold px-3.5 py-2 rounded-md transition flex items-center justify-center gap-1.5 shadow-2xs text-xs"
          >
            <Eye className="w-3.5 h-3.5 text-slate-505" /> Live Preview
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="bg-white hover:bg-slate-100 text-slate-750 border border-slate-300 font-bold px-3.5 py-2 rounded-md transition flex items-center justify-center gap-1.5 shadow-2xs text-xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-505" /> Print
          </button>

          <button
            type="button"
            onClick={() => toast(t('Extra ERP configurations: Import XML, Batch accrual settlement, configure automated tax mappings.'), { icon: 'ℹ️' })}
            className="bg-white hover:bg-slate-100 text-slate-755 border border-slate-300 font-bold px-3 py-2 rounded-md transition text-xs"
          >
            More...
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-[#ffe4e6] hover:bg-[#fecdd3] text-rose-800 font-bold px-4 py-2 rounded-md transition flex items-center justify-center gap-1.5 text-xs sm:ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Cancel (Return)
          </button>
        </div>
      </div>
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="Delete invoice"
        message="This removes the invoice from the Apex candidate list. This action cannot be undone."
        confirmLabel="Delete invoice"
        cancelLabel="Keep invoice"
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
}
