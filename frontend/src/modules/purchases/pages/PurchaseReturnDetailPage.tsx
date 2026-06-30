import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreatePurchaseReturnPayload, GoodsReceiptDTO, PurchaseInvoiceDTO, PurchaseReturnDTO, purchasesApi } from '../../../api/purchasesApi';
import { sharedApi } from '../../../api/sharedApi';
import { InventoryItemDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { ItemSelector, PartySelector, UomSelector, WarehouseSelector, DiscountTypeSelector, TaxCodeSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useCompanyCurrencies } from '../../accounting/hooks/useCompanyCurrencies';
import { buildItemUomOptions, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { FileText } from 'lucide-react';
import { GlImpactModal } from '../../sales/components/GlImpactModal';
import {
  DocumentDetailScaffold,
  DocumentFooterTotalsStrip,
  DocumentHeaderGrid,
  DocumentPill,
  DocumentRailKeyValueList,
  DocumentRailTotals,
  DocumentScaffoldRailSections,
} from '../../../components/shared/DocumentDetailScaffold';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);
type PurchaseReturnMode = 'DIRECT' | 'FROM_PI' | 'FROM_GRN';

const PurchaseReturnDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(['purchases', 'common']);
  const isCreateMode = !params.id || params.id === 'new';

  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturnDTO | null>(null);
  const initialMode: PurchaseReturnMode = searchParams.get('purchaseInvoiceId')
    ? 'FROM_PI'
    : searchParams.get('goodsReceiptId')
      ? 'FROM_GRN'
      : 'DIRECT';
  const [sourceMode, setSourceMode] = useState<PurchaseReturnMode>(initialMode);
  const [vendorId, setVendorId] = useState('');
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState(searchParams.get('purchaseInvoiceId') || '');
  const [goodsReceiptId, setGoodsReceiptId] = useState(searchParams.get('goodsReceiptId') || '');
  const [purchaseOrderId, setPurchaseOrderId] = useState(searchParams.get('purchaseOrderId') || '');
  const [returnDate, setReturnDate] = useState(todayIso());
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [unpostConfirmOpen, setUnpostConfirmOpen] = useState(false);
  const [glImpactOpen, setGlImpactOpen] = useState(false);
  const [editReturnDate, setEditReturnDate] = useState('');
  const [editWarehouseId, setEditWarehouseId] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLines, setEditLines] = useState<any[]>([]);
  const [sourceDocument, setSourceDocument] = useState<any>(null);
  const [selectedLines, setSelectedLines] = useState<any[]>([{
    itemId: '',
    itemName: '',
    itemCode: '',
    returnQty: 0,
    uomId: undefined,
    uom: '',
    unitCostDoc: 0,
    lineId: `new-${Date.now()}`
  }]);
  const [showPiPicker, setShowPiPicker] = useState(false);
  const [piPickerLoading, setPiPickerLoading] = useState(false);
  const [piPickerError, setPiPickerError] = useState<string | null>(null);
  const [piOptions, setPiOptions] = useState<PurchaseInvoiceDTO[]>([]);
  const [selectedPiId, setSelectedPiId] = useState('');
  const [showGrnPicker, setShowGrnPicker] = useState(false);
  const [grnPickerLoading, setGrnPickerLoading] = useState(false);
  const [grnPickerError, setGrnPickerError] = useState<string | null>(null);
  const [grnOptions, setGrnOptions] = useState<GoodsReceiptDTO[]>([]);
  const [selectedGrnId, setSelectedGrnId] = useState('');
  
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [taxCodes, setTaxCodes] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});

  const { settings: company } = useCompanySettings();
  const { data: currencies = [] } = useCompanyCurrencies();

  const contextLabel = useMemo(() => {
    if (sourceMode === 'FROM_PI') return 'AFTER_INVOICE';
    if (sourceMode === 'FROM_GRN') return 'BEFORE_INVOICE';
    if (sourceMode === 'DIRECT') return 'DIRECT';
    return '-';
  }, [sourceMode]);

  const purchaseTaxCodes = useMemo(
    () => taxCodes.filter((code) => code.scope === 'PURCHASE' || code.scope === 'BOTH'),
    [taxCodes]
  );

  const computeLineTotalDoc = (line: any): number => {
    const gross = (Number(line.returnQty) || 0) * (Number(line.unitCostDoc) || 0);
    const dv = Number(line.discountValue || 0);
    const discount = line.discountType === 'PERCENT'
      ? Math.max(0, Math.min(gross, gross * (dv / 100)))
      : line.discountType === 'AMOUNT'
        ? Math.max(0, Math.min(dv, gross))
        : 0;
    const postDiscount = gross - discount;
    const taxRate = Number(line.taxRate || 0);
    if (line.priceIsInclusive) return postDiscount;
    return postDiscount + (postDiscount * taxRate);
  };

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const loadReferenceData = async () => {
    try {
      const [settingsResult, vendorResult, itemResult, taxResult, warehouseResult] = await Promise.all([
        purchasesApi.getSettings(),
        sharedApi.listParties({ role: 'VENDOR', active: true }),
        inventoryApi.listItems({ active: true, limit: 500 }),
        sharedApi.listTaxCodes({ active: true }),
        inventoryApi.listWarehouses({ active: true }),
      ]);

      setSettings(unwrap(settingsResult));
      setVendors(unwrap<any[]>(vendorResult) || []);
      setItems(unwrap<any[]>(itemResult) || []);
      setTaxCodes(unwrap<any[]>(taxResult) || []);
      setWarehouses(unwrap<any[]>(warehouseResult) || []);
    } catch (err) {
      console.error('Failed to load reference data', err);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      await loadReferenceData();

      if (!isCreateMode && params.id) {
        const result = await purchasesApi.getReturn(params.id);
        const loaded = unwrap<PurchaseReturnDTO>(result);
        setPurchaseReturn(loaded);
      } else {
        setPurchaseReturn(null);
      }
    } catch (err: any) {
      console.error('Failed to load purchase return detail', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || t('returnDetail.errors.loadFailed', 'Failed to load purchase return.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    const ids = Array.from(
      new Set(
        [...selectedLines, ...editLines]
          .map((line) => line?.itemId)
          .filter((itemId): itemId is string => Boolean(itemId))
      )
    );
    ids.forEach((itemId) => {
      void ensureItemUomOptions(itemId);
    });
  }, [selectedLines, editLines, itemById]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSourceData = async (options?: { purchaseInvoiceId?: string; goodsReceiptId?: string }) => {
    try {
      const targetPI = (options?.purchaseInvoiceId ?? purchaseInvoiceId).trim();
      const targetGRN = (options?.goodsReceiptId ?? goodsReceiptId).trim();
      setBusy(true);
      setError(null);
      setSourceDocument(null);
      setSelectedLines([]);

      if (targetPI) {
        const result = await purchasesApi.getPI(targetPI);
        const pi = unwrap<any>(result);
        setSourceDocument(pi);
        setCurrency(pi.currency);
        setExchangeRate(pi.exchangeRate);
        setWarehouseId(pi.lines[0]?.warehouseId || '');
        setSelectedLines(pi.lines.map((l: any) => ({
          ...l,
          piLineId: l.lineId,
          uomId: l.uomId,
          // PI lines carry the price as unitPriceDoc; the return row reads unitCostDoc.
          // Without this map the inherited unit price renders empty and posts as 0,
          // zeroing the AP/debit-note reversal. Mirrors handleItemSelect.
          unitCostDoc: l.unitPriceDoc ?? l.unitCostDoc,
          availableQty: l.invoicedQty ?? l.receivedQty,
          returnQty: 0, // Default to 0, let user enter
        })));
      } else if (targetGRN) {
        const result = await purchasesApi.getGRN(targetGRN);
        const grn = unwrap<any>(result);
        setSourceDocument(grn);
        setWarehouseId(grn.warehouseId);
        setSelectedLines(grn.lines.map((l: any) => ({
          ...l,
          grnLineId: l.lineId,
          uomId: l.uomId,
          unitCostDoc: l.unitPriceDoc ?? l.unitCostDoc,
          availableQty: l.receivedQty ?? l.invoicedQty,
          returnQty: 0,
        })));
      } else {
        setError(t('returnDetail.errors.sourceRequired', 'Please enter a Purchase Invoice ID or Goods Receipt ID first.'));
      }
    } catch (err: any) {
      console.error('Failed to fetch source data', err);
      setError(t('returnDetail.errors.fetchSourceFailed', 'Failed to fetch source document. Check the ID.'));
    } finally {
      setBusy(false);
    }
  };

  const openPurchaseInvoicePicker = async () => {
    try {
      setShowPiPicker(true);
      setPiPickerLoading(true);
      setPiPickerError(null);

      const result = await purchasesApi.listPIs({ status: 'POSTED', limit: 30 });
      const list = (unwrap<PurchaseInvoiceDTO[]>(result) || []).slice().sort((a, b) => {
        const aDate = Date.parse(a.invoiceDate || a.createdAt || '');
        const bDate = Date.parse(b.invoiceDate || b.createdAt || '');
        return bDate - aDate;
      });

      setPiOptions(list);
      if (list.length === 0) {
        setSelectedPiId('');
        return;
      }

      const existingSelection = purchaseInvoiceId && list.some((pi) => pi.id === purchaseInvoiceId);
      setSelectedPiId(existingSelection ? purchaseInvoiceId : list[0].id);
    } catch (err) {
      console.error('Failed to load latest purchase invoices', err);
      setPiPickerError(t('returnDetail.errors.loadLatestPurchaseInvoicesFailed', 'Failed to load latest purchase invoices.'));
      setPiOptions([]);
      setSelectedPiId('');
    } finally {
      setPiPickerLoading(false);
    }
  };

  const handlePullSelectedPI = async () => {
    if (!selectedPiId) {
      setPiPickerError(t('returnDetail.errors.selectPurchaseInvoice', 'Please select a Purchase Invoice.'));
      return;
    }

    setPurchaseInvoiceId(selectedPiId);
    setGoodsReceiptId('');
    setVendorId('');
    setSourceMode('FROM_PI');
    setShowPiPicker(false);
    await fetchSourceData({ purchaseInvoiceId: selectedPiId, goodsReceiptId: '' });
  };

  const openGoodsReceiptPicker = async () => {
    try {
      setShowGrnPicker(true);
      setGrnPickerLoading(true);
      setGrnPickerError(null);

      const result = await purchasesApi.listGRNs({ status: 'POSTED', limit: 30 });
      const list = (unwrap<GoodsReceiptDTO[]>(result) || []).slice().sort((a, b) => {
        const aDate = Date.parse(a.receiptDate || a.createdAt || '');
        const bDate = Date.parse(b.receiptDate || b.createdAt || '');
        return bDate - aDate;
      });

      setGrnOptions(list);
      if (list.length === 0) {
        setSelectedGrnId('');
        return;
      }

      const existingSelection = goodsReceiptId && list.some((grn) => grn.id === goodsReceiptId);
      setSelectedGrnId(existingSelection ? goodsReceiptId : list[0].id);
    } catch (err) {
      console.error('Failed to load latest goods receipts', err);
      setGrnPickerError(t('returnDetail.errors.loadLatestGoodsReceiptsFailed', 'Failed to load latest goods receipts.'));
      setGrnOptions([]);
      setSelectedGrnId('');
    } finally {
      setGrnPickerLoading(false);
    }
  };

  const handlePullSelectedGRN = async () => {
    if (!selectedGrnId) {
      setGrnPickerError(t('returnDetail.errors.selectGoodsReceipt', 'Please select a Goods Receipt.'));
      return;
    }

    setGoodsReceiptId(selectedGrnId);
    setPurchaseInvoiceId('');
    setVendorId('');
    setSourceMode('FROM_GRN');
    setShowGrnPicker(false);
    await fetchSourceData({ purchaseInvoiceId: '', goodsReceiptId: selectedGrnId });
  };

  const switchSourceMode = (mode: PurchaseReturnMode) => {
    setSourceMode(mode);
    setPurchaseInvoiceId('');
    setGoodsReceiptId('');
    setSourceDocument(null);
    setSelectedLines([{
      itemId: '',
      itemName: '',
      itemCode: '',
      returnQty: 0,
      uomId: undefined,
      uom: '',
      unitCostDoc: 0,
      discountType: undefined,
      discountValue: 0,
      lineId: `new-${Date.now()}`
    }]);
    if (mode !== 'DIRECT') {
      setVendorId('');
    }
  };

  const handleReturnQtyChange = (lineId: string, qtyValue: string) => {
    const qty = parseFloat(qtyValue) || 0;
    setSelectedLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, returnQty: qty } : l)));
  };

  const handleUnitPriceChange = (lineId: string, priceValue: string) => {
    const price = parseFloat(priceValue) || 0;
    setSelectedLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, unitCostDoc: price } : l)));
  };

  const handleUomChange = (lineId: string, itemId: string, value: string) => {
    const selected = (uomOptionsByItemId[itemId] || []).find((option) => (option.uomId || option.code) === value);
    setSelectedLines((prev) =>
      prev.map((line) =>
        line.lineId === lineId ? { ...line, uomId: selected?.uomId, uom: selected?.code || '' } : line
      )
    );
  };

  const handleTaxCodeChange = (lineId: string, option: any | null) => {
    setSelectedLines((prev) =>
      prev.map((line) =>
        line.lineId === lineId
          ? {
              ...line,
              taxCodeId: option?.id,
              taxCode: option?.code,
              taxRate: option?.rate || 0,
              priceIsInclusive: option?.priceIsInclusive === true,
            }
          : line
      )
    );
  };

  const handleItemSelect = (index: number, itemId: string) => {
    if (sourceDocument) {
      const sourceLine = sourceDocument.lines.find((l: any) => l.itemId === itemId);
      if (!sourceLine) return;

      setSelectedLines(prev => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          itemId: sourceLine.itemId,
          itemCode: sourceLine.itemCode,
          itemName: sourceLine.itemName,
          uomId: sourceLine.uomId,
          uom: sourceLine.uom,
          unitCostDoc: sourceLine.unitPriceDoc ?? sourceLine.unitCostDoc,
          piLineId: sourceLine.piLineId || (purchaseInvoiceId ? sourceLine.lineId : undefined),
          grnLineId: sourceLine.grnLineId || (goodsReceiptId ? sourceLine.lineId : undefined),
          availableQty: sourceLine.invoicedQty ?? sourceLine.receivedQty,
          returnQty: sourceLine.invoicedQty ?? sourceLine.receivedQty, 
        };
        return copy;
      });
    } else {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      const defaultUom = getDefaultItemUomOption(item, 'purchase');
      setSelectedLines(prev => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          uomId: defaultUom?.uomId,
          uom: defaultUom?.code || item.purchaseUom || item.baseUom,
          unitCostDoc: (item as any).lastPurchasePrice || 0,
          taxCodeId: undefined,
          priceIsInclusive: false,
          availableQty: undefined,
          returnQty: 1,
        };
        return copy;
      });
    }
  };

  const grandTotalDoc = useMemo(() => {
    return selectedLines.reduce((acc, l) => acc + computeLineTotalDoc(l), 0);
  }, [selectedLines]);

  const createDraft = async () => {
    try {
      setBusy(true);
      setError(null);

      if (sourceMode === 'FROM_PI' && !purchaseInvoiceId) {
        setError(t('returnDetail.validation.postedPurchaseInvoiceRequired', 'Select a posted Purchase Invoice first.'));
        return;
      }
      if (sourceMode === 'FROM_GRN' && !goodsReceiptId) {
        setError(t('returnDetail.validation.postedGoodsReceiptRequired', 'Select a posted Goods Receipt first.'));
        return;
      }
      if (sourceMode === 'DIRECT' && !vendorId) {
        setError(t('returnDetail.validation.directVendorRequired', 'Vendor is required for direct purchase return.'));
        return;
      }
      if (!returnDate) {
        setError(t('returnDetail.validation.returnDateRequired', 'Return date is required.'));
        return;
      }
      if (!reason.trim()) {
        setError(t('returnDetail.validation.reasonRequired', 'Reason is required.'));
        return;
      }
      const activeLines = selectedLines.filter(l => l.itemId && l.returnQty > 0);
      if (activeLines.length === 0) {
        setError(t('returnDetail.validation.linesRequired', 'At least one item with a return quantity is required.'));
        return;
      }

      const payload: CreatePurchaseReturnPayload = {
        vendorId: vendorId || undefined,
        purchaseInvoiceId: purchaseInvoiceId || undefined,
        goodsReceiptId: goodsReceiptId || undefined,
        purchaseOrderId: purchaseOrderId || undefined,
        returnDate,
        warehouseId: warehouseId || undefined,
        reason: reason.trim(),
        notes: notes || undefined,
        currency,
        exchangeRate,
        lines: activeLines.map(l => ({
          piLineId: l.piLineId,
          grnLineId: l.grnLineId,
          itemId: l.itemId,
          returnQty: l.returnQty,
          unitCostDoc: l.unitCostDoc,
          discountType: l.discountType,
          discountValue: l.discountValue,
          taxCodeId: l.taxCodeId,
          priceIsInclusive: l.priceIsInclusive,
          uomId: l.uomId,
          uom: l.uom,
          description: l.description,
        })),
      };

      const created = await purchasesApi.createReturn(payload);
      const dto = unwrap<PurchaseReturnDTO>(created);
      navigate(`/purchases/returns/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create purchase return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || t('returnDetail.errors.createDraftFailed', 'Failed to create purchase return draft.')
      );
    } finally {
      setBusy(false);
    }
  };

  const addLine = () => {
    setSelectedLines(prev => [...prev, {
      itemId: '',
      itemName: '',
      itemCode: '',
      returnQty: 0,
      uomId: undefined,
      uom: '',
      unitCostDoc: 0,
      discountType: undefined,
      discountValue: 0,
      taxCodeId: undefined,
      priceIsInclusive: false,
      lineId: `new-${Date.now()}`
    }]);
  };

  const removeLine = (index: number) => {
    setSelectedLines(prev => prev.filter((_, i) => i !== index));
  };

  const postDraft = async () => {
    if (!purchaseReturn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await purchasesApi.postReturn(purchaseReturn.id);
      setPurchaseReturn(unwrap<PurchaseReturnDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post purchase return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || t('returnDetail.errors.postFailed', 'Failed to post purchase return.')
      );
    } finally {
      setBusy(false);
    }
  };

  const unpostReturn = async () => {
    if (!purchaseReturn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const unposted = await purchasesApi.unpostReturn(purchaseReturn.id);
      setPurchaseReturn(unwrap<PurchaseReturnDTO>(unposted));
      setUnpostConfirmOpen(false);
    } catch (err: any) {
      console.error('Failed to unpost purchase return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || t('returnDetail.errors.unpostFailed', 'Failed to unpost purchase return.')
      );
    } finally {
      setBusy(false);
    }
  };

  const enterEditMode = () => {
    if (!purchaseReturn) return;
    setEditReturnDate(purchaseReturn.returnDate);
    setEditWarehouseId(purchaseReturn.warehouseId);
    setEditReason(purchaseReturn.reason);
    setEditNotes(purchaseReturn.notes || '');
    setEditLines(purchaseReturn.lines.map(l => ({
      lineId: l.lineId,
      piLineId: l.piLineId,
      grnLineId: l.grnLineId,
      poLineId: l.poLineId,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      returnQty: l.returnQty,
      uomId: l.uomId,
      uom: l.uom,
      unitCostDoc: l.unitCostDoc,
      accountId: l.accountId,
      description: l.description,
    })));
    setIsEditMode(true);
    setError(null);
  };

  const cancelEditMode = () => {
    setIsEditMode(false);
    setError(null);
  };

  const saveEdit = async () => {
    if (!purchaseReturn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const activeLines = editLines.filter(l => l.itemId && l.returnQty > 0);
      const updated = await purchasesApi.updateReturn(purchaseReturn.id, {
        returnDate: editReturnDate,
        warehouseId: editWarehouseId || undefined,
        reason: editReason,
        notes: editNotes || undefined,
        lines: activeLines.map(l => ({
          lineId: l.lineId,
          piLineId: l.piLineId,
          grnLineId: l.grnLineId,
          poLineId: l.poLineId,
          itemId: l.itemId,
          returnQty: l.returnQty,
          unitCostDoc: l.unitCostDoc,
          discountType: l.discountType,
          discountValue: l.discountValue,
          uomId: l.uomId,
          uom: l.uom,
          accountId: l.accountId,
          description: l.description,
        })),
      });
      setPurchaseReturn(unwrap<PurchaseReturnDTO>(updated));
      setIsEditMode(false);
    } catch (err: any) {
      console.error('Failed to update purchase return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || t('returnDetail.errors.updateFailed', 'Failed to update purchase return.')
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("auto.PurchaseReturnDetailPage.purchaseReturn", "Purchase Return")}</h1>
        <Card className="p-6">{t("auto.PurchaseReturnDetailPage.loadingPurchaseReturn", "Loading purchase return...")}</Card>
      </div>
    );
  }

  const hasUnsavedDocumentChanges = (() => {
    if (!isEditMode || !purchaseReturn) return false;
    const baselineLines = purchaseReturn.lines.map(l => ({
      ...l,
      returnQty: l.returnQty,
      uomId: l.uomId,
      uom: l.uom,
      unitCostDoc: l.unitCostDoc,
      accountId: l.accountId,
      description: l.description,
    }));
    return (
      editReturnDate !== purchaseReturn.returnDate ||
      editWarehouseId !== (purchaseReturn.warehouseId || '') ||
      editReason !== (purchaseReturn.reason || '') ||
      editNotes !== (purchaseReturn.notes || '') ||
      JSON.stringify(editLines) !== JSON.stringify(baselineLines)
    );
  })();

  const openNewPurchaseReturnForm = () => {
    setPurchaseReturn(null);
    setVendorId('');
    setSourceMode('DIRECT');
    setPurchaseInvoiceId('');
    setGoodsReceiptId('');
    setPurchaseOrderId('');
    setReturnDate(todayIso());
    setCurrency('USD');
    setExchangeRate(1);
    setWarehouseId('');
    setReason('');
    setNotes('');
    setSelectedLines([{
      itemId: '',
      itemName: '',
      itemCode: '',
      returnQty: 0,
      uomId: undefined,
      uom: '',
      unitCostDoc: 0,
      discountType: undefined,
      discountValue: 0,
      taxCodeId: undefined,
      priceIsInclusive: false,
      lineId: `new-${Date.now()}`
    }]);
    setIsEditMode(false);
    setError(null);
    navigate('/purchases/returns/new');
  };

  if (isCreateMode) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("auto.PurchaseReturnDetailPage.newPurchaseReturn", "New Purchase Return")}</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => navigate('/purchases/returns')}
          >{t("auto.PurchaseReturnDetailPage.backToList", "Back to List")}</button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="overflow-visible p-0">
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t('returnDetail.returnMode')}</label>
              <div className="grid h-9 grid-cols-3 rounded border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-bold">
                {([
                  ['DIRECT', t('returnDetail.modeDirect')],
                  ['FROM_PI', t('returnDetail.modeFromPi')],
                  ['FROM_GRN', t('returnDetail.modeFromGrn')],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded px-2 transition-colors ${
                      sourceMode === mode ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => switchSourceMode(mode)}
                    disabled={busy}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {sourceMode === 'FROM_PI' && (
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t('returnDetail.purchaseInvoice')}</label>
                <button
                  type="button"
                  className="h-9 w-full rounded border border-indigo-200 bg-indigo-50 px-3 text-left text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  onClick={openPurchaseInvoicePicker}
                  disabled={busy}
                >
                  {sourceDocument?.invoiceNumber || purchaseInvoiceId || t('returnDetail.selectPostedPi')}
                </button>
              </div>
            )}
            {sourceMode === 'FROM_GRN' && (
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t('returnDetail.goodsReceipt')}</label>
                <button
                  type="button"
                  className="h-9 w-full rounded border border-indigo-200 bg-indigo-50 px-3 text-left text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  onClick={openGoodsReceiptPicker}
                  disabled={busy}
                >
                  {sourceDocument?.grnNumber || goodsReceiptId || t('returnDetail.selectPostedGrn')}
                </button>
              </div>
            )}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t('returnDetail.vendor')}</label>
              <PartySelector 
                value={vendorId}
                role="VENDOR"
                disabled={sourceMode !== 'DIRECT'}
                placeholder={t('returnDetail.selectVendor')}
                onChange={(party) => {
                  setVendorId(party?.id || '');
                  if (party) {
                    setPurchaseInvoiceId('');
                    setGoodsReceiptId('');
                    // Also update currency if party has a default
                    if (party.defaultCurrency) setCurrency(party.defaultCurrency);
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t("auto.PurchaseReturnDetailPage.purchaseOrderIDOptional", "Purchase Order ID (optional)")}</label>
              <input
                type="text"
                className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-primary-500"
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t("auto.PurchaseReturnDetailPage.returnDate", "Return Date")}</label>
              <DatePicker 
                value={returnDate}
                onChange={(val) => setReturnDate(val)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t("auto.PurchaseReturnDetailPage.warehouse", "Warehouse")}</label>
              <WarehouseSelector
                value={warehouseId}
                onChange={(warehouse) => setWarehouseId(warehouse?.id || '')}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{t("auto.PurchaseReturnDetailPage.context", "Context")}</label>
              <div className="flex h-9 items-center rounded border border-slate-200 bg-slate-50 px-2 text-xs font-bold">
                {contextLabel}
              </div>
            </div>
          </div>

            <div className="col-span-full mt-2 border-t border-slate-100 pt-3">
              <ClassicLineItemsTable<any>
                tableId="purchases.return.create.lines"
                title={t("auto.PurchaseReturnDetailPage.returnItems", "Return Items")}
                rows={selectedLines}
                onRowChange={(index, patch) => {
                  setSelectedLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
                }}
                onRowRemove={removeLine}
                onRowsChange={setSelectedLines}
                createEmptyRow={() => ({
                  itemId: '',
                  itemName: '',
                  itemCode: '',
                  returnQty: 0,
                  uomId: undefined,
                  uom: '',
                  unitCostDoc: 0,
                  discountType: undefined,
                  discountValue: 0,
                  lineId: `new-${Date.now()}`,
                })}
                isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName)}
                onRowAdd={addLine}
                addLabel={t('returnDetail.addItem', 'Add Item')}
                minTableWidth="980px"
                columns={[
                  {
                    id: 'item',
                    label: t('returnDetail.item', 'Item'),
                    kind: 'custom',
                    width: '280px',
                    render: (line, index) => sourceDocument ? (
                      <select
                        className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none"
                        value={line.itemId}
                        onChange={(e) => handleItemSelect(index, e.target.value)}
                      >
                        <option value="">{t("auto.PurchaseReturnDetailPage.selectItemFromSource", "Select item from source...")}</option>
                        {sourceDocument.lines.map((sl: any) => (
                          <option key={sl.lineId} value={sl.itemId}>
                            {sl.itemCode} - {sl.itemName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <ItemSelector
                        value={line.itemId}
                        noBorder
                        placeholder={t("auto.PurchaseReturnDetailPage.searchItem", "Search item...")}
                        onChange={(item) => handleItemSelect(index, item?.id || '')}
                      />
                    ),
                  } as ColumnDef<any>,
                  { id: 'available', label: t('returnDetail.available', 'Available'), kind: 'computed', width: '100px', compute: (line) => line.availableQty ?? '-' },
                  { id: 'returnQty', label: t('returnDetail.returnQty', 'Return Qty'), kind: 'number', width: '120px', accessor: (line) => line.returnQty, setter: (value) => ({ returnQty: Number(value) }) },
                  {
                    id: 'uom',
                    label: t('returnDetail.uom', 'UOM'),
                    kind: 'custom',
                    width: '100px',
                    render: (line) => (
                      <UomSelector
                        item={itemById[line.itemId]}
                        itemId={line.itemId}
                        valueId={line.uomId}
                        valueCode={line.uom}
                        usage="purchase"
                        disabled={!line.itemId}
                        noBorder
                        onChange={(selected) => handleUomChange(line.lineId, line.itemId, selected?.uomId || selected?.code || '')}
                      />
                    ),
                  },
                  { id: 'unitCost', label: t('returnDetail.unitPrice', 'Unit Price'), kind: 'number', width: '120px', accessor: (line) => line.unitCostDoc, setter: (value) => ({ unitCostDoc: Number(value) }) },
                  {
                    id: 'discountType',
                    label: t('returnDetail.discountType', 'Discount Type'),
                    kind: 'custom',
                    width: '64px',
                    render: (line, index) => (
                      <DiscountTypeSelector
                        noBorder
                        value={line.discountType}
                        currencyCode={currency}
                        onChange={(next) => setSelectedLines((prev) => prev.map((l, i) =>
                          i === index ? { ...l, discountType: next || undefined, discountValue: 0 } : l,
                        ))}
                      />
                    ),
                  },
                  { id: 'discountValue', label: t('returnDetail.discount', 'Discount'), kind: 'number', width: '90px', accessor: (line) => line.discountValue || 0, setter: (value) => ({ discountValue: Number(value) }) },
                  {
                    id: 'tax',
                    label: t('returnDetail.tax', 'Tax'),
                    kind: 'custom',
                    width: '150px',
                    render: (line) => (
                      <TaxCodeSelector
                        options={purchaseTaxCodes}
                        valueId={line.taxCodeId}
                        noBorder
                        disabled={sourceMode !== 'DIRECT'}
                        placeholder={t("auto.PurchaseReturnDetailPage.tax", "Tax")}
                        emptySetupMessage={t('returnDetail.noPurchaseTaxCodes')}
                        onChange={(option) => handleTaxCodeChange(line.lineId, option)}
                      />
                    ),
                  },
                  {
                    id: 'total',
                    label: t('returnDetail.total', 'Total'),
                    kind: 'computed',
                    width: '120px',
                    compute: computeLineTotalDoc,
                  },
                ]}
              />
            </div>

          <div className="mt-8 border-t border-slate-100 pt-8">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">{t("auto.PurchaseReturnDetailPage.currencyAndExchange", "Currency & Exchange")}</h3>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("auto.PurchaseReturnDetailPage.currency", "Currency")}</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  disabled={busy}
                >
                  <option value="SYP">{t("auto.PurchaseReturnDetailPage.sYPSyrianPound", "SYP - Syrian Pound")}</option>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("auto.PurchaseReturnDetailPage.exchangeRate", "Exchange Rate")}</label>
                <CurrencyExchangeWidget
                  currency={currency}
                  baseCurrency={company?.baseCurrency || 'SYP'}
                  voucherDate={returnDate}
                  value={exchangeRate}
                  onChange={setExchangeRate}
                  disabled={busy}
                />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("auto.PurchaseReturnDetailPage.reason", "Reason")}</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("auto.PurchaseReturnDetailPage.eGDamagedGoodsIncorrectItem", "e.g. Damaged goods, Incorrect item")}
            />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">{t("auto.PurchaseReturnDetailPage.notes", "Notes")}</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
            <p className="font-semibold mb-1 uppercase tracking-wider text-slate-600">{t("auto.PurchaseReturnDetailPage.information", "Information")}</p>
            {selectedLines.length === 0 
              ? t('returnDetail.emptyLineHelp', 'Start by adding items manually or fetch from a source document.')
              : t('returnDetail.sourceLineHelp', 'Items already fetched from source are restricted to source quantities. Manual entries can search from the full catalog.')}
          </div>

        </Card>

        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={createDraft}
          disabled={busy}
        >
          {busy ? t('returnDetail.creating', 'Creating...') : t('returnDetail.createDraftReturn', 'Create Draft Return')}
        </button>

        {showPiPicker && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => !piPickerLoading && setShowPiPicker(false)}
          >
            <div
              className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{t("auto.PurchaseReturnDetailPage.selectPurchaseInvoice", "Select Purchase Invoice")}</h3>
                  <p className="text-xs text-slate-500">{t("auto.PurchaseReturnDetailPage.latestPostedInvoicesChooseOneToPullLines", "Latest posted invoices. Choose one to pull lines into this return.")}</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                  onClick={() => setShowPiPicker(false)}
                  disabled={piPickerLoading}
                >{t("auto.PurchaseReturnDetailPage.close", "Close")}</button>
              </div>

              <div className="max-h-[60vh] overflow-auto p-4">
                {piPickerError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {piPickerError}
                  </div>
                )}

                {piPickerLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{t("auto.PurchaseReturnDetailPage.loadingPurchaseInvoices", "Loading purchase invoices...")}</div>
                ) : piOptions.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{t("auto.PurchaseReturnDetailPage.noPostedPurchaseInvoicesFound", "No posted purchase invoices found.")}</div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left">{t("auto.PurchaseReturnDetailPage.pick", "Pick")}</th>
                        <th className="px-3 py-2 text-left">{t("auto.PurchaseReturnDetailPage.invoiceNo", "Invoice No")}</th>
                        <th className="px-3 py-2 text-left">{t("auto.PurchaseReturnDetailPage.vendor", "Vendor")}</th>
                        <th className="px-3 py-2 text-left">{t("auto.PurchaseReturnDetailPage.invoiceDate", "Invoice Date")}</th>
                        <th className="px-3 py-2 text-left">{t("auto.PurchaseReturnDetailPage.currency2", "Currency")}</th>
                        <th className="px-3 py-2 text-right">{t("auto.PurchaseReturnDetailPage.grandTotal", "Grand Total")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {piOptions.map((pi) => (
                        <tr
                          key={pi.id}
                          className={`cursor-pointer hover:bg-slate-50 ${selectedPiId === pi.id ? 'bg-indigo-50' : ''}`}
                          onClick={() => setSelectedPiId(pi.id)}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="radio"
                              name="selected-pi"
                              checked={selectedPiId === pi.id}
                              onChange={() => setSelectedPiId(pi.id)}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-indigo-700">{pi.invoiceNumber}</td>
                          <td className="px-3 py-2">{pi.vendorName}</td>
                          <td className="px-3 py-2">{pi.invoiceDate}</td>
                          <td className="px-3 py-2">{pi.currency}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {pi.grandTotalDoc.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  onClick={() => setShowPiPicker(false)}
                  disabled={piPickerLoading}
                >{t("auto.PurchaseReturnDetailPage.cancel", "Cancel")}</button>
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={handlePullSelectedPI}
                  disabled={piPickerLoading || !selectedPiId}
                >{t("auto.PurchaseReturnDetailPage.pullSelectedInvoice", "Pull Selected Invoice")}</button>
              </div>
            </div>
          </div>
        )}

        {showGrnPicker && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => !grnPickerLoading && setShowGrnPicker(false)}
          >
            <div
              className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{t('returnDetail.selectGoodsReceiptTitle')}</h3>
                  <p className="text-xs text-slate-500">{t('returnDetail.selectGoodsReceiptHint')}</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                  onClick={() => setShowGrnPicker(false)}
                  disabled={grnPickerLoading}
                >{t("auto.PurchaseReturnDetailPage.close2", "Close")}</button>
              </div>

              <div className="max-h-[60vh] overflow-auto p-4">
                {grnPickerError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {grnPickerError}
                  </div>
                )}

                {grnPickerLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    {t('returnDetail.loadingGoodsReceipts')}
                  </div>
                ) : grnOptions.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    {t('returnDetail.noPostedGoodsReceipts')}
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left">{t("auto.PurchaseReturnDetailPage.pick2", "Pick")}</th>
                        <th className="px-3 py-2 text-left">{t('returnDetail.grnNo')}</th>
                        <th className="px-3 py-2 text-left">{t('returnDetail.vendor')}</th>
                        <th className="px-3 py-2 text-left">{t('returnDetail.receiptDate')}</th>
                        <th className="px-3 py-2 text-left">{t("auto.PurchaseReturnDetailPage.warehouse2", "Warehouse")}</th>
                        <th className="px-3 py-2 text-right">{t('returnDetail.lines')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {grnOptions.map((grn) => (
                        <tr
                          key={grn.id}
                          className={`cursor-pointer hover:bg-slate-50 ${selectedGrnId === grn.id ? 'bg-indigo-50' : ''}`}
                          onClick={() => setSelectedGrnId(grn.id)}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="radio"
                              name="selected-grn"
                              checked={selectedGrnId === grn.id}
                              onChange={() => setSelectedGrnId(grn.id)}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-indigo-700">{grn.grnNumber}</td>
                          <td className="px-3 py-2">{grn.vendorName}</td>
                          <td className="px-3 py-2">{grn.receiptDate}</td>
                          <td className="px-3 py-2">{grn.warehouseId}</td>
                          <td className="px-3 py-2 text-right font-mono">{grn.lines.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  onClick={() => setShowGrnPicker(false)}
                  disabled={grnPickerLoading}
                >{t("auto.PurchaseReturnDetailPage.cancel2", "Cancel")}</button>
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={handlePullSelectedGRN}
                  disabled={grnPickerLoading || !selectedGrnId}
                >
                  {t('returnDetail.pullSelectedReceipt')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!purchaseReturn) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("auto.PurchaseReturnDetailPage.purchaseReturn2", "Purchase Return")}</h1>
        <Card className="p-6 text-sm text-red-700">{t("auto.PurchaseReturnDetailPage.purchaseReturnNotFound", "Purchase return not found.")}</Card>
      </div>
    );
  }

  const activeGrandTotal = isEditMode
    ? editLines.reduce((s, l) => s + l.returnQty * l.unitCostDoc, 0)
    : purchaseReturn.grandTotalDoc;
  const viewRailSections: DocumentScaffoldRailSections = {
    info: {
      title: t('returnDetail.rail.info', 'Info'),
      action: <DocumentPill tone="blue">{purchaseReturn.returnContext}</DocumentPill>,
      content: (
        <DocumentRailKeyValueList
          items={[
            { label: t('returnDetail.vendor', 'Vendor'), value: purchaseReturn.vendorName || purchaseReturn.vendorId || '-' },
            { label: t('returnDetail.returnDate', 'Return Date'), value: isEditMode ? editReturnDate : purchaseReturn.returnDate },
            { label: t('returnDetail.warehouse', 'Warehouse'), value: isEditMode ? editWarehouseId : purchaseReturn.warehouseId || '-' },
          ]}
        />
      ),
    },
    readiness: {
      title: t('returnDetail.rail.documentStatus', 'Document Status'),
      content: (
        <DocumentRailKeyValueList
          items={[
            {
              label: t('returnDetail.status', 'Status'),
              value: (
                <DocumentPill tone={purchaseReturn.status === 'POSTED' ? 'green' : 'slate'}>
                  {purchaseReturn.status}
                </DocumentPill>
              ),
            },
            { label: t('returnDetail.lines', 'Lines'), value: (isEditMode ? editLines : purchaseReturn.lines).length },
          ]}
        />
      ),
    },
    totals: {
      title: t('returnDetail.rail.totals', 'Totals'),
      action: <DocumentPill tone="slate">{purchaseReturn.currency}</DocumentPill>,
      content: (
        <DocumentRailTotals
          rows={[
            { label: t('returnDetail.subtotal', 'Subtotal'), value: `${purchaseReturn.currency} ${purchaseReturn.subtotalDoc.toFixed(2)}` },
            { label: t('returnDetail.tax', 'Tax'), value: `${purchaseReturn.currency} ${purchaseReturn.taxTotalDoc.toFixed(2)}` },
          ]}
          grand={{ label: t('returnDetail.grandTotal', 'Grand Total'), value: `${purchaseReturn.currency} ${activeGrandTotal.toFixed(2)}` }}
        />
      ),
    },
  };

  const footerActions = isEditMode ? (
    <button
      type="button"
      className="rounded bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
      onClick={saveEdit}
      disabled={busy}
    >
      {busy ? t('common.saving', 'Saving...') : t('returnDetail.saveChanges', 'Save Changes')}
    </button>
  ) : (
    <>
      {purchaseReturn.status === 'DRAFT' && (
        <>
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            onClick={postDraft}
            disabled={busy}
          >
            {busy ? t('returnDetail.posting', 'Posting...') : t('returnDetail.postReturn', 'Post Return')}
          </button>
          <button
            type="button"
            className="rounded border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
            onClick={enterEditMode}
            disabled={busy}
          >{t("auto.PurchaseReturnDetailPage.editReturn", "Edit Return")}</button>
        </>
      )}
      {purchaseReturn.status === 'POSTED' && (
        <>
          <button
            type="button"
            className="rounded border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
            onClick={() => setGlImpactOpen(true)}
            disabled={busy}
          >
            {t('returnDetail.glImpact')}
          </button>
          <button
            type="button"
            className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
            onClick={() => setUnpostConfirmOpen(true)}
            disabled={busy}
          >
            {busy ? t('returnDetail.unposting', 'Unposting...') : t('returnDetail.unpostReturn', 'Unpost Return')}
          </button>
        </>
      )}
    </>
  );

  return (
    <>
    <DocumentDetailScaffold
      title={purchaseReturn.returnNumber}
      subtitle={t('returnDetail.viewSubtitle', 'Vendor: {{vendor}}', { vendor: purchaseReturn.vendorName || purchaseReturn.vendorId || '-' })}
      icon={FileText}
      backLabel={isEditMode ? t('returnDetail.cancelEdit', 'Cancel edit') : t('returnDetail.backToPurchaseReturns', 'Back to purchase returns')}
      onBack={() => (isEditMode ? cancelEditMode() : navigate('/purchases/returns'))}
      badges={
        <>
          <DocumentPill tone="blue">{purchaseReturn.returnContext}</DocumentPill>
          <DocumentPill tone={purchaseReturn.status === 'POSTED' ? 'green' : 'slate'}>{purchaseReturn.status}</DocumentPill>
          {isEditMode && <DocumentPill tone="amber">{t("auto.PurchaseReturnDetailPage.editing", "Editing")}</DocumentPill>}
        </>
      }
      newAction={{
        label: t('returnDetail.newReturn', 'New Return'),
        title: t('returnDetail.newReturn', 'New Return'),
        hasUnsavedChanges: hasUnsavedDocumentChanges,
        onNew: openNewPurchaseReturnForm,
      }}
      railSections={viewRailSections}
      railTitle={t('returnDetail.rail.title', 'Purchase return side rail')}
      footerSections={{
        totals: {
          content: (
        <DocumentFooterTotalsStrip
          totals={[
            { label: t('returnDetail.subtotal', 'Subtotal'), value: `${purchaseReturn.currency} ${purchaseReturn.subtotalDoc.toFixed(2)}` },
            { label: t('returnDetail.tax', 'Tax'), value: `${purchaseReturn.currency} ${purchaseReturn.taxTotalDoc.toFixed(2)}`, tone: 'blue' },
            { label: t('returnDetail.grand', 'Grand'), value: `${purchaseReturn.currency} ${activeGrandTotal.toFixed(2)}`, tone: 'green' },
          ]}
        />
          ),
        },
        actions: { content: footerActions },
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
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("auto.PurchaseReturnDetailPage.returnDate2", "Return Date")}</div>
            {isEditMode ? (
              <DatePicker 
                value={editReturnDate}
                onChange={(val) => setEditReturnDate(val)}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.returnDate}</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("auto.PurchaseReturnDetailPage.warehouse3", "Warehouse")}</div>
            {isEditMode ? (
              <div className="mt-1">
                <WarehouseSelector 
                  value={editWarehouseId} 
                  onChange={(wh) => setEditWarehouseId(wh?.id || '')} 
                />
              </div>
            ) : (
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.warehouseId}</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("auto.PurchaseReturnDetailPage.reason2", "Reason")}</div>
            {isEditMode ? (
              <input type="text" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            ) : (
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.reason}</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("auto.PurchaseReturnDetailPage.currency3", "Currency")}</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.currency}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("auto.PurchaseReturnDetailPage.exchangeRate2", "Exchange Rate")}</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.exchangeRate.toFixed(4)}</div>
          </div>
          {isEditMode && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{t("auto.PurchaseReturnDetailPage.notes2", "Notes")}</div>
              <textarea rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
          )}
        </DocumentHeaderGrid>
      </Card>
          ),
        },
        lines: {
          content: (
      <ClassicLineItemsTable<any>
        tableId="purchases.return.view.lines"
        title={t("auto.PurchaseReturnDetailPage.lines", "Lines")}
        rows={isEditMode ? editLines : purchaseReturn.lines}
        disabled={!isEditMode}
        onRowChange={(index, patch) => {
          if (!isEditMode) return;
          setEditLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
        }}
        onRowRemove={isEditMode ? (index) => setEditLines((prev) => prev.filter((_, i) => i !== index)) : undefined}
        onRowsChange={isEditMode ? setEditLines : undefined}
        createEmptyRow={() => ({
          itemId: '',
          itemName: '',
          itemCode: '',
          returnQty: 0,
          uomId: undefined,
          uom: '',
          unitCostDoc: 0,
          discountType: undefined,
          discountValue: 0,
          lineId: `new-${Date.now()}`,
        })}
        isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName)}
        minTableWidth="900px"
        columns={[
          {
            id: 'item',
            label: t('returnDetail.item', 'Item'),
            kind: 'custom',
            width: '260px',
            render: (line) => (
              <div className="flex h-9 items-center px-2 text-xs">
                <span className="text-slate-500">{line.itemCode}</span>
                <span className="ml-1 font-semibold text-slate-900 dark:text-slate-100">{line.itemName}</span>
              </div>
            ),
          } as ColumnDef<any>,
          { id: 'returnQty', label: t('returnDetail.returnQty', 'Return Qty'), kind: isEditMode ? 'number' : 'computed', width: '120px', accessor: (line) => line.returnQty, setter: (value) => ({ returnQty: Number(value) }), compute: (line) => line.returnQty },
          {
            id: 'uom',
            label: t('returnDetail.uom', 'UOM'),
            kind: 'custom',
            width: '110px',
            render: (line, index) => isEditMode ? (
              <UomSelector
                item={itemById[line.itemId]}
                itemId={line.itemId}
                valueId={line.uomId}
                valueCode={line.uom}
                usage="purchase"
                disabled={!line.itemId}
                noBorder
                onChange={(selected) => {
                  setEditLines((prev) =>
                    prev.map((entry, i) =>
                      i === index ? { ...entry, uomId: selected?.uomId, uom: selected?.code || '' } : entry
                    )
                  );
                }}
              />
            ) : (
              <div className="flex h-9 items-center px-2 text-xs uppercase text-slate-700 dark:text-slate-200">{line.uom}</div>
            ),
          },
          { id: 'unitCost', label: t('returnDetail.unitCost', 'Unit Cost'), kind: isEditMode ? 'number' : 'computed', width: '120px', accessor: (line) => line.unitCostDoc, setter: (value) => ({ unitCostDoc: Number(value) }), compute: (line) => line.unitCostDoc },
          {
            id: 'discountType',
            label: t('returnDetail.discountType', 'Discount Type'),
            kind: 'custom',
            width: '64px',
            render: (line, index) => isEditMode ? (
              <DiscountTypeSelector
                noBorder
                value={line.discountType}
                currencyCode={purchaseReturn.currency}
                onChange={(next) => setEditLines((prev) => prev.map((entry, i) =>
                  i === index ? { ...entry, discountType: next || undefined, discountValue: 0 } : entry,
                ))}
              />
            ) : (
              <div className="flex h-9 items-center justify-center px-2 text-xs uppercase text-slate-700 dark:text-slate-200">
                {line.discountType === 'PERCENT' ? '%' : line.discountType === 'AMOUNT' ? purchaseReturn.currency : '—'}
              </div>
            ),
          },
          { id: 'discountValue', label: t('returnDetail.discount', 'Discount'), kind: isEditMode ? 'number' : 'computed', width: '90px', accessor: (line) => line.discountValue || 0, setter: (value) => ({ discountValue: Number(value) }), compute: (line) => line.discountValue || 0 },
          {
            id: 'lineTotal',
            label: t('returnDetail.lineTotal', 'Line Total'),
            kind: 'computed',
            width: '130px',
            compute: (line) => {
              const gross = (line.returnQty || 0) * (line.unitCostDoc || 0);
              const dv = Number(line.discountValue || 0);
              const discount = line.discountType === 'PERCENT'
                ? Math.max(0, Math.min(gross, gross * (dv / 100)))
                : line.discountType === 'AMOUNT'
                  ? Math.max(0, Math.min(dv, gross))
                  : 0;
              return gross - discount;
            },
          },
        ]}
      />
          ),
        },
        secondary: {
          content: (
      <Card className="p-5">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-slate-600">{t("auto.PurchaseReturnDetailPage.subtotal", "Subtotal")}</span>
            <span className="font-medium">
              {purchaseReturn.currency} {isEditMode
                ? editLines.reduce((s, l) => {
                    const gross = (l.returnQty || 0) * (l.unitCostDoc || 0);
                    const dv = Number(l.discountValue || 0);
                    const disc = l.discountType === 'PERCENT'
                      ? Math.max(0, Math.min(gross, gross * (dv / 100)))
                      : l.discountType === 'AMOUNT'
                        ? Math.max(0, Math.min(dv, gross))
                        : 0;
                    return s + (gross - disc);
                  }, 0).toFixed(2)
                : purchaseReturn.subtotalDoc.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">{t("auto.PurchaseReturnDetailPage.tax2", "Tax")}</span>
            <span className="font-medium">
              {purchaseReturn.currency} {purchaseReturn.taxTotalDoc.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{t("auto.PurchaseReturnDetailPage.grandTotal2", "Grand Total")}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {purchaseReturn.currency} {isEditMode
                ? editLines.reduce((s, l) => {
                    const gross = (l.returnQty || 0) * (l.unitCostDoc || 0);
                    const dv = Number(l.discountValue || 0);
                    const disc = l.discountType === 'PERCENT'
                      ? Math.max(0, Math.min(gross, gross * (dv / 100)))
                      : l.discountType === 'AMOUNT'
                        ? Math.max(0, Math.min(dv, gross))
                        : 0;
                    return s + (gross - disc);
                  }, 0).toFixed(2)
                : purchaseReturn.grandTotalDoc.toFixed(2)}
            </span>
          </div>
        </div>
      </Card>
          ),
        },
      }}
    />

      <ConfirmDialog
        isOpen={unpostConfirmOpen}
        title={t("auto.PurchaseReturnDetailPage.unpostPurchaseReturn", "Unpost Purchase Return")}
        message={t('returnDetail.unpost.confirmMessage', 'This will reverse all accounting and inventory entries posted for this purchase return. The action is auditable but cannot be undone in place. Continue?')}
        confirmLabel={t('returnDetail.unpostReturn', 'Unpost Return')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="danger"
        isConfirming={busy}
        onConfirm={unpostReturn}
        onCancel={() => { if (!busy) setUnpostConfirmOpen(false); }}
      />
      {purchaseReturn.status === 'POSTED' && (
        <GlImpactModal
          isOpen={glImpactOpen}
          onClose={() => setGlImpactOpen(false)}
          sourceId={purchaseReturn.id}
          sourceLabel={purchaseReturn.returnNumber}
          fallbackVoucherIds={purchaseReturn.voucherId ? [purchaseReturn.voucherId] : []}
          documentStatus={purchaseReturn.status}
          postingContext="purchases"
        />
      )}
    </>
  );
};

export default PurchaseReturnDetailPage;
