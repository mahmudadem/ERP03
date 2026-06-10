import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { StatusChip } from '../../../components/ui/StatusChip';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ItemSelector, PartySelector, WarehouseSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import { FileText, Link2, Plus, Truck } from 'lucide-react';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { GlImpactModal } from '../components/GlImpactModal';
import { PeriodLockOverrideModal } from '../components/PeriodLockOverrideModal';
import { RecordAuditModal } from '../components/RecordAuditModal';
import {
  DocumentDetailScaffold,
  DocumentFooterTotalsStrip,
  DocumentPill,
  DocumentRailCard,
  DocumentRailStat,
} from '../../../components/shared/DocumentDetailScaffold';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);
const SalesReturnDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';
  const { t } = useTranslation();
  const reasonCodeLabel = (code: ReturnReasonCode) => t('sales.returnDetail.reasonCode.' + code.toLowerCase());
  const settlementModeLabel = (mode: ReturnSettlementMode) => t('sales.returnDetail.settlementMode.' + mode.toLowerCase());
  const contextLabel = (ctx: ReturnContext) => t('sales.returnDetail.context.' + ctx.toLowerCase());
  const statusLabel = (st: string) => t('sales.returnDetail.status.' + st.toLowerCase());
  const restockingFeeTypeLabel = (type: RestockingFeeType) => t('sales.returnDetail.restockingFeeType.' + type.toLowerCase());

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
  const [isEditing, setIsEditing] = useState(false);

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
      setIsEditing(false);

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
          || t('sales.returnDetail.loadFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const beginEdit = () => {
    if (!salesReturn) return;
    setReturnDate(salesReturn.returnDate || todayIso());
    setWarehouseId(salesReturn.warehouseId || '');
    setSettlementMode(salesReturn.settlementMode);
    setReasonCode(salesReturn.reasonCode);
    setReason(salesReturn.reason || '');
    setRestockingFeeType(salesReturn.restockingFeeType || 'AMOUNT');
    setRestockingFeeValue(String(salesReturn.restockingFeeValue ?? 0));
    setNotes(salesReturn.notes || '');
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const saveEdits = async () => {
    if (!salesReturn?.id) return;
    if (!returnDate) {
      setError(t('sales.returnDetail.returnDateRequired'));
      return;
    }
    if (!reason.trim()) {
      setError(t('sales.returnDetail.reasonRequired'));
      return;
    }
    const parsedRestockingValue = Number(restockingFeeValue || '0');
    if (Number.isNaN(parsedRestockingValue) || parsedRestockingValue < 0) {
      setError(t('sales.returnDetail.restockingFeeNonNegative'));
      return;
    }
    if (restockingFeeType === 'PERCENT' && parsedRestockingValue > 100) {
      setError(t('sales.returnDetail.restockingFeePercentMax'));
      return;
    }
    const allowRestockingFee = salesReturn.returnContext !== 'BEFORE_INVOICE';
    try {
      setBusy(true);
      setError(null);
      const updated = await salesApi.updateReturn(salesReturn.id, {
        returnDate,
        warehouseId: warehouseId || undefined,
        settlementMode,
        reasonCode,
        reason: reason.trim(),
        restockingFeeType: allowRestockingFee && parsedRestockingValue > 0 ? restockingFeeType : undefined,
        restockingFeeValue: allowRestockingFee && parsedRestockingValue > 0 ? parsedRestockingValue : undefined,
        notes: notes || undefined,
      });
      setSalesReturn(unwrap<SalesReturnDTO>(updated));
      setIsEditing(false);
      toast.success(t('sales.returnDetail.returnUpdated'));
    } catch (err: any) {
      console.error('Failed to update sales return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || t('sales.returnDetail.updateFailed')
      );
    } finally {
      setBusy(false);
    }
  };

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
        setError(t('sales.returnDetail.invoiceRequired'));
        return;
      }
      if (returnContext === 'BEFORE_INVOICE' && !deliveryNoteId) {
        setError(t('sales.returnDetail.deliveryNoteRequired'));
        return;
      }
      if (returnContext === 'DIRECT' && !customerId) {
        setError(t('sales.returnDetail.customerRequired'));
        return;
      }
      if (!returnDate) {
        setError(t('sales.returnDetail.returnDateRequired'));
        return;
      }
      if (!reason.trim()) {
        setError(t('sales.returnDetail.reasonRequired'));
        return;
      }
      const parsedRestockingValue = Number(restockingFeeValue || '0');
      if (Number.isNaN(parsedRestockingValue) || parsedRestockingValue < 0) {
        setError(t('sales.returnDetail.restockingFeeNonNegative'));
        return;
      }
      if (restockingFeeType === 'PERCENT' && parsedRestockingValue > 100) {
        setError(t('sales.returnDetail.restockingFeePercentMax'));
        return;
      }
      if (returnContext === 'BEFORE_INVOICE' && parsedRestockingValue > 0) {
        setError(t('sales.returnDetail.restockingFeeBeforeInvoice'));
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
          setError(t('sales.returnDetail.selectOneLine'));
          return;
        }
        const bad = payloadLines.find((l) => !(l.returnQty && l.returnQty > 0));
        if (bad) {
          setError(t('sales.returnDetail.returnQtyPositive'));
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
          setError(t('sales.returnDetail.selectOneLine'));
          return;
        }
        const bad = payloadLines.find((l) => !(l.returnQty && l.returnQty > 0));
        if (bad) {
          setError(t('sales.returnDetail.returnQtyPositive'));
          return;
        }
      } else if (returnContext === 'DIRECT') {
        if (!directLines.length) {
          setError(t('sales.returnDetail.addOneLine'));
          return;
        }
        const missingItem = directLines.find((l) => !l.itemId);
        if (missingItem) {
          setError(t('sales.returnDetail.everyLineMustHaveItem'));
          return;
        }
        const badQty = directLines.find((l) => !(Number(l.returnQty) > 0));
        if (badQty) {
          setError(t('sales.returnDetail.everyLineReturnQtyPositive'));
          return;
        }
        const badPrice = directLines.find((l) => Number(l.unitPriceDoc) < 0 || Number.isNaN(Number(l.unitPriceDoc)));
        if (badPrice) {
          setError(t('sales.returnDetail.unitPriceNonNegative'));
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
      toast.success(t('sales.returnDetail.draftReturnCreated', { number: dto.returnNumber }));
      navigate(`/sales/returns/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create sales return', err);
      const message = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || t('sales.returnDetail.createFailed');
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
      toast.success(t('sales.returnDetail.returnPosted'));
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
          setError(t('sales.returnDetail.periodClosed'));
          return;
        }
      }
      console.error('Failed to post sales return', err);
      const message = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || t('sales.returnDetail.postFailed');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('sales.returnDetail.title')}</h1>
        <Card className="p-6">{t('sales.returnDetail.loading')}</Card>
      </div>
    );
  }

  if (isCreateMode) {
    const draftFooterSummary = (
      <DocumentFooterTotalsStrip
        totals={[
          { label: t('sales.returnDetail.modeLabel'), value: contextLabel(returnContext) },
          { label: t('sales.returnDetail.settlement'), value: settlementModeLabel(settlementMode), tone: settlementMode === 'REFUND' ? 'amber' : 'blue' },
        ]}
      />
    );
    const draftSideRail = (
      <>
        <DocumentRailCard title={t('sales.returnDetail.returnDraft')}>
          <div className="grid grid-cols-2 gap-1.5 p-2 text-xs">
            <DocumentRailStat label={t('sales.returnDetail.context')} value={contextLabel(returnContext)} tone={returnContext === 'AFTER_INVOICE' ? 'blue' : returnContext === 'BEFORE_INVOICE' ? 'amber' : 'slate'} />
            <DocumentRailStat label={t('sales.returnDetail.settlement')} value={settlementModeLabel(settlementMode)} tone={settlementMode === 'REFUND' ? 'amber' : 'blue'} />
            <DocumentRailStat label={t('sales.returnDetail.returnDate')} value={returnDate || '-'} />
            <DocumentRailStat label={t('sales.returnDetail.reason')} value={reasonCodeLabel(reasonCode)} />
          </div>
        </DocumentRailCard>
      </>
    );
    const headerLabelClass = 'mb-1 block text-[10px] font-bold uppercase text-slate-500';
    const headerControlClass = 'h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

    const renderReturnControlCard = () => (
      <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
              {[
                { mode: 'AFTER_INVOICE' as const, label: t('sales.returnDetail.mode.afterInvoice'), icon: FileText },
                { mode: 'BEFORE_INVOICE' as const, label: t('sales.returnDetail.mode.beforeInvoice'), icon: Truck },
                { mode: 'DIRECT' as const, label: t('sales.returnDetail.mode.directReturn'), icon: Plus },
              ].map((option) => {
                const Icon = option.icon;
                const active = returnContext === option.mode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => handleContextChange(option.mode)}
                    disabled={busy}
                    className={`inline-flex h-7 items-center gap-1.5 rounded px-2 text-[10px] font-black uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      active
                        ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-blue-900'
                        : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled
              className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[10px] font-black uppercase text-slate-500 disabled:cursor-default dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
            >
              <Link2 className="h-3.5 w-3.5" />
              {returnContext === 'DIRECT'
                ? t('sales.returnDetail.directHeaderDriven')
                : t('sales.returnDetail.pickSourceInHeader')}
            </button>
          </div>
        </div>
      </section>
    );

    return (
      <DocumentDetailScaffold
        title={t('sales.returnDetail.createTitle')}
        subtitle={t('sales.returnDetail.createSubtitle')}
        icon={FileText}
        backLabel={t('sales.returnDetail.backToList')}
        onBack={() => navigate('/sales/returns')}
        badges={
          <DocumentPill tone={returnContext === 'AFTER_INVOICE' ? 'blue' : returnContext === 'BEFORE_INVOICE' ? 'amber' : 'slate'}>
            {contextLabel(returnContext)}
          </DocumentPill>
        }
        sideRail={draftSideRail}
        railTitle={t('sales.returnDetail.sideRailTitle')}
        footerSummary={draftFooterSummary}
        footerActions={
          <button
            type="button"
            className="rounded bg-slate-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700"
            onClick={createDraft}
            disabled={busy}
          >
            {busy ? t('sales.returnDetail.creating') : t('sales.returnDetail.createDraftReturn')}
          </button>
        }
      >

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {renderReturnControlCard()}

        <Card className="overflow-visible p-0">
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
            {returnContext === 'AFTER_INVOICE' && (
              <div>
                <label className={headerLabelClass}>{t('sales.returnDetail.postedSalesInvoice')}</label>
                <select
                  className={headerControlClass}
                  value={salesInvoiceId}
                  onChange={(e) => handleSalesInvoiceChange(e.target.value)}
                  disabled={busy}
                >
                  <option value="">{t('sales.returnDetail.selectSalesInvoice')}</option>
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
                <label className={headerLabelClass}>{t('sales.returnDetail.postedDeliveryNote')}</label>
                <select
                  className={headerControlClass}
                  value={deliveryNoteId}
                  onChange={(e) => handleDeliveryNoteChange(e.target.value)}
                  disabled={busy}
                >
                  <option value="">{t('sales.returnDetail.selectDeliveryNote')}</option>
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
                <label className={headerLabelClass}>{t('sales.returnDetail.customer')}</label>
                <PartySelector
                  role="CUSTOMER"
                  value={customerId}
                  onChange={(party) => setCustomerId(party?.id || '')}
                  disabled={busy}
                  placeholder={t('sales.returnDetail.selectCustomer')}
                />
              </div>
            )}

            <div>
              <label className={headerLabelClass}>{t('sales.returnDetail.returnDate')}</label>
              <DatePicker 
                value={returnDate}
                onChange={(val) => setReturnDate(val)}
              />
            </div>
            <div>
              <label className={headerLabelClass}>{t('sales.returnDetail.warehouseOptional')}</label>
              <WarehouseSelector
                value={warehouseId}
                onChange={(warehouse) => setWarehouseId(warehouse?.id || '')}
                disabled={busy}
                warehouses={warehouses}
                placeholder={t('sales.returnDetail.useSourceWarehouse')}
              />
            </div>
            <div>
              <label className={headerLabelClass}>{t('sales.returnDetail.settlementModeLabel')}</label>
              <select
                className={headerControlClass}
                value={settlementMode}
                onChange={(e) => setSettlementMode(e.target.value as ReturnSettlementMode)}
                disabled={busy}
              >
                <option value="CREDIT_NOTE">{settlementModeLabel('CREDIT_NOTE')}</option>
                <option value="REFUND">{settlementModeLabel('REFUND')}</option>
              </select>
            </div>
            {settlementMode === 'REFUND' && (
              <div>
                <label className={headerLabelClass}>
                  {t('sales.returnDetail.refundAccount')} <span className="text-xs font-normal text-slate-400">{t('sales.returnDetail.refundAccountHint')}</span>
                </label>
                <AccountSelector
                  value={refundSettlementAccountId || undefined}
                  onChange={(account: any) => setRefundSettlementAccountId(account?.id || '')}
                  placeholder={t('sales.returnDetail.defaultRefundAccount')}
                  allowedClassifications={['ASSET']}
                  contextLabel={t('sales.returnDetail.cashBankAsset')}
                />
              </div>
            )}
            <div>
              <label className={headerLabelClass}>{t('sales.returnDetail.returnReasonCode')}</label>
              <select
                className={headerControlClass}
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}
                disabled={busy}
              >
                <option value="DEFECTIVE">{reasonCodeLabel('DEFECTIVE')}</option>
                <option value="WRONG_ITEM">{reasonCodeLabel('WRONG_ITEM')}</option>
                <option value="CHANGED_MIND">{reasonCodeLabel('CHANGED_MIND')}</option>
                <option value="OTHER">{reasonCodeLabel('OTHER')}</option>
              </select>
            </div>
            <div>
              <label className={headerLabelClass}>{t('sales.returnDetail.restockingFeeTypeLabel')}</label>
              <select
                className={headerControlClass}
                value={restockingFeeType}
                onChange={(e) => setRestockingFeeType(e.target.value as RestockingFeeType)}
                disabled={busy}
              >
                <option value="AMOUNT">{t('sales.returnDetail.restockingFeeType.amount')}</option>
                <option value="PERCENT">{t('sales.returnDetail.restockingFeeType.percent')}</option>
              </select>
            </div>
            <div>
              <label className={headerLabelClass}>
                {t('sales.returnDetail.restockingFeeValue')} ({restockingFeeType === 'PERCENT' ? t('sales.returnDetail.restockingFeeType.percentUnit') : t('sales.returnDetail.restockingFeeType.amount')})
              </label>
              <input
                type="number"
                min={0}
                step={restockingFeeType === 'PERCENT' ? '0.01' : '0.01'}
                className={headerControlClass}
                value={restockingFeeValue}
                onChange={(e) => setRestockingFeeValue(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">{t('sales.returnDetail.reason')}</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">{t('sales.returnDetail.notes')}</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="mt-4 text-xs text-slate-500">
            {returnContext === 'DIRECT'
              ? t('sales.returnDetail.directReturnHint')
              : t('sales.returnDetail.sourceLinesHint')}
          </div>
        </Card>

        {returnContext === 'AFTER_INVOICE' && salesInvoiceId && (
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('sales.returnDetail.linesToReturn')}</h2>
            {selectedInvoiceLines.length === 0 ? (
              <div className="text-sm text-slate-500">{t('sales.returnDetail.noInvoiceLines')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-left w-10">{t('sales.returnDetail.returnColumn')}</th>
                      <th className="py-2 text-left">{t('sales.returnDetail.itemColumn')}</th>
                      <th className="py-2 text-right">{t('sales.returnDetail.invoicedQtyColumn')}</th>
                      <th className="py-2 text-left">{t('sales.returnDetail.uomColumn')}</th>
                      <th className="py-2 text-right">{t('sales.returnDetail.unitPriceColumn')}</th>
                      <th className="py-2 text-right w-32">{t('sales.returnDetail.returnQtyColumn')}</th>
                      <th className="py-2 text-right">{t('sales.returnDetail.lineTotalColumn')}</th>
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
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('sales.returnDetail.linesToReturn')}</h2>
            {selectedDeliveryNoteLines.length === 0 ? (
              <div className="text-sm text-slate-500">{t('sales.returnDetail.noDeliveryNoteLines')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-left w-10">{t('sales.returnDetail.returnColumn')}</th>
                      <th className="py-2 text-left">{t('sales.returnDetail.itemColumn')}</th>
                      <th className="py-2 text-right">{t('sales.returnDetail.deliveredQtyColumn')}</th>
                      <th className="py-2 text-left">{t('sales.returnDetail.uomColumn')}</th>
                      <th className="py-2 text-right w-32">{t('sales.returnDetail.returnQtyColumn')}</th>
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('sales.returnDetail.linesToReturn')}</h2>
              <button
                type="button"
                onClick={addDirectLine}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> {t('sales.returnDetail.addLine')}
              </button>
            </div>
            <ClassicLineItemsTable<DirectLine>
              tableId="sales.return.direct.lines"
              title={t('sales.returnDetail.linesToReturn')}
              rows={directLines}
              disabled={busy}
              onRowChange={(index, patch) => updateDirectLine(directLines[index].key, patch)}
              onRowRemove={(index) => removeDirectLine(directLines[index].key)}
              onRowsChange={setDirectLines}
              createEmptyRow={newDirectLine}
              isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName || line.description)}
              onRowAdd={addDirectLine}
              addLabel={t('sales.returnDetail.addLine')}
              minTableWidth="920px"
              columns={[
                  {
                    id: 'item',
                    label: t('sales.returnDetail.itemColumn'),
                    kind: 'custom',
                    width: '280px',
                    render: (line) => (
                      <ItemSelector
                        value={line.itemId || undefined}
                        onChange={(item) => onDirectLineItemPick(line.key, item)}
                        disabled={busy}
                        noBorder
                        placeholder={t('sales.returnDetail.selectItem')}
                      />
                    ),
                  } as ColumnDef<DirectLine>,
                  { id: 'returnQty', label: t('sales.returnDetail.returnQtyColumn'), kind: 'number', width: '120px', accessor: (line) => line.returnQty, setter: (value) => ({ returnQty: String(value) }) },
                  { id: 'uom', label: t('sales.returnDetail.uomColumn'), kind: 'computed', width: '90px', align: 'left', compute: (line) => line.uom || '-' },
                  { id: 'unitPrice', label: t('sales.returnDetail.unitPriceColumn'), kind: 'number', width: '120px', accessor: (line) => line.unitPriceDoc, setter: (value) => ({ unitPriceDoc: String(value) }) },
                  { id: 'lineTotal', label: t('sales.returnDetail.lineTotalColumn'), kind: 'computed', width: '130px', compute: (line) => Number(line.returnQty || '0') * Number(line.unitPriceDoc || '0') },
                  { id: 'description', label: t('sales.returnDetail.descriptionColumn'), kind: 'text', width: '190px', accessor: (line) => line.description, setter: (value) => ({ description: value }) },
              ]}
            />
            <p className="mt-3 text-xs text-slate-500 italic">
              {t('sales.returnDetail.directReturnInfo')}
            </p>
          </Card>
        )}

      </DocumentDetailScaffold>
    );
  }

  if (!salesReturn) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('sales.returnDetail.title')}</h1>
        <Card className="p-6 text-sm text-red-700">{t('sales.returnDetail.notFound')}</Card>
      </div>
    );
  }

  const sourceLabel =
    salesReturn.returnContext === 'AFTER_INVOICE'
      ? (salesReturn.salesInvoiceId && salesInvoiceLabelById[salesReturn.salesInvoiceId]) || salesReturn.salesInvoiceId || '-'
      : (salesReturn.deliveryNoteId && deliveryNoteLabelById[salesReturn.deliveryNoteId]) || salesReturn.deliveryNoteId || '-';
  const viewFooterSummary = (
    <DocumentFooterTotalsStrip
      totals={[
        { label: t('sales.returnDetail.subtotal'), value: `${salesReturn.currency} ${salesReturn.subtotalDoc.toFixed(2)}` },
        { label: t('sales.returnDetail.tax'), value: `${salesReturn.currency} ${salesReturn.taxTotalDoc.toFixed(2)}`, tone: 'blue' },
        { label: t('sales.returnDetail.settlement'), value: `${salesReturn.currency} ${(salesReturn.netSettlementAmountDoc || 0).toFixed(2)}`, tone: 'amber' },
        { label: t('sales.returnDetail.grand'), value: `${salesReturn.currency} ${salesReturn.grandTotalDoc.toFixed(2)}`, tone: 'green' },
      ]}
    />
  );
  const viewSideRail = (
    <>
      <DocumentRailCard title={t('sales.returnDetail.returnTotals')}>
        <div className="grid grid-cols-2 gap-1.5 p-2 text-xs">
          <DocumentRailStat label={`${t('sales.returnDetail.subtotal')} (${salesReturn.currency})`} value={`${salesReturn.currency} ${salesReturn.subtotalDoc.toFixed(2)}`} />
          <DocumentRailStat label={`${t('sales.returnDetail.tax')} (${salesReturn.currency})`} value={`${salesReturn.currency} ${salesReturn.taxTotalDoc.toFixed(2)}`} tone="blue" />
          <DocumentRailStat label={t('sales.returnDetail.netSettlement')} value={`${salesReturn.currency} ${(salesReturn.netSettlementAmountDoc || 0).toFixed(2)}`} tone="amber" />
          <DocumentRailStat label={t('sales.returnDetail.lines')} value={salesReturn.lines.length} />
          <div className="col-span-2 rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
            <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{t('sales.returnDetail.grandTotal')}</div>
            <div className="truncate font-mono text-sm font-black text-slate-900 dark:text-slate-100">
              {salesReturn.currency} {salesReturn.grandTotalDoc.toFixed(2)}
            </div>
          </div>
        </div>
      </DocumentRailCard>
      <DocumentRailCard title={t('sales.returnDetail.returnControl')}>
        <div className="space-y-1.5 p-2.5 text-xs">
          <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{t('sales.returnDetail.source')}</div>
            <div className="truncate font-black text-slate-900 dark:text-slate-100">{sourceLabel}</div>
          </div>
          <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
            <span className="font-bold text-slate-600 dark:text-slate-300">{t('sales.returnDetail.settlement')}</span>
            <DocumentPill tone={salesReturn.settlementMode === 'REFUND' ? 'amber' : 'blue'}>
              {settlementModeLabel(salesReturn.settlementMode)}
            </DocumentPill>
          </div>
        </div>
      </DocumentRailCard>
    </>
  );

  return (
    <>
    <DocumentDetailScaffold
      title={salesReturn.returnNumber}
      subtitle={t('sales.returnDetail.subtitleWithName', { customerName: salesReturn.customerName })}
      icon={FileText}
      backLabel={t('sales.returnDetail.backToList')}
      onBack={() => navigate('/sales/returns')}
      badges={
        <>
          <DocumentPill tone={salesReturn.returnContext === 'AFTER_INVOICE' ? 'blue' : salesReturn.returnContext === 'BEFORE_INVOICE' ? 'amber' : 'slate'}>
            {contextLabel(salesReturn.returnContext)}
          </DocumentPill>
          <DocumentPill tone={salesReturn.status === 'POSTED' ? 'green' : salesReturn.status === 'CANCELLED' ? 'rose' : 'slate'}>
            {statusLabel(salesReturn.status)}
          </DocumentPill>
        </>
      }
      sideRail={viewSideRail}
      railTitle={t('sales.returnDetail.sideRailTitle')}
      footerSummary={viewFooterSummary}
      footerActions={
        <>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => navigate('/sales/returns')}
          >
            {t('sales.returnDetail.backToListButton')}
          </button>
          {salesReturn.status === 'DRAFT' && isEditing && (
            <>
              <button
                type="button"
                className="rounded bg-primary-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                onClick={saveEdits}
                disabled={busy}
              >
                {busy ? t('sales.returnDetail.saving') : t('sales.returnDetail.saveChanges')}
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                onClick={cancelEdit}
                disabled={busy}
              >
                {t('sales.returnDetail.cancel')}
              </button>
            </>
          )}
          {salesReturn.status === 'DRAFT' && !isEditing && (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              onClick={beginEdit}
              disabled={busy}
            >
              {t('sales.returnDetail.edit')}
            </button>
          )}
          {salesReturn.status === 'DRAFT' && !isEditing && (
            <button
              type="button"
              className="rounded bg-primary-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              onClick={() => setPostConfirmOpen(true)}
              disabled={busy}
            >
              {busy ? t('sales.returnDetail.posting') : t('sales.returnDetail.postReturn')}
            </button>
          )}
          {salesReturn.status === 'POSTED' && (
            <button
              type="button"
              className="rounded border border-violet-300 bg-white px-4 py-2 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-50"
              onClick={() => setGlImpactOpen(true)}
            >
              {t('sales.returnDetail.glImpact')}
            </button>
          )}
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            onClick={() => setAuditModalOpen(true)}
          >
            {t('sales.returnDetail.history')}
          </button>
        </>
      }
    >

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {isEditing ? (
        <Card className="overflow-visible p-0">
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sales.returnDetail.returnDate')}</label>
              <DatePicker value={returnDate} onChange={(val) => setReturnDate(val)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sales.returnDetail.warehouse')}</label>
              <WarehouseSelector
                value={warehouseId}
                onChange={(warehouse) => setWarehouseId(warehouse?.id || '')}
                disabled={busy}
                warehouses={warehouses}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sales.returnDetail.settlement')}</label>
              <select
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                value={settlementMode}
                onChange={(e) => setSettlementMode(e.target.value as ReturnSettlementMode)}
              >
                {(['CREDIT_NOTE', 'REFUND'] as ReturnSettlementMode[]).map((value) => (
                  <option key={value} value={value}>{settlementModeLabel(value)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sales.returnDetail.reasonCodeLabel')}</label>
              <select
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}
              >
                {(['DEFECTIVE', 'WRONG_ITEM', 'CHANGED_MIND', 'OTHER'] as ReturnReasonCode[]).map((value) => (
                  <option key={value} value={value}>{reasonCodeLabel(value)}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sales.returnDetail.reason')}</label>
              <input
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {salesReturn.returnContext !== 'BEFORE_INVOICE' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sales.returnDetail.restockingFee')}</label>
                <div className="flex gap-2">
                  <select
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    value={restockingFeeType}
                    onChange={(e) => setRestockingFeeType(e.target.value as RestockingFeeType)}
                  >
                    <option value="AMOUNT">{t('sales.returnDetail.restockingFeeType.amount')}</option>
                    <option value="PERCENT">{t('sales.returnDetail.restockingFeeType.percent')}</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-right bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    value={restockingFeeValue}
                    onChange={(e) => setRestockingFeeValue(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sales.returnDetail.notes')}</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {t('sales.returnDetail.editHint')}
          </p>
        </Card>
      ) : (
        <Card className="overflow-visible p-0">
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.returnDetail.returnDate')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{salesReturn.returnDate}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.returnDetail.warehouse')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {warehouseLabelById[salesReturn.warehouseId] || salesReturn.warehouseId}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.returnDetail.reason')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{salesReturn.reason}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.returnDetail.reasonCodeLabel')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {reasonCodeLabel(salesReturn.reasonCode)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.returnDetail.settlement')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {settlementModeLabel(salesReturn.settlementMode)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.returnDetail.restockingFee')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {salesReturn.restockingFeeAmountDoc?.toFixed(2) || t('sales.returnDetail.zeroAmount')} {salesReturn.currency}
                {salesReturn.restockingFeeType ? ` (${restockingFeeTypeLabel(salesReturn.restockingFeeType)} ${salesReturn.restockingFeeValue})` : ''}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.returnDetail.netSettlement')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {salesReturn.netSettlementAmountDoc?.toFixed(2) || t('sales.returnDetail.zeroAmount')} {salesReturn.currency}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.returnDetail.sourceDocument')}</div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{sourceLabel}</div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('sales.returnDetail.lines')}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">{t('sales.returnDetail.itemColumn')}</th>
                <th className="py-2 text-right">{t('sales.returnDetail.returnQtyColumn')}</th>
                <th className="py-2 text-left">{t('sales.returnDetail.uomColumn')}</th>
                <th className="py-2 text-right">{t('sales.returnDetail.unitCostColumn')}</th>
                <th className="py-2 text-right">{t('sales.returnDetail.lineCostColumn')}</th>
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

    </DocumentDetailScaffold>

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
        title={t('sales.returnDetail.confirm.title')}
        message={
          <>
            {t('sales.returnDetail.confirm.messagePrefix')} <strong>{salesReturn.returnNumber}</strong> {t('sales.returnDetail.confirm.messageSuffix', { settlementType: salesReturn.settlementMode === 'REFUND' ? t('sales.returnDetail.settlementMode.refund') : t('sales.returnDetail.settlementMode.creditNote') })} {t('sales.returnDetail.confirm.messageCannotUndo')}
          </>
        }
        tone="warning"
        confirmLabel={t('sales.returnDetail.confirm.confirmLabel')}
        isConfirming={busy}
        onCancel={() => setPostConfirmOpen(false)}
        onConfirm={() => {
          setPostConfirmOpen(false);
          postDraft();
        }}
      />
    </>
  );
};

export default SalesReturnDetailPage;
