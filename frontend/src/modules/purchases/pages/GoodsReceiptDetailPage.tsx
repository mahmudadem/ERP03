import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  GoodsReceiptDTO,
  GoodsReceiptLineInputDTO,
  PurchaseInvoiceDTO,
  PurchaseOrderDTO,
  PurchaseSettingsDTO,
  purchasesApi,
} from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { ItemSelector, PartySelector, WarehouseSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { Truck } from 'lucide-react';
import {
  DocumentDetailScaffold,
  DocumentFooterTotalsStrip,
  DocumentHeaderField,
  DocumentHeaderGrid,
  DocumentPill,
  DocumentRailCard,
  DocumentRailStat,
  documentHeaderControlClass,
  documentHeaderSelectorClass,
} from '../../../components/shared/DocumentDetailScaffold';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface EditableLine {
  lineId?: string;
  poLineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  receivedQty: number;
  uomId?: string;
  uom: string;
  warehouseId?: string;
  description?: string;
}

interface EditableForm {
  purchaseOrderId: string;
  vendorId: string;
  receiptDate: string;
  warehouseId: string;
  notes: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  receivedQty: 1,
  uomId: undefined,
  uom: '',
  warehouseId: undefined,
  description: '',
});

const createEmptyForm = (purchaseOrderId = '', vendorId = '', warehouseId = ''): EditableForm => ({
  purchaseOrderId,
  vendorId,
  receiptDate: todayIso(),
  warehouseId,
  notes: '',
  lines: [createEmptyLine()],
});

const GoodsReceiptDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const initialPurchaseOrderId = searchParams.get('purchaseOrderId') || '';
  const initialVendorId = searchParams.get('vendorId') || '';

  const [grn, setGrn] = useState<GoodsReceiptDTO | null>(null);
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [form, setForm] = useState<EditableForm>(() => createEmptyForm(initialPurchaseOrderId, initialVendorId));
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingPOLines, setLoadingPOLines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLinkedInvoiceLine, setHasLinkedInvoiceLine] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [unpostConfirmOpen, setUnpostConfirmOpen] = useState(false);
  const [linkedPO, setLinkedPO] = useState<PurchaseOrderDTO | null>(null);

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

  const roundQty = (value: number): number => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

  const getLineItemLabel = (line: { itemId: string; itemCode?: string; itemName?: string }): string => {
    const code = line.itemCode || itemById[line.itemId]?.code;
    const name = line.itemName || itemById[line.itemId]?.name;
    if (code && name) return `${code} - ${name}`;
    return name || code || line.itemId;
  };

  const mapOpenPOLinesToEditable = (
    po: PurchaseOrderDTO,
    fallbackWarehouseId?: string
  ): EditableLine[] =>
    po.lines
      .filter((line) => line.trackInventory && line.orderedQty - line.receivedQty > 0)
      .map((line) => ({
        poLineId: line.lineId,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        receivedQty: roundQty(Math.max(line.orderedQty - line.receivedQty, 0)),
        uomId: line.uomId,
        uom: line.uom || itemById[line.itemId]?.purchaseUom || itemById[line.itemId]?.baseUom || 'EA',
        warehouseId: line.warehouseId || fallbackWarehouseId,
        description: line.description,
      }));

  const loadOpenLinesFromPO = async (poId?: string, silent = false, fallbackWarehouseId?: string) => {
    const targetPOId = (poId || form.purchaseOrderId || '').trim();
    if (!targetPOId) {
      if (!silent) setError('Please enter a PO reference first.');
      return;
    }

    try {
      setLoadingPOLines(true);
      setError(null);

      const result = await purchasesApi.getPO(targetPOId);
      const po = unwrap<PurchaseOrderDTO>(result);
      const mappedLines = mapOpenPOLinesToEditable(
        po,
        fallbackWarehouseId || form.warehouseId || settings?.defaultWarehouseId
      );

      setForm((prev) => ({
        ...prev,
        purchaseOrderId: targetPOId,
        vendorId: po.vendorId || prev.vendorId,
        lines: mappedLines.length > 0 ? mappedLines : [createEmptyLine()],
      }));

      if (!mappedLines.length && !silent) {
        setError('No open stock lines found on this PO.');
      }
    } catch (err: any) {
      console.error('Failed to load PO lines', err);
      if (!silent) {
        setError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            'Failed to load lines from PO.'
        );
      }
    } finally {
      setLoadingPOLines(false);
    }
  };

  const loadReferenceData = async () => {
    const [settingsResult, warehouseResult, itemResult] = await Promise.all([
      purchasesApi.getSettings(),
      inventoryApi.listWarehouses({ active: true, limit: 200 }),
      inventoryApi.listItems({ limit: 1000 }),
    ]);

    const currentSettings = unwrap<PurchaseSettingsDTO | null>(settingsResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);

    setSettings(currentSettings);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
    setItems(Array.isArray(itemList) ? itemList : []);

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

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentSettings = await loadReferenceData();
      const defaultWarehouseId = currentSettings?.defaultWarehouseId || '';

      if (!isCreateMode && params.id) {
        const result = await purchasesApi.getGRN(params.id);
        const loaded = unwrap<GoodsReceiptDTO>(result);
        setGrn(loaded);

        if (loaded.purchaseOrderId) {
          try {
            const poResult = await purchasesApi.getPO(loaded.purchaseOrderId);
            setLinkedPO(unwrap<PurchaseOrderDTO>(poResult));
          } catch {
            setLinkedPO(null);
          }

          const invoicesResult = await purchasesApi.listPIs({
            purchaseOrderId: loaded.purchaseOrderId,
            limit: 200,
          });
          const invoices = unwrap<PurchaseInvoiceDTO[]>(invoicesResult);
          const grnLineIdSet = new Set(loaded.lines.map((line) => line.lineId));
          const linked = (Array.isArray(invoices) ? invoices : []).some((invoice) =>
            invoice.lines.some((line) => line.grnLineId && grnLineIdSet.has(line.grnLineId))
          );
          setHasLinkedInvoiceLine(linked);
        } else {
          setLinkedPO(null);
          setHasLinkedInvoiceLine(false);
        }
      } else {
        setGrn(null);
        setLinkedPO(null);
        setHasLinkedInvoiceLine(false);
        setForm(createEmptyForm(initialPurchaseOrderId, initialVendorId, defaultWarehouseId));
        if (initialPurchaseOrderId) {
          await loadOpenLinesFromPO(initialPurchaseOrderId, true);
        }
      }
    } catch (err: any) {
      console.error('Failed to load goods receipt detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load goods receipt.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((isCreateMode || isEditMode) && form.lines.length === 0) {
      setForm((prev) => ({ ...prev, lines: [createEmptyLine()] }));
    }
  }, [form.lines.length, isCreateMode, isEditMode]);

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
          const defaultUom = getDefaultItemUomOption(item, 'purchase');
          next.itemCode = item.code;
          next.itemName = item.name;
          next.uomId = next.uomId || defaultUom?.uomId;
          next.uom = next.uom || defaultUom?.code || item.purchaseUom || item.baseUom;
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
    if (!form.receiptDate) return 'Receipt date is required.';
    if (!form.warehouseId) return 'Warehouse is required.';
    if (!form.purchaseOrderId && !form.vendorId) return 'Vendor is required when PO is not provided.';

    const activeLines = form.lines.filter((line) => line.itemId || line.poLineId);

    if (!form.purchaseOrderId) {
      if (!activeLines.length) return 'At least one line is required for direct goods receipts.';
      for (let i = 0; i < form.lines.length; i += 1) {
        const line = form.lines[i];
        if (!line.itemId) return `Line ${i + 1}: item is required.`;
        if (Number.isNaN(line.receivedQty) || line.receivedQty <= 0) {
          return `Line ${i + 1}: received quantity must be greater than 0.`;
        }
      }
    } else if (activeLines.length > 0) {
      for (let i = 0; i < form.lines.length; i += 1) {
        const line = form.lines[i];
        if (!line.itemId && !line.poLineId) continue;
        if (!line.itemId) return `Line ${i + 1}: item is required.`;
        if (Number.isNaN(line.receivedQty) || line.receivedQty <= 0) {
          return `Line ${i + 1}: received quantity must be greater than 0.`;
        }
      }
    }

    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): GoodsReceiptLineInputDTO => {
    const item = itemById[line.itemId];
    const payload = {
      lineId: line.lineId,
      lineNo: index + 1,
      poLineId: line.poLineId || undefined,
      itemId: line.itemId || undefined,
      receivedQty: line.receivedQty,
      uomId: line.uomId,
      uom: line.uom || item?.purchaseUom || item?.baseUom || 'EA',
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    };
    return payload;
  };

  const saveDraft = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const mappedLines = form.lines
        .filter((line) => line.itemId && line.receivedQty > 0)
        .map((line, index) => buildLinePayload(line, index));

      if (isCreateMode) {
        const created = await purchasesApi.createGRN({
          purchaseOrderId: form.purchaseOrderId || undefined,
          vendorId: form.purchaseOrderId ? undefined : form.vendorId || undefined,
          receiptDate: form.receiptDate,
          warehouseId: form.warehouseId,
          lines: mappedLines.length ? mappedLines : undefined,
          notes: form.notes || undefined,
        });

        const dto = unwrap<GoodsReceiptDTO>(created);
        navigate(`/purchases/goods-receipts/${dto.id}`, { replace: true });
      } else if (grn?.id) {
        const updated = await purchasesApi.updateGRN(grn.id, {
          vendorId: form.purchaseOrderId ? undefined : form.vendorId || undefined,
          receiptDate: form.receiptDate,
          warehouseId: form.warehouseId,
          lines: mappedLines.length ? mappedLines : undefined,
          notes: form.notes || undefined,
        });
        setGrn(unwrap<GoodsReceiptDTO>(updated));
        setIsEditMode(false);
      }
    } catch (err: any) {
      console.error('Failed to save goods receipt', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save draft GRN.'
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleEdit = () => {
    if (!grn) return;
    const editableLines = grn.lines.map((l) => ({
      lineId: l.lineId,
      poLineId: l.poLineId,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      receivedQty: l.receivedQty,
      uomId: l.uomId,
      uom: l.uom,
      warehouseId: grn.warehouseId,
      description: l.description,
    }));

    setForm({
      purchaseOrderId: grn.purchaseOrderId || '',
      vendorId: grn.vendorId || '',
      receiptDate: grn.receiptDate,
      warehouseId: grn.warehouseId,
      notes: grn.notes || '',
      lines: editableLines.length > 0 ? editableLines : [createEmptyLine()],
    });
    setIsEditMode(true);

    if (grn.purchaseOrderId && editableLines.length === 0) {
      void loadOpenLinesFromPO(grn.purchaseOrderId, true, grn.warehouseId);
    }
  };

  const postDraft = async () => {
    if (!grn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await purchasesApi.postGRN(grn.id);
      setGrn(unwrap<GoodsReceiptDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post goods receipt', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to post goods receipt.'
      );
    } finally {
      setBusy(false);
    }
  };

  const unpostGRN = async () => {
    if (!grn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const unposted = await purchasesApi.unpostGRN(grn.id);
      setGrn(unwrap<GoodsReceiptDTO>(unposted));
      setUnpostConfirmOpen(false);
    } catch (err: any) {
      console.error('Failed to unpost goods receipt', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to unpost goods receipt.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Goods Receipt</h1>
        <Card className="p-6">Loading goods receipt...</Card>
      </div>
    );
  }

  if (isCreateMode || isEditMode) {
    const receivedQtyTotal = form.lines.reduce((sum, line) => sum + (Number(line.receivedQty) || 0), 0);
    const draftSideRail = (
      <>
        <DocumentRailCard title="Info" action={<DocumentPill tone={form.purchaseOrderId ? 'blue' : 'slate'}>{form.purchaseOrderId ? 'PO' : 'Direct'}</DocumentPill>}>
          <div className="grid gap-2 p-2.5">
            <DocumentRailStat label="Lines" value={form.lines.length} />
            <DocumentRailStat label="Received Qty" value={receivedQtyTotal.toFixed(2)} tone="green" />
            <DocumentRailStat label="Warehouse" value={form.warehouseId || '-'} />
          </div>
        </DocumentRailCard>
        <DocumentRailCard title="Document Status">
          <div className="space-y-1.5 p-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
              Draft receipt. Posting will update inventory receipt state through the existing purchase flow.
            </div>
            {form.purchaseOrderId && (
              <div className="rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
                Source PO lines can be loaded into this receipt.
              </div>
            )}
          </div>
        </DocumentRailCard>
        <DocumentRailCard title="Totals">
          <div className="grid gap-2 p-2.5">
            <DocumentRailStat label="Received Qty" value={receivedQtyTotal.toFixed(2)} tone="green" />
            <DocumentRailStat label="Receipt Date" value={form.receiptDate || '-'} />
          </div>
        </DocumentRailCard>
      </>
    );

    return (
      <DocumentDetailScaffold
        title={isCreateMode ? 'New Goods Receipt' : `Edit ${grn?.grnNumber}`}
        subtitle="Warehouse receiving document. Posting records received stock through the existing Purchases flow."
        icon={Truck}
        backLabel={isEditMode ? 'Cancel edit' : 'Back to goods receipts'}
        onBack={() => (isEditMode ? setIsEditMode(false) : navigate('/purchases/goods-receipts'))}
        badges={<DocumentPill tone="slate">Draft</DocumentPill>}
        sideRail={draftSideRail}
        railTitle="Goods receipt side rail"
        footerSummary={
          <DocumentFooterTotalsStrip
            totals={[
              { label: 'Lines', value: form.lines.length },
              { label: 'Received', value: receivedQtyTotal.toFixed(2), tone: 'green' },
            ]}
          />
        }
        footerActions={
          <button
            type="button"
            className="rounded bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            onClick={saveDraft}
            disabled={busy}
          >
            {busy ? 'Saving...' : (isCreateMode ? 'Create Draft GRN' : 'Update Draft')}
          </button>
        }
      >

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="overflow-visible p-0">
          <DocumentHeaderGrid>
            <DocumentHeaderField label="PO Reference">
              <input
                type="text"
                className={documentHeaderControlClass}
                value={form.purchaseOrderId}
                onChange={(e) => setForm((prev) => ({ ...prev, purchaseOrderId: e.target.value }))}
                placeholder="purchaseOrderId"
              />
            </DocumentHeaderField>
            <DocumentHeaderField label="Vendor (standalone only)">
              <PartySelector 
                className={documentHeaderSelectorClass}
                value={form.vendorId}
                disabled={!!form.purchaseOrderId}
                onChange={(party) => {
                  setForm((prev) => ({
                    ...prev,
                    vendorId: party?.id || '',
                  }));
                }}
              />
            </DocumentHeaderField>
            <DocumentHeaderField label="Receipt Date">
              <DatePicker 
                className="w-full"
                inputClassName={documentHeaderControlClass}
                value={form.receiptDate}
                onChange={(val) => setForm((prev) => ({ ...prev, receiptDate: val }))}
              />
            </DocumentHeaderField>
            <DocumentHeaderField label="Warehouse">
              <WarehouseSelector
                className={documentHeaderSelectorClass}
                value={form.warehouseId}
                onChange={(warehouse) => setForm((prev) => ({ ...prev, warehouseId: warehouse?.id || '' }))}
              />
            </DocumentHeaderField>
          </DocumentHeaderGrid>

          <div className="px-3 pb-3">
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-primary-500"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="px-3 pb-3 text-xs text-slate-500">
            If PO is provided, lines are pre-filled from open stock lines using server-side rules.
          </div>
        </Card>

        <ClassicLineItemsTable<EditableLine>
          tableId="purchases.goodsReceipt.lines"
          title="Line Items"
          headerAction={
            form.purchaseOrderId ? (
              <button
                type="button"
                className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-700 disabled:opacity-50"
                onClick={() => loadOpenLinesFromPO()}
                disabled={busy || loadingPOLines}
              >
                {loadingPOLines ? 'Loading...' : 'Load PO Lines'}
              </button>
            ) : undefined
          }
          rows={form.lines}
          disabled={busy}
          onRowChange={setLine}
          onRowRemove={!form.purchaseOrderId ? removeLine : undefined}
          onRowsChange={!form.purchaseOrderId ? (lines) => setForm((prev) => ({ ...prev, lines })) : undefined}
          createEmptyRow={createEmptyLine}
          isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName || line.description || line.warehouseId)}
          onRowAdd={!form.purchaseOrderId ? addLine : undefined}
          addLabel="Add Item"
          minTableWidth="860px"
          columns={[
            {
              id: 'item',
              label: 'Item',
              kind: 'custom',
              width: '280px',
              render: (line, index) => (
                <ItemSelector
                  value={line.itemId}
                  disabled={!!form.purchaseOrderId || busy}
                  noBorder
                  placeholder="Select item"
                  trackInventoryOnly
                  onChange={(item) => {
                    if (!item) {
                      setLine(index, { itemId: '', itemCode: undefined, itemName: undefined });
                      return;
                    }
                    const defaultUom = getDefaultItemUomOption(item, 'purchase');
                    setLine(index, {
                      itemId: item.id,
                      itemCode: item.code,
                      itemName: item.name,
                      uomId: defaultUom?.uomId,
                      uom: defaultUom?.code || item.purchaseUom || item.baseUom,
                    });
                  }}
                />
              ),
            } as ColumnDef<EditableLine>,
            { id: 'receivedQty', label: 'Received Qty', kind: 'number', width: '130px', accessor: (line) => line.receivedQty, setter: (value) => ({ receivedQty: Number(value) }) },
            {
              id: 'uom',
              label: 'UOM',
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
                  disabled={!line.itemId || busy}
                  onChange={(e) => {
                    const selected = (uomOptionsByItemId[line.itemId] || []).find(
                      (option) => (option.uomId || option.code) === e.target.value
                    );
                    setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' });
                  }}
                >
                  <option value="">{line.itemId ? 'Select' : 'No item'}</option>
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
              label: 'Warehouse',
              kind: 'custom',
              width: '220px',
              render: (line, index) => (
                <WarehouseSelector
                  value={line.warehouseId}
                  disabled={busy}
                  noBorder
                  placeholder="Select Warehouse"
                  onChange={(warehouse) => setLine(index, { warehouseId: warehouse?.id })}
                />
              ),
            },
          ]}
        />

      </DocumentDetailScaffold>
    );
  }

  if (!grn) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Goods Receipt</h1>
        <Card className="p-6 text-sm text-red-700">Goods receipt not found.</Card>
      </div>
    );
  }

  const canCreateReturn = grn.status === 'POSTED'
    && !!settings?.requirePOForStockItems
    && !hasLinkedInvoiceLine;
  const createReturnHref = `/purchases/returns/new?goodsReceiptId=${encodeURIComponent(grn.id)}${
    grn.purchaseOrderId ? `&purchaseOrderId=${encodeURIComponent(grn.purchaseOrderId)}` : ''
  }`;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{grn.grnNumber}</h1>
          <p className="text-sm text-slate-600">
            Vendor: <span className="font-medium">{grn.vendorName}</span>
            {grn.purchaseOrderId ? ` • PO: ${linkedPO?.orderNumber || grn.purchaseOrderId}` : ''}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
          {grn.status}
        </span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Receipt Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{grn.receiptDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Warehouse</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {warehouseLabelById[grn.warehouseId] || grn.warehouseId}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Created</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {new Date(grn.createdAt).toLocaleString()}
            </div>
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
                <th className="py-2 text-right">Received Qty</th>
                <th className="py-2 text-left">UOM</th>
                <th className="py-2 text-right">Unit Cost</th>
                <th className="py-2 text-left">Currency</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2">{getLineItemLabel(line)}</td>
                  <td className="py-2 text-right">{line.receivedQty}</td>
                  <td className="py-2">{line.uom}</td>
                  <td className="py-2 text-right">{line.unitCostDoc.toFixed(2)}</td>
                  <td className="py-2">{line.moveCurrency}</td>
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
          onClick={() => navigate('/purchases/goods-receipts')}
        >
          Back to List
        </button>
        {grn.status === 'DRAFT' && (
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={toggleEdit}
            disabled={busy}
          >
            Edit Draft
          </button>
        )}
        {grn.status === 'DRAFT' && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={postDraft}
            disabled={busy}
          >
            {busy ? 'Posting...' : 'Post GRN'}
          </button>
        )}
        {grn.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => navigate(createReturnHref)}
            disabled={!canCreateReturn}
          >
            Create Return
          </button>
        )}
        {grn.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            onClick={() => setUnpostConfirmOpen(true)}
            disabled={busy || hasLinkedInvoiceLine}
            title={hasLinkedInvoiceLine ? "Cannot unpost because this GRN is linked to a PI" : ""}
          >
            {busy ? 'Unposting...' : 'Unpost GRN'}
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={unpostConfirmOpen}
        title="Unpost Goods Receipt"
        message="This will reverse all inventory movements recorded for this goods receipt. The action is auditable but cannot be undone in place. Continue?"
        confirmLabel="Unpost GRN"
        cancelLabel="Cancel"
        tone="danger"
        isConfirming={busy}
        onConfirm={unpostGRN}
        onCancel={() => { if (!busy) setUnpostConfirmOpen(false); }}
      />
    </div>
  );
};

export default GoodsReceiptDetailPage;

