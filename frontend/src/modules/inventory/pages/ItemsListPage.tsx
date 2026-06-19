import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { inventoryApi, InventoryItemDTO } from '../../../api/inventoryApi';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { Package, Plus, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const ItemsListPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const { uiMode } = useUserPreferences();
  const { openWindow } = useWindowManager();
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const itemsBasePath = pathname.startsWith('/sales/')
    ? '/sales/items'
    : pathname.startsWith('/purchases/')
      ? '/purchases/items'
      : '/inventory/items';

  const loadItems = async (targetPage = 0) => {
    try {
      setLoading(true);
      setError(null);
      const result = search
        ? await inventoryApi.searchItems(search, pageSize, targetPage * pageSize)
        : await inventoryApi.listItems({ type: type || undefined, limit: pageSize, offset: targetPage * pageSize });
      const rows = unwrap<InventoryItemDTO[]>(result) || [];
      setItems(rows);
      setHasNext(rows.length === pageSize);
      setPage(targetPage);
    } catch (err: any) {
      console.error('Failed to load inventory items', err);
      const message = err?.response?.data?.error?.message || err?.message || t('inventory.itemsList.messages.loadFailed');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Items load only when the user clicks Search or adds a new item.
  React.useEffect(() => {
    if (state?.masterDataRefreshToken) {
      void loadItems(0);
    }
  }, [state?.masterDataRefreshToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createItem({
        ...newItem,
        trackInventory: true,
      });
      setNewItem({ code: '', name: '', type: 'PRODUCT', baseUom: 'pcs', costCurrency: 'USD' });
      await loadItems(0);
      toast.success(t('inventory.itemsList.messages.created'));
    } catch (err: any) {
      console.error('Failed to create item', err);
      toast.error(err?.response?.data?.error?.message || err?.message || t('inventory.itemsList.messages.createFailed'));
    }
  };

  const openItem = (item: Pick<InventoryItemDTO, 'id' | 'name'>) => {
    if (uiMode === 'windows') {
      openWindow({
        type: 'item',
        title: item.name,
        data: { itemId: item.id },
        size: { width: 900, height: 700 }
      });
    } else {
      navigate(`${itemsBasePath}/${item.id}`);
    }
  };

  const openNewItem = () => {
    if (uiMode === 'windows') {
      openWindow({
        type: 'item',
        title: t('inventory.itemsList.newWindowTitle'),
        data: { itemId: 'new', onSaved: () => loadItems(0) },
        size: { width: 900, height: 700 }
      });
    } else {
      navigate(`${itemsBasePath}/new`);
    }
  };

  const hasActiveFilters = !!search || !!type;

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title={t('inventory.itemsList.title')}
        subtitle={t('inventory.itemsList.subtitle')}
        action={
          <button
            type="button"
            onClick={openNewItem}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            <Plus size={16} aria-hidden="true" />
            {t('inventory.itemsList.new')}
          </button>
        }
      />

      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">{t('inventory.itemsList.quickAdd')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('inventory.itemsList.quickAddHelp')}</p>
        </div>
        <form className="grid gap-3 md:grid-cols-6" onSubmit={handleCreate}>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={t('inventory.itemsList.fields.code')}
            value={newItem.code}
            onChange={(e) => setNewItem((prev) => ({ ...prev, code: e.target.value }))}
            required
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            placeholder={t('inventory.itemsList.fields.name')}
            value={newItem.name}
            onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={newItem.type}
            onChange={(e) => setNewItem((prev) => ({ ...prev, type: e.target.value as InventoryItemDTO['type'] }))}
          >
            <option value="PRODUCT">{t('inventory.itemsList.typeOptions.PRODUCT')}</option>
            <option value="RAW_MATERIAL">{t('inventory.itemsList.typeOptions.RAW_MATERIAL')}</option>
            <option value="SERVICE">{t('inventory.itemsList.typeOptions.SERVICE')}</option>
          </select>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={t('inventory.itemsList.fields.costCurrency')}
            value={newItem.costCurrency}
            onChange={(e) => setNewItem((prev) => ({ ...prev, costCurrency: e.target.value.toUpperCase() }))}
          />
          <button className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700" type="submit">
            {t('inventory.itemsList.add')}
          </button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-4 grid gap-3 lg:grid-cols-[2fr_1fr_auto_auto]">
          <label className="relative">
            <span className="sr-only">{t('inventory.itemsList.search')}</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
            <input
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm"
              placeholder={t('inventory.itemsList.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void loadItems(0);
                }
              }}
            />
          </label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">{t('inventory.itemsList.allTypes')}</option>
            <option value="PRODUCT">{t('inventory.itemsList.typeOptions.PRODUCT')}</option>
            <option value="RAW_MATERIAL">{t('inventory.itemsList.typeOptions.RAW_MATERIAL')}</option>
            <option value="SERVICE">{t('inventory.itemsList.typeOptions.SERVICE')}</option>
          </select>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
            onClick={() => loadItems(0)}
            type="button"
            disabled={loading}
          >
            <Search size={16} aria-hidden="true" />
            {t('actions.search')}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            onClick={() => loadItems(page)}
            type="button"
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
            {t('actions.refresh')}
          </button>
          {hasActiveFilters && (
            <button
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              onClick={() => {
                setSearch('');
                setType('');
              }}
              type="button"
            >
              {t('actions.clear')}
            </button>
          )}
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">{t('inventory.itemsList.columns.code')}</th>
                <th className="py-2 text-left">{t('inventory.itemsList.columns.name')}</th>
                <th className="py-2 text-left">{t('inventory.itemsList.columns.type')}</th>
                <th className="py-2 text-left">{t('inventory.itemsList.columns.baseUom')}</th>
                <th className="py-2 text-left">{t('inventory.itemsList.columns.costCurrency')}</th>
                <th className="py-2 text-left">{t('inventory.itemsList.columns.costMethod')}</th>
                <th className="py-2 text-left">{t('inventory.itemsList.columns.status')}</th>
                <th className="py-2 text-right">{t('inventory.itemsList.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-8">
                    <EmptyState
                      icon={<Package size={36} aria-hidden="true" />}
                      title={t('inventory.itemsList.emptyTitle')}
                      description={t('inventory.itemsList.emptyDescription')}
                    />
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2">
                    <button 
                        onClick={() => openItem(item)}
                        className="font-mono text-blue-600 hover:underline text-left"
                    >
                        {item.code}
                    </button>
                  </td>
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.type}</td>
                  <td className="py-2">{item.baseUom}</td>
                  <td className="py-2">{item.costCurrency}</td>
                  <td className="py-2">{item.costingMethod}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ${item.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
                      {item.active ? t('inventory.itemsList.status.active') : t('inventory.itemsList.status.inactive')}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                      onClick={() => openItem(item)}
                    >
                      {t('actions.open')}
                    </button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    {t('inventory.itemsList.loading')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
              disabled={page === 0 || loading}
              onClick={() => loadItems(page - 1)}
              type="button"
            >
              {t('actions.previous')}
            </button>
            <span className="text-sm text-slate-600">{t('inventory.itemsList.page', { page: page + 1 })}</span>
            <button
              className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
              disabled={!hasNext || loading}
              onClick={() => loadItems(page + 1)}
              type="button"
            >
              {t('actions.next')}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ItemsListPage;
