
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Package, 
  DollarSign, 
  Maximize2, 
  ShieldCheck, 
  FileText, 
  Barcode,
  Image as ImageIcon,
  Warehouse,
  Trash2,
  Plus,
  Layers,
  Sparkles,
  Coins
} from 'lucide-react';
import {
  inventoryApi,
  InventoryCategoryDTO,
  InventoryCostPointDTO,
  InventoryItemDTO,
  InventoryUomDTO,
  UomConversionDTO,
  UomConversionImpactReportDTO,
} from '../../../api/inventoryApi';
import client from '../../../api/client';
import { sharedApi, TaxCodeDTO } from '../../../api/sharedApi';
import { accountingApi } from '../../../api/accountingApi';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { clsx } from 'clsx';
import { MasterCardLayout, FormSection, Field, MasterCardTab } from '../../../components/layout/MasterCardLayout';
import { generateNextCode, CODE_PATTERNS } from '../../../utils/codeGenerator';
import { useConfirm } from '../../../hooks/useConfirm';
import { useTranslation } from 'react-i18next';

interface ItemMasterCardProps {
  itemId?: string;
  isWindow?: boolean;
  onClose?: () => void;
  onSaved?: (item: InventoryItemDTO) => void;
}

// ITEM_TABS will be defined inside the component to use the translation hook.

const ItemMasterCard: React.FC<ItemMasterCardProps> = ({ 
  itemId, 
  isWindow = false, 
  onClose, 
  onSaved 
}) => {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useRBAC();
  const { confirm, confirmDialog } = useConfirm();
  const [activeTab, setActiveTab] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<InventoryCategoryDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [uoms, setUoms] = useState<InventoryUomDTO[]>([]);
  const [conversions, setConversions] = useState<UomConversionDTO[]>([]);
  const [conversionDraft, setConversionDraft] = useState<{ fromUomId?: string; toUomId?: string; factor: number }>({ factor: 1 });
  const [conversionFactorDrafts, setConversionFactorDrafts] = useState<Record<string, number>>({});
  const [conversionImpactById, setConversionImpactById] = useState<Record<string, UomConversionImpactReportDTO | undefined>>({});
  const [analyzingConversionId, setAnalyzingConversionId] = useState<string | null>(null);
  const [applyingConversionId, setApplyingConversionId] = useState<string | null>(null);

  const [item, setItem] = useState<Partial<InventoryItemDTO>>({
    code: '',
    name: '',
    type: 'PRODUCT',
    baseUom: 'pcs',
    costCurrency: 'USD',
    trackInventory: true,
    active: true,
    metadata: {
      dimensions: { weightUom: 'kg', dimensionUom: 'cm' },
      prices: { groups: [{ name: 'Retail', price: 0 }] }
    }
  });

  const isNew = !itemId || itemId === 'new';
  const canEdit = hasPermission('inventory.items.manage');

  const ITEM_TABS: MasterCardTab[] = [
    { id: 'GENERAL', label: t('General Info', 'General Info'), icon: FileText },
    { id: 'PRICING', label: t('Pricing & Costs', 'Pricing & Costs'), icon: DollarSign },
    { id: 'DIMENSIONS', label: t('Size & Weight', 'Size & Weight'), icon: Maximize2 },
    { id: 'INVENTORY', label: t('Stock Control', 'Stock Control'), icon: Warehouse },
    { id: 'ACCOUNTING', label: t('Accounting GL', 'Accounting GL'), icon: ShieldCheck },
  ];
  const itemUomKeys = new Set([
    item.baseUomId, item.baseUom,
    item.purchaseUomId, item.purchaseUom,
    item.salesUomId, item.salesUom,
    ...conversions.flatMap((entry) => [entry.fromUomId, entry.fromUom, entry.toUomId, entry.toUom]),
  ].filter(Boolean).map((value) => String(value).toUpperCase()));
  const itemUomOptions = uoms.filter((uom) =>
    itemUomKeys.has(uom.id.toUpperCase()) || itemUomKeys.has(uom.code.toUpperCase())
  );

  const setUomBarcodes = (uom: InventoryUomDTO, barcodes: string[]) => {
    setItem((current) => {
      const remaining = (current.uomBarcodes || []).filter((entry) =>
        entry.uomId ? entry.uomId !== uom.id : entry.uom.toUpperCase() !== uom.code.toUpperCase()
      );
      return {
        ...current,
        uomBarcodes: barcodes.length
          ? [...remaining, { uomId: uom.id, uom: uom.code, barcodes }]
          : remaining,
      };
    });
  };

  useEffect(() => {
    loadCategories();
    loadTaxCodes();
    loadCurrencies();
    loadUoms();
    if (!isNew && itemId) loadItem(itemId);
  }, [itemId]);

  const loadCurrencies = async () => {
    try {
      const res = await accountingApi.getCompanyCurrencies();
      setCurrencies((res?.currencies || []).filter(c => c.isEnabled).map(c => c.currencyCode));
    } catch (err) { console.error(err); }
  };

  const loadCategories = async () => {
    try { setCategories(await inventoryApi.listCategories()); } 
    catch (err) { console.error(err); }
  };

  const loadTaxCodes = async () => {
    try { setTaxCodes(await sharedApi.listTaxCodes() || []); } 
    catch (err) { console.error(err); }
  };

  const loadUoms = async () => {
    try {
      const result = await inventoryApi.listUoms({ active: true, limit: 500 });
      setUoms((result as any).data || result || []);
    } catch (err) {
      console.error(err);
    }
  };

  const applyConversionState = (entries: UomConversionDTO[]) => {
    setConversions(entries);
    setConversionFactorDrafts((current) => {
      const next: Record<string, number> = {};
      entries.forEach((entry) => {
        next[entry.id] = current[entry.id] ?? entry.factor;
      });
      return next;
    });
    setConversionImpactById({});
  };

  const loadConversions = async (targetItemId: string) => {
    const result = await inventoryApi.listUomConversions(targetItemId);
    const list = ((result as any).data || result || []) as UomConversionDTO[];
    applyConversionState(list);
  };

  const loadItem = async (id: string) => {
    try {
      setLoading(true);
      const itemsBasePath = window.location.pathname.startsWith('/sales/') ? '/sales/items' :
                            window.location.pathname.startsWith('/purchases/') ? '/purchases/items' :
                            window.location.pathname.startsWith('/pos/') ? '/pos/items' :
                            '/inventory/items';
      const result = await client.get(`/tenant${itemsBasePath}/${id}`);
      const data = (result as any).data || result;
      setItem({
        ...data,
        metadata: {
            dimensions: { weightUom: 'kg', dimensionUom: 'cm', ...(data.metadata?.dimensions || {}) },
            prices: { groups: data.metadata?.prices?.groups || [{ name: 'Retail', price: 0 }] }
        }
      });
      if (data.id) {
        await loadConversions(data.id);
      }
    } catch (err) { setError('Failed to load item'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const itemsBasePath = window.location.pathname.startsWith('/sales/') ? '/sales/items' :
                            window.location.pathname.startsWith('/purchases/') ? '/purchases/items' :
                            window.location.pathname.startsWith('/pos/') ? '/pos/items' :
                            '/inventory/items';
      const result = isNew 
        ? await client.post(`/tenant${itemsBasePath}`, item)
        : await client.put(`/tenant${itemsBasePath}/${itemId}`, item);
      const normalized = (result as any).data || result;
      setItem({
        ...normalized,
        metadata: {
          dimensions: { weightUom: 'kg', dimensionUom: 'cm', ...(normalized?.metadata?.dimensions || {}) },
          prices: { groups: normalized?.metadata?.prices?.groups || [{ name: 'Retail', price: 0 }] },
        },
      });
      if (normalized?.id) {
        await loadConversions(normalized.id);
      }
      onSaved?.(normalized);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddConversion = async () => {
    if (!item.id && !itemId) {
      setError('Save the item before adding conversions.');
      return;
    }
    const toUomId = conversionDraft.toUomId || item.baseUomId;
    if (!conversionDraft.fromUomId || !toUomId || !(conversionDraft.factor > 0)) {
      setError('Conversion requires from UOM, to UOM, and a positive factor.');
      return;
    }
    if (findActiveConversionPair(conversionDraft.fromUomId, toUomId)) {
      setError('This From UOM and To UOM conversion already exists. Update the existing row factor instead.');
      return;
    }

    try {
      setError(null);
      const savedItemId = item.id || itemId!;
      await inventoryApi.createUomConversion({
        itemId: savedItemId,
        fromUomId: conversionDraft.fromUomId,
        toUomId,
        factor: conversionDraft.factor,
      });
      await loadConversions(savedItemId);
      setConversionDraft({ factor: 1 });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add conversion');
    }
  };

  const handleDeleteConversion = async (conversion: UomConversionDTO) => {
    try {
      setError(null);
      const result = await inventoryApi.getUomConversionImpact(conversion.id);
      const impact = ((result as any).data || result) as UomConversionImpactReportDTO;
      setConversionImpactById((current) => ({ ...current, [conversion.id]: impact }));

      if (impact.used) {
        const message = 'This conversion is already used in posted stock movements and cannot be deleted.';
        setError(message);
        toast.error(message);
        return;
      }

      const ok = await confirm({
        title: 'Delete unused UOM conversion?',
        message: `Delete ${conversion.fromUom} -> ${conversion.toUom}? No posted movement uses this conversion yet.`,
        confirmLabel: 'Delete conversion',
        cancelLabel: 'Keep conversion',
        tone: 'danger',
      });
      if (!ok) return;

      await inventoryApi.deleteUomConversion(conversion.id);
      const savedItemId = item.id || itemId;
      if (savedItemId) {
        await loadConversions(savedItemId);
      }
      toast.success('Unused UOM conversion deleted.');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to delete conversion';
      setError(message);
      toast.error(message);
    }
  };

  const getDraftFactor = (conversion: UomConversionDTO): number => {
    const value = conversionFactorDrafts[conversion.id];
    return typeof value === 'number' ? value : conversion.factor;
  };

  const setDraftFactor = (conversionId: string, value: number) => {
    setConversionFactorDrafts((current) => ({ ...current, [conversionId]: value }));
  };

  const handleAnalyzeConversion = async (conversion: UomConversionDTO) => {
    const proposedFactor = getDraftFactor(conversion);
    if (!(proposedFactor > 0)) {
      setError('New factor must be a positive number.');
      return;
    }

    try {
      setError(null);
      setAnalyzingConversionId(conversion.id);
      const result = await inventoryApi.getUomConversionImpact(conversion.id, proposedFactor);
      const report = ((result as any).data || result) as UomConversionImpactReportDTO;
      setConversionImpactById((current) => ({ ...current, [conversion.id]: report }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to analyze conversion impact');
    } finally {
      setAnalyzingConversionId(null);
    }
  };

  const handleApplyConversionCorrection = async (conversion: UomConversionDTO) => {
    const proposedFactor = getDraftFactor(conversion);
    if (!(proposedFactor > 0)) {
      setError('New factor must be a positive number.');
      return;
    }

    const existingImpact = conversionImpactById[conversion.id];
    if (existingImpact?.used) {
      const shouldProceed = await confirm({
        title: 'Adjust UoM conversion?',
        message: 'This conversion has posted usage. The system will add stock adjustment delta movements to apply the new factor without changing invoice/payment values. Continue?',
        confirmLabel: 'Continue',
        tone: 'warning',
      });
      if (!shouldProceed) return;
    }

    try {
      setError(null);
      setApplyingConversionId(conversion.id);
      await inventoryApi.applyUomConversionCorrection(conversion.id, proposedFactor);

      const savedItemId = item.id || itemId;
      if (savedItemId) {
        await loadConversions(savedItemId);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to apply conversion correction');
    } finally {
      setApplyingConversionId(null);
    }
  };

  const findUom = (id?: string) => uoms.find((uom) => uom.id === id);
  const findActiveConversionPair = (fromUomId?: string, toUomId?: string) => (
    conversions.find((conversion) => (
      conversion.active !== false
      && conversion.fromUomId === fromUomId
      && conversion.toUomId === toUomId
    ))
  );
  const draftToUomId = conversionDraft.toUomId || item.baseUomId;
  const duplicateDraftConversion = conversionDraft.fromUomId && draftToUomId
    ? findActiveConversionPair(conversionDraft.fromUomId, draftToUomId)
    : undefined;

  const updateMetadata = (path: string, value: any) => {
    const parts = path.split('.');
    setItem(prev => {
        const meta = { ...prev.metadata };
        let curr = meta;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = value;
        return { ...prev, metadata: meta };
    });
  };

  const handleAutoGenerateCode = async () => {
    try {
      setError(null);
      const items = await inventoryApi.listItems();
      const codes = (items || []).map(i => i.code);
      const nextCode = generateNextCode(codes, CODE_PATTERNS.ITEM);
      setItem(p => ({ ...p, code: nextCode }));
    } catch (err) {
      setError('Could not predict next SKU');
    }
  };

  const formatMoney = (value?: number, currency?: string) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '—';
    const code = currency || 'USD';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${code}`;
    }
  };

  const renderCostPoint = (
    label: string,
    point?: InventoryCostPointDTO
  ) => (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {point ? formatMoney(point.ccy, point.currency) : '—'}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {t('Base', 'Base')}: {point ? formatMoney(point.base, currencies[0] || item.costCurrency || point.currency) : '—'}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">
        {point ? `${point.asOf} • FX ${point.fxRateToBase}` : t('No posted value yet', 'No posted value yet')}
      </div>
    </div>
  );

  if (loading) return <div className="p-20 text-center opacity-50">{t('Loading Item Master...', 'Loading Item Master...')}</div>;

  return (
    <MasterCardLayout
      title={item.name || t('Item', 'Item')}
      subtitle={isNew ? t('New Inventory Record', 'New Inventory Record') : `${t('Inventory Item', 'Inventory Item')} • ${t(item.type || 'PRODUCT', item.type || 'PRODUCT')}`}
      identifier={item.code}
      icon={Package}
      tabs={ITEM_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      isWindow={isWindow}
      isNew={isNew}
      saving={saving}
      canEdit={canEdit}
      onSave={handleSave}
      onClose={onClose}
      updatedAt={item.updatedAt}
      error={error}
      saveNewLabel={t('Save New Item', 'Save New Item')}
      updateLabel={t('Update Item', 'Update Item')}
    >
      {activeTab === 'GENERAL' && (
        <div className="space-y-6">
          <FormSection title={t('Identity', 'Identity')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('Code', 'Code')} required>
                 <div className="relative flex items-center gap-1 group">
                    <input 
                        disabled={!isNew}
                        className="form-control font-bold pr-10" 
                        value={item.code} 
                        onChange={e => setItem(p => ({ ...p, code: e.target.value.toUpperCase() }))} 
                        placeholder={t('e.g. ITM-0001', 'e.g. ITM-0001')}
                    />
                    {isNew && (
                        <button 
                            type="button" 
                            onClick={handleAutoGenerateCode}
                            className="absolute right-2 p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded transition-all opacity-0 group-hover:opacity-100"
                            title={t('Auto-sequence Item Code', 'Auto-sequence Item Code')}
                        >
                            <Sparkles size={14} />
                        </button>
                    )}
                 </div>
              </Field>
              <div className="col-span-1 sm:col-span-2">
                <Field label={t('Primary Barcode', 'Primary Barcode')}>
                  <div className="flex items-center gap-2">
                     <div className="w-9 h-9 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <Barcode size={16} />
                     </div>
                     <input className="form-control" value={item.barcode || ''} onChange={e => setItem(p => ({ ...p, barcode: e.target.value }))} />
                  </div>
                </Field>
              </div>
              <div className="col-span-1 sm:col-span-4">
                <Field label={t('Barcodes by Unit of Measure', 'Barcodes by Unit of Measure')}>
                  <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    {itemUomOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        {t('Save the item and configure its units before assigning unit barcodes.', 'Save the item and configure its units before assigning unit barcodes.')}
                      </p>
                    ) : itemUomOptions.map((uom) => {
                      const assigned = (item.uomBarcodes || []).find((entry) =>
                        entry.uomId ? entry.uomId === uom.id : entry.uom.toUpperCase() === uom.code.toUpperCase()
                      )?.barcodes || [];
                      return (
                        <div key={uom.id} className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {uom.code} · {uom.translations?.[i18n.resolvedLanguage || i18n.language]
                              || uom.translations?.[(i18n.resolvedLanguage || i18n.language).split('-')[0]]
                              || uom.name}
                          </div>
                          <input
                            className="form-control text-sm"
                            value={assigned.join(', ')}
                            onChange={(event) => setUomBarcodes(
                              uom,
                              event.target.value.split(',').map((value) => value.trim()).filter(Boolean)
                            )}
                            placeholder={t('Comma-separated barcodes', 'Comma-separated barcodes')}
                          />
                        </div>
                      );
                    })}
                  </div>
                </Field>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <Field label={t('Secondary Barcodes', 'Secondary Barcodes')}>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(item.barcodes || []).map((code, idx) => (
                        <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-sm">
                          <span>{code}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(item.barcodes || [])];
                              next.splice(idx, 1);
                              setItem(p => ({ ...p, barcodes: next }));
                            }}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        className="form-control text-sm" 
                        placeholder={t('Add secondary barcode...', 'Add secondary barcode...')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val && !(item.barcodes || []).includes(val)) {
                              setItem(p => ({ ...p, barcodes: [...(p.barcodes || []), val] }));
                            }
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <span className="text-xs text-slate-400">{t('Press Enter to add', 'Press Enter to add')}</span>
                    </div>
                  </div>
                </Field>
              </div>
              <div className="col-span-2"><Field label={t('Name', 'Name')} required><input className="form-control font-medium" value={item.name} onChange={e => setItem(p => ({ ...p, name: e.target.value }))} /></Field></div>
            </div>
          </FormSection>
          <FormSection title={t('Details', 'Details')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('Category', 'Category')}><select className="form-control" value={item.categoryId} onChange={e => setItem(p => ({ ...p, categoryId: e.target.value }))}><option value="">{t('None', 'None')}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label={t('Type', 'Type')}><select className="form-control" value={item.type} onChange={e => {
                const type = e.target.value as InventoryItemDTO['type'];
                setItem(p => ({ ...p, type, trackInventory: type === 'SERVICE' ? false : p.trackInventory }));
              }}><option value="PRODUCT">{t('PRODUCT', 'PRODUCT')}</option><option value="SERVICE">{t('SERVICE', 'SERVICE')}</option></select></Field>
            </div>
          </FormSection>
        </div>
      )}

      {activeTab === 'PRICING' && (
        <div className="space-y-6">
          <FormSection title={t('Live Costing Snapshot', 'Live Costing Snapshot')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {renderCostPoint(t('Average Cost', 'Average Cost'), item.costingStats?.avgCost)}
              {renderCostPoint(t('Last Purchase', 'Last Purchase'), item.costingStats?.lastPurchaseCost)}
              {renderCostPoint(t('Last Sale', 'Last Sale'), item.costingStats?.lastSalePrice)}
            </div>
            <p className="mt-2 text-[10px] text-slate-400 italic uppercase tracking-tighter">
              {t('Live values update from posted stock receipts and sales. They do not replace per-warehouse stock-level costs.', 'Live values update from posted stock receipts and sales. They do not replace per-warehouse stock-level costs.')}
            </p>
          </FormSection>

          <FormSection title={t('Default Prices', 'Default Prices')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('Default Sale Price', 'Default Sale Price')}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="form-control text-right"
                  value={item.salePrice ?? ''}
                  onChange={e => setItem(p => ({ ...p, salePrice: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                  placeholder="0.00"
                />
              </Field>
              <Field label={t('Default Purchase Price', 'Default Purchase Price')}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="form-control text-right"
                  value={item.purchasePrice ?? ''}
                  onChange={e => setItem(p => ({ ...p, purchasePrice: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                  placeholder="0.00"
                />
              </Field>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 italic uppercase tracking-tighter">
              {t('Default unit prices in the pricing currency below. Sale price is used as a fallback when no customer price list applies.', 'Default unit prices in the pricing currency below. Sale price is used as a fallback when no customer price list applies.')}
            </p>
          </FormSection>

          <FormSection title={t('Price Groups', 'Price Groups')}>
            <div className="rounded border font-mono">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b">
                  <tr><th className="px-4 py-2">{t('Group', 'Group')}</th><th className="px-4 py-2 text-right">{t('Price', 'Price')}</th><th className="w-8"></th></tr>
                </thead>
                <tbody>
                  {(item.metadata?.prices?.groups || []).map((g: any, i: number) => (
                    <tr key={i} className="border-b last:border-none">
                      <td className="px-2 py-1"><input className="w-full px-2 py-1 bg-transparent" value={g.name} onChange={e => {
                        const next = [...item.metadata?.prices?.groups];
                        next[i].name = e.target.value;
                        updateMetadata('prices.groups', next);
                      }} /></td>
                      <td className="px-2 py-1"><input type="number" className="w-full px-2 py-1 bg-transparent text-right" value={g.price} onChange={e => {
                        const next = [...item.metadata?.prices?.groups];
                        next[i].price = parseFloat(e.target.value);
                        updateMetadata('prices.groups', next);
                      }} /></td>
                      <td className="px-2 text-center"><button onClick={() => {
                        const next = [...item.metadata?.prices?.groups];
                        next.splice(i, 1);
                        updateMetadata('prices.groups', next);
                      }} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => updateMetadata('prices.groups', [...(item.metadata?.prices?.groups || []), { name: '', price: 0 }])} className="w-full py-2 text-[10px] font-bold text-blue-600 border-t flex justify-center items-center gap-1"><Plus size={10} /> {t('ADD GROUP', 'ADD GROUP')}</button>
            </div>
          </FormSection>

          <FormSection title={t('Currency & Valuation', 'Currency & Valuation')}>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('Pricing Currency', 'Pricing Currency')}>
                   <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 flex-shrink-0">
                         <Coins size={16} />
                      </div>
                      <select 
                        className="form-control font-bold text-emerald-700 dark:text-emerald-400" 
                        value={item.costCurrency || ''} 
                        onChange={e => setItem(p => ({ ...p, costCurrency: e.target.value }))}
                      >
                        <option value="">({t('Select Currency', 'Select Currency')})</option>
                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                </Field>
                <div className="flex items-center text-[10px] text-slate-400 italic pt-6 px-1 uppercase tracking-tighter">
                   {t('This currency acts as the base for all price groups defined above.', 'This currency acts as the base for all price groups defined above.')}
                </div>
             </div>
          </FormSection>
        </div>
      )}

      {activeTab === 'DIMENSIONS' && (
        <div className="space-y-6">
           <FormSection title={t('Physical Data', 'Physical Data')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('Net Weight', 'Net Weight')}><input type="number" className="form-control" value={item.metadata?.dimensions?.netWeight} onChange={e => updateMetadata('dimensions.netWeight', parseFloat(e.target.value))} /></Field>
                <Field label={t('Length', 'Length')}><input type="number" className="form-control" value={item.metadata?.dimensions?.length} onChange={e => updateMetadata('dimensions.length', parseFloat(e.target.value))} /></Field>
              </div>
           </FormSection>
        </div>
      )}

      {activeTab === 'INVENTORY' && (
        <div className="space-y-6">
           <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border">
              <Layers size={18} className="text-blue-500" />
              <div className="flex-1">
                <div className="text-sm font-bold">{t('Inventory Tracking', 'Inventory Tracking')}</div>
                {item.type === 'SERVICE' && (
                  <div className="text-[11px] text-slate-500">{t('Service items are non-stock by default.', 'Service items are non-stock by default.')}</div>
                )}
              </div>
              <button
                type="button"
                disabled={item.type === 'SERVICE'}
                onClick={() => setItem(p => ({ ...p, trackInventory: !p.trackInventory }))}
                className={clsx(
                  "px-4 py-1.5 rounded-full text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-60",
                  item.trackInventory && item.type !== 'SERVICE' ? "bg-blue-600 text-white" : "bg-slate-200"
                )}
              >
                {item.trackInventory && item.type !== 'SERVICE' ? t('ON', 'ON') : t('OFF', 'OFF')}
              </button>
           </div>

           <FormSection title={t('Managed UOM Defaults', 'Managed UOM Defaults')}>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <Field label={t('Base UOM', 'Base UOM')} required>
                 <select
                   className="form-control"
                   value={item.baseUomId || ''}
                   onChange={(e) => {
                     const selected = findUom(e.target.value);
                     setItem((current) => ({
                       ...current,
                       baseUomId: selected?.id,
                       baseUom: selected?.code || '',
                     }));
                   }}
                 >
                   <option value="">{t('Select base UOM', 'Select base UOM')}</option>
                   {uoms.map((uom) => (
                     <option key={uom.id} value={uom.id}>{uom.code} - {uom.name}</option>
                   ))}
                 </select>
               </Field>
               <Field label={t('Purchase UOM', 'Purchase UOM')}>
                 <select
                   className="form-control"
                   value={item.purchaseUomId || ''}
                   onChange={(e) => {
                     const selected = findUom(e.target.value);
                     setItem((current) => ({
                       ...current,
                       purchaseUomId: selected?.id,
                       purchaseUom: selected?.code || undefined,
                     }));
                   }}
                 >
                   <option value="">{t('Use base UOM', 'Use base UOM')}</option>
                   {uoms.map((uom) => (
                     <option key={uom.id} value={uom.id}>{uom.code} - {uom.name}</option>
                   ))}
                 </select>
               </Field>
               <Field label={t('Sales UOM', 'Sales UOM')}>
                 <select
                   className="form-control"
                   value={item.salesUomId || ''}
                   onChange={(e) => {
                     const selected = findUom(e.target.value);
                     setItem((current) => ({
                       ...current,
                       salesUomId: selected?.id,
                       salesUom: selected?.code || undefined,
                     }));
                   }}
                 >
                   <option value="">{t('Use base UOM', 'Use base UOM')}</option>
                   {uoms.map((uom) => (
                     <option key={uom.id} value={uom.id}>{uom.code} - {uom.name}</option>
                   ))}
                 </select>
               </Field>
             </div>
             <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
               {t('Need a new unit? Open', 'Need a new unit? Open')} <Link className="font-semibold underline" to="/inventory/uoms">{t('UOM Master', 'UOM Master')}</Link>. {t('Base/Purchase/Sales UOM selection is here; conversion factor setup is in the section below.', 'Base/Purchase/Sales UOM selection is here; conversion factor setup is in the section below.')}
             </div>
           </FormSection>

           <FormSection title={t('Item UOM Conversions', 'Item UOM Conversions')}>
             {isNew ? (
               <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                 {t('Save this item first, then return to Stock Control to define From UOM, To UOM, and conversion factor.', 'Save this item first, then return to Stock Control to define From UOM, To UOM, and conversion factor.')}
               </div>
             ) : (
               <div className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                   <select
                     className="form-control"
                     value={conversionDraft.fromUomId || ''}
                     onChange={(e) => setConversionDraft((current) => ({ ...current, fromUomId: e.target.value || undefined }))}
                   >
                     <option value="">{t('From UOM', 'From UOM')}</option>
                     {uoms.map((uom) => (
                       <option key={uom.id} value={uom.id}>{uom.code}</option>
                     ))}
                   </select>
                   <select
                     className="form-control"
                     value={conversionDraft.toUomId || item.baseUomId || ''}
                     onChange={(e) => setConversionDraft((current) => ({ ...current, toUomId: e.target.value || undefined }))}
                   >
                     <option value="">{t('To UOM', 'To UOM')}</option>
                     {uoms.map((uom) => (
                       <option key={uom.id} value={uom.id}>{uom.code}</option>
                     ))}
                   </select>
                   <input
                     className="form-control"
                     type="number"
                     min={0}
                     step="0.0001"
                     value={conversionDraft.factor}
                     onChange={(e) => setConversionDraft((current) => ({ ...current, factor: Number(e.target.value || 0) }))}
                   />
                   <button type="button" onClick={handleAddConversion} className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white">
                     {t('Add Conversion', 'Add Conversion')}
                   </button>
                 </div>
                 {duplicateDraftConversion && (
                   <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                     {t('This From UOM and To UOM conversion already exists. Update the existing row factor instead.', 'This From UOM and To UOM conversion already exists. Update the existing row factor instead.')}
                   </div>
                 )}

                <div className="rounded border font-mono">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-2">{t('From', 'From')}</th>
                        <th className="px-4 py-2">{t('To', 'To')}</th>
                        <th className="px-4 py-2 text-right">{t('Current Factor', 'Current Factor')}</th>
                        <th className="px-4 py-2 text-right">{t('New Factor', 'New Factor')}</th>
                        <th className="px-4 py-2">{t('Impact', 'Impact')}</th>
                        <th className="w-40" />
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map((conversion) => {
                        const impact = conversionImpactById[conversion.id];
                        const draftFactor = getDraftFactor(conversion);
                        const hasDraftChange = Math.abs(draftFactor - conversion.factor) > 0.0000001;

                        return (
                          <React.Fragment key={conversion.id}>
                            <tr className="border-b last:border-none">
                              <td className="px-4 py-2">{conversion.fromUom}</td>
                              <td className="px-4 py-2">{conversion.toUom}</td>
                              <td className="px-4 py-2 text-right">{conversion.factor}</td>
                              <td className="px-4 py-2">
                                <input
                                  className="form-control text-right"
                                  type="number"
                                  min={0}
                                  step="0.0001"
                                  value={draftFactor}
                                  onChange={(e) => setDraftFactor(conversion.id, Number(e.target.value || 0))}
                                />
                              </td>
                              <td className="px-4 py-2">
                                {impact ? (
                                  <div className="text-[11px] leading-4 text-slate-600">
                                    <div>Usage: {impact.usageCount}</div>
                                    <div>P: {impact.purchaseUsageCount} / S: {impact.salesUsageCount}</div>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400">{t('Not analyzed', 'Not analyzed')}</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    className="rounded border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700 disabled:opacity-50"
                                    disabled={analyzingConversionId === conversion.id}
                                    onClick={() => handleAnalyzeConversion(conversion)}
                                  >
                                    {analyzingConversionId === conversion.id ? t('Analyzing...', 'Analyzing...') : t('Analyze', 'Analyze')}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                                    disabled={!hasDraftChange || applyingConversionId === conversion.id || impact?.used === true}
                                    onClick={() => handleApplyConversionCorrection(conversion)}
                                  >
                                    {applyingConversionId === conversion.id ? t('Applying...', 'Applying...') : t('Apply', 'Apply')}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-slate-300 hover:text-red-500"
                                    onClick={() => handleDeleteConversion(conversion)}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {impact && (
                              <tr className="border-b bg-slate-50/50 last:border-none">
                                <td className="px-4 py-3" colSpan={6}>
                                  <div className="space-y-2 text-[11px]">
                                    {!impact.used && (
                                      <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                                        {t('No posted movement uses this conversion yet. Applying new factor is direct.', 'No posted movement uses this conversion yet. Applying new factor is direct.')}
                                      </div>
                                    )}
                                    {impact.used && (
                                      <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
                                        {t('Correction will be applied as stock delta adjustments. Invoice/payment values stay unchanged.', 'Correction will be applied as stock delta adjustments. Invoice/payment values stay unchanged.')}
                                      </div>
                                    )}
                                    {impact.impactedReferences.length > 0 && (
                                      <div className="overflow-auto rounded border border-slate-200">
                                        <table className="w-full text-[11px] text-left">
                                          <thead className="bg-slate-100">
                                            <tr>
                                              <th className="px-2 py-1">{t('Reference', 'Reference')}</th>
                                              <th className="px-2 py-1">{t('Status', 'Status')}</th>
                                              <th className="px-2 py-1">{t('Movements', 'Movements')}</th>
                                              <th className="px-2 py-1">{t('Module', 'Module')}</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {impact.impactedReferences.map((entry) => (
                                              <tr key={`${entry.referenceType}:${entry.referenceId}`} className="border-t">
                                                <td className="px-2 py-1">{entry.referenceType} / {entry.referenceId}</td>
                                                <td className="px-2 py-1">{entry.status}</td>
                                                <td className="px-2 py-1">{entry.movementCount}</td>
                                                <td className="px-2 py-1">{entry.module}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {conversions.length === 0 && (
                        <tr>
                          <td className="px-4 py-3 text-slate-400" colSpan={6}>{t('No alternate UOM conversions defined', 'No alternate UOM conversions defined')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
               </div>
             )}
           </FormSection>
        </div>
      )}

      {activeTab === 'ACCOUNTING' && (
        <div className="space-y-6">
           <FormSection title={t('GL Mapping', 'GL Mapping')}>
              <div className="space-y-4 pt-2">
                <Field label={t('Revenue Account', 'Revenue Account')}><AccountSelector value={item.revenueAccountId} onChange={(a: any) => setItem(p => ({ ...p, revenueAccountId: a?.id }))} /></Field>
                <Field label={t('COGS Account', 'COGS Account')}><AccountSelector value={item.cogsAccountId} onChange={(a: any) => setItem(p => ({ ...p, cogsAccountId: a?.id }))} /></Field>
              </div>
           </FormSection>
        </div>
      )}

      <style>{`
        .form-control { width: 100%; border-radius: 0.375rem; border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; font-size: 0.75rem; outline: none; transition: all 0.2s; }
        .form-control:focus { border-color: #2563eb; ring: 2px solid #2563eb; }
        .dark .form-control { background: #0f172a; border-color: #334155; color: #f1f5f9; }
      `}</style>
      {confirmDialog}
    </MasterCardLayout>
  );
};

export default ItemMasterCard;
