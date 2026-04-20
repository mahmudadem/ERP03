import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CreatePurchaseReturnPayload, PurchaseInvoiceDTO, PurchaseReturnDTO, purchasesApi } from '../../../api/purchasesApi';
import { sharedApi } from '../../../api/sharedApi';
import { InventoryItemDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import { Card } from '../../../components/ui/Card';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { PartySelector } from '../../../components/shared/selectors';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useCompanyCurrencies } from '../../accounting/hooks/useCompanyCurrencies';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const PurchaseReturnDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturnDTO | null>(null);
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
  
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [taxCodes, setTaxCodes] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});

  const { settings: company } = useCompanySettings();
  const { data: currencies = [] } = useCompanyCurrencies();

  const contextLabel = useMemo(() => {
    if (purchaseInvoiceId.trim()) return 'AFTER_INVOICE';
    if (goodsReceiptId.trim()) return 'BEFORE_INVOICE';
    if (vendorId.trim()) return 'DIRECT';
    return '-';
  }, [goodsReceiptId, purchaseInvoiceId, vendorId]);

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
          || 'Failed to load purchase return.'
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
          returnQty: 0,
        })));
      } else {
        setError('Please enter a Purchase Invoice ID or Goods Receipt ID first.');
      }
    } catch (err: any) {
      console.error('Failed to fetch source data', err);
      setError('Failed to fetch source document. Check the ID.');
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
      setPiPickerError('Failed to load latest purchase invoices.');
      setPiOptions([]);
      setSelectedPiId('');
    } finally {
      setPiPickerLoading(false);
    }
  };

  const handlePullSelectedPI = async () => {
    if (!selectedPiId) {
      setPiPickerError('Please select a Purchase Invoice.');
      return;
    }

    setPurchaseInvoiceId(selectedPiId);
    setGoodsReceiptId('');
    setVendorId('');
    setShowPiPicker(false);
    await fetchSourceData({ purchaseInvoiceId: selectedPiId, goodsReceiptId: '' });
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
          availableQty: undefined,
          returnQty: 1,
        };
        return copy;
      });
    }
  };

  const grandTotalDoc = useMemo(() => {
    return selectedLines.reduce((acc, l) => acc + (l.returnQty * l.unitCostDoc), 0);
  }, [selectedLines]);

  const createDraft = async () => {
    try {
      setBusy(true);
      setError(null);

      if (!purchaseInvoiceId && !goodsReceiptId && !vendorId) {
        setError('Purchase Invoice, Goods Receipt, or Vendor is required.');
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
      const activeLines = selectedLines.filter(l => l.itemId && l.returnQty > 0);
      if (activeLines.length === 0) {
        setError('At least one item with a return quantity is required.');
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
          || 'Failed to create purchase return draft.'
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
          || 'Failed to post purchase return.'
      );
    } finally {
      setBusy(false);
    }
  };

  const unpostReturn = async () => {
    if (!purchaseReturn?.id) return;
    if (!window.confirm('Are you sure you want to unpost this return? This will reverse all accounting and inventory entries.')) return;
    try {
      setBusy(true);
      setError(null);
      const unposted = await purchasesApi.unpostReturn(purchaseReturn.id);
      setPurchaseReturn(unwrap<PurchaseReturnDTO>(unposted));
    } catch (err: any) {
      console.error('Failed to unpost purchase return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Failed to unpost purchase return.'
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
          || 'Failed to update purchase return.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Return</h1>
        <Card className="p-6">Loading purchase return...</Card>
      </div>
    );
  }

  if (isCreateMode) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Purchase Return</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => navigate('/purchases/returns')}
          >
            Back to List
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Purchase Invoice ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={purchaseInvoiceId}
                  onChange={(e) => {
                    setPurchaseInvoiceId(e.target.value);
                    if (e.target.value) {
                      setGoodsReceiptId('');
                      setVendorId('');
                    }
                  }}
                  placeholder="Use for AFTER_INVOICE"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Goods Receipt ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={goodsReceiptId}
                  onChange={(e) => {
                    setGoodsReceiptId(e.target.value);
                    if (e.target.value) {
                      setPurchaseInvoiceId('');
                      setVendorId('');
                    }
                  }}
                  placeholder="Use for BEFORE_INVOICE"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Vendor (Manual Selection)</label>
              <PartySelector 
                value={vendorId}
                disabled={!!purchaseInvoiceId || !!goodsReceiptId}
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
            <div className="md:col-span-2 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                onClick={async () => {
                  if (goodsReceiptId.trim()) {
                    await fetchSourceData({ goodsReceiptId });
                    return;
                  }
                  await openPurchaseInvoicePicker();
                }}
                disabled={busy}
              >
                Fetch Items from Source
              </button>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Purchase Order ID (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Return Date</label>
              <DatePicker 
                value={returnDate}
                onChange={(val) => setReturnDate(val)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Warehouse</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">-- Select Warehouse --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Context</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium">
                {contextLabel}
              </div>
            </div>
          </div>

            <div className="mt-8 border-t border-slate-100 pt-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Return Items</h3>
                <button
                  type="button"
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  onClick={addLine}
                >
                  + Add Item
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50/50 font-semibold text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">Item</th>
                      <th className="px-4 py-3 text-right">Available</th>
                      <th className="px-4 py-3 text-right w-32">Return Qty</th>
                      <th className="px-4 py-3 text-left">UOM</th>
                      <th className="px-4 py-3 text-right">Unit Price</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-center w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {selectedLines.map((line, index) => (
                      <tr key={line.lineId || index} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
                            value={line.itemId}
                            onChange={(e) => handleItemSelect(index, e.target.value)}
                          >
                            <option value="">{sourceDocument ? 'Select item from source...' : 'Search item...'}</option>
                            {sourceDocument ? (
                              sourceDocument.lines.map((sl: any) => (
                                <option key={sl.lineId} value={sl.itemId}>
                                  {sl.itemCode} - {sl.itemName}
                                </option>
                              ))
                            ) : (
                              items.map((it: any) => (
                                <option key={it.id} value={it.id}>
                                  {it.code} - {it.name}
                                </option>
                              ))
                            )}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 italic">
                          {line.availableQty ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            value={line.returnQty}
                            onChange={(e) => handleReturnQtyChange(line.lineId, e.target.value)}
                            min={0}
                            max={line.availableQty}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm uppercase focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={
                              findItemUomOption(uomOptionsByItemId[line.itemId] || [], line.uomId, line.uom)?.uomId ||
                              line.uomId ||
                              line.uom
                            }
                            disabled={!line.itemId}
                            onChange={(e) => handleUomChange(line.lineId, line.itemId, e.target.value)}
                          >
                            <option value="">{line.itemId ? 'Select UOM' : 'No item'}</option>
                            {(uomOptionsByItemId[line.itemId] || []).map((option) => (
                              <option key={option.uomId || option.code} value={option.uomId || option.code}>
                                {option.code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={line.unitCostDoc}
                            onChange={(e) => handleUnitPriceChange(line.lineId, e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900 font-mono">
                          {(line.returnQty * line.unitCostDoc).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                            onClick={() => removeLine(index)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/50 font-bold text-slate-900 border-t border-slate-200">
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-right uppercase tracking-wider text-xs text-slate-500">Subtotal</td>
                      <td className="px-4 py-4 text-right font-mono text-lg">
                        {grandTotalDoc.toFixed(2)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          <div className="mt-8 border-t border-slate-100 pt-8">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Currency & Exchange</h3>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  disabled={busy}
                >
                  <option value="SYP">SYP - Syrian Pound</option>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Exchange Rate</label>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Damaged goods, Incorrect item"
            />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
            <p className="font-semibold mb-1 uppercase tracking-wider text-slate-600">Information</p>
            {selectedLines.length === 0 
              ? "Start by adding items manually or fetch from a source document." 
              : "Items already fetched from source are restricted to source quantities. Manual entries can search from the full catalog."}
          </div>

        </Card>

        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={createDraft}
          disabled={busy}
        >
          {busy ? 'Creating...' : 'Create Draft Return'}
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
                  <h3 className="text-lg font-semibold text-slate-900">Select Purchase Invoice</h3>
                  <p className="text-xs text-slate-500">Latest posted invoices. Choose one to pull lines into this return.</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                  onClick={() => setShowPiPicker(false)}
                  disabled={piPickerLoading}
                >
                  Close
                </button>
              </div>

              <div className="max-h-[60vh] overflow-auto p-4">
                {piPickerError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {piPickerError}
                  </div>
                )}

                {piPickerLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Loading purchase invoices...
                  </div>
                ) : piOptions.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No posted purchase invoices found.
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Pick</th>
                        <th className="px-3 py-2 text-left">Invoice No</th>
                        <th className="px-3 py-2 text-left">Vendor</th>
                        <th className="px-3 py-2 text-left">Invoice Date</th>
                        <th className="px-3 py-2 text-left">Currency</th>
                        <th className="px-3 py-2 text-right">Grand Total</th>
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
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={handlePullSelectedPI}
                  disabled={piPickerLoading || !selectedPiId}
                >
                  Pull Selected Invoice
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Return</h1>
        <Card className="p-6 text-sm text-red-700">Purchase return not found.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {purchaseReturn.returnNumber}
            {isEditMode && <span className="ml-2 text-base font-normal text-indigo-600">(Editing)</span>}
          </h1>
          <p className="text-sm text-slate-600">
            Vendor: <span className="font-medium">{purchaseReturn.vendorName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {purchaseReturn.returnContext}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            purchaseReturn.status === 'POSTED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
          }`}>{purchaseReturn.status}</span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Return Date</div>
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
            <div className="text-xs uppercase tracking-wide text-slate-500">Warehouse</div>
            {isEditMode ? (
              <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white" value={editWarehouseId} onChange={(e) => setEditWarehouseId(e.target.value)}>
                <option value="">-- Select --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            ) : (
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.warehouseId}</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Reason</div>
            {isEditMode ? (
              <input type="text" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            ) : (
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.reason}</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Currency</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.currency}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Exchange Rate</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.exchangeRate.toFixed(4)}</div>
          </div>
          {isEditMode && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Notes</div>
              <textarea rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
          )}
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
                <th className="py-2 text-right">Line Total</th>
                {isEditMode && <th className="py-2 w-12" />}
              </tr>
            </thead>
            <tbody>
              {isEditMode ? (
                editLines.map((line, idx) => (
                  <tr key={line.lineId || idx} className="border-b border-slate-100">
                    <td className="py-2">
                      <span className="text-xs text-slate-500">{line.itemCode}</span>{' '}
                      <span className="font-medium">{line.itemName}</span>
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                        value={line.returnQty}
                        min={0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditLines(prev => prev.map((l, i) => i === idx ? { ...l, returnQty: val } : l));
                        }}
                      />
                    </td>
                    <td className="py-2">
                      <select
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm uppercase"
                        value={
                          findItemUomOption(uomOptionsByItemId[line.itemId] || [], line.uomId, line.uom)?.uomId ||
                          line.uomId ||
                          line.uom
                        }
                        disabled={!line.itemId}
                        onChange={(e) => {
                          const selected = (uomOptionsByItemId[line.itemId] || []).find(
                            (option) => (option.uomId || option.code) === e.target.value
                          );
                          setEditLines((prev) =>
                            prev.map((entry, i) =>
                              i === idx ? { ...entry, uomId: selected?.uomId, uom: selected?.code || '' } : entry
                            )
                          );
                        }}
                      >
                        <option value="">{line.itemId ? 'Select UOM' : 'No item'}</option>
                        {(uomOptionsByItemId[line.itemId] || []).map((option) => (
                          <option key={option.uomId || option.code} value={option.uomId || option.code}>
                            {option.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        step="0.01"
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-mono"
                        value={line.unitCostDoc}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditLines(prev => prev.map((l, i) => i === idx ? { ...l, unitCostDoc: val } : l));
                        }}
                      />
                    </td>
                    <td className="py-2 text-right font-mono">{(line.returnQty * line.unitCostDoc).toFixed(2)}</td>
                    <td className="py-2 text-center">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        onClick={() => setEditLines(prev => prev.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                purchaseReturn.lines.map((line) => (
                  <tr key={line.lineId} className="border-b border-slate-100">
                    <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                    <td className="py-2 text-right">{line.returnQty}</td>
                    <td className="py-2">{line.uom}</td>
                    <td className="py-2 text-right">{line.unitCostDoc.toFixed(2)}</td>
                    <td className="py-2 text-right">{(line.returnQty * line.unitCostDoc).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium">
              {purchaseReturn.currency} {isEditMode
                ? editLines.reduce((s, l) => s + l.returnQty * l.unitCostDoc, 0).toFixed(2)
                : purchaseReturn.subtotalDoc.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Tax</span>
            <span className="font-medium">
              {purchaseReturn.currency} {purchaseReturn.taxTotalDoc.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Grand Total</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {purchaseReturn.currency} {isEditMode
                ? editLines.reduce((s, l) => s + l.returnQty * l.unitCostDoc, 0).toFixed(2)
                : purchaseReturn.grandTotalDoc.toFixed(2)}
            </span>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          onClick={() => isEditMode ? cancelEditMode() : navigate('/purchases/returns')}
        >
          {isEditMode ? 'Cancel Edit' : 'Back to List'}
        </button>
        {isEditMode ? (
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={saveEdit}
            disabled={busy}
          >
            {busy ? 'Saving...' : 'Save Changes'}
          </button>
        ) : (
          <>
            {purchaseReturn.status === 'DRAFT' && (
              <>
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={postDraft}
                  disabled={busy}
                >
                  {busy ? 'Posting...' : 'Post Return'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                  onClick={enterEditMode}
                  disabled={busy}
                >
                  Edit Return
                </button>
              </>
            )}
            {purchaseReturn.status === 'POSTED' && (
              <button
                type="button"
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                onClick={unpostReturn}
                disabled={busy}
              >
                {busy ? 'Unposting...' : 'Unpost Return'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PurchaseReturnDetailPage;
