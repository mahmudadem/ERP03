import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreateSalesReturnPayload,
  DeliveryNoteDTO,
  ReturnReasonCode,
  ReturnSettlementMode,
  RestockingFeeType,
  ReturnContext,
  SalesInvoiceDTO,
  SalesReturnDTO,
  salesApi,
} from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ItemSelector, PartySelector, WarehouseSelector } from '../../../components/shared/selectors';
import { Plus, Trash2 } from 'lucide-react';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { GlImpactModal } from '../components/GlImpactModal';
import { PeriodLockOverrideModal } from '../components/PeriodLockOverrideModal';
import { RecordAuditModal } from '../components/RecordAuditModal';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);
const reasonCodeLabels: Record<ReturnReasonCode, string> = {
  DEFECTIVE: 'Defective',
  WRONG_ITEM: 'Wrong Item',
  CHANGED_MIND: 'Changed Mind',
  OTHER: 'Other',
};
const settlementModeLabels: Record<ReturnSettlementMode, string> = {
  CREDIT_NOTE: 'Credit Note',
  REFUND: 'Refund',
};

const SalesReturnDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const initialSalesInvoiceId = searchParams.get('salesInvoiceId') || '';
  const initialDeliveryNoteId = searchParams.get('deliveryNoteId') || '';
  const initialContext: ReturnContext = initialSalesInvoiceId
    ? 'AFTER_INVOICE'
    : initialDeliveryNoteId
      ? 'BEFORE_INVOICE'
      : 'DIRECT';

  const [salesReturn, setSalesReturn] = useState<SalesReturnDTO | null>(null);
  const [salesInvoiceId, setSalesInvoiceId] = useState(initialSalesInvoiceId);
  const [deliveryNoteId, setDeliveryNoteId] = useState(initialDeliveryNoteId);
  const [returnContext, setReturnContext] = useState<ReturnContext>(initialContext);
  const [returnDate, setReturnDate] = useState(todayIso());
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [settlementMode, setSettlementMode] = useState<ReturnSettlementMode>('CREDIT_NOTE');
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>('OTHER');
  const [reason, setReason] = useState('');
  const [restockingFeeType, setRestockingFeeType] = useState<RestockingFeeType>('AMOUNT');
  const [restockingFeeValue, setRestockingFeeValue] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [refundSettlementAccountId, setRefundSettlementAccountId] = useState('');
  const [lineSelections, setLineSelections] = useState<Record<string, { include: boolean; returnQty: string }>>({});
  type DirectLine = {
    key: string;
    itemId: string;
    itemCode: string;
    itemName: string;
    uomId?: string;
    uom: string;
    returnQty: string;
    unitPriceDoc: string;
    description: string;
  };
  const newDirectLine = (): DirectLine => ({
    key: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    itemId: '',
    itemCode: '',
    itemName: '',
    uomId: undefined,
    uom: '',
    returnQty: '1',
    unitPriceDoc: '0',
    description: '',
  });
  const [directLines, setDirectLines] = useState<DirectLine[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoiceDTO[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glImpactOpen, setGlImpactOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideModalData, setOverrideModalData] = useState<{ documentDate: string; lockedThroughDate: string } | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);

  const salesInvoiceLabelById = useMemo(
    () =>
      salesInvoices.reduce<Record<string, string>>((acc, invoice) => {
        acc[invoice.id] = `${invoice.invoiceNumber} - ${invoice.customerName}`;
        return acc;
      }, {}),
    [salesInvoices]
  );

  const deliveryNoteLabelById = useMemo(
    () =>
      deliveryNotes.reduce<Record<string, string>>((acc, note) => {
        acc[note.id] = `${note.dnNumber} - ${note.customerName}`;
        return acc;
      }, {}),
    [deliveryNotes]
  );

  const warehouseLabelById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

  const loadReferenceData = async () => {
    const [invoiceResult, deliveryNoteResult, warehouseResult] = await Promise.all([
      salesApi.listSIs({ status: 'POSTED', limit: 500 }),
      salesApi.listDNs({ status: 'POSTED', limit: 500 }),
      inventoryApi.listWarehouses({ active: true, limit: 200 }),
    ]);

    const invoiceList = unwrap<SalesInvoiceDTO[]>(invoiceResult);
    const deliveryNoteList = unwrap<DeliveryNoteDTO[]>(deliveryNoteResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);

    setSalesInvoices(Array.isArray(invoiceList) ? invoiceList : []);
    setDeliveryNotes(Array.isArray(deliveryNoteList) ? deliveryNoteList : []);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      await loadReferenceData();

      if (!isCreateMode && params.id) {
        const result = await salesApi.getReturn(params.id);
        const loaded = unwrap<SalesReturnDTO>(result);
        setSalesReturn(loaded);
      } else {
        setSalesReturn(null);
      }
    } catch (err: any) {
      console.error('Failed to load sales return detail', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Failed to load sales return.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyDefaultWarehouseFromInvoice = (invoiceId: string) => {
    const selectedInvoice = salesInvoices.find((entry) => entry.id === invoiceId);
    const sourceWarehouseId = selectedInvoice?.lines.find((line) => !!line.warehouseId)?.warehouseId;
    if (sourceWarehouseId) {
      setWarehouseId((prev) => prev || sourceWarehouseId);
    }
  };

  const applyDefaultWarehouseFromDeliveryNote = (noteId: string) => {
    const selectedDeliveryNote = deliveryNotes.find((entry) => entry.id === noteId);
    if (selectedDeliveryNote?.warehouseId) {
      setWarehouseId((prev) => prev || selectedDeliveryNote.warehouseId);
    }
  };

  const handleContextChange = (nextContext: ReturnContext) => {
    setReturnContext(nextContext);
    setError(null);
    setLineSelections({});

    if (nextContext === 'AFTER_INVOICE') {
      setDeliveryNoteId('');
      setCustomerId('');
    } else if (nextContext === 'BEFORE_INVOICE') {
      setSalesInvoiceId('');
      setCustomerId('');
    } else {
      setSalesInvoiceId('');
      setDeliveryNoteId('');
    }
  };

  const seedLineSelectionsFromInvoice = (invoiceId: string) => {
    const invoice = salesInvoices.find((entry) => entry.id === invoiceId);
    if (!invoice) {
      setLineSelections({});
      return;
    }
    const seed: Record<string, { include: boolean; returnQty: string }> = {};
    invoice.lines.forEach((line) => {
      seed[line.lineId] = { include: true, returnQty: String(line.invoicedQty) };
    });
    setLineSelections(seed);
  };

  const seedLineSelectionsFromDeliveryNote = (noteId: string) => {
    const note = deliveryNotes.find((entry) => entry.id === noteId);
    if (!note) {
      setLineSelections({});
      return;
    }
    const seed: Record<string, { include: boolean; returnQty: string }> = {};
    note.lines.forEach((line) => {
      seed[line.lineId] = { include: true, returnQty: String(line.deliveredQty) };
    });
    setLineSelections(seed);
  };

  const handleSalesInvoiceChange = (value: string) => {
    setSalesInvoiceId(value);
    setDeliveryNoteId('');
    if (value) {
      applyDefaultWarehouseFromInvoice(value);
      seedLineSelectionsFromInvoice(value);
    } else {
      setLineSelections({});
    }
  };

  const handleDeliveryNoteChange = (value: string) => {
    setDeliveryNoteId(value);
    setSalesInvoiceId('');
    if (value) {
      applyDefaultWarehouseFromDeliveryNote(value);
      seedLineSelectionsFromDeliveryNote(value);
    } else {
      setLineSelections({});
    }
  };

  const selectedInvoiceLines = useMemo(() => {
    if (returnContext !== 'AFTER_INVOICE' || !salesInvoiceId) return [];
    return salesInvoices.find((entry) => entry.id === salesInvoiceId)?.lines || [];
  }, [returnContext, salesInvoiceId, salesInvoices]);

  const selectedDeliveryNoteLines = useMemo(() => {
    if (returnContext !== 'BEFORE_INVOICE' || !deliveryNoteId) return [];
    return deliveryNotes.find((entry) => entry.id === deliveryNoteId)?.lines || [];
  }, [returnContext, deliveryNoteId, deliveryNotes]);

  const toggleLineInclude = (lineId: string) => {
    setLineSelections((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], include: !prev[lineId]?.include, returnQty: prev[lineId]?.returnQty ?? '0' },
    }));
  };

  const setLineReturnQty = (lineId: string, qty: string) => {
    setLineSelections((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], include: prev[lineId]?.include ?? true, returnQty: qty },
    }));
  };

  const addDirectLine = () => setDirectLines((prev) => [...prev, newDirectLine()]);
  const removeDirectLine = (key: string) => setDirectLines((prev) => prev.filter((l) => l.key !== key));
  const updateDirectLine = (key: string, patch: Partial<DirectLine>) =>
    setDirectLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const onDirectLineItemPick = (key: string, item: InventoryItemDTO | null) => {
    if (!item) {
      updateDirectLine(key, { itemId: '', itemCode: '', itemName: '', uomId: undefined, uom: '' });
      return;
    }
    updateDirectLine(key, {
      itemId: item.id,
      itemCode: item.code || '',
      itemName: item.name || '',
      uomId: (item as any).baseUomId,
      uom: (item as any).baseUom || '',
      unitPriceDoc: ((item as any).standardPrice ?? (item as any).salePrice ?? 0).toString(),
    });
  };

  const createDraft = async () => {
    try {
      setBusy(true);
      setError(null);

      if (returnContext === 'AFTER_INVOICE' && !salesInvoiceId) {
        setError('A posted sales invoice is required for AFTER_INVOICE returns.');
        return;
      }
      if (returnContext === 'BEFORE_INVOICE' && !deliveryNoteId) {
        setError('A posted delivery note is required for BEFORE_INVOICE returns.');
        return;
      }
      if (returnContext === 'DIRECT' && !customerId) {
        setError('A customer is required for standalone returns.');
        return;
      }
      if (!returnDate) {
        setError('Return date is required.');
        return;
      }
      if (!reason.trim()) {
        setError('Reason is required.');
        return;
      }
      const parsedRestockingValue = Number(restockingFeeValue || '0');
      if (Number.isNaN(parsedRestockingValue) || parsedRestockingValue < 0) {
        setError('Restocking fee value must be a non-negative number.');
        return;
      }
      if (restockingFeeType === 'PERCENT' && parsedRestockingValue > 100) {
        setError('Restocking fee percent cannot exceed 100.');
        return;
      }
      if (returnContext === 'BEFORE_INVOICE' && parsedRestockingValue > 0) {
        setError('Restocking fee can only be used for returns that affect invoiced value.');
        return;
      }

      let payloadLines: CreateSalesReturnPayload['lines'];
      if (returnContext === 'AFTER_INVOICE') {
        payloadLines = selectedInvoiceLines
          .filter((line) => lineSelections[line.lineId]?.include)
          .map((line) => ({
            siLineId: line.lineId,
            returnQty: Number(lineSelections[line.lineId]?.returnQty || '0'),
            unitPriceDoc: line.unitPriceDoc,
          }));
        if (!payloadLines.length) {
          setError('Select at least one line to return.');
          return;
        }
        const bad = payloadLines.find((l) => !(l.returnQty && l.returnQty > 0));
        if (bad) {
          setError('Each selected line must have a return quantity greater than 0.');
          return;
        }
      } else if (returnContext === 'BEFORE_INVOICE') {
        payloadLines = selectedDeliveryNoteLines
          .filter((line) => lineSelections[line.lineId]?.include)
          .map((line) => ({
            dnLineId: line.lineId,
            returnQty: Number(lineSelections[line.lineId]?.returnQty || '0'),
          }));
        if (!payloadLines.length) {
          setError('Select at least one line to return.');
          return;
        }
        const bad = payloadLines.find((l) => !(l.returnQty && l.returnQty > 0));
        if (bad) {
          setError('Each selected line must have a return quantity greater than 0.');
          return;
        }
      } else if (returnContext === 'DIRECT') {
        if (!directLines.length) {
          setError('Add at least one item line to the return.');
          return;
        }
        const missingItem = directLines.find((l) => !l.itemId);
        if (missingItem) {
          setError('Every line must have an item selected.');
          return;
        }
        const badQty = directLines.find((l) => !(Number(l.returnQty) > 0));
        if (badQty) {
          setError('Every line must have a return quantity greater than 0.');
          return;
        }
        const badPrice = directLines.find((l) => Number(l.unitPriceDoc) < 0 || Number.isNaN(Number(l.unitPriceDoc)));
        if (badPrice) {
          setError('Unit price must be a non-negative number on every line.');
          return;
        }
        payloadLines = directLines.map((l) => ({
          itemId: l.itemId,
          returnQty: Number(l.returnQty),
          unitPriceDoc: Number(l.unitPriceDoc),
          uomId: l.uomId,
          uom: l.uom || undefined,
          description: l.description.trim() || undefined,
        }));
      }

      const payload: CreateSalesReturnPayload = {
        returnContext,
        customerId: returnContext === 'DIRECT' ? customerId : undefined,
        salesInvoiceId: returnContext === 'AFTER_INVOICE' ? salesInvoiceId || undefined : undefined,
        deliveryNoteId: returnContext === 'BEFORE_INVOICE' ? deliveryNoteId || undefined : undefined,
        returnDate,
        warehouseId: warehouseId || undefined,
        settlementMode,
        reasonCode,
        reason: reason.trim(),
        restockingFeeType: parsedRestockingValue > 0 ? restockingFeeType : undefined,
        restockingFeeValue: parsedRestockingValue > 0 ? parsedRestockingValue : undefined,
        notes: notes || undefined,
        lines: payloadLines,
        refundSettlementAccountId: (settlementMode === 'REFUND' && refundSettlementAccountId) ? refundSettlementAccountId : undefined,
      };

      const created = await salesApi.createReturn(payload);
      const dto = unwrap<SalesReturnDTO>(created);
      toast.success(`Draft return ${dto.returnNumber} created`);
      navigate(`/sales/returns/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create sales return', err);
      const message = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || 'Failed to create sales return draft.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const postDraft = async (periodLockOverrideReason?: string) => {
    if (!salesReturn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await salesApi.postReturn(salesReturn.id, periodLockOverrideReason);
      setSalesReturn(unwrap<SalesReturnDTO>(posted));
      toast.success('Sales return posted');
    } catch (err: any) {
      const errorCode = err?.response?.data?.error?.code;
      if (errorCode === 'PERIOD_LOCKED') {
        const errorData = err?.response?.data?.error;
        if (errorData?.tier === 'SOFT') {
          setOverrideModalData({
            documentDate: errorData.documentDate || salesReturn.returnDate,
            lockedThroughDate: errorData.lockedThroughDate || '',
          });
          setOverrideModalOpen(true);
          return;
        } else {
          setError('This accounting period is closed and cannot be overridden.');
          return;
        }
      }
      console.error('Failed to post sales return', err);
      const message = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || 'Failed to post sales return.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Return</h1>
        <Card className="p-6">Loading sales return...</Card>
      </div>
    );
  }

  if (isCreateMode) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Sales Return</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => navigate('/sales/returns')}
          >
            Back to List
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Return Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    returnContext === 'AFTER_INVOICE'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-300 text-slate-700'
                  }`}
                  onClick={() => handleContextChange('AFTER_INVOICE')}
                  disabled={busy}
                >
                  After Invoice
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    returnContext === 'BEFORE_INVOICE'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-300 text-slate-700'
                  }`}
                  onClick={() => handleContextChange('BEFORE_INVOICE')}
                  disabled={busy}
                >
                  Before Invoice
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    returnContext === 'DIRECT'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-300 text-slate-700'
                  }`}
                  onClick={() => handleContextChange('DIRECT')}
                  disabled={busy}
                >
                  Direct Return
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Context</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium">
                {returnContext}
              </div>
            </div>

            {returnContext === 'AFTER_INVOICE' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Posted Sales Invoice</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={salesInvoiceId}
                  onChange={(e) => handleSalesInvoiceChange(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select sales invoice</option>
                  {salesInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} - {invoice.customerName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {returnContext === 'BEFORE_INVOICE' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Posted Delivery Note</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={deliveryNoteId}
                  onChange={(e) => handleDeliveryNoteChange(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select delivery note</option>
                  {deliveryNotes.map((note) => (
                    <option key={note.id} value={note.id}>
                      {note.dnNumber} - {note.customerName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {returnContext === 'DIRECT' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Customer</label>
                <PartySelector
                  role="CUSTOMER"
                  value={customerId}
                  onChange={(party) => setCustomerId(party?.id || '')}
                  disabled={busy}
                  placeholder="Select customer..."
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Return Date</label>
              <DatePicker 
                value={returnDate}
                onChange={(val) => setReturnDate(val)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Warehouse (optional)</label>
              <WarehouseSelector
                value={warehouseId}
                onChange={(warehouse) => setWarehouseId(warehouse?.id || '')}
                disabled={busy}
                warehouses={warehouses}
                placeholder="Use source/default warehouse"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Settlement Mode</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={settlementMode}
                onChange={(e) => setSettlementMode(e.target.value as ReturnSettlementMode)}
                disabled={busy}
              >
                <option value="CREDIT_NOTE">Credit Note</option>
                <option value="REFUND">Refund</option>
              </select>
            </div>
            {settlementMode === 'REFUND' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Refund Account <span className="text-xs font-normal text-slate-400">(optional — overrides Sales Settings default)</span>
                </label>
                <AccountSelector
                  value={refundSettlementAccountId || undefined}
                  onChange={(account: any) => setRefundSettlementAccountId(account?.id || '')}
                  placeholder="Use default from Sales Settings"
                  allowedClassifications={['ASSET']}
                  contextLabel="Cash/Bank (Asset)"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Return Reason Code</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}
                disabled={busy}
              >
                <option value="DEFECTIVE">Defective</option>
                <option value="WRONG_ITEM">Wrong Item</option>
                <option value="CHANGED_MIND">Changed Mind</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Restocking Fee Type</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={restockingFeeType}
                onChange={(e) => setRestockingFeeType(e.target.value as RestockingFeeType)}
                disabled={busy}
              >
                <option value="AMOUNT">Amount</option>
                <option value="PERCENT">Percent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Restocking Fee Value ({restockingFeeType === 'PERCENT' ? '%' : 'Amount'})
              </label>
              <input
                type="number"
                min={0}
                step={restockingFeeType === 'PERCENT' ? '0.01' : '0.01'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={restockingFeeValue}
                onChange={(e) => setRestockingFeeValue(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="mt-4 text-xs text-slate-500">
            {returnContext === 'DIRECT'
              ? 'No source invoice or delivery note — build the return lines manually below.'
              : 'Check the lines to return below and adjust quantities as needed. By default every source line is included with full quantity.'}
          </div>
        </Card>

        {returnContext === 'AFTER_INVOICE' && salesInvoiceId && (
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Lines to Return</h2>
            {selectedInvoiceLines.length === 0 ? (
              <div className="text-sm text-slate-500">Selected invoice has no lines.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-left w-10">Return</th>
                      <th className="py-2 text-left">Item</th>
                      <th className="py-2 text-right">Invoiced Qty</th>
                      <th className="py-2 text-left">UOM</th>
                      <th className="py-2 text-right">Unit Price</th>
                      <th className="py-2 text-right w-32">Return Qty</th>
                      <th className="py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoiceLines.map((line) => {
                      const sel = lineSelections[line.lineId] || { include: false, returnQty: '0' };
                      const qty = Number(sel.returnQty || '0');
                      const lineTotal = sel.include ? qty * line.unitPriceDoc : 0;
                      return (
                        <tr key={line.lineId} className="border-b border-slate-100">
                          <td className="py-2">
                            <input
                              type="checkbox"
                              checked={!!sel.include}
                              onChange={() => toggleLineInclude(line.lineId)}
                              disabled={busy}
                            />
                          </td>
                          <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                          <td className="py-2 text-right">{line.invoicedQty}</td>
                          <td className="py-2">{line.uom}</td>
                          <td className="py-2 text-right">{line.unitPriceDoc.toFixed(2)}</td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={line.invoicedQty}
                              step="0.01"
                              className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm disabled:bg-slate-100"
                              value={sel.returnQty}
                              onChange={(e) => setLineReturnQty(line.lineId, e.target.value)}
                              disabled={busy || !sel.include}
                            />
                          </td>
                          <td className="py-2 text-right">{lineTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {returnContext === 'BEFORE_INVOICE' && deliveryNoteId && (
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Lines to Return</h2>
            {selectedDeliveryNoteLines.length === 0 ? (
              <div className="text-sm text-slate-500">Selected delivery note has no lines.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-left w-10">Return</th>
                      <th className="py-2 text-left">Item</th>
                      <th className="py-2 text-right">Delivered Qty</th>
                      <th className="py-2 text-left">UOM</th>
                      <th className="py-2 text-right w-32">Return Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDeliveryNoteLines.map((line) => {
                      const sel = lineSelections[line.lineId] || { include: false, returnQty: '0' };
                      return (
                        <tr key={line.lineId} className="border-b border-slate-100">
                          <td className="py-2">
                            <input
                              type="checkbox"
                              checked={!!sel.include}
                              onChange={() => toggleLineInclude(line.lineId)}
                              disabled={busy}
                            />
                          </td>
                          <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                          <td className="py-2 text-right">{line.deliveredQty}</td>
                          <td className="py-2">{line.uom}</td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={line.deliveredQty}
                              step="0.01"
                              className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm disabled:bg-slate-100"
                              value={sel.returnQty}
                              onChange={(e) => setLineReturnQty(line.lineId, e.target.value)}
                              disabled={busy || !sel.include}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {returnContext === 'DIRECT' && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Lines to Return</h2>
              <button
                type="button"
                onClick={addDirectLine}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add Line
              </button>
            </div>
            {directLines.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                No lines yet — click "Add Line" to start building the return.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-left">Item</th>
                      <th className="py-2 text-right w-28">Return Qty</th>
                      <th className="py-2 text-left w-20">UOM</th>
                      <th className="py-2 text-right w-32">Unit Price</th>
                      <th className="py-2 text-right w-32">Line Total</th>
                      <th className="py-2 text-left">Description</th>
                      <th className="py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {directLines.map((line) => {
                      const qty = Number(line.returnQty || '0');
                      const price = Number(line.unitPriceDoc || '0');
                      const lineTotal = qty * price;
                      return (
                        <tr key={line.key} className="border-b border-slate-100">
                          <td className="py-2 pr-2 min-w-[260px]">
                            <ItemSelector
                              value={line.itemId || undefined}
                              onChange={(item) => onDirectLineItemPick(line.key, item)}
                              disabled={busy}
                              placeholder="Select item..."
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                              value={line.returnQty}
                              onChange={(e) => updateDirectLine(line.key, { returnQty: e.target.value })}
                              disabled={busy}
                            />
                          </td>
                          <td className="py-2 pr-2 text-slate-600">{line.uom || '-'}</td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                              value={line.unitPriceDoc}
                              onChange={(e) => updateDirectLine(line.key, { unitPriceDoc: e.target.value })}
                              disabled={busy}
                            />
                          </td>
                          <td className="py-2 pr-2 text-right font-medium text-slate-700">{lineTotal.toFixed(2)}</td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                              value={line.description}
                              onChange={(e) => updateDirectLine(line.key, { description: e.target.value })}
                              placeholder="Optional"
                              disabled={busy}
                            />
                          </td>
                          <td className="py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeDirectLine(line.key)}
                              disabled={busy}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              title="Remove line"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500 italic">
              Direct returns create their own revenue reversal and (for tracked items) stock receipt + COGS reversal entries. Make sure the unit price matches what the customer paid for the item.
            </p>
          </Card>
        )}

        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={createDraft}
          disabled={busy}
        >
          {busy ? 'Creating...' : 'Create Draft Return'}
        </button>
      </div>
    );
  }

  if (!salesReturn) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Return</h1>
        <Card className="p-6 text-sm text-red-700">Sales return not found.</Card>
      </div>
    );
  }

  const sourceLabel =
    salesReturn.returnContext === 'AFTER_INVOICE'
      ? (salesReturn.salesInvoiceId && salesInvoiceLabelById[salesReturn.salesInvoiceId]) || salesReturn.salesInvoiceId || '-'
      : (salesReturn.deliveryNoteId && deliveryNoteLabelById[salesReturn.deliveryNoteId]) || salesReturn.deliveryNoteId || '-';

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{salesReturn.returnNumber}</h1>
          <p className="text-sm text-slate-600">
            Customer: <span className="font-medium">{salesReturn.customerName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {salesReturn.returnContext}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{salesReturn.status}</span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Return Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{salesReturn.returnDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Warehouse</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {warehouseLabelById[salesReturn.warehouseId] || salesReturn.warehouseId}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Reason</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{salesReturn.reason}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Reason Code</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {reasonCodeLabels[salesReturn.reasonCode] || salesReturn.reasonCode}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Settlement</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {settlementModeLabels[salesReturn.settlementMode] || salesReturn.settlementMode}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Restocking Fee</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {salesReturn.restockingFeeAmountDoc?.toFixed(2) || '0.00'} {salesReturn.currency}
              {salesReturn.restockingFeeType ? ` (${salesReturn.restockingFeeType} ${salesReturn.restockingFeeValue})` : ''}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Net Settlement</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {salesReturn.netSettlementAmountDoc?.toFixed(2) || '0.00'} {salesReturn.currency}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Source Document</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{sourceLabel}</div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Lines</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-right">Return Qty</th>
                <th className="py-2 text-left">UOM</th>
                <th className="py-2 text-right">Unit Cost</th>
                <th className="py-2 text-right">Line Cost</th>
              </tr>
            </thead>
            <tbody>
              {salesReturn.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                  <td className="py-2 text-right">{line.returnQty}</td>
                  <td className="py-2">{line.uom}</td>
                  <td className="py-2 text-right">{line.unitCostBase.toFixed(2)}</td>
                  <td className="py-2 text-right">{(line.returnQty * line.unitCostBase).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          onClick={() => navigate('/sales/returns')}
        >
          Back to List
        </button>
        {salesReturn.status === 'DRAFT' && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => setPostConfirmOpen(true)}
            disabled={busy}
          >
            {busy ? 'Posting...' : 'Post Return'}
          </button>
        )}
        {salesReturn.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-medium text-violet-700"
            onClick={() => setGlImpactOpen(true)}
          >
            GL Impact
          </button>
        )}
        <button
          type="button"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          onClick={() => setAuditModalOpen(true)}
        >
          History
        </button>
      </div>

      <GlImpactModal
        isOpen={glImpactOpen}
        onClose={() => setGlImpactOpen(false)}
        sourceId={salesReturn.id}
        sourceLabel={salesReturn.returnNumber}
        fallbackVoucherIds={[salesReturn.revenueVoucherId, salesReturn.cogsVoucherId].filter((v): v is string => !!v)}
        documentStatus={salesReturn.status}
      />

      {overrideModalData && (
        <PeriodLockOverrideModal
          isOpen={overrideModalOpen}
          onClose={() => setOverrideModalOpen(false)}
          documentDate={overrideModalData.documentDate}
          lockedThroughDate={overrideModalData.lockedThroughDate}
          onConfirm={(reason) => {
            setOverrideModalOpen(false);
            postDraft(reason);
          }}
        />
      )}

      <RecordAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        entityType="SALES_RETURN"
        entityId={salesReturn.id}
      />

      <ConfirmDialog
        isOpen={postConfirmOpen}
        title="Post sales return?"
        message={
          <>
            This will post return <strong>{salesReturn.returnNumber}</strong> and create the related
            GL, inventory, and {salesReturn.settlementMode === 'REFUND' ? 'refund' : 'credit note'} entries.
            This action cannot be undone.
          </>
        }
        tone="warning"
        confirmLabel="Post Return"
        isConfirming={busy}
        onCancel={() => setPostConfirmOpen(false)}
        onConfirm={() => {
          setPostConfirmOpen(false);
          postDraft();
        }}
      />
    </div>
  );
};

export default SalesReturnDetailPage;
