import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; import { useCompanyAccess } from '../../../context/CompanyAccessContext'; import { useAuth } from '../../../context/AuthContext'; import { loadModuleDocumentForms, DocumentFormConfig, AvailableField } from '../forms-designer'; import { Card } from '../../../components/ui/Card'; import { Button } from '../../../components/ui/Button'; import { salesApi } from '../../../api/salesApi'; import { purchasesApi } from '../../../api/purchasesApi'; import { accountingApi } from '../../../api/accountingApi'; import { voucherFormApi } from '../../../api/voucherFormApi'; import { Plus, RefreshCw, ArrowLeft, FileText, AlertCircle } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { errorHandler } from '../../../services/errorHandler';
// We'll try to reuse the Voucher renderer if possible, or build a simplified one
import { GenericVoucherRenderer } from '../../accounting/components/shared/GenericVoucherRenderer';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useWindowManager } from '../../../context/WindowManagerContext';

interface DynamicDocumentRow {
  id: string;
  number: string;
  counterparty: string;
  date: string;
  status: string;
  amountText: string;
}

type DynamicDocumentKind =
  | 'sales_invoice'
  | 'sales_order'
  | 'delivery_note'
  | 'sales_return'
  | 'purchase_invoice'
  | 'purchase_order'
  | 'goods_receipt'
  | 'purchase_return'
  | 'accounting_voucher';

const normalizeCode = (value: any): string =>
  String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const formatAmount = (amount: number | undefined, currency?: string): string => {
  const safeAmount = Number(amount || 0);
  const code = (currency || '').toUpperCase();
  if (!code) return safeAmount.toFixed(2);
  return `${safeAmount.toFixed(2)} ${code}`;
};

const unwrapPayload = <T,>(payload: any): T => (payload?.data?.data ?? payload?.data ?? payload) as T;

const normalizeModuleCode = (value: any): string => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PURCHASES') return 'PURCHASE';
  if (raw === 'SALES_MODULE') return 'SALES';
  return raw;
};

export const DynamicDocumentPage: React.FC = () => {
  const { formCode, id } = useParams<{ formCode: string; id?: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();
  const { user } = useAuth();
  const { uiMode } = useUserPreferences();
  const { openWindow } = useWindowManager();

  const [loading, setLoading] = useState(true);
  const [formConfig, setFormConfig] = useState<DocumentFormConfig | null>(null);
  const [rows, setRows] = useState<DynamicDocumentRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = pathname.endsWith('/new');
  const isEditor = !!id || isNew;
  const module = pathname.split('/')[1].toUpperCase(); // SALES or PURCHASES (mapped later)
  const normalizedModule = normalizeModuleCode(module);
  const normalizedFormCode = useMemo(() => normalizeCode(formCode), [formCode]);

  const detectDocumentKind = (config?: DocumentFormConfig | null): DynamicDocumentKind => {
    const candidates = [
      normalizeCode(config?.voucherType),
      normalizeCode(config?.formType),
      normalizeCode(config?.baseType),
      normalizeCode(config?.code),
      normalizedFormCode,
    ];

    const hasToken = (token: string) => candidates.some((candidate) => candidate.includes(token));

    if (normalizedModule === 'SALES') {
      if (hasToken('sales_invoice') || hasToken('invoice')) return 'sales_invoice';
      if (hasToken('sales_order') || hasToken('order')) return 'sales_order';
      if (hasToken('delivery_note') || hasToken('delivery')) return 'delivery_note';
      if (hasToken('sales_return') || hasToken('return')) return 'sales_return';
    }

    if (normalizedModule === 'PURCHASE') {
      if (hasToken('purchase_invoice') || hasToken('invoice')) return 'purchase_invoice';
      if (hasToken('purchase_order') || hasToken('order')) return 'purchase_order';
      if (hasToken('goods_receipt') || hasToken('receipt') || hasToken('grn')) return 'goods_receipt';
      if (hasToken('purchase_return') || hasToken('return')) return 'purchase_return';
    }

    return 'accounting_voucher';
  };

  const documentKind = useMemo<DynamicDocumentKind>(
    () => detectDocumentKind(formConfig),
    [formConfig, normalizedFormCode, normalizedModule]
  );

  const getFormIdentityValues = (config: DocumentFormConfig): string[] =>
    [
      config.formType,
      config.voucherType,
      config.baseType,
      config.code,
      config.id,
      config.persona,
      normalizedFormCode,
    ]
      .map(normalizeCode)
      .filter(Boolean);

  const matchesFormCode = (form: DocumentFormConfig, code: string): boolean => {
    const expected = normalizeCode(code);
    const identities = [
      form.id,
      form.code,
      (form as any).formType,
      (form as any).baseType,
      (form as any).typeId,
    ]
      .map(normalizeCode)
      .filter(Boolean);

    return identities.includes(expected);
  };

  const loadResolvableForms = async (): Promise<DocumentFormConfig[]> => {
    const directForms = await loadModuleDocumentForms(companyId, normalizedModule);

    try {
      const apiForms = await voucherFormApi.list();
      const normalizedApiForms = (Array.isArray(apiForms) ? apiForms : [])
        .filter((form: any) => normalizeModuleCode(form.module || 'ACCOUNTING') === normalizedModule)
        .map((form: any) => ({ ...form } as DocumentFormConfig));

      const merged = new Map<string, DocumentFormConfig>();
      for (const form of directForms) merged.set(form.id, form);
      for (const form of normalizedApiForms) merged.set(form.id, form);
      return Array.from(merged.values());
    } catch (apiErr) {
      console.warn('[DynamicDocumentPage] voucherForms API fallback failed:', apiErr);
      return directForms;
    }
  };

  const matchesDocumentRecord = (record: any, config: DocumentFormConfig): boolean => {
    const expected = getFormIdentityValues(config);
    const recordTokens = [
      record.formType,
      record.voucherTypeId,
      record.formId,
      record.code,
      record.metadata?.formId,
    ]
      .map(normalizeCode)
      .filter(Boolean);

    if (recordTokens.some((token) => expected.includes(token))) return true;

    const formVoucherType = normalizeCode(config.voucherType || config.baseType);
    const formPersona = normalizeCode(config.persona);
    const recordVoucherType = normalizeCode(record.voucherType);
    const recordPersona = normalizeCode(record.persona);

    if (formVoucherType && recordVoucherType && formVoucherType === recordVoucherType) {
      if (!formPersona || !recordPersona || formPersona === recordPersona) return true;
    }

    if (detectDocumentKind(config) === 'sales_invoice' && recordVoucherType === 'sales_invoice') {
      const directForm = formPersona === 'direct' || expected.some((token) => token.includes('direct'));
      const linkedForm = formPersona === 'linked' || expected.some((token) => token.includes('linked'));
      const serviceForm = formPersona === 'service' || expected.some((token) => token.includes('service'));
      const recordFormType = normalizeCode(record.formType || record.voucherTypeId);

      if (directForm) return recordPersona === 'direct' || recordFormType === 'sales_invoice_direct';
if (linkedForm) return recordPersona === 'linked' || recordFormType === 'sales_invoice_linked';
      if (serviceForm) return recordPersona === 'service' || recordFormType === 'sales_invoice_service';
    }

    if (detectDocumentKind(config) === 'purchase_invoice' && recordVoucherType === 'purchase_invoice') {
      const directForm = formPersona === 'direct' || expected.some((token) => token.includes('direct'));
      const linkedForm = formPersona === 'linked' || expected.some((token) => token.includes('linked'));
      const serviceForm = formPersona === 'service' || expected.some((token) => token.includes('service'));
      const recordFormType = normalizeCode(record.formType || record.voucherTypeId);

      if (directForm) return recordPersona === 'direct' || recordFormType === 'purchase_invoice_direct';
      if (linkedForm) return recordPersona === 'linked' || recordFormType === 'purchase_invoice_linked';
      if (serviceForm) return recordPersona === 'service' || recordFormType === 'purchase_invoice_service';
    }

    return false;
  };

  const getRowTarget = (row: DynamicDocumentRow): string => {
    switch (documentKind) {
      case 'sales_invoice':
        return `/sales/invoices/${row.id}`;
      case 'sales_order':
        return `/sales/orders/${row.id}`;
      case 'delivery_note':
        return `/sales/delivery-notes/${row.id}`;
      case 'sales_return':
        return `/sales/returns/${row.id}`;
      case 'purchase_invoice':
        return `/purchases/invoices/${row.id}`;
      case 'purchase_order':
        return `/purchases/orders/${row.id}`;
      case 'goods_receipt':
        return `/purchases/goods-receipts/${row.id}`;
      case 'purchase_return':
        return `/purchases/returns/${row.id}`;
      default:
        return `${pathname}/${row.id}`;
    }
  };

  const loadDocumentRows = async (config: DocumentFormConfig) => {
    if (!companyId) return;
    setRowsLoading(true);
    try {
      let nextRows: DynamicDocumentRow[] = [];
      const kind = detectDocumentKind(config);

      if (kind === 'sales_invoice') {
        const list = unwrapPayload<any[]>(await salesApi.listSIs({ limit: 500 }));
        nextRows = (Array.isArray(list) ? list : [])
          .filter((invoice: any) => matchesDocumentRecord(invoice, config))
          .map((invoice: any) => ({
            id: invoice.id,
            number: invoice.invoiceNumber || invoice.id,
            counterparty: invoice.customerName || '-',
            date: invoice.invoiceDate || '',
            status: invoice.status || 'DRAFT',
            amountText: formatAmount(invoice.grandTotalDoc, invoice.currency),
          }));
      } else if (kind === 'sales_order') {
        const list = unwrapPayload<any[]>(await salesApi.listSOs({ limit: 500 }));
        nextRows = (Array.isArray(list) ? list : [])
          .filter((order: any) => matchesDocumentRecord(order, config))
          .map((order: any) => ({
            id: order.id,
            number: order.orderNumber || order.id,
            counterparty: order.customerName || '-',
            date: order.orderDate || '',
            status: order.status || 'DRAFT',
            amountText: formatAmount(order.grandTotalDoc, order.currency),
          }));
      } else if (kind === 'delivery_note') {
        const list = unwrapPayload<any[]>(await salesApi.listDNs({ limit: 500 }));
        nextRows = (Array.isArray(list) ? list : [])
          .filter((note: any) => matchesDocumentRecord(note, config))
          .map((note: any) => ({
            id: note.id,
            number: note.dnNumber || note.id,
            counterparty: note.customerName || '-',
            date: note.deliveryDate || '',
            status: note.status || 'DRAFT',
            amountText: '-',
          }));
      } else if (kind === 'sales_return') {
        const list = unwrapPayload<any[]>(await salesApi.listReturns({}));
        nextRows = (Array.isArray(list) ? list : [])
          .filter((entry: any) => matchesDocumentRecord(entry, config))
          .map((entry: any) => ({
            id: entry.id,
            number: entry.returnNumber || entry.id,
            counterparty: entry.customerName || '-',
            date: entry.returnDate || '',
            status: entry.status || 'DRAFT',
            amountText: formatAmount(entry.grandTotalDoc, entry.currency),
          }));
      } else if (kind === 'purchase_invoice') {
        const list = unwrapPayload<any[]>(await purchasesApi.listPIs({ limit: 500 }));
        nextRows = (Array.isArray(list) ? list : [])
          .filter((invoice: any) => matchesDocumentRecord(invoice, config))
          .map((invoice: any) => ({
            id: invoice.id,
            number: invoice.invoiceNumber || invoice.id,
            counterparty: invoice.vendorName || '-',
            date: invoice.invoiceDate || '',
            status: invoice.status || 'DRAFT',
            amountText: formatAmount(invoice.grandTotalDoc, invoice.currency),
          }));
      } else if (kind === 'purchase_order') {
        const list = unwrapPayload<any[]>(await purchasesApi.listPOs({ limit: 500 }));
        nextRows = (Array.isArray(list) ? list : [])
          .filter((order: any) => matchesDocumentRecord(order, config))
          .map((order: any) => ({
            id: order.id,
            number: order.orderNumber || order.id,
            counterparty: order.vendorName || '-',
            date: order.orderDate || '',
            status: order.status || 'DRAFT',
            amountText: formatAmount(order.grandTotalDoc, order.currency),
          }));
      } else if (kind === 'goods_receipt') {
        const list = unwrapPayload<any[]>(await purchasesApi.listGRNs({ limit: 500 }));
        nextRows = (Array.isArray(list) ? list : [])
          .filter((receipt: any) => matchesDocumentRecord(receipt, config))
          .map((receipt: any) => ({
            id: receipt.id,
            number: receipt.grnNumber || receipt.id,
            counterparty: receipt.vendorName || '-',
            date: receipt.receiptDate || '',
            status: receipt.status || 'DRAFT',
            amountText: '-',
          }));
      } else if (kind === 'purchase_return') {
        const list = unwrapPayload<any[]>(await purchasesApi.listReturns({}));
        nextRows = (Array.isArray(list) ? list : [])
          .filter((entry: any) => matchesDocumentRecord(entry, config))
          .map((entry: any) => ({
            id: entry.id,
            number: entry.returnNumber || entry.id,
            counterparty: entry.vendorName || '-',
            date: entry.returnDate || '',
            status: entry.status || 'DRAFT',
            amountText: formatAmount(entry.grandTotalDoc, entry.currency),
          }));
      } else {
        const response: any = unwrapPayload<any>(await accountingApi.listVouchers({
          type: 'ALL',
          formId: config.id,
          status: 'ALL',
          page: 1,
          pageSize: 500,
        }));
        const records = response?.items || [];
        nextRows = records.map((voucher: any) => ({
          id: voucher.id,
          number: voucher.voucherNo || voucher.id,
          counterparty: voucher.description || '-',
          date: voucher.date || '',
          status: voucher.status || 'DRAFT',
          amountText: formatAmount(voucher.totalDebit, voucher.currency),
        }));
      }

      nextRows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      setRows(nextRows);
    } catch (err) {
      console.error('Failed to load document rows', err);
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      if (!companyId || !formCode) return;
      
      setLoading(true);
      setError(null);
      try {
        const forms = await loadResolvableForms();
        // Find form by code (normalized: replace dashes with underscores if needed)
        const code = decodeURIComponent(formCode).replace(/-/g, '_');
        const found = forms.find(f => matchesFormCode(f, code));

        if (!found) {
          setError(`Document form "${formCode}" not found.`);
        } else {
          setFormConfig(found);
          await loadDocumentRows(found);
        }
      } catch (err: any) {
        console.error('Failed to load dynamic document config:', err);
        setError('Failed to load document configuration.');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [companyId, formCode, normalizedModule]);

  useEffect(() => {
    if (!formConfig) return;
    const onUpdated = () => {
      void loadDocumentRows(formConfig);
    };
    window.addEventListener('vouchers-updated', onUpdated);
    return () => window.removeEventListener('vouchers-updated', onUpdated);
  }, [formConfig, documentKind]);

  // Function to trigger the MDI window
  const handleOpenInWindow = () => {
    if (!formConfig) return;
    openWindow({
      type: 'voucher',
      title: isNew ? `New ${formConfig.name}` : `Edit ${formConfig.name}`,
      data: {
        ...formConfig,
        id: id === 'new' ? undefined : id,
        voucherConfig: formConfig, // Required for VoucherWindow
        status: 'Draft',
        sourceModule: normalizedModule.toLowerCase(), // Critical for non-accounting saves
        lines: [],
        metadata: {
          formId: formConfig.id,
          module: normalizedModule,
          source: 'DYNAMIC_FORM'
        }
      }
    });
    // Navigate back to the list so the background shows the document table
    const listPath = pathname.split('/').slice(0, -1).join('/');
    navigate(listPath);
  };

  // AUTO-TRIGGER: If in windows mode, pop the window immediately on mount
  // CRITICAL: This MUST be before any conditional returns (like if (loading))
  useEffect(() => {
    if (isEditor && uiMode === 'windows' && formConfig && !loading) {
      handleOpenInWindow();
    }
  }, [uiMode, isEditor, !!formConfig, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Spinner size="lg" variant="indigo" className="mb-2" />
        <p className="text-slate-500 font-medium">Loading {formCode}...</p>
      </div>
    );
  }

  if (error || !formConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Configuration Error</h2>
        <p className="text-slate-500 max-w-md mb-6">{error || 'Unknown error'}</p>
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft size={16} className="mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  // --- RENDER EDITOR ---
  // Note: In Windows mode, we don't render the editor full-page; 
  // we trigger handleOpenInWindow (via useEffect) and then the component 
  // proceeds to render the List view below.
  if (isEditor && uiMode !== 'windows') {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                {isNew ? `New ${formConfig.name}` : `Edit ${formConfig.name}`}
              </h1>
              <p className="text-xs text-slate-400">#{formCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
             <Button className="bg-indigo-600">Save Document</Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 flex justify-center">
          <div className="w-full max-w-5xl">
             <Card className="p-0 overflow-hidden border-none shadow-xl bg-white">
                <GenericVoucherRenderer 
                   definition={formConfig as any} 
                   mode="classic" 
                   readOnly={false}
                />
             </Card>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER LIST ---
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shadow-sm z-10">
           <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{formConfig.name}</h1>
              <p className="text-sm text-slate-500">Manage your {formConfig.name.toLowerCase()} documents.</p>
           </div>
           <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => loadDocumentRows(formConfig)} size="sm">
                <RefreshCw size={14} className="mr-2" /> Refresh
              </Button>
              <Button 
                onClick={() => navigate(`${pathname}/new`)} 
                className="bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all active:scale-95"
              >
                <Plus size={18} className="mr-1.5" /> New {formConfig.name}
              </Button>
           </div>
        </header>

        <div className="flex-1 p-6 overflow-hidden flex flex-col">
           <Card className="flex-1 flex flex-col bg-white border-slate-200 shadow-sm overflow-hidden rounded-xl">
              {rowsLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                  <Spinner size="lg" variant="indigo" className="mb-2" />
                  <p className="text-slate-500 font-medium">Loading documents...</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                   <div className="bg-slate-100 p-6 rounded-full text-slate-300 mb-6">
                      <FileText size={64} />
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 mb-2">No Documents Found</h3>
                   <p className="text-slate-500 max-w-sm mb-8">
                     You haven't created any {formConfig.name.toLowerCase()} records yet using this layout.
                   </p>
                   <Button
                      onClick={() => navigate(`${pathname}/new`)}
                      className="bg-indigo-600 rounded-xl px-8"
                   >
                     Create First Document
                   </Button>
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-200 text-left text-slate-600">
                        <th className="px-4 py-3 font-semibold">Number</th>
                        <th className="px-4 py-3 font-semibold">Party</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                          onClick={() => navigate(getRowTarget(row))}
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">{row.number}</td>
                          <td className="px-4 py-3 text-slate-700">{row.counterparty}</td>
                          <td className="px-4 py-3 text-slate-700">{row.date}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{row.amountText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
           </Card>
        </div>
    </div>
  );
};

export default DynamicDocumentPage;
