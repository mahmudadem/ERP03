
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { Building2, LucideIcon, Mail, Phone, Plus, RefreshCw, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const CustomersListPage: React.FC = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const { openWindow } = useWindowManager();
  const { uiMode } = useUserPreferences();
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const result = await sharedApi.listParties({ role: 'CUSTOMER' });
      setCustomers(result || []);
    } catch (error) {
      console.error('Failed to load customers', error);
      setCustomers([]);
      toast.error(t('sales.customersPage.messages.loadFailed', 'Failed to load customers'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [location.state?.masterDataRefreshToken]);

  const handleCustomerClick = (customer: PartyDTO) => {
    if (uiMode === 'windows') {
      openWindow({
        type: 'party',
        title: `Customer: ${customer.displayName}`,
        data: { partyId: customer.id, role: 'CUSTOMER' },
        size: { width: 950, height: 650 }
      });
    } else {
      navigate(`/sales/customers/${customer.id}`);
    }
  };

  const handleAddCustomer = () => {
    if (uiMode === 'windows') {
       openWindow({
         type: 'party',
         title: 'New Customer',
         data: { partyId: 'new', role: 'CUSTOMER', onSaved: loadCustomers },
         size: { width: 950, height: 650 }
       });
    } else {
       navigate('/sales/customers/new');
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (statusFilter === 'ACTIVE' && !customer.active) return false;
      if (statusFilter === 'INACTIVE' && customer.active) return false;
      if (!term) return true;
      return [customer.code, customer.displayName, customer.legalName, customer.email, customer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [customers, search, statusFilter]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.active).length;
    const withEmail = customers.filter((c) => !!c.email).length;
    const withCreditLimit = customers.filter((c) => c.creditLimit && c.creditLimit > 0).length;
    return { total, active, withEmail, withCreditLimit };
  }, [customers]);

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title={t('sales.customersPage.title', 'Customers')}
        subtitle={t('sales.customersPage.subtitle', 'Manage your customer master records and the AR sub-accounts they post to.')}
        action={
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700 transition-all uppercase tracking-widest"
            onClick={handleAddCustomer}
            type="button"
          >
            <Plus size={14} aria-hidden="true" />
            {t('sales.customersPage.addCustomer', 'Add Customer')}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label={t('sales.customersPage.kpi.total', 'Total customers')}
          value={stats.total}
          unit={t('sales.customersPage.kpi.records', 'records')}
          accent="indigo"
        />
        <KpiCard
          icon={Building2}
          label={t('sales.customersPage.kpi.active', 'Active customers')}
          value={stats.active}
          unit={t('sales.customersPage.kpi.operational', 'operational')}
          accent="emerald"
        />
        <KpiCard
          icon={Mail}
          label={t('sales.customersPage.kpi.withEmail', 'With email')}
          value={stats.withEmail}
          unit={t('sales.customersPage.kpi.contactable', 'contactable')}
          accent="blue"
        />
        <KpiCard
          icon={Phone}
          label={t('sales.customersPage.kpi.withCreditLimit', 'With credit limit')}
          value={stats.withCreditLimit}
          unit={t('sales.customersPage.kpi.creditLines', 'credit lines')}
          accent="amber"
        />
      </div>

      <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[2fr_1fr_auto_auto]">
          <label className="relative">
            <span className="sr-only">{t('sales.customersPage.search', 'Search customers')}</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
            <input
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm"
              placeholder={t('sales.customersPage.searchPlaceholder', 'Search code, name, email, phone…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
          >
            <option value="ALL">{t('sales.customersPage.statusFilter.all', 'All statuses')}</option>
            <option value="ACTIVE">{t('sales.customersPage.statusFilter.active', 'Active only')}</option>
            <option value="INACTIVE">{t('sales.customersPage.statusFilter.inactive', 'Inactive only')}</option>
          </select>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            onClick={() => loadCustomers()}
            type="button"
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
            {t('actions.refresh', 'Refresh')}
          </button>
          {(search || statusFilter !== 'ALL') && (
            <button
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
              }}
              type="button"
            >
              {t('actions.clear', 'Clear')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500 italic animate-pulse">Syncing Master Records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">{t('sales.customersPage.columns.code', 'Code')}</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">{t('sales.customersPage.columns.name', 'Display Name')}</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">{t('sales.customersPage.columns.roles', 'Roles')}</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">{t('sales.customersPage.columns.phone', 'Phone')}</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">{t('sales.customersPage.columns.email', 'Email')}</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">{t('sales.customersPage.columns.credit', 'Credit Limit')}</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest text-right">{t('sales.customersPage.columns.status', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    onClick={() => handleCustomerClick(customer)}
                  >
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{customer.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                      {customer.displayName}
                      {customer.legalName && customer.legalName !== customer.displayName && (
                        <span className="block text-[10px] text-slate-500">{customer.legalName}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(customer.roles || []).map((role) => (
                          <span
                            key={role}
                            className="bg-slate-100 dark:bg-slate-800 text-slate-500 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 text-slate-500">{customer.email || '-'}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono">
                      {customer.creditLimit && customer.creditLimit > 0
                        ? customer.creditLimit.toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${customer.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                            {customer.active
                              ? t('sales.customersPage.status.active', 'Active')
                              : t('sales.customersPage.status.inactive', 'Inactive')}
                        </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="py-20 text-center text-slate-400 font-medium" colSpan={7}>
                      {search || statusFilter !== 'ALL'
                        ? t('sales.customersPage.emptyFiltered', 'No customers match the current filters.')
                        : t('sales.customersPage.empty', 'No Customer records found in directory.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-200 px-4 py-2 text-[10px] uppercase tracking-widest text-slate-400 dark:border-slate-800">
          {t('sales.customersPage.footerCount', {
            shown: filtered.length,
            total: customers.length,
            defaultValue: `Showing ${filtered.length} of ${customers.length} customers`,
          })}
        </div>
      </Card>
    </div>
  );
};

const ACCENT_CLASSES: Record<'indigo' | 'emerald' | 'blue' | 'amber', string> = {
  indigo: 'border-b-indigo-500/30 text-indigo-600',
  emerald: 'border-b-emerald-500/30 text-emerald-600',
  blue: 'border-b-blue-500/30 text-blue-600',
  amber: 'border-b-amber-500/30 text-amber-600',
};

const KpiCard: React.FC<{
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
  accent: 'indigo' | 'emerald' | 'blue' | 'amber';
}> = ({ icon: Icon, label, value, unit, accent }) => (
  <div className={`bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm border-b-2 transition-all hover:shadow-md ${ACCENT_CLASSES[accent]}`}>
    <div className="flex items-start justify-between">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <Icon size={16} aria-hidden={true} />
    </div>
    <div className="mt-2 flex items-baseline gap-2">
      <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{value}</span>
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter font-mono">{unit}</span>
    </div>
  </div>
);

export default CustomersListPage;
