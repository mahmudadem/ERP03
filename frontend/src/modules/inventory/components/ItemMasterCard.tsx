
import React, { useState, useEffect } from 'react';
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
import { inventoryApi, InventoryItemDTO, InventoryCategoryDTO } from '../../../api/inventoryApi';
import { sharedApi, TaxCodeDTO } from '../../../api/sharedApi';
import { accountingApi } from '../../../api/accountingApi';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { clsx } from 'clsx';
import { MasterCardLayout, FormSection, Field, MasterCardTab } from '../../../components/layout/MasterCardLayout';
import { generateNextCode, CODE_PATTERNS } from '../../../utils/codeGenerator';

interface ItemMasterCardProps {
  itemId?: string;
  isWindow?: boolean;
  onClose?: () => void;
  onSaved?: (item: InventoryItemDTO) => void;
}

const ITEM_TABS: MasterCardTab[] = [
  { id: 'GENERAL', label: 'General Info', icon: FileText },
  { id: 'PRICING', label: 'Pricing & Costs', icon: DollarSign },
  { id: 'DIMENSIONS', label: 'Size & Weight', icon: Maximize2 },
  { id: 'INVENTORY', label: 'Stock Control', icon: Warehouse },
  { id: 'ACCOUNTING', label: 'Accounting GL', icon: ShieldCheck },
];

const ItemMasterCard: React.FC<ItemMasterCardProps> = ({ 
  itemId, 
  isWindow = false, 
  onClose, 
  onSaved 
}) => {
  const { hasPermission } = useRBAC();
  const [activeTab, setActiveTab] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<InventoryCategoryDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);

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

  useEffect(() => {
    loadCategories();
    loadTaxCodes();
    loadCurrencies();
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

  const loadItem = async (id: string) => {
    try {
      setLoading(true);
      const result = await inventoryApi.getItem(id);
      const data = (result as any).data || result;
      setItem({
        ...data,
        metadata: {
            dimensions: { weightUom: 'kg', dimensionUom: 'cm', ...(data.metadata?.dimensions || {}) },
            prices: { groups: data.metadata?.prices?.groups || [{ name: 'Retail', price: 0 }] }
        }
      });
    } catch (err) { setError('Failed to load item'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = isNew 
        ? await inventoryApi.createItem(item as any)
        : await inventoryApi.updateItem(itemId!, item as any);
      onSaved?.(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

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

  if (loading) return <div className="p-20 text-center opacity-50">Loading Item Master...</div>;

  return (
    <MasterCardLayout
      title={item.name || 'Item'}
      subtitle={isNew ? 'New Inventory Record' : `Inventory Item • ${item.type}`}
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
    >
      {activeTab === 'GENERAL' && (
        <div className="space-y-6">
          <FormSection title="Identity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Code" required>
                 <div className="relative flex items-center gap-1 group">
                    <input 
                        disabled={!isNew}
                        className="form-control font-bold pr-10" 
                        value={item.code} 
                        onChange={e => setItem(p => ({ ...p, code: e.target.value.toUpperCase() }))} 
                        placeholder="e.g. ITM-0001"
                    />
                    {isNew && (
                        <button 
                            type="button" 
                            onClick={handleAutoGenerateCode}
                            className="absolute right-2 p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded transition-all opacity-0 group-hover:opacity-100"
                            title="Auto-sequence Item Code"
                        >
                            <Sparkles size={14} />
                        </button>
                    )}
                 </div>
              </Field>
              <Field label="Barcode">
                <div className="flex items-center gap-2">
                   <div className="w-9 h-9 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700 flex-shrink-0">
                      <Barcode size={16} />
                   </div>
                   <input className="form-control" value={item.barcode || ''} onChange={e => setItem(p => ({ ...p, barcode: e.target.value }))} />
                </div>
              </Field>
              <div className="col-span-2"><Field label="Name" required><input className="form-control font-medium" value={item.name} onChange={e => setItem(p => ({ ...p, name: e.target.value }))} /></Field></div>
            </div>
          </FormSection>
          <FormSection title="Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category"><select className="form-control" value={item.categoryId} onChange={e => setItem(p => ({ ...p, categoryId: e.target.value }))}><option value="">None</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Type"><select className="form-control" value={item.type} onChange={e => setItem(p => ({ ...p, type: e.target.value as any }))}><option value="PRODUCT">PRODUCT</option><option value="SERVICE">SERVICE</option></select></Field>
            </div>
          </FormSection>
        </div>
      )}

      {activeTab === 'PRICING' && (
        <div className="space-y-6">
          <FormSection title="Price Groups">
            <div className="rounded border font-mono">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b">
                  <tr><th className="px-4 py-2">Group</th><th className="px-4 py-2 text-right">Price</th><th className="w-8"></th></tr>
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
              <button onClick={() => updateMetadata('prices.groups', [...(item.metadata?.prices?.groups || []), { name: '', price: 0 }])} className="w-full py-2 text-[10px] font-bold text-blue-600 border-t flex justify-center items-center gap-1"><Plus size={10} /> ADD GROUP</button>
            </div>
          </FormSection>

          <FormSection title="Currency & Valuation">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Pricing Currency">
                   <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 flex-shrink-0">
                         <Coins size={16} />
                      </div>
                      <select 
                        className="form-control font-bold text-emerald-700 dark:text-emerald-400" 
                        value={item.costCurrency || ''} 
                        onChange={e => setItem(p => ({ ...p, costCurrency: e.target.value }))}
                      >
                        <option value="">(Select Currency)</option>
                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                </Field>
                <div className="flex items-center text-[10px] text-slate-400 italic pt-6 px-1 uppercase tracking-tighter">
                   This currency acts as the base for all price groups defined above.
                </div>
             </div>
          </FormSection>
        </div>
      )}

      {activeTab === 'DIMENSIONS' && (
        <div className="space-y-6">
           <FormSection title="Physical Data">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Net Weight"><input type="number" className="form-control" value={item.metadata?.dimensions?.netWeight} onChange={e => updateMetadata('dimensions.netWeight', parseFloat(e.target.value))} /></Field>
                <Field label="Length"><input type="number" className="form-control" value={item.metadata?.dimensions?.length} onChange={e => updateMetadata('dimensions.length', parseFloat(e.target.value))} /></Field>
              </div>
           </FormSection>
        </div>
      )}

      {activeTab === 'INVENTORY' && (
        <div className="space-y-6">
           <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border">
              <Layers size={18} className="text-blue-500" />
              <div className="flex-1 text-sm font-bold">Inventory Tracking</div>
              <button onClick={() => setItem(p => ({ ...p, trackInventory: !p.trackInventory }))} className={clsx("px-4 py-1.5 rounded-full text-[10px] font-black", item.trackInventory ? "bg-blue-600 text-white" : "bg-slate-200")}>{item.trackInventory ? 'ON' : 'OFF'}</button>
           </div>
        </div>
      )}

      {activeTab === 'ACCOUNTING' && (
        <div className="space-y-6">
           <FormSection title="GL Mapping">
              <div className="space-y-4 pt-2">
                <Field label="Revenue Account"><AccountSelector value={item.revenueAccountId} onChange={(a: any) => setItem(p => ({ ...p, revenueAccountId: a?.id }))} /></Field>
                <Field label="COGS Account"><AccountSelector value={item.cogsAccountId} onChange={(a: any) => setItem(p => ({ ...p, cogsAccountId: a?.id }))} /></Field>
              </div>
           </FormSection>
        </div>
      )}

      <style>{`
        .form-control { width: 100%; border-radius: 0.375rem; border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; font-size: 0.75rem; outline: none; transition: all 0.2s; }
        .form-control:focus { border-color: #2563eb; ring: 2px solid #2563eb; }
        .dark .form-control { background: #0f172a; border-color: #334155; color: #f1f5f9; }
      `}</style>
    </MasterCardLayout>
  );
};

export default ItemMasterCard;
