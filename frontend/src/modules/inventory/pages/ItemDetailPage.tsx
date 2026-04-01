import React, { useEffect, useMemo, useState } from 'react';
import client from '../../../api/client';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { inventoryApi, InventoryItemDTO, InventoryCategoryDTO } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type ItemTab = 'GENERAL' | 'COST' | 'ACCOUNTING' | 'STOCK';

const tabs: Array<{ id: ItemTab; label: string }> = [
  { id: 'GENERAL', label: 'General' },
  { id: 'COST', label: 'Cost' },
  { id: 'ACCOUNTING', label: 'Accounting' },
  { id: 'STOCK', label: 'Stock' },
];

const ItemDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<InventoryItemDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ItemTab>('GENERAL');
  const [categories, setCategories] = useState<InventoryCategoryDTO[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const [tagsText, setTagsText] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const cats = await inventoryApi.listCategories();
        setCategories(unwrap<InventoryCategoryDTO[]>(cats));
      } catch (e) {
        console.error('Failed to load categories', e);
      }
      try {
        const curResult = await client.get('/tenant/accounting/company/currencies');
        const curList: any[] = curResult?.data ?? curResult ?? [];
        setCurrencies(curList.map((c: any) => ({ code: c.code, name: c.name ?? c.code })));
      } catch (e) {
        console.error('Failed to load currencies', e);
      }
      if (!id) return;
      try {
        const result = await inventoryApi.getItem(id);
        const current = unwrap<InventoryItemDTO | null>(result);
        setItem(current);
        setTagsText((current?.tags || []).join(', '));
      } catch (error) {
        console.error('Failed to load item', error);
      }
    };
    load();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !item) return;
    try {
      setSaving(true);
      const payload: Partial<InventoryItemDTO> = {
        ...item,
        tags: tagsText
          .split(',')
          .map((token) => token.trim())
          .filter(Boolean),
      };
      const updated = await inventoryApi.updateItem(id, payload);
      setItem(unwrap<InventoryItemDTO>(updated));
    } catch (error) {
      console.error('Failed to update item', error);
    } finally {
      setSaving(false);
    }
  };

  const tabClass = useMemo(
    () => (tabId: ItemTab) =>
      `rounded px-3 py-2 text-sm ${activeTab === tabId ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`,
    [activeTab]
  );

  if (!item) {
    return <div className="p-4 text-sm text-slate-600">Loading item...</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Item Detail</h1>
        <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => navigate('/inventory/items')} type="button">
          Back to List
        </button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab.id} className={tabClass(tab.id)} onClick={() => setActiveTab(tab.id)} type="button">
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSave}>
          {activeTab === 'GENERAL' && (
            <>
              <label className="text-sm">
                <div className="mb-1 font-medium">Code</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.code}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, code: e.target.value } : prev))}
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Name</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.name}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Type</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.type}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, type: e.target.value as InventoryItemDTO['type'] } : prev))}
                >
                  <option value="PRODUCT">PRODUCT</option>
                  <option value="RAW_MATERIAL">RAW_MATERIAL</option>
                  <option value="SERVICE">SERVICE</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Category</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.categoryId || ''}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, categoryId: e.target.value || undefined } : prev))}
                >
                  <option value="">— No Category —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Brand</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.brand || ''}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">Description</div>
                <textarea
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  rows={4}
                  value={item.description || ''}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">Tags (comma separated)</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                />
              </label>
            </>
          )}

          {activeTab === 'COST' && (
            <>
              <label className="text-sm">
                <div className="mb-1 font-medium">Cost Currency</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.costCurrency}
                  disabled={currencies.length === 0}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, costCurrency: e.target.value } : prev))}
                >
                  <option value="">— Select Currency —</option>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
                {currencies.length === 0 && (
                  <p className="mt-1 text-xs text-red-500">Could not load company currencies. Enable currencies in Accounting → Settings first.</p>
                )}
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Costing Method</div>
                <input className="w-full rounded border border-slate-300 px-3 py-2" value={item.costingMethod} disabled />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Base UoM</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.baseUom}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, baseUom: e.target.value } : prev))}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Purchase UoM</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.purchaseUom || ''}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, purchaseUom: e.target.value } : prev))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">Sales UoM</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.salesUom || ''}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, salesUom: e.target.value } : prev))}
                />
              </label>
            </>
          )}

          {activeTab === 'ACCOUNTING' && (
            <>
              <label className="text-sm">
                <div className="mb-1 font-medium">Revenue Account</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.revenueAccountId || ''}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, revenueAccountId: e.target.value } : prev))}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">COGS Account</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.cogsAccountId || ''}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, cogsAccountId: e.target.value } : prev))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">Inventory Asset Account</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={item.inventoryAssetAccountId || ''}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, inventoryAssetAccountId: e.target.value } : prev))}
                />
              </label>
            </>
          )}

          {activeTab === 'STOCK' && (
            <>
              <label className="text-sm">
                <div className="mb-1 font-medium">Track Inventory</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={String(item.trackInventory)}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, trackInventory: e.target.value === 'true' } : prev))}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Active</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={String(item.active)}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, active: e.target.value === 'true' } : prev))}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Min Stock Level</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  type="number"
                  value={item.minStockLevel ?? 0}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, minStockLevel: Number(e.target.value) } : prev))}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Max Stock Level</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  type="number"
                  value={item.maxStockLevel ?? 0}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, maxStockLevel: Number(e.target.value) } : prev))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">Reorder Point</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  type="number"
                  value={item.reorderPoint ?? 0}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, reorderPoint: Number(e.target.value) } : prev))}
                />
              </label>
            </>
          )}

          <div className="md:col-span-2">
            <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white" disabled={saving} type="submit">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ItemDetailPage;
