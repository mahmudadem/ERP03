import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../hooks/useConfirm';
import { errorHandler } from '../../services/errorHandler';
import { Card } from '../../components/ui/Card';
import { PartySelector, ItemSelector, WarehouseSelector, DatePicker } from '../../components/shared/selectors';
import { CurrencyExchangeWidget } from '../../modules/accounting/components/shared/CurrencyExchangeWidget';
import { CurrencySelector } from '../../modules/accounting/components/shared/CurrencySelector';
import { AccountSelector } from '../../modules/accounting/components/shared/AccountSelector';
import { Account } from '../../context/AccountsContext';
import { inventoryApi, InventoryItemDTO, InventoryWarehouseDTO } from '../../api/inventoryApi';
import { sharedApi, PartyDTO, TaxCodeDTO } from '../../api/sharedApi';
import { salesMasterDataApi, SalespersonDTO } from '../../api/salesMasterDataApi';
import { accountingApi } from '../../api/accountingApi';
import { todayLocalIso } from '../../utils/dateUtils';
import { 
  Search, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  Share2, 
  AlertTriangle,
  BookOpen,
  FileText,
  Upload,
  Layers,
  Paperclip,
  Send,
  MessageSquare,
  X,
  Check,
  RefreshCw,
  Info,
  Calendar,
  Lock,
  Globe,
  Download,
  ChevronDown
} from 'lucide-react';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

interface EditableLine {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  qty: number;
  uom: string;
  unitPrice: number;
  discountType: 'PERCENT' | 'AMOUNT' | 'NONE';
  discountValue: number;
  taxCodeId?: string;
  warehouseId?: string;
  notes: string;
}

interface EditableForm {
  salesOrderId: string;
  invoiceTemplateId: string;
  customerId: string;
  customerName: string;
  salespersonId: string;
  customerInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  parityMultiplier: number;
  exchangeParity: number;
  warehouseId: string;
  paymentMethod: string;
  financialClientAccount: string;
  notes: string;
  lines: EditableLine[];
}

const DEFAULT_ACCOUNTS = [
  { id: 'acc-ar-gen', code: '1210001', name: 'AR Customer Accounts Receivable General', classification: 'ASSET', type: 'Asset', accountRole: 'POSTING', currency: 'SYP' },
  { id: 'acc-cash', code: '1110001', name: 'Cash Safe (SYP)', classification: 'ASSET', type: 'Asset', accountRole: 'POSTING', currency: 'SYP' },
  { id: 'acc-bank', code: '1120001', name: 'Commercial Bank of Syria (SYP)', classification: 'ASSET', type: 'Asset', accountRole: 'POSTING', currency: 'SYP' },
  { id: 'acc-sales', code: '4000001', name: 'Sales Revenue', classification: 'REVENUE', type: 'Income', accountRole: 'POSTING', currency: 'SYP' },
  { id: 'acc-discount', code: '4130001', name: 'Sales Discounts Allowed', classification: 'REVENUE', type: 'Income', accountRole: 'POSTING', currency: 'SYP' },
  { id: 'acc-vat', code: '2060001', name: 'Value Added Tax Payable (VAT 5%)', classification: 'LIABILITY', type: 'Liability', accountRole: 'POSTING', currency: 'SYP' },
  { id: 'acc-purchase-discount', code: '4230001', name: 'Various Revenues', classification: 'REVENUE', type: 'Income', accountRole: 'POSTING', currency: 'SYP' },
  { id: 'acc-cogs', code: '5010001', name: 'Cost of Goods Sold', classification: 'EXPENSE', type: 'Expense', accountRole: 'POSTING', currency: 'SYP' }
];

const DEFAULT_ITEMS = [
  { id: '[HW-SRV-001] - Server Rack Module', code: 'HW-SRV-001', name: 'Server Rack Module', salesUom: 'PCS', baseUom: 'PCS', trackInventory: true, active: true },
  { id: '[HW-CAB-002] - Network Cable Cat6', code: 'HW-CAB-002', name: 'Network Cable Cat6', salesUom: 'PCS', baseUom: 'PCS', trackInventory: true, active: true },
  { id: '[HW-SWI-003] - 24-Port Switch L3', code: 'HW-SWI-003', name: '24-Port Switch L3', salesUom: 'PCS', baseUom: 'PCS', trackInventory: true, active: true }
] as unknown as InventoryItemDTO[];

export default function SalesInvoiceV2LayoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirm();

  // Simulated status engine
  const [simulatedStatus, setSimulatedStatus] = useState<'create' | 'draft' | 'posted'>('create');

  // Modal display states
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showInternalNotesModal, setShowInternalNotesModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  // Allocation Grid Presets State
  const [applySyrianPresets, setApplySyrianPresets] = useState(true);

  // Dispatch details state
  const [sendChannel, setSendChannel] = useState('WhatsApp');

  // State values for mock data list
  const [mockAttachments, setMockAttachments] = useState<string[]>([
    'Commercial_Invoice_Sign_Off.pdf',
    'Bank_Transfer_Reference_Image.png'
  ]);
  const [internalNotes, setInternalNotes] = useState('Verify routing block check before releasing the stock allocation.');

  // Reference data states
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [salespersons, setSalespersons] = useState<SalespersonDTO[]>([]);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [form, setForm] = useState<EditableForm>({
    salesOrderId: '',
    invoiceTemplateId: 'sales_invoice_direct_copy',
    customerId: 'الشركة العربية للتجارة والخدمات (Arabian Trade Corp)',
    customerName: 'الشركة العربية للتجارة والخدمات (Arabian Trade Corp)',
    salespersonId: '',
    customerInvoiceNumber: '',
    invoiceDate: todayLocalIso(),
    dueDate: todayLocalIso(),
    currency: 'SYP',
    parityMultiplier: 1.00000,
    exchangeParity: 1.00000,
    warehouseId: 'WH-MAIN',
    paymentMethod: 'ON_CREDIT',
    financialClientAccount: '1210001',
    notes: 'Private bank terms, routing guarantees, loading/shipping terms...',
    lines: [
      { itemId: '[HW-SRV-001] - Server Rack Module', qty: 1, uom: 'PCS', unitPrice: 2100000, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: 'WH-MAIN', taxCodeId: '' },
      { itemId: '[HW-CAB-002] - Network Cable Cat6', qty: 15, uom: 'PCS', unitPrice: 5000, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: 'WH-MAIN', taxCodeId: '' },
      { itemId: '[HW-SWI-003] - 24-Port Switch L3', qty: 2, uom: 'PCS', unitPrice: 450000, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: 'WH-MAIN', taxCodeId: '' },
      { itemId: '', qty: 0, uom: 'PCS', unitPrice: 0, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: '', taxCodeId: '' },
      { itemId: '', qty: 0, uom: 'PCS', unitPrice: 0, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: '', taxCodeId: '' },
      { itemId: '', qty: 0, uom: 'PCS', unitPrice: 0, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: '', taxCodeId: '' },
      { itemId: '', qty: 0, uom: 'PCS', unitPrice: 0, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: '', taxCodeId: '' },
      { itemId: '', qty: 0, uom: 'PCS', unitPrice: 0, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: '', taxCodeId: '' },
      { itemId: '', qty: 0, uom: 'PCS', unitPrice: 0, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: '', taxCodeId: '' },
      { itemId: '', qty: 0, uom: 'PCS', unitPrice: 0, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: '', taxCodeId: '' }
    ]
  });

  // Allocation custom overriden accounts
  const [allocationAccounts, setAllocationAccounts] = useState({
    clientAccount: '',
    revenueAccount: '4000001',
    discountAccount: '4130001',
    vatAccount: '2060001'
  });

  // Context Menu and Highlight State matching GVR
  const [lineContextMenu, setLineContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [copiedLineData, setCopiedLineData] = useState<EditableLine | null>(null);

  // Fetch reference data
  const loadReferenceData = async () => {
    try {
      setLoading(true);
      const [itemResult, whResult, taxResult, spResult, partiesResult, accountsData] = await Promise.all([
        inventoryApi.listItems({ active: true, limit: 100 }),
        inventoryApi.listWarehouses({ active: true }),
        sharedApi.listTaxCodes({ active: true }),
        salesMasterDataApi.listSalespersons({ status: 'ACTIVE' }),
        sharedApi.listParties({ role: 'CUSTOMER' }),
        accountingApi.getAccounts().catch(() => [])
      ]);
      setItems(unwrap<InventoryItemDTO[]>(itemResult) || []);
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(whResult) || []);
      setTaxCodes(unwrap<TaxCodeDTO[]>(taxResult) || []);
      setSalespersons(spResult || []);
      setCustomers(unwrap<PartyDTO[]>(partiesResult) || []);
      setAccounts(unwrap<any[]>(accountsData) || accountsData || []);
    } catch (err: any) {
      errorHandler.showError('Failed to load reference data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  // Merge loaded accounts with predefined fallback list
  const mergedAccounts = useMemo(() => {
    const list = [...accounts];
    DEFAULT_ACCOUNTS.forEach(def => {
      if (!list.some(a => a.code === def.code || a.id === def.code)) {
        list.push(def);
      }
    });
    return list.map(a => ({
      ...a,
      id: a.id || a.code,
      code: a.code || a.systemCode
    }));
  }, [accounts]);

  // Merge loaded items with default mockup items
  const mergedItems = useMemo(() => {
    const list = [...items];
    DEFAULT_ITEMS.forEach(def => {
      if (!list.some(i => i.id === def.id || i.code === def.code)) {
        list.push(def);
      }
    });
    return list;
  }, [items]);

  // Handle client account auto selection depending on payment method
  useEffect(() => {
    if (form.paymentMethod === 'ON_CREDIT') {
      const customer = customers.find(c => c.id === form.customerId || c.displayName === form.customerId);
      if (customer && customer.defaultARAccountId) {
        const found = mergedAccounts.find(a => a.id === customer.defaultARAccountId || a.code === customer.defaultARAccountId);
        if (found) {
          setForm(prev => ({ ...prev, financialClientAccount: found.code }));
          return;
        }
      }
      setForm(prev => ({ ...prev, financialClientAccount: '1210001' }));
    } else {
      setForm(prev => ({ ...prev, financialClientAccount: '1110001' }));
    }
  }, [form.paymentMethod, form.customerId, customers, mergedAccounts]);

  // Calculations for items table
  const computedLines = useMemo(() => {
    return form.lines.map(line => {
      if (!line.itemId) return { gross: 0, discountAmt: 0, total: 0 };
      const gross = roundMoney(line.qty * line.unitPrice);
      let discountAmt = 0;
      if (line.discountType === 'PERCENT') {
        discountAmt = roundMoney(gross * (line.discountValue / 100));
      } else if (line.discountType === 'AMOUNT') {
        discountAmt = roundMoney(line.discountValue);
      }
      const total = roundMoney(gross - discountAmt);
      return { gross, discountAmt, total };
    });
  }, [form.lines]);

  // Totals calculations matching screenshot formulas
  const totals = useMemo(() => {
    const rawSubtotal = computedLines.reduce((acc, l) => acc + l.total, 0);
    
    let discountAmount = 0;
    let taxAmount = 0;

    if (applySyrianPresets && rawSubtotal > 0) {
      discountAmount = rawSubtotal * 0.02; // 2% Syrian Discount Preset
      taxAmount = rawSubtotal * 0.05; // 5% Syrian VAT Preset
    }

    const grandTotal = rawSubtotal - discountAmount + taxAmount;
    const sumEquivalent = roundMoney(grandTotal * form.exchangeParity * form.parityMultiplier);

    return { 
      subtotal: roundMoney(rawSubtotal), 
      discountAmount: roundMoney(discountAmount),
      taxAmount: roundMoney(taxAmount), 
      grandTotal: roundMoney(grandTotal), 
      sumEquivalent 
    };
  }, [computedLines, form.exchangeParity, form.parityMultiplier, applySyrianPresets]);

  // Ledger allocations table calculation
  const ledgerAllocations = useMemo(() => {
    const clientCode = allocationAccounts.clientAccount || form.financialClientAccount;
    const revCode = allocationAccounts.revenueAccount;
    const discCode = allocationAccounts.discountAccount;
    const vatCode = allocationAccounts.vatAccount;

    const list: Array<{ accountCode: string; accountName: string; debit: number; credit: number; type: string }> = [];

    // 1. Client receivable or cash settlement (Debit)
    const clientAcc = mergedAccounts.find(a => a.code === clientCode);
    list.push({
      accountCode: clientCode,
      accountName: clientAcc ? clientAcc.name : 'Financial Client Settlement Account',
      debit: totals.grandTotal,
      credit: 0,
      type: 'client'
    });

    // 2. Sales Revenue (Credit)
    const revAcc = mergedAccounts.find(a => a.code === revCode);
    list.push({
      accountCode: revCode,
      accountName: revAcc ? revAcc.name : 'Sales Revenue Account',
      debit: 0,
      credit: totals.subtotal,
      type: 'revenue'
    });

    // 3. Discount (Debit) - if active
    if (totals.discountAmount > 0) {
      const discAcc = mergedAccounts.find(a => a.code === discCode);
      list.push({
        accountCode: discCode,
        accountName: discAcc ? discAcc.name : 'Sales Discounts Allowed',
        debit: totals.discountAmount,
        credit: 0,
        type: 'discount'
      });
    }

    // 4. VAT tax allocation (Credit) - if active
    if (totals.taxAmount > 0) {
      const vatAcc = mergedAccounts.find(a => a.code === vatCode);
      list.push({
        accountCode: vatCode,
        accountName: vatAcc ? vatAcc.name : 'Value Added Tax Liability',
        debit: 0,
        credit: totals.taxAmount,
        type: 'vat'
      });
    }

    return list;
  }, [totals, form.financialClientAccount, allocationAccounts, mergedAccounts]);

  // Handlers
  const addRow = () => {
    setForm(prev => ({
      ...prev,
      lines: [...prev.lines, { itemId: '', qty: 1, uom: 'PCS', unitPrice: 0, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: prev.warehouseId || 'WH-MAIN', taxCodeId: '' }]
    }));
  };

  const removeRow = (index: number) => {
    setForm(prev => {
      const nextLines = prev.lines.filter((_, i) => i !== index);
      // Ensure we always have at least 10 lines row structure
      while (nextLines.length < 10) {
        nextLines.push({ itemId: '', qty: 0, uom: 'PCS', unitPrice: 0, discountType: 'NONE', discountValue: 0, notes: '', warehouseId: '', taxCodeId: '' });
      }
      return { ...prev, lines: nextLines };
    });
  };

  const updateRow = (index: number, patch: Partial<EditableLine>) => {
    setForm(prev => {
      const lines = [...prev.lines];
      const target = { ...lines[index], ...patch };
      
      // Auto-set mock price if item is selected
      if (patch.itemId !== undefined && patch.itemId !== '') {
        target.unitPrice = 2100000;
        target.qty = 1;
        target.uom = 'PCS';
        if (!target.warehouseId) {
          target.warehouseId = prev.warehouseId || 'WH-MAIN';
        }
      }
      
      lines[index] = target;
      return { ...prev, lines };
    });
  };

  // Line context menu handlers matching GVR
  const handleLineContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setLineContextMenu({ x: e.clientX, y: e.clientY, index });
  };

  const closeLineContextMenu = () => setLineContextMenu(null);

  const handleDeleteLine = (index: number) => {
    removeRow(index);
    closeLineContextMenu();
  };

  const handleCopyLine = (index: number) => {
    const row = form.lines[index];
    if (row) {
      setCopiedLineData(row);
      navigator.clipboard.writeText(JSON.stringify(row, null, 2))
        .then(() => {
          errorHandler.showSuccess(`Row ${index + 1} copied to clipboard.`);
        })
        .catch(() => {
          errorHandler.showSuccess(`Row ${index + 1} copied internally.`);
        });
    }
    closeLineContextMenu();
  };

  const handlePasteLine = async (index: number) => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const data = JSON.parse(clipboardText);
      if (data && typeof data === 'object') {
        updateRow(index, data);
        errorHandler.showSuccess(`Pasted clipboard data into row ${index + 1}.`);
      }
    } catch (err) {
      if (copiedLineData) {
        updateRow(index, copiedLineData);
        errorHandler.showSuccess(`Pasted copied row data into row ${index + 1}.`);
      } else {
        errorHandler.showError('No valid row data on clipboard or copied.');
      }
    }
    closeLineContextMenu();
  };

  const handleInsertLine = (index: number) => {
    setForm(prev => {
      const nextLines = [...prev.lines];
      const newRow: EditableLine = {
        itemId: '',
        qty: 0,
        uom: 'PCS',
        unitPrice: 0,
        discountType: 'NONE',
        discountValue: 0,
        notes: '',
        warehouseId: prev.warehouseId || 'WH-MAIN',
        taxCodeId: ''
      };
      nextLines.splice(index + 1, 0, newRow);
      // Remove last line if it is empty to maintain layout height cleanly
      if (nextLines.length > 10 && nextLines[nextLines.length - 1].itemId === '') {
        nextLines.pop();
      }
      return { ...prev, lines: nextLines };
    });
    errorHandler.showSuccess(`Inserted new empty row below row ${index + 1}.`);
    closeLineContextMenu();
  };

  const handleHighlightLine = (index: number) => {
    setHighlightedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    closeLineContextMenu();
  };

  // State action handlers (Simulated saves / confirmations)
  const triggerSaveDraft = () => {
    errorHandler.showSuccess('Sales Voucher Draft saved successfully (Simulated).');
    setSimulatedStatus('draft');
  };

  const triggerPostInvoice = () => {
    errorHandler.showSuccess('Sales Invoice posted and ledger entries finalized (Simulated).');
    setSimulatedStatus('posted');
  };

  const triggerDiscardDraft = async () => {
    const approved = await confirm({
      title: 'Discard Voucher Draft',
      message: 'Are you sure you want to discard this draft? This will clear all entered document lines.',
      confirmLabel: 'Discard',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (approved) {
      setForm(prev => ({
        ...prev,
        lines: [
          { itemId: '[HW-SRV-001] - Server Rack Module', qty: 1, uom: 'PCS', unitPrice: 2100000, discountType: 'NONE' as const, discountValue: 0, notes: '' },
          ...Array(9).fill(null).map(() => ({ itemId: '', qty: 0, uom: 'PCS', unitPrice: 0, discountType: 'NONE' as const, discountValue: 0, notes: '' }))
        ]
      }));
      setSimulatedStatus('create');
      errorHandler.showInfo('Voucher draft discarded.');
    }
  };

  const addMockAttachment = () => {
    const filename = `Signed_Agreement_${Math.floor(Math.random() * 1000)}.pdf`;
    setMockAttachments(prev => [...prev, filename]);
    errorHandler.showSuccess(`Uploaded attachment ${filename}`);
  };

  const removeAttachment = (idx: number) => {
    const targetName = mockAttachments[idx];
    setMockAttachments(prev => prev.filter((_, i) => i !== idx));
    errorHandler.showInfo(`Removed attachment ${targetName}`);
  };

  const handleDispatch = () => {
    setShowSendModal(false);
    errorHandler.showSuccess(`Document successfully sent via ${sendChannel}!`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-slate-950 font-sans text-xs text-slate-800 dark:text-slate-200 overflow-hidden select-none">
      
      {/* V2 Header Bar */}
      <div className="flex-none bg-slate-900 text-slate-100 px-4 py-1.5 flex items-center justify-between shadow border-b border-slate-850 h-[38px]">
        <div className="flex items-center gap-3">
          <BookOpen className="text-blue-500 h-4 w-4 shrink-0" />
          <span className="font-bold tracking-wider uppercase text-[10px] sm:text-[11px] text-slate-200">
            Sales Invoice V2 Desktop Interface
          </span>
          {/* Simulated Mode Selector Tabs */}
          <div className="flex bg-slate-950/80 p-0.5 rounded border border-slate-800 ml-4">
            <button
              type="button"
              onClick={() => setSimulatedStatus('create')}
              className={`px-3 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all ${simulatedStatus === 'create' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ➕ Create
            </button>
            <button
              type="button"
              onClick={() => setSimulatedStatus('draft')}
              className={`px-3 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all ${simulatedStatus === 'draft' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              📝 Draft
            </button>
            <button
              type="button"
              onClick={() => setSimulatedStatus('posted')}
              className={`px-3 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all ${simulatedStatus === 'posted' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              🔒 Posted
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[9px] px-2.5 py-0.5 rounded font-black uppercase tracking-wider border ${
            simulatedStatus === 'create' ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' :
            simulatedStatus === 'draft' ? 'bg-amber-600/10 text-amber-400 border-amber-500/30' :
            'bg-emerald-600/10 text-emerald-400 border-emerald-500/30'
          }`}>
            {t(`VOUCHER:`)} {simulatedStatus === 'create' ? 'NEW' : simulatedStatus.toUpperCase()}
          </span>
          <button 
            type="button" 
            onClick={() => navigate('/sales/invoices')} 
            className="text-slate-400 hover:text-white transition-colors"
            title="Go Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace Frame - No window scrolling */}
      <div className="flex-1 min-h-0 p-1 flex flex-col gap-1 overflow-hidden">

        {/* Card 1: Core Details - Full width, 4-column horizontal grid */}
        <div className="flex-none bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 rounded-lg shadow-sm">
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
              {/* Client Selector */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Client Selector
                </label>
                <PartySelector 
                  value={form.customerId} 
                  role="CUSTOMER"
                  disabled={simulatedStatus === 'posted'}
                  onChange={(party) => {
                    setForm(prev => ({
                      ...prev,
                      customerId: party?.id || '',
                      customerName: party?.displayName || '',
                    }));
                  }}
                />
              </div>

              {/* Warehouse Selector */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Warehouse
                </label>
                <WarehouseSelector 
                  value={form.warehouseId}
                  disabled={simulatedStatus === 'posted'}
                  onChange={(wh) => setForm(prev => ({ ...prev, warehouseId: wh?.id || '' }))}
                />
              </div>

              {/* Voucher Date */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Voucher Date
                </label>
                <DatePicker 
                  value={form.invoiceDate} 
                  disabled={simulatedStatus === 'posted'}
                  onChange={(val: any) => setForm(prev => ({ ...prev, invoiceDate: val || '' }))}
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Payment Method
                </label>
                <select
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2 h-[30px] text-xs focus:ring-1 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100 disabled:opacity-50"
                  value={form.paymentMethod}
                  disabled={simulatedStatus === 'posted'}
                  onChange={(e) => setForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  <option value="ON_CREDIT">{t(`On Credit (Receivable)`)}</option>
                  <option value="CASH">{t(`Cash Settlement`)}</option>
                  <option value="BANK">{t(`Bank Wire Transfer`)}</option>
                  <option value="CHECK">{t(`Bank Check`)}</option>
                </select>
              </div>
          </div>
        </div>

        {/* Card 2: Financial Settings - Full width, 4-column horizontal grid */}
        <div className="flex-none bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 rounded-lg shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-1">
              {/* Currency Selector */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Currency
                </label>
                <CurrencySelector
                  value={form.currency}
                  disabled={simulatedStatus === 'posted'}
                  onChange={(code) => setForm(prev => ({ ...prev, currency: code }))}
                />
              </div>

              {/* Smart Currency Exchange Rate */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Exchange Rate
                </label>
                <CurrencyExchangeWidget
                  currency={form.currency}
                  baseCurrency="SYP"
                  voucherDate={form.invoiceDate}
                  value={form.exchangeParity}
                  disabled={simulatedStatus === 'posted'}
                  onChange={(rate) => setForm(prev => ({ ...prev, exchangeParity: rate }))}
                />
              </div>

              {/* Financial Client Account */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Client Account
                </label>
                <AccountSelector
                  value={form.financialClientAccount}
                  disabled={simulatedStatus === 'posted'}
                  accounts={mergedAccounts}
                  allowedClassifications={['ASSET']}
                  contextLabel={form.paymentMethod === 'ON_CREDIT' ? 'Receivable' : 'Cash/Bank'}
                  onChange={(acc) => {
                    if (acc) {
                      setForm(prev => ({ ...prev, financialClientAccount: acc.code }));
                    }
                  }}
                />
              </div>

              {/* Public Notes (Non-internal) */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Public Document Note
                </label>
                <input
                  type="text"
                  disabled={simulatedStatus === 'posted'}
                  placeholder="Terms, bank lines details..."
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2 text-xs focus:ring-1 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100 disabled:opacity-50 h-[30px]"
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
          </div>
        </div>

        {/* Card 3: Line Items — 60% of flexible remaining space */}
        <div className="flex-[3] min-h-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-2 rounded-lg shadow-sm flex flex-col gap-1">
            {simulatedStatus !== 'posted' && (
              <div className="flex-none flex justify-end">
                <button 
                  type="button" 
                  onClick={addRow}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition active:scale-[0.98]"
                >
                  + Add Row
                </button>
              </div>
            )}

            {/* Real Spreadsheet Table with Border-r Cells and Transparent Inputs */}
            <div className="flex-1 min-h-0 overflow-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="min-w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
                  <tr className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">
                    <th className="py-1 px-1 text-center w-[30px] border-r border-slate-200 dark:border-slate-800">#</th>
                    <th className="py-1 px-1.5 min-w-[180px] border-r border-slate-200 dark:border-slate-800">{t(`MATERIAL SKU & NAME`)}</th>
                    <th className="py-1 px-1 w-[110px] border-r border-slate-200 dark:border-slate-800">{t(`WAREHOUSE`)}</th>
                    <th className="py-1 px-1 w-[60px] text-center border-r border-slate-200 dark:border-slate-800">{t(`UOM`)}</th>
                    <th className="py-1 px-1 w-[60px] text-right border-r border-slate-200 dark:border-slate-800">{t(`QTY`)}</th>
                    <th className="py-1 px-1 w-[90px] text-right border-r border-slate-200 dark:border-slate-800">{t(`UNIT PRICE`)}</th>
                    <th className="py-1 px-1 w-[90px] border-r border-slate-200 dark:border-slate-800">{t(`DISC TYPE`)}</th>
                    <th className="py-1 px-1 w-[70px] text-right border-r border-slate-200 dark:border-slate-800">{t(`DISCOUNT`)}</th>
                    <th className="py-1 px-1 w-[90px] border-r border-slate-200 dark:border-slate-800">{t(`TAX CODE`)}</th>
                    <th className="py-1 px-1.5 w-[90px] text-right border-r border-slate-200 dark:border-slate-800">{t(`TOTAL`)}</th>
                    <th className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800">{t(`LINE MEMO`)}</th>
                    <th className="py-1 px-1 w-[30px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {form.lines.map((line, index) => (
                    <tr 
                      key={index} 
                      className={`hover:bg-slate-50/40 dark:hover:bg-slate-950/15 align-middle ${
                        highlightedRows.has(index) ? 'bg-amber-100/50 dark:bg-amber-900/30' : ''
                      }`}
                    >
                      {/* # Index */}
                      <td 
                        onContextMenu={(e) => handleLineContextMenu(e, index)}
                        className="py-1 px-1 text-center font-bold text-slate-400 bg-slate-50/40 dark:bg-slate-950/10 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 select-none"
                        title="Right-click for options"
                      >
                        {index + 1}
                      </td>

                      {/* Material Select */}
                      <td className="py-0.5 px-1 border-r border-slate-200 dark:border-slate-800">
                        <ItemSelector
                          value={line.itemId}
                          disabled={simulatedStatus === 'posted'}
                          noBorder={true}
                          onChange={(item) => {
                            updateRow(index, {
                              itemId: item?.id || '',
                              itemCode: item?.code || '',
                              itemName: item?.name || ''
                            });
                          }}
                        />
                      </td>

                      {/* Warehouse Select */}
                      <td className="py-0.5 px-1 border-r border-slate-200 dark:border-slate-800">
                        <WarehouseSelector
                          value={line.warehouseId}
                          disabled={simulatedStatus === 'posted' || !line.itemId}
                          noBorder={true}
                          onChange={(wh) => {
                            updateRow(index, { warehouseId: wh?.id || '' });
                          }}
                        />
                      </td>

                      {/* UoM Selection */}
                      <td className="py-0.5 px-1 border-r border-slate-200 dark:border-slate-800">
                        <select
                          className="w-full border-0 bg-transparent px-1 py-0.5 text-xs focus:ring-1 focus:ring-primary-500 outline-none text-slate-850 dark:text-slate-100 disabled:opacity-50"
                          value={line.uom}
                          disabled={simulatedStatus === 'posted' || !line.itemId}
                          onChange={(e) => updateRow(index, { uom: e.target.value })}
                        >
                          <option value="PCS">{t(`PCS`)}</option>
                          <option value="BOX">{t(`BOX`)}</option>
                          <option value="KG">{t(`KG`)}</option>
                        </select>
                      </td>

                      {/* Qty Input */}
                      <td className="py-0.5 px-1 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="number"
                          min={0}
                          disabled={simulatedStatus === 'posted' || !line.itemId}
                          className="w-full border-0 bg-transparent px-1 py-0.5 text-right font-mono outline-none text-slate-850 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-primary-500 rounded disabled:opacity-40"
                          value={line.qty || ''}
                          onChange={(e) => updateRow(index, { qty: Number(e.target.value) || 0 })}
                        />
                      </td>

                      {/* Unit Price */}
                      <td className="py-0.5 px-1 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="number"
                          min={0}
                          disabled={simulatedStatus === 'posted' || !line.itemId}
                          className="w-full border-0 bg-transparent px-1 py-0.5 text-right font-mono outline-none text-slate-850 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-primary-500 rounded disabled:opacity-40"
                          value={line.unitPrice || ''}
                          onChange={(e) => updateRow(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                        />
                      </td>

                      {/* Discount Type */}
                      <td className="py-0.5 px-1 border-r border-slate-200 dark:border-slate-800">
                        <select
                          className="w-full border-0 bg-transparent px-1 py-0.5 text-xs focus:ring-1 focus:ring-primary-500 outline-none text-slate-850 dark:text-slate-100 disabled:opacity-40"
                          value={line.discountType}
                          disabled={simulatedStatus === 'posted' || !line.itemId}
                          onChange={(e) => updateRow(index, { discountType: e.target.value as any, discountValue: 0 })}
                        >
                          <option value="NONE">{t(`No Discount`)}</option>
                          <option value="PERCENT">{t(`% Percent`)}</option>
                          <option value="AMOUNT">{t(`Fixed Amt`)}</option>
                        </select>
                      </td>

                      {/* Discount Value */}
                      <td className="py-0.5 px-1 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="number"
                          min={0}
                          disabled={simulatedStatus === 'posted' || line.discountType === 'NONE'}
                          className="w-full border-0 bg-transparent px-1 py-0.5 text-right font-mono outline-none text-slate-850 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-primary-500 rounded disabled:opacity-40"
                          value={line.discountValue || ''}
                          onChange={(e) => updateRow(index, { discountValue: Number(e.target.value) || 0 })}
                        />
                      </td>

                      {/* Tax Code */}
                      <td className="py-0.5 px-1 border-r border-slate-200 dark:border-slate-800">
                        <select
                          className="w-full border-0 bg-transparent px-1 py-0.5 text-xs focus:ring-1 focus:ring-primary-500 outline-none text-slate-850 dark:text-slate-100 disabled:opacity-40"
                          value={line.taxCodeId || ''}
                          disabled={simulatedStatus === 'posted' || !line.itemId}
                          onChange={(e) => updateRow(index, { taxCodeId: e.target.value })}
                        >
                          <option value="">{t(`No Tax`)}</option>
                          {taxCodes.map(tc => (
                            <option key={tc.id} value={tc.id}>{tc.code} ({Math.round(tc.rate * 100)}%)</option>
                          ))}
                        </select>
                      </td>

                      {/* Computed Total */}
                      <td className="py-1 px-1.5 border-r border-slate-200 dark:border-slate-800 text-right font-mono font-bold text-slate-850 dark:text-slate-100 pr-3">
                        {line.itemId ? computedLines[index]?.total.toLocaleString() : '-'}
                      </td>

                      {/* Line Memo */}
                      <td className="py-0.5 px-1.5 border-r border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          placeholder="Line note..."
                          disabled={simulatedStatus === 'posted' || !line.itemId}
                          className="w-full border-0 bg-transparent px-2 py-0.5 text-xs outline-none text-slate-850 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-primary-500 rounded disabled:opacity-40"
                          value={line.notes}
                          onChange={(e) => updateRow(index, { notes: e.target.value })}
                        />
                      </td>

                      {/* Delete Action */}
                      <td className="py-1 px-1 text-center">
                        {simulatedStatus !== 'posted' && (
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="text-slate-400 hover:text-rose-500 transition-colors"
                            title="Clear row"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>

        {/* Card 4: Actions & Allocation Grid — 40% of flexible remaining space */}
        <div className="flex-[2] min-h-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-2 rounded-lg shadow-sm flex flex-col gap-1">
            
            {/* Modal actions row - auto-width buttons, not full-width grid */}
            <div className="flex gap-1 flex-none">
              <button
                type="button"
                onClick={() => setShowAttachmentsModal(true)}
                className="py-0.5 px-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded flex items-center gap-1 text-[10px] transition active:scale-[0.98] whitespace-nowrap"
              >
                <Paperclip className="h-3 w-3 text-slate-500 shrink-0" /> 
                {t(`Files (`)}{mockAttachments.length})
              </button>
              <button
                type="button"
                onClick={() => setShowInternalNotesModal(true)}
                className="py-0.5 px-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded flex items-center gap-1 text-[10px] transition active:scale-[0.98] whitespace-nowrap"
              >
                <MessageSquare className="h-3 w-3 text-slate-500 shrink-0" /> 
                {t(`Notes`)} {internalNotes.trim() && '🔴'}
              </button>
              <button
                type="button"
                onClick={() => setShowSendModal(true)}
                className="py-0.5 px-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded flex items-center gap-1 text-[10px] transition active:scale-[0.98] whitespace-nowrap"
              >
                <Send className="h-3 w-3 text-slate-500 shrink-0" /> 
                Dispatch
              </button>
            </div>

            {/* Allocation Table - fills remaining height of Card 4 */}
            <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
              <div className="flex justify-end pb-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setApplySyrianPresets(prev => !prev);
                    errorHandler.showSuccess(applySyrianPresets ? 'Tax presets cleared' : 'Applied Syrian Tax presets: 5% VAT and 2% discount.');
                  }}
                  className={`px-2 py-0.5 border rounded text-[9px] font-bold transition flex items-center gap-1 shadow-sm ${
                    applySyrianPresets 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-350'
                  }`}
                >
                  <Check className="h-2.5 w-2.5" /> presets
                </button>
              </div>

              {/* Allocation spreadsheet table - styled exactly like Card 3 spreadsheet */}
              <div className="flex-1 min-h-0 overflow-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="min-w-full text-[10px] border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
                    <tr className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">
                      <th className="py-0.5 px-1.5 border-r border-b border-slate-200 dark:border-slate-800">{t(`LEDGER ACCOUNT`)}</th>
                      <th className="py-0.5 px-1.5 text-right w-[75px] border-r border-b border-slate-200 dark:border-slate-800">{t(`DEBIT`)}</th>
                      <th className="py-0.5 px-1.5 text-right w-[75px] border-b border-slate-200 dark:border-slate-800">{t(`CREDIT`)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {ledgerAllocations.map((alloc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-950/15 align-middle">
                        
                        {/* Account Selector in cell */}
                        <td className="py-0.5 px-1 border-r border-slate-200 dark:border-slate-800 align-middle">
                          <AccountSelector
                            value={alloc.accountCode}
                            disabled={simulatedStatus === 'posted'}
                            accounts={mergedAccounts}
                            noBorder={true}
                            allowedClassifications={alloc.type === 'client' || alloc.type === 'discount' ? ['ASSET', 'REVENUE'] : ['REVENUE', 'LIABILITY']}
                            onChange={(acc) => {
                              if (acc) {
                                setAllocationAccounts(prev => {
                                  const next = { ...prev };
                                  if (alloc.type === 'client') next.clientAccount = acc.code;
                                  else if (alloc.type === 'revenue') next.revenueAccount = acc.code;
                                  else if (alloc.type === 'discount') next.discountAccount = acc.code;
                                  else if (alloc.type === 'vat') next.vatAccount = acc.code;
                                  return next;
                                });
                              }
                            }}
                          />
                        </td>

                        {/* Debit */}
                        <td className="py-0.5 px-1.5 text-right font-mono font-bold text-slate-850 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
                          {alloc.debit > 0 ? alloc.debit.toLocaleString() : '-'}
                        </td>

                        {/* Credit */}
                        <td className="py-0.5 px-1.5 text-right font-mono font-bold text-slate-850 dark:text-slate-100">
                          {alloc.credit > 0 ? alloc.credit.toLocaleString() : '-'}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-850 font-bold text-[10px]">
                    <tr className="align-middle">
                      <td className="py-0.5 px-1.5 text-right font-black uppercase text-[9px] text-slate-400 border-r border-slate-200 dark:border-slate-800">
                        Total
                      </td>
                      <td className="py-0.5 px-1.5 text-right font-mono text-slate-850 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
                        {ledgerAllocations.reduce((acc, l) => acc + l.debit, 0).toLocaleString()}
                      </td>
                      <td className="py-0.5 px-1.5 text-right font-mono text-slate-850 dark:text-slate-100">
                        {ledgerAllocations.reduce((acc, l) => acc + l.credit, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
        </div>

      </div>

      {/* Footer - direct flex-none child of root, always visible at bottom */}
      <div className="flex-none bg-white/95 dark:bg-slate-900/95 border-t-2 border-slate-200 dark:border-slate-800 px-5 py-5 shadow-lg flex items-center gap-0">

        {/* LEFT: Totals - 35% */}
        <div className="w-[35%] flex items-center gap-4 pr-4 border-r border-slate-200 dark:border-slate-800">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-black">{t(`SUBTOTAL`)}</span>
            <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200 leading-none">
              {totals.subtotal.toLocaleString()} {form.currency}
            </span>
          </div>

          {totals.discountAmount > 0 && (
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-black">{t(`DISC (2%)`)}</span>
              <span className="font-mono font-bold text-xs text-rose-600 leading-none">
                -{totals.discountAmount.toLocaleString()}
              </span>
            </div>
          )}

          {totals.taxAmount > 0 && (
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-black">{t(`TAX (5%)`)}</span>
              <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 leading-none">
                +{totals.taxAmount.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex flex-col ml-1">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-black">{t(`GRAND TOTAL`)}</span>
            <span className="font-mono font-black text-2xl text-rose-600 dark:text-rose-400 leading-none">
              {totals.grandTotal.toLocaleString()} <span className="text-sm font-bold">{form.currency}</span>
            </span>
          </div>
        </div>

        {/* RIGHT: Action Buttons */}
        <div className="flex-1 flex items-center justify-end gap-2 pl-4">

          {simulatedStatus === 'create' && (
            <>
              <button type="button" onClick={triggerSaveDraft}
                className="rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 dark:hover:bg-slate-600 transition-all active:scale-[0.98]">
                Save Draft
              </button>
              <button type="button" onClick={triggerPostInvoice}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-all active:scale-[0.98]">
                {t(`Save`)} {'&'} Post
              </button>
            </>
          )}

          {simulatedStatus === 'draft' && (
            <>
              <button type="button"
                onClick={() => errorHandler.showSuccess('Invoice template cloned to recurring schedule.')}
                className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 transition-all active:scale-[0.98]">
                Clone to Recurring
              </button>
              <button type="button" onClick={triggerDiscardDraft}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 transition-all active:scale-[0.98]">
                Discard
              </button>
              <button type="button"
                onClick={() => errorHandler.showSuccess('Changes saved to draft document.')}
                className="rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 dark:hover:bg-slate-600 transition-all active:scale-[0.98]">
                Save Changes
              </button>
              <button type="button" onClick={triggerPostInvoice}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-all active:scale-[0.98]">
                Post Invoice
              </button>
            </>
          )}

          {simulatedStatus === 'posted' && (
            <>
              <button type="button"
                onClick={() => errorHandler.showSuccess('Invoice template cloned to recurring schedule.')}
                className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 transition-all active:scale-[0.98]">
                Clone to Recurring
              </button>
              <button type="button"
                onClick={() => errorHandler.showInfo('Navigating to reversing sales return creation...')}
                className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-100/50 transition-all active:scale-[0.98]">
                Create Reversing Sales Return
              </button>
              <button type="button"
                onClick={() => errorHandler.showSuccess('Simulating customer receipt collection...')}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-all active:scale-[0.98]">
                Create Receipt
              </button>
            </>
          )}

        </div>
      </div>

      {/* MODAL OVERLAYS */}
      {showAttachmentsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{t(`📁 Manage Invoice Attachments`)}</h3>
              <button onClick={() => setShowAttachmentsModal(false)} className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div 
                onClick={addMockAttachment}
                className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
              >
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-350">{t(`Drag files here or click to select`)}</p>
                <p className="text-[10px] text-slate-400 mt-1">{t(`PDF, PNG, JPG, XLSX (Max 10MB)`)}</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t(`Attached Files (`)}{mockAttachments.length})</h4>
                {mockAttachments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">{t(`No files attached to this invoice.`)}</p>
                ) : (
                  <div className="divide-y divide-slate-150 dark:divide-slate-800 border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden">
                    {mockAttachments.map((att, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center text-xs bg-slate-50/50 dark:bg-slate-950/20">
                        <span className="font-medium text-slate-700 dark:text-slate-350 truncate max-w-[320px]">{att}</span>
                        <button onClick={() => removeAttachment(idx)} className="text-rose-500 hover:underline">{t(`Delete`)}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
              <button onClick={addMockAttachment} className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">{t(`Add Simulated File`)}</button>
              <button onClick={() => setShowAttachmentsModal(false)} className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-750 dark:text-slate-350">{t(`Close`)}</button>
            </div>
          </div>
        </div>
      )}

      {showInternalNotesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{t(`📝 Internal Audit Notes`)}</h3>
              <button onClick={() => setShowInternalNotesModal(false)} className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400 italic">{t(`These notes are strictly for internal audit and credit vetting logs. They will not print on the official customer-facing document.`)}</p>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-slate-350 dark:border-slate-750 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary-500 outline-none text-slate-900 dark:text-slate-100"
                placeholder="Audit notes, internal approvals, bank guarantees details..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
            <div className="p-4 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
              <button onClick={() => setShowInternalNotesModal(false)} className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">{t(`Save Notes`)}</button>
            </div>
          </div>
        </div>
      )}

      {showSendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{t(`✉️ Dispatch / Send Document`)}</h3>
              <button onClick={() => setShowSendModal(false)} className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">{t(`Communication Channel`)}</label>
                <div className="flex gap-2">
                  {['WhatsApp', 'Telegram', 'Email'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSendChannel(c)}
                      className={`flex-1 py-2 text-center rounded-lg border font-bold ${sendChannel === c ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-350'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">{t(`Sender Account`)}</label>
                <select className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 outline-none text-slate-800 dark:text-slate-150">
                  <option>{t(`Default Company Sender (Business Line)`)}</option>
                  <option>{t(`CFO Personal Telegram Route`)}</option>
                  <option>{t(`System Auto-Dispatch BOT`)}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">{t(`Preview Message Text`)}</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[10px] leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-line">
                  {`Dear ${form.customerName || 'Customer'},\n\nYour Sales Invoice is ready.\nInvoice No: SINV-2026-0001\nGrand Total: ${totals.grandTotal.toLocaleString()} SYP\nDue Date: ${form.dueDate || 'N/A'}\n\nThank you for doing business with us.`}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
              <button onClick={handleDispatch} className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">{t(`Dispatch Message`)}</button>
              <button onClick={() => setShowSendModal(false)} className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-750 dark:text-slate-350">{t(`Close`)}</button>
            </div>
          </div>
        </div>
      )}

      {/* GVR Classic Table Right-Click Context Menu */}
      {lineContextMenu && (
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={closeLineContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeLineContextMenu(); }}
          />
          <div 
            className="fixed bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 z-[9999] py-1.5 w-52 transition-colors animate-in fade-in zoom-in duration-200"
            style={{ left: lineContextMenu.x, top: lineContextMenu.y }}
          >
            <button
              onClick={() => handleDeleteLine(lineContextMenu.index)}
              className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete Line
            </button>
            <div className="border-t border-slate-100 dark:border-slate-800 my-1.5 opacity-50"></div>
            <button
              onClick={() => handleCopyLine(lineContextMenu.index)}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-400" />
              Copy
            </button>
            <button
              onClick={() => handlePasteLine(lineContextMenu.index)}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-400" />
              Paste
            </button>
            <button
              onClick={() => handleInsertLine(lineContextMenu.index)}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-400" />
              Insert Below
            </button>
            <div className="border-t border-slate-100 dark:border-slate-800 my-1.5 opacity-50"></div>
            <button
              onClick={() => handleHighlightLine(lineContextMenu.index)}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <span className={`w-4 h-4 rounded-sm ${highlightedRows.has(lineContextMenu.index) ? 'bg-amber-500' : 'bg-amber-300'} border border-amber-400`}></span>
              {highlightedRows.has(lineContextMenu.index) ? 'Remove Highlight' : 'Highlight'}
            </button>
            <div className="border-t border-slate-100 dark:border-slate-800 my-1.5 opacity-50"></div>
            <button
              onClick={() => {
                errorHandler.showInfo(`Account statement drill-down is coming soon. Use Accounting → Reports → Account Statement in the meantime.`);
                closeLineContextMenu();
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-slate-400" />
              Statement
            </button>
            <button
              onClick={() => {
                errorHandler.showInfo(`Account balance lookup is coming soon. Use Accounting → Reports → Trial Balance in the meantime.`);
                closeLineContextMenu();
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <ChevronDown className="w-4 h-4 text-slate-400" />
              Account Balance
            </button>
          </div>
        </>
      )}

      {confirmDialog}
    </div>
  );
}
