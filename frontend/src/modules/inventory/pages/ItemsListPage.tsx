import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { inventoryApi, InventoryItemDTO } from '../../../api/inventoryApi';
import client from '../../../api/client';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { useConfirm } from '../../../hooks/useConfirm';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { Package, Plus, Power, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const ItemsListPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const { uiMode } = useUserPreferences();
  const { openWindow } = useWindowManager();
  const { confirm, confirmDialog } = useConfirm();
  const { hasPermission } = useRBAC();
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const pageSize = 25;

  const itemsBasePath = pathname.startsWith('/sales/')
    ? '/sales/items'
    : pathname.startsWith('/purchases/')
      ? '/purchases/items'
      : pathname.startsWith('/pos/')
        ? '/pos/items'
        : '/inventory/items';

  const loadItems = async (targetPage = 0) => {
    try {
      setLoading(true);
      setError(null);
      const params: { type?: string; active?: boolean; limit: number; offset: number } = {
        limit: pageSize,
        offset: targetPage * pageSize,
      };
      if (type) params.type = type;
      if (activeFilter === 'ACTIVE') params.active = true;
      if (activeFilter === 'INACTIVE') params.active = false;
      const result = search
        ? await client.get(`/tenant${itemsBasePath}/search`, { params: { q: search, ...params } })
        : await client.get(`/tenant${itemsBasePath}`, { params });
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

  React.useEffect(() => {
    if (state?.masterDataRefreshToken) {
      void loadItems(0);
    }
  }, [state?.masterDataRefreshToken]);

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

  const handleToggleActive = async (item: InventoryItemDTO) => {
    const requiredPermission = pathname.startsWith('/sales/') ? 'sales.items.manage'
      : pathname.startsWith('/purchases/') ? 'purchase.items.manage'
      : pathname.startsWith('/pos/') ? 'pos.items.manage'
      : 'inventory.items.manage';

    if (!hasPermission(requiredPermission)) {
      toast.error(t('inventory.itemsList.messages.permissionDenied', 'You do not have permission to change item status.'));
      return;
    }
    const nextActive = !item.active;
    const tone = nextActive ? 'info' : 'warning';
    const ok = await confirm({
      title: nextActive
        ? t('inventory.itemsList.activate.title', 'Activate item')
        : t('inventory.itemsList.deactivate.title', 'Deactivate item'),
      message: nextActive
        ? t('inventory.itemsList.activate.message', {
            name: item.name,
            defaultValue: `Activate "${item.name}"? It will become available in pickers, sales, and purchase lines.`,
          })
        : t('inventory.itemsList.deactivate.message', {
            name: item.name,
            defaultValue: `Deactivate "${item.name}"? It will be hidden from pickers and new documents. Stock and posted history are preserved.`,
          }),
      confirmLabel: nextActive
        ? t('inventory.itemsList.activate.confirm', 'Activate')
        : t('inventory.itemsList.deactivate.confirm', 'Deactivate'),
      cancelLabel: t('actions.cancel', 'Cancel'),
      tone,
    });
    if (!ok) return;
    try {
      setPendingToggleId(item.id);
      await client.put(`/tenant${itemsBasePath}/${item.id}`, { active: nextActive });
      toast.success(
        nextActive
          ? t('inventory.itemsList.activated', 'Item activated')
          : t('inventory.itemsList.deactivated', 'Item deactivated')
      );
      await loadItems(page);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || t('inventory.itemsList.messages.toggleFailed', 'Failed to update item status');
      toast.error(message);
    } finally {
      setPendingToggleId(null);
    }
  };

  const hasActiveFilters = !!search || !!type || activeFilter !== 'ALL';

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
        <div className="mb-4 grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto_auto]">
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
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            title={t('inventory.itemsList.statusHelp', 'Active items are selectable in new documents. Inactive items stay in history and stock.')}
          >
            <option value="ALL">{t('inventory.itemsList.statusFilter.all', 'All statuses')}</option>
            <option value="ACTIVE">{t('inventory.itemsList.statusFilter.active', 'Active only')}</option>
            <option value="INACTIVE">{t('inventory.itemsList.statusFilter.inactive', 'Inactive only')}</option>
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
                setActiveFilter('ALL');
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
                      {item.active
                        ? t('inventory.itemsList.status.active', 'Active')
                        : t('inventory.itemsList.status.inactive', 'Inactive')}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        onClick={() => openItem(item)}
                      >
                        {t('actions.open', 'Open')}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        onClick={() => handleToggleActive(item)}
                        disabled={pendingToggleId === item.id}
                        title={item.active
                          ? t('inventory.itemsList.deactivate.title', 'Deactivate item')
                          : t('inventory.itemsList.activate.title', 'Activate item')}
                      >
                        <Power size={12} aria-hidden="true" />
                        {item.active
                          ? t('inventory.itemsList.deactivate.label', 'Deactivate')
                          : t('inventory.itemsList.activate.label', 'Activate')}
                      </button>
                    </div>
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
      {confirmDialog}
    </div>
  );
};

export default ItemsListPage;
