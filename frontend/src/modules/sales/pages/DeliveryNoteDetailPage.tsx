import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  DeliveryNoteDTO,
  DeliveryNoteLineInputDTO,
  SalesOrderDTO,
  salesApi,
  SalesSettingsDTO,
} from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { StatusChip } from '../../../components/ui/StatusChip';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { ItemSelector, PartySelector, WarehouseSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { GlImpactModal } from '../components/GlImpactModal';
import { PeriodLockOverrideModal } from '../components/PeriodLockOverrideModal';
import { RecordAuditModal } from '../components/RecordAuditModal';
import { Truck } from 'lucide-react';
import {
  DocumentDetailScaffold,
  DocumentFooterTotalsStrip,
  DocumentHeaderField,
  DocumentHeaderGrid,
  DocumentPill,
  DocumentRailKeyValueList,
  DocumentRailTotals,
  DocumentScaffoldRailSections,
  documentHeaderControlClass,
  documentHeaderSelectorClass,
} from '../../../components/shared/DocumentDetailScaffold';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface EditableLine {
  lineId?: string;
  soLineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  deliveredQty: number;
  maxDeliverableQty?: number;
  uomId?: string;
  uom: string;
  warehouseId?: string;
  description?: string;
}

interface EditableForm {
  salesOrderId: string;
  customerId: string;
  deliveryDate: string;
  promisedDate: string;
  warehouseId: string;
  notes: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  deliveredQty: 1,
  uomId: undefined,
  uom: '',
  warehouseId: undefined,
  description: '',
});

const createEmptyForm = (salesOrderId = '', customerId = '', warehouseId = ''): EditableForm => ({
  salesOrderId,
  customerId,
  deliveryDate: todayIso(),
  promisedDate: '',
  warehouseId,
  notes: '',
  lines: [createEmptyLine()],
});

const DeliveryNoteDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const initialSalesOrderId = searchParams.get('salesOrderId') || '';
  const initialCustomerId = searchParams.get('customerId') || '';

  const [deliveryNote, setDeliveryNote] = useState<DeliveryNoteDTO | null>(null);
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderDTO[]>([]);
  const [form, setForm] = useState<EditableForm>(() => createEmptyForm(initialSalesOrderId, initialCustomerId));
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orderLineLoading, setOrderLineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glImpactOpen, setGlImpactOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideModalData, setOverrideModalData] = useState<{ documentDate: string; lockedThroughDate: string } | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const warehouseLabelById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const salesOrderLabelById = useMemo(
    () =>
      salesOrders.reduce<Record<string, string>>((acc, order) => {
        acc[order.id] = `${order.orderNumber} - ${order.customerName}`;
        return acc;
      }, {}),
    [salesOrders]
  );

  const toEditableLinesFromSalesOrder = (so: SalesOrderDTO): EditableLine[] => {
    return so.lines
      .map((line) => {
        const remainingQty = Math.max(line.orderedQty - line.deliveredQty, 0);
        if (remainingQty <= 0) return null;

        return {
          soLineId: line.lineId,
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          deliveredQty: remainingQty,
          maxDeliverableQty: remainingQty,
          uomId: line.uomId,
          uom: line.uom,
          warehouseId: line.warehouseId,
          description: line.description,
        } as EditableLine;
      })
      .filter((line): line is EditableLine => line !== null);
  };

  const toEditableFormFromDTO = (dto: DeliveryNoteDTO): EditableForm => ({
    salesOrderId: dto.salesOrderId || '',
    customerId: dto.customerId || '',
    deliveryDate: dto.deliveryDate || todayIso(),
    promisedDate: dto.promisedDate || '',
    warehouseId: dto.warehouseId || '',
    notes: dto.notes || '',
    lines: (dto.lines || []).map((line) => ({
      lineId: line.lineId,
      soLineId: line.soLineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      deliveredQty: line.deliveredQty,
      uomId: line.uomId,
      uom: line.uom,
      warehouseId: dto.warehouseId || undefined,
      description: line.description,
    })),
  });

  const loadReferenceData = async () => {
    const [settingsResult, warehouseResult, customerResult, itemResult, salesOrderResult] = await Promise.all([
      salesApi.getSettings(),
      inventoryApi.listWarehouses({ active: true, limit: 200 }),
      sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      inventoryApi.listItems({ active: true, limit: 500 }),
      salesApi.listSOs({ limit: 500 }),
    ]);

    const currentSettings = unwrap<SalesSettingsDTO | null>(settingsResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
    const customerList = unwrap<PartyDTO[]>(customerResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const salesOrderList = unwrap<SalesOrderDTO[]>(salesOrderResult);

    setSettings(currentSettings);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
    setCustomers(Array.isArray(customerList) ? customerList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setSalesOrders(Array.isArray(salesOrderList) ? salesOrderList : []);

    return currentSettings;
  };

  const ensureItemUomOptions = async (itemId: string) => {
    if (!itemId || uomOptionsByItemId[itemId] || !itemById[itemId]) return;
    try {
      const result = await inventoryApi.listUomConversions(itemId);
      const conversions = unwrap<UomConversionDTO[]>(result) || [];
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], conversions),
      }));
    } catch (loadError) {
      console.error('Failed to load UOM conversions', loadError);
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], []),
      }));
    }
  };

  const loadSalesOrderLines = async (orderId: string) => {
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId) return;

    try {
      setOrderLineLoading(true);
      setError(null);

      const orderResult = await salesApi.getSO(trimmedOrderId);
      const so = unwrap<SalesOrderDTO>(orderResult);
      const nextLines = toEditableLinesFromSalesOrder(so);

      setForm((prev) => ({
        ...prev,
        salesOrderId: trimmedOrderId,
        customerId: so.customerId,
        lines: nextLines.length ? nextLines : [createEmptyLine()],
      }));
    } catch (err: any) {
      console.error('Failed to load sales order lines', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.dnDetail.loadSOLinesFailed')
      );
    } finally {
      setOrderLineLoading(false);
    }
  };

  const handleSalesOrderChange = (orderId: string) => {
    setForm((prev) => ({
      ...prev,
      salesOrderId: orderId,
      customerId: orderId ? '' : prev.customerId,
      lines: orderId ? [] : [createEmptyLine()],
    }));

    if (orderId) {
      void loadSalesOrderLines(orderId);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsEditing(false);

      const currentSettings = await loadReferenceData();
      const defaultWarehouseId = currentSettings?.defaultWarehouseId || '';

      if (!isCreateMode && params.id) {
        const result = await salesApi.getDN(params.id);
        const loaded = unwrap<DeliveryNoteDTO>(result);
        setDeliveryNote(loaded);
      } else {
        setDeliveryNote(null);
        setForm(createEmptyForm(initialSalesOrderId, initialCustomerId, defaultWarehouseId));
        if (initialSalesOrderId) {
          await loadSalesOrderLines(initialSalesOrderId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load delivery note detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.dnDetail.loadFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ids = Array.from(new Set(form.lines.map((line) => line.itemId).filter(Boolean)));
    ids.forEach((itemId) => {
      void ensureItemUomOptions(itemId);
    });
  }, [form.lines, itemById]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (index: number, patch: Partial<EditableLine>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      const current = lines[index];
      const next: EditableLine = { ...current, ...patch };

      if (patch.itemId !== undefined) {
        const item = itemById[patch.itemId];
        if (item) {
          const defaultUom = getDefaultItemUomOption(item, 'sales');
          next.itemCode = item.code;
          next.itemName = item.name;
          next.uomId = next.uomId || defaultUom?.uomId;
          next.uom = next.uom || defaultUom?.code || item.salesUom || item.baseUom;
          if (!next.warehouseId && settings?.defaultWarehouseId) {
            next.warehouseId = settings.defaultWarehouseId;
          }
        } else {
          next.itemCode = undefined;
          next.itemName = undefined;
        }
      }

      lines[index] = next;
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, createEmptyLine()] }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((_, idx) => idx !== index),
      };
    });
  };

  const validateBeforeSave = (): string | null => {
    if (!form.deliveryDate) return t('sales.dnDetail.deliveryDateRequired');
    if (!form.warehouseId) return t('sales.dnDetail.warehouseRequired');
    if (!form.salesOrderId && !form.customerId) return t('sales.dnDetail.customerRequired');

    if (!form.salesOrderId) {
      if (!form.lines.length) return t('sales.dnDetail.minLinesRequired');
      for (let i = 0; i < form.lines.length; i += 1) {
        const line = form.lines[i];
        if (!line.itemId) return t('sales.dnDetail.lineItemRequired', { n: i + 1 });
        if (Number.isNaN(line.deliveredQty) || line.deliveredQty <= 0) {
          return t('sales.dnDetail.lineQtyPositive', { n: i + 1 });
        }
      }
    } else if (form.lines.length > 0) {
      for (let i = 0; i < form.lines.length; i += 1) {
        const line = form.lines[i];
        if (!line.itemId) return t('sales.dnDetail.lineItemRequired', { n: i + 1 });
        if (Number.isNaN(line.deliveredQty) || line.deliveredQty <= 0) {
          return t('sales.dnDetail.lineQtyPositive', { n: i + 1 });
        }
        if (line.maxDeliverableQty !== undefined && line.deliveredQty > line.maxDeliverableQty + 0.000001) {
          return t('sales.dnDetail.lineQtyExceedsSO', { n: i + 1 });
        }
      }
    }

    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): DeliveryNoteLineInputDTO => {
    const item = itemById[line.itemId];
    const payload = {
      lineId: line.lineId,
      lineNo: index + 1,
      soLineId: line.soLineId || undefined,
      itemId: line.itemId || undefined,
      deliveredQty: line.deliveredQty,
      uomId: line.uomId,
      uom: line.uom || item?.salesUom || item?.baseUom || 'EA',
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    };
    return payload;
  };

  const createDraft = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const mappedLines = form.lines
        .filter((line) => line.itemId && line.deliveredQty > 0)
        .map((line, index) => buildLinePayload(line, index));

      const created = await salesApi.createDN({
        salesOrderId: form.salesOrderId || undefined,
        customerId: form.salesOrderId ? undefined : form.customerId || undefined,
        deliveryDate: form.deliveryDate,
        promisedDate: form.promisedDate || undefined,
        warehouseId: form.warehouseId,
        lines: mappedLines.length ? mappedLines : undefined,
        notes: form.notes || undefined,
      });

      const dto = unwrap<DeliveryNoteDTO>(created);
      navigate(`/sales/delivery-notes/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create delivery note', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.dnDetail.createFailed')
      );
    } finally {
      setBusy(false);
    }
  };

  const postDraft = async (periodLockOverrideReason?: string) => {
    if (!deliveryNote?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await salesApi.postDN(deliveryNote.id, periodLockOverrideReason);
      setDeliveryNote(unwrap<DeliveryNoteDTO>(posted));
    } catch (err: any) {
      const errorCode = err?.response?.data?.error?.code;
      if (errorCode === 'PERIOD_LOCKED') {
        const errorData = err?.response?.data?.error;
        if (errorData?.tier === 'SOFT') {
          setOverrideModalData({
            documentDate: errorData.documentDate || deliveryNote.deliveryDate,
            lockedThroughDate: errorData.lockedThroughDate || '',
          });
          setOverrideModalOpen(true);
          return;
        } else {
          setError(t('sales.dnDetail.periodLockedHard'));
          return;
        }
      }
      console.error('Failed to post delivery note', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.dnDetail.postFailed')
      );
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = () => {
    if (!deliveryNote) return;
    setForm(toEditableFormFromDTO(deliveryNote));
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const saveEdits = async () => {
    if (!deliveryNote?.id) return;
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const mappedLines = form.lines
        .filter((line) => line.itemId && line.deliveredQty > 0)
        .map((line, index) => buildLinePayload(line, index));
      const updated = await salesApi.updateDN(deliveryNote.id, {
        customerId: form.salesOrderId ? undefined : form.customerId || undefined,
        deliveryDate: form.deliveryDate,
        promisedDate: form.promisedDate || undefined,
        warehouseId: form.warehouseId,
        lines: mappedLines.length ? mappedLines : undefined,
        notes: form.notes || undefined,
      });
      setDeliveryNote(unwrap<DeliveryNoteDTO>(updated));
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to update delivery note', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.dnDetail.updateFailed', 'Failed to update delivery note.')
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('sales.dnDetail.pageTitle')}</h1>
        <Card className="p-6">{t('sales.dnDetail.loading')}</Card>
      </div>
    );
  }

  if (isCreateMode || isEditing) {
    const draftFooterSummary = (
      <DocumentFooterTotalsStrip
        totals={[
          { label: t('sales.dnDetail.draftLabel'), value: t('sales.dnDetail.linesCount', { count: form.lines.length }) },
          { label: t('sales.dnDetail.source'), value: form.salesOrderId ? t('sales.dnDetail.fromSO') : t('sales.dnDetail.direct'), tone: form.salesOrderId ? 'blue' : 'slate' },
        ]}
      />
    );

    const draftRailSections: DocumentScaffoldRailSections = {
      info: {
        title: t('sales.dnDetail.deliveryDraftTitle'),
        content: (
          <DocumentRailKeyValueList
            items={[
              { label: t('sales.dnDetail.linesLabel'), value: form.lines.length },
              { label: t('sales.dnDetail.source'), value: form.salesOrderId ? t('sales.dnDetail.salesOrderLabel') : t('sales.dnDetail.direct') },
              { label: t('sales.dnDetail.deliveryDate'), value: form.deliveryDate || '-' },
              { label: t('sales.dnDetail.warehouse'), value: warehouseLabelById[form.warehouseId] || form.warehouseId || '-' },
            ]}
          />
        ),
      },
    };

    return (
      <DocumentDetailScaffold
        title={isEditing ? t('sales.dnDetail.editTitle', 'Edit Delivery Note') : t('sales.dnDetail.newTitle', 'New Delivery Note')}
        subtitle={t('sales.dnDetail.subtitle')}
        icon={Truck}
        backLabel={t('sales.dnDetail.backToList')}
        onBack={() => (isEditing ? cancelEdit() : navigate('/sales/delivery-notes'))}
        badges={isEditing && deliveryNote ? <DocumentPill tone="slate">{deliveryNote.status}</DocumentPill> : <DocumentPill tone="slate">{t('sales.dnDetail.draftBadge')}</DocumentPill>}
        railSections={draftRailSections}
        railTitle={t('sales.dnDetail.sideRailTitle')}
        footerSections={{
          totals: { content: draftFooterSummary },
          actions: {
            content: (
          <>
            <button
              type="button"
              className="rounded bg-primary-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              onClick={isEditing ? saveEdits : createDraft}
              disabled={busy || orderLineLoading}
            >
              {busy
                ? isEditing
                  ? t('sales.dnDetail.saving', 'Saving...')
                  : t('sales.dnDetail.creating', 'Creating...')
                : isEditing
                  ? t('sales.dnDetail.saveChanges', 'Save Changes')
                  : t('sales.dnDetail.createDraft', 'Create Draft Delivery Note')}
            </button>
            {isEditing && (
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                onClick={cancelEdit}
                disabled={busy}
              >
                {t('sales.dnDetail.cancel', 'Cancel')}
              </button>
            )}
          </>
            ),
          },
        }}
        sections={{
          banner: {
            content: error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null,
          },
          header: {
            content: (
        <Card className="overflow-visible p-0">
          <DocumentHeaderGrid>
            <DocumentHeaderField label={t('sales.dnDetail.salesOrderFieldLabel')}>
              <div className="flex gap-2">
                <select
                  className={documentHeaderControlClass}
                  value={form.salesOrderId}
                  disabled={isEditing}
                  onChange={(e) => handleSalesOrderChange(e.target.value)}
                >
                  <option value="">{t('sales.dnDetail.noSalesOrder')}</option>
                  {salesOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} - {order.customerName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="h-9 shrink-0 rounded border border-slate-300 bg-white px-2 text-[10px] font-black uppercase tracking-wide text-slate-700 disabled:opacity-50"
                  onClick={() => loadSalesOrderLines(form.salesOrderId)}
                  disabled={busy || orderLineLoading || !form.salesOrderId.trim() || isEditing}
                >
                  {orderLineLoading ? t('sales.dnDetail.loadingLines') : t('sales.dnDetail.loadSOLines')}
                </button>
              </div>
            </DocumentHeaderField>
            <DocumentHeaderField label={t('sales.dnDetail.customerStandalone')}>
              <PartySelector 
                className={documentHeaderSelectorClass}
                value={form.customerId}
                disabled={!!form.salesOrderId}
                onChange={(party) => {
                  setForm((prev) => ({
                    ...prev,
                    customerId: party?.id || '',
                  }));
                }}
              />
            </DocumentHeaderField>
            <DocumentHeaderField label={t('sales.dnDetail.deliveryDate')}>
              <DatePicker
                className="w-full"
                inputClassName={documentHeaderControlClass}
                value={form.deliveryDate}
                onChange={(val) => setForm((prev) => ({ ...prev, deliveryDate: val }))}
              />
            </DocumentHeaderField>
            <DocumentHeaderField label={t('sales.dnDetail.promisedDeliveryDate')}>
              <DatePicker
                className="w-full"
                inputClassName={documentHeaderControlClass}
                value={form.promisedDate}
                onChange={(val) => setForm((prev) => ({ ...prev, promisedDate: val }))}
              />
            </DocumentHeaderField>
            <DocumentHeaderField label={t('sales.dnDetail.warehouse')}>
              <select
                className={documentHeaderControlClass}
                value={form.warehouseId}
                onChange={(e) => setForm((prev) => ({ ...prev, warehouseId: e.target.value }))}
              >
                <option value="">{t('sales.dnDetail.selectWarehouse')}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </DocumentHeaderField>
          </DocumentHeaderGrid>

          <div className="px-3 pb-3">
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t('sales.dnDetail.notes')}</label>
            <textarea
              rows={3}
              className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-primary-500"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          {settings?.requireSOForStockItems && !form.salesOrderId && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              {t('sales.dnDetail.requiresSOWarning')}
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500">
            {t('sales.dnDetail.soHint')}
          </div>
        </Card>
            ),
          },
          lines: {
            content: (!form.salesOrderId || form.lines.length > 0) ? (
          <ClassicLineItemsTable<EditableLine>
            tableId="sales.deliveryNote.lines"
            title={t('sales.dnDetail.lineItemsTitle')}
            rows={form.lines}
            disabled={busy}
            onRowChange={setLine}
            onRowRemove={!form.salesOrderId ? removeLine : undefined}
            onRowsChange={!form.salesOrderId ? (lines) => setForm((prev) => ({ ...prev, lines })) : undefined}
            createEmptyRow={createEmptyLine}
            isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.warehouseId)}
            onRowAdd={!form.salesOrderId ? addLine : undefined}
            addLabel={t('sales.dnDetail.addItem')}
            minTableWidth="820px"
            columns={[
              {
                id: 'item',
                label: t('sales.dnDetail.itemColumn'),
                kind: 'custom',
                width: '280px',
                render: (line, index) => (
                  <ItemSelector
                    value={line.itemId}
                    disabled={!!form.salesOrderId || busy}
                    noBorder
                    placeholder={t('sales.dnDetail.selectItem')}
                    trackInventoryOnly
                    onChange={(item) => {
                      if (!item) {
                        setLine(index, { itemId: '', itemCode: undefined, itemName: undefined });
                        return;
                      }
                      const defaultUom = getDefaultItemUomOption(item, 'sales');
                      setLine(index, {
                        itemId: item.id,
                        itemCode: item.code,
                        itemName: item.name,
                        uomId: defaultUom?.uomId,
                        uom: defaultUom?.code || item.salesUom || item.baseUom,
                      });
                    }}
                  />
                ),
              } as ColumnDef<EditableLine>,
              {
                id: 'deliveredQty',
                label: t('sales.dnDetail.deliveredQtyColumn'),
                kind: 'number',
                width: '130px',
                accessor: (line) => line.deliveredQty,
                setter: (value) => ({ deliveredQty: Number(value) }),
              },
              {
                id: 'uom',
                label: t('sales.dnDetail.uomColumn'),
                kind: 'custom',
                width: '110px',
                render: (line, index) => (
                  <select
                    className="h-9 w-full border-0 bg-transparent px-2 text-xs uppercase outline-none disabled:opacity-60"
                    value={
                      findItemUomOption(uomOptionsByItemId[line.itemId] || [], line.uomId, line.uom)?.uomId ||
                      line.uomId ||
                      line.uom
                    }
                    disabled={!line.itemId || !!form.salesOrderId || busy}
                    onChange={(e) => {
                      const selected = (uomOptionsByItemId[line.itemId] || []).find(
                        (option) => (option.uomId || option.code) === e.target.value
                      );
                      setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' });
                    }}
                  >
                    <option value="">{line.itemId ? t('sales.dnDetail.selectUom') : t('sales.dnDetail.noItem')}</option>
                    {(uomOptionsByItemId[line.itemId] || []).map((option) => (
                      <option key={option.uomId || option.code} value={option.uomId || option.code}>
                        {option.code}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                id: 'warehouse',
                label: t('sales.dnDetail.warehouseColumn'),
                kind: 'custom',
                width: '220px',
                render: (line, index) => (
                  <WarehouseSelector
                    value={line.warehouseId}
                    disabled={busy}
                    noBorder
                    placeholder={t('sales.dnDetail.selectWarehouseColumn')}
                    onChange={(warehouse) => setLine(index, { warehouseId: warehouse?.id })}
                  />
                ),
              },
              {
                id: 'max',
                label: t('sales.dnDetail.openQtyColumn'),
                kind: 'computed',
                width: '110px',
                compute: (line) => line.maxDeliverableQty ?? '',
              },
            ]}
          />
            ) : null,
          },
        }}
      />
    );
  }

  if (!deliveryNote) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('sales.dnDetail.pageTitle')}</h1>
        <Card className="p-6 text-sm text-red-700">{t('sales.dnDetail.notFound')}</Card>
      </div>
    );
  }

  const canCreateReturn = deliveryNote.status === 'POSTED' && !!settings?.requireSOForStockItems;
  const createReturnHref = `/sales/returns/new?deliveryNoteId=${encodeURIComponent(deliveryNote.id)}${deliveryNote.salesOrderId ? `&salesOrderId=${encodeURIComponent(deliveryNote.salesOrderId)}` : ''}`;
  const deliveredQtyTotal = deliveryNote.lines.reduce((sum, line) => sum + (line.deliveredQty || 0), 0);
  const lineCostBaseTotal = deliveryNote.lines.reduce((sum, line) => sum + (line.lineCostBase || 0), 0);
  const viewFooterSummary = (
    <DocumentFooterTotalsStrip
      totals={[
        { label: t('sales.dnDetail.linesLabel'), value: deliveryNote.lines.length },
        { label: t('sales.dnDetail.qtyLabel'), value: deliveredQtyTotal.toFixed(2), tone: 'blue' },
        { label: t('sales.dnDetail.costBaseLabel'), value: lineCostBaseTotal.toFixed(2), tone: 'green' },
      ]}
    />
  );
  const viewRailSections: DocumentScaffoldRailSections = {
    info: {
      title: t('sales.dnDetail.sourceTitle'),
      content: (
        <DocumentRailKeyValueList
          items={[
            { label: t('sales.dnDetail.customerLabel'), value: deliveryNote.customerName },
            { label: t('sales.dnDetail.salesOrderLabel'), value: deliveryNote.salesOrderId ? salesOrderLabelById[deliveryNote.salesOrderId] || deliveryNote.salesOrderId : '-' },
          ]}
        />
      ),
    },
    totals: {
      title: t('sales.dnDetail.deliverySummaryTitle'),
      content: (
        <DocumentRailTotals
          rows={[
            { label: t('sales.dnDetail.linesLabel'), value: deliveryNote.lines.length },
            { label: t('sales.dnDetail.deliveredQtyLabel'), value: deliveredQtyTotal.toFixed(2) },
            { label: t('sales.dnDetail.warehouse'), value: warehouseLabelById[deliveryNote.warehouseId] || deliveryNote.warehouseId || '-' },
          ]}
          grand={{
            label: t('sales.dnDetail.costBaseLabel'),
            value: lineCostBaseTotal.toFixed(2),
          }}
        />
      ),
    },
  };

  return (
    <>
    <DocumentDetailScaffold
      title={deliveryNote.dnNumber}
      subtitle={t('sales.dnDetail.viewSubtitle', { customerName: deliveryNote.customerName, soRef: deliveryNote.salesOrderId ? salesOrderLabelById[deliveryNote.salesOrderId] || deliveryNote.salesOrderId : '' })}
      icon={Truck}
      backLabel={t('sales.dnDetail.backToList')}
      onBack={() => navigate('/sales/delivery-notes')}
      badges={
        <DocumentPill tone={deliveryNote.status === 'POSTED' ? 'green' : deliveryNote.status === 'CANCELLED' ? 'rose' : 'slate'}>
          {deliveryNote.status}
        </DocumentPill>
      }
      railSections={viewRailSections}
      railTitle={t('sales.dnDetail.sideRailTitle')}
      footerSections={{
        totals: { content: viewFooterSummary },
        actions: {
          content: (
        <>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => navigate('/sales/delivery-notes')}
          >
            {t('sales.dnDetail.backToListButton')}
          </button>
          {deliveryNote.status === 'DRAFT' && (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              onClick={beginEdit}
              disabled={busy}
            >
              {t('sales.dnDetail.edit', 'Edit')}
            </button>
          )}
          {deliveryNote.status === 'DRAFT' && (
            <button
              type="button"
              className="rounded bg-primary-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              onClick={() => postDraft()}
              disabled={busy}
            >
              {busy ? t('sales.dnDetail.posting', 'Posting...') : t('sales.dnDetail.post', 'Post Delivery Note')}
            </button>
          )}
          {canCreateReturn && (
            <button
              type="button"
              className="rounded border border-amber-300 bg-amber-50/50 px-4 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100/50"
              onClick={() => navigate(createReturnHref)}
            >
              {t('sales.dnDetail.createReturn')}
            </button>
          )}
          {deliveryNote.status === 'POSTED' && (
            <button
              type="button"
              className="rounded border border-violet-300 bg-white px-4 py-2 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-50"
              onClick={() => setGlImpactOpen(true)}
            >
              {t('sales.dnDetail.glImpact')}
            </button>
          )}
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            onClick={() => setAuditModalOpen(true)}
          >
            {t('sales.dnDetail.history')}
          </button>
        </>
          ),
        },
      }}
      sections={{
        banner: {
          content: error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null,
        },
        header: {
          content: (
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.dnDetail.deliveryDate')}</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{deliveryNote.deliveryDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.dnDetail.warehouse')}</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {warehouseLabelById[deliveryNote.warehouseId] || deliveryNote.warehouseId}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t('sales.dnDetail.created')}</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {new Date(deliveryNote.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      </Card>
          ),
        },
        lines: {
          content: (() => {
        const linkedSO = deliveryNote.salesOrderId
          ? salesOrders.find((so) => so.id === deliveryNote.salesOrderId)
          : null;
        const soLineMap: Map<string, { orderedQty: number }> = linkedSO
          ? new Map(linkedSO.lines.map((l) => [l.lineId, { orderedQty: l.orderedQty }] as [string, { orderedQty: number }]))
          : new Map<string, { orderedQty: number }>();
        const hasPartialLine = linkedSO
          ? deliveryNote.lines.some((dnLine) => {
              if (!dnLine.soLineId) return false;
              const soLine = soLineMap.get(dnLine.soLineId);
              return soLine ? dnLine.deliveredQty < soLine.orderedQty : false;
            })
          : false;
        return (
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('sales.dnDetail.linesHeading')}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left">{t('sales.dnDetail.itemColumn')}</th>
                    {linkedSO && <th className="py-2 text-right">{t('fulfillment.ordered')}</th>}
                    <th className="py-2 text-right">{t('sales.dnDetail.deliveredQtyColumn')}</th>
                    <th className="py-2 text-left">{t('sales.dnDetail.uomColumn')}</th>
                    <th className="py-2 text-right">{t('sales.dnDetail.unitCostBaseColumn')}</th>
                    <th className="py-2 text-right">{t('sales.dnDetail.lineCostBaseColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryNote.lines.map((line) => {
                    const soLine = line.soLineId ? soLineMap.get(line.soLineId) : undefined;
                    const orderedQty = soLine ? soLine.orderedQty : undefined;
                    const isPartial = orderedQty !== undefined && line.deliveredQty < orderedQty;
                    const isFulfilled = orderedQty !== undefined && line.deliveredQty >= orderedQty;
                    return (
                      <tr key={line.lineId} className="border-b border-slate-100">
                        <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                        {linkedSO && (
                          <td className="py-2 text-right">
                            {orderedQty ?? '—'}
                          </td>
                        )}
                        <td className="py-2 text-right">
                          {line.deliveredQty}
                          {linkedSO && (
                            isPartial ? (
                              <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                                {t('fulfillment.partial')}
                              </span>
                            ) : isFulfilled ? (
                              <span className="ml-2 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">
                                {t('fulfillment.fulfilled')}
                              </span>
                            ) : null
                          )}
                        </td>
                        <td className="py-2">{line.uom}</td>
                        <td className="py-2 text-right">{line.unitCostBase.toFixed(2)}</td>
                        <td className="py-2 text-right">{line.lineCostBase.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasPartialLine && (
              <div className="mt-4">
                <button
                  type="button"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                  onClick={() => navigate(`/sales/delivery-notes/create?fromOrder=${encodeURIComponent(deliveryNote.salesOrderId!)}&partial=true`)}
                >
                  {t('fulfillment.createBackorder')}
                </button>
              </div>
            )}
          </Card>
        );
      })(),
        },
      }}
    />

      <GlImpactModal
        isOpen={glImpactOpen}
        onClose={() => setGlImpactOpen(false)}
        sourceId={deliveryNote.id}
        sourceLabel={deliveryNote.dnNumber}
        documentStatus={deliveryNote.status}
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
        entityType="DELIVERY_NOTE"
        entityId={deliveryNote.id}
      />
    </>
  );
};

export default DeliveryNoteDetailPage;

