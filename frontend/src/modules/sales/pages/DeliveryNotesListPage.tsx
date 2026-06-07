import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { DeliveryNoteDTO, DNStatus, salesApi } from '../../../api/salesApi';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type DNStatusFilter = DNStatus | 'ALL';

const STATUS_VALUES: DNStatusFilter[] = ['ALL', 'DRAFT', 'POSTED', 'CANCELLED'];

const statusChipClasses = (status: DNStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700';
    case 'POSTED':
      return 'bg-emerald-100 text-emerald-700';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const DeliveryNotesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [statusFilter, setStatusFilter] = useState<DNStatusFilter>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warehouseNameById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

  const customerById = useMemo(
    () =>
      customers.reduce<Record<string, string>>((acc, customer) => {
        acc[customer.id] = customer.displayName;
        return acc;
      }, {}),
    [customers]
  );

  const hasActiveFilters =
    statusFilter !== 'ALL' || warehouseFilter !== 'ALL' || customerFilter !== 'ALL';

  const clearFilters = () => {
    setStatusFilter('ALL');
    setWarehouseFilter('ALL');
    setCustomerFilter('ALL');
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dnResult, warehouseResult, customerResult] = await Promise.all([
        salesApi.listDNs({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          limit: 200,
        }),
        inventoryApi.listWarehouses({ active: true, limit: 200 }),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      ]);

      const dnList = unwrap<DeliveryNoteDTO[]>(dnResult);
      const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
      const customerList = unwrap<PartyDTO[]>(customerResult);
      setDeliveryNotes(Array.isArray(dnList) ? dnList : []);
      setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
    } catch (err: any) {
      console.error('Failed to load delivery notes', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.deliveryNotesList.loadError')
      );
      setDeliveryNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredNotes = useMemo(() => {
    return deliveryNotes.filter((dn) => {
      if (warehouseFilter !== 'ALL' && dn.warehouseId !== warehouseFilter) return false;
      if (customerFilter !== 'ALL' && dn.customerId !== customerFilter) return false;
      return true;
    });
  }, [deliveryNotes, warehouseFilter, customerFilter]);

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title={t('sales.deliveryNotesList.title')}
        subtitle={t('sales.deliveryNotesList.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              title={t('sales.deliveryNotesList.refresh')}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              onClick={() => navigate('/sales/delivery-notes/new')}
            >
              {t('sales.deliveryNotesList.newButton')}
            </button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.deliveryNotesList.filters.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DNStatusFilter)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`sales.deliveryNotesList.status.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.deliveryNotesList.filters.warehouse')}
            </label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL">{t('sales.deliveryNotesList.filters.allWarehouses')}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.deliveryNotesList.filters.customer')}
            </label>
            <PartySelector
              role="CUSTOMER"
              value={customerFilter === 'ALL' ? '' : customerFilter}
              onChange={(party) => setCustomerFilter(party ? party.id : 'ALL')}
              placeholder={t('sales.deliveryNotesList.filters.allCustomers')}
            />
          </div>
          <div className="flex items-end">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <X size={14} />
                {t('sales.deliveryNotesList.clearFilters')}
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && filteredNotes.length === 0 && !error ? (
          <EmptyState
            title={t('sales.deliveryNotesList.empty.title')}
            description={t('sales.deliveryNotesList.empty.description')}
            action={
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                onClick={() => navigate('/sales/delivery-notes/new')}
              >
                {t('sales.deliveryNotesList.newButton')}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">{t('sales.deliveryNotesList.headers.dnNumber')}</th>
                  <th className="py-2 text-left">{t('sales.deliveryNotesList.headers.customer')}</th>
                  <th className="py-2 text-left">{t('sales.deliveryNotesList.headers.deliveryDate')}</th>
                  <th className="py-2 text-left">{t('sales.deliveryNotesList.headers.warehouse')}</th>
                  <th className="py-2 text-left">{t('sales.deliveryNotesList.headers.status')}</th>
                  <th className="py-2 text-right">{t('sales.deliveryNotesList.headers.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotes.map((dn) => (
                  <tr
                    key={dn.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/sales/delivery-notes/${dn.id}`)}
                  >
                    <td className="py-2 font-medium">{dn.dnNumber}</td>
                    <td className="py-2">{customerById[dn.customerId] || dn.customerName}</td>
                    <td className="py-2">{dn.deliveryDate}</td>
                    <td className="py-2">{warehouseNameById[dn.warehouseId] || dn.warehouseId}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusChipClasses(dn.status)}`}
                      >
                        {t(`sales.deliveryNotesList.status.${dn.status}`, dn.status)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-primary-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales/delivery-notes/${dn.id}`);
                        }}
                      >
                        {t('sales.deliveryNotesList.open')}
                      </button>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={6}>
                      {t('sales.deliveryNotesList.loading')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DeliveryNotesListPage;
