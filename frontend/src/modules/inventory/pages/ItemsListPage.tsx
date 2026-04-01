import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { inventoryApi, InventoryItemDTO } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const ItemsListPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const pageSize = 25;
  const [newItem, setNewItem] = useState<{
    code: string;
    name: string;
    type: InventoryItemDTO['type'];
    baseUom: string;
    costCurrency: string;
  }>({
    code: '',
    name: '',
    type: 'PRODUCT',
    baseUom: 'pcs',
    costCurrency: 'USD',
  });

  const loadItems = async (targetPage = 0) => {
    try {
      setLoading(true);
      const result = search
        ? await inventoryApi.searchItems(search, pageSize, targetPage * pageSize)
        : await inventoryApi.listItems({ type: type || undefined, limit: pageSize, offset: targetPage * pageSize });
      const rows = unwrap<InventoryItemDTO[]>(result) || [];
      setItems(rows);
      setHasNext(rows.length === pageSize);
      setPage(targetPage);
    } catch (error) {
      console.error('Failed to load inventory items', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(0);
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createItem({
        ...newItem,
        trackInventory: true,
      });
      setNewItem({ code: '', name: '', type: 'PRODUCT', baseUom: 'pcs', costCurrency: 'USD' });
      await loadItems(0);
    } catch (error) {
      console.error('Failed to create item', error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {t('modulePlaceholders.inventory.itemsTitle', { defaultValue: 'Inventory Items' })}
      </h1>

      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-6" onSubmit={handleCreate}>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Code"
            value={newItem.code}
            onChange={(e) => setNewItem((prev) => ({ ...prev, code: e.target.value }))}
            required
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Name"
            value={newItem.name}
            onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={newItem.type}
            onChange={(e) => setNewItem((prev) => ({ ...prev, type: e.target.value as InventoryItemDTO['type'] }))}
          >
            <option value="PRODUCT">PRODUCT</option>
            <option value="RAW_MATERIAL">RAW_MATERIAL</option>
            <option value="SERVICE">SERVICE</option>
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Cost Currency"
            value={newItem.costCurrency}
            onChange={(e) => setNewItem((prev) => ({ ...prev, costCurrency: e.target.value.toUpperCase() }))}
          />
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">
            Add Item
          </button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-64"
            placeholder="Search code/name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="rounded bg-slate-700 px-3 py-2 text-sm text-white" onClick={() => loadItems(0)} type="button">
            Search
          </button>
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="PRODUCT">PRODUCT</option>
            <option value="RAW_MATERIAL">RAW_MATERIAL</option>
            <option value="SERVICE">SERVICE</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Code</th>
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Type</th>
                <th className="py-2 text-left">Base UoM</th>
                <th className="py-2 text-left">Cost CCY</th>
                <th className="py-2 text-left">Cost Method</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2">
                    <Link className="text-blue-600 hover:underline" to={`/inventory/items/${item.id}`}>
                      {item.code}
                    </Link>
                  </td>
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.type}</td>
                  <td className="py-2">{item.baseUom}</td>
                  <td className="py-2">{item.costCurrency}</td>
                  <td className="py-2">{item.costingMethod}</td>
                  <td className="py-2">{item.active ? 'ACTIVE' : 'INACTIVE'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="mt-3 text-sm text-slate-500">Loading...</p>}
          <div className="mt-4 flex items-center gap-2">
            <button
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
              disabled={page === 0 || loading}
              onClick={() => loadItems(page - 1)}
              type="button"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">Page {page + 1}</span>
            <button
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
              disabled={!hasNext || loading}
              onClick={() => loadItems(page + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ItemsListPage;
