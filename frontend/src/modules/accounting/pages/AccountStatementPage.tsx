import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { endOfYear, format, startOfYear } from 'date-fns';
import { AlertTriangle, ArrowUpRight, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { accountingApi, AccountStatementData, AccountStatementEntry } from '../../../api/accountingApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { exportToExcel } from '../../../utils/exportUtils';
import { DatePicker } from '../components/shared/DatePicker';
import { AccountSelector } from '../components/shared/AccountSelector';
import { CostCenterSelector } from '../components/shared/CostCenterSelector';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useVoucherTypes } from '../../../hooks/useVoucherTypes';
import { useCompanyCurrencies } from '../hooks/useCompanyCurrencies';
import { VoucherFormConfig } from '../voucher-wizard/types';
import { VoucherEntryModal } from '../components/VoucherEntryModal';
import { useVoucherActions } from '../../../hooks/useVoucherActions';
import { errorHandler } from '../../../services/errorHandler';
import { useAccounts } from '../../../context/AccountsContext';
import { AccountsProvider } from '../../../context/AccountsContext';
import { CostCentersProvider } from '../../../context/CostCentersContext';

interface AccountStatementParams {
  accountId: string;
  accountName?: string;
  costCenterId?: string;
  costCenterLabel?: string;
  currency?: string;
  fromDate: string;
  toDate: string;
  includeUnposted?: boolean;
}

const currencyFormat = (value: number, currency?: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
};

const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const compareVoucherNo = (a: unknown, b: unknown) =>
  String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });

const sortAccountStatementEntries = (entries: AccountStatementEntry[]): AccountStatementEntry[] =>
  [...entries].sort((a, b) => {
    const dateCmp = String(a.date || '').localeCompare(String(b.date || ''));
    if (dateCmp !== 0) return dateCmp;

    const timeCmp = toMillis(a.time) - toMillis(b.time);
    if (timeCmp !== 0) return timeCmp;

    const voucherCmp = compareVoucherNo(a.voucherNo, b.voucherNo);
    if (voucherCmp !== 0) return voucherCmp;

    return String(a.id || '').localeCompare(String(b.id || ''));
  });

const AccountStatementInitiator: React.FC<{
  onSubmit: (params: AccountStatementParams) => void;
  initialParams?: AccountStatementParams | null;
  isModal?: boolean;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('accounting');
  const { refreshAccounts } = useAccounts();

  useEffect(() => {
    // Force a fresh fetch of accounts when this page opens (ensuring 20103 is visible)
    refreshAccounts();
  }, []); // Only run once on mount.
  const [accountId, setAccountId] = useState(initialParams?.accountId || '');
  const [accountName, setAccountName] = useState(initialParams?.accountName || '');
  const [costCenterId, setCostCenterId] = useState(initialParams?.costCenterId || '');
  const [costCenterLabel, setCostCenterLabel] = useState(initialParams?.costCenterLabel || '');
  const [currency, setCurrency] = useState(initialParams?.currency || '');
  const [fromDate, setFromDate] = useState(
    initialParams?.fromDate || format(startOfYear(new Date()), 'yyyy-MM-dd')
  );
  const [toDate, setToDate] = useState(
    initialParams?.toDate || format(endOfYear(new Date()), 'yyyy-MM-dd')
  );
  const [includeUnposted, setIncludeUnposted] = useState(initialParams?.includeUnposted ?? false);
  const { data: companyCurrencies = [] } = useCompanyCurrencies();
  const selectClass =
    'w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountId) return;
    onSubmit({
      accountId,
      accountName,
      costCenterId: costCenterId || undefined,
      costCenterLabel: costCenterLabel || undefined,
      currency: currency || undefined,
      fromDate,
      toDate,
      includeUnposted
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.account')} <span className="text-red-500">*</span>
          </label>
          <AccountSelector
            value={accountId}
            scope="all"
            onChange={(account) => {
              setAccountId(account?.id || '');
              setAccountName(account?.name || '');
            }}
            placeholder={t('accountStatement.selectAccountPlaceholder', { defaultValue: 'Select account to analyze...' })}
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.costCenter', { defaultValue: 'Cost Center' })}{' '}
            <span className="text-[8px] text-slate-400 normal-case">
              ({t('accountStatement.optional', { defaultValue: 'optional' })})
            </span>
          </label>
          <CostCenterSelector
            value={costCenterId}
            onChange={(cc) => {
              setCostCenterId(cc?.id || '');
              setCostCenterLabel(cc ? `${cc.code} - ${cc.name}` : '');
            }}
            placeholder={t('accountStatement.allCostCentersPlaceholder', { defaultValue: 'All cost centers...' })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.from')}
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full text-base" />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.to')}
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full text-base" />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.currency', { defaultValue: 'Currency' })}{' '}
            <span className="text-[8px] text-slate-400 normal-case">
              ({t('accountStatement.optional', { defaultValue: 'optional' })})
            </span>
          </label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
            <option value="">{t('accountStatement.allCurrencies', { defaultValue: 'All Currencies' })}</option>
            {companyCurrencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.options', { defaultValue: 'Options' })}
          </label>
          <label className="flex items-start gap-2 text-xs font-semibold text-[var(--color-text-muted)] leading-tight border border-slate-200 rounded px-3 py-2.5 bg-slate-50">
            <input
              type="checkbox"
              checked={includeUnposted}
              onChange={(e) => setIncludeUnposted(e.target.checked)}
              className="mt-0.5 rounded border-[var(--color-border)]"
            />
            {t('accountStatement.includeUnposted')}
          </label>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100">
        <Button
          type="submit"
          className="bg-slate-900 hover:bg-black text-white px-10 py-2.5 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2"
          disabled={!accountId}
        >
          <Search className="w-4 h-4" />
          {t('accountStatement.executeAnalysis', { defaultValue: 'Execute Analysis' })}
        </Button>
      </div>
    </form>
  );
};

const AccountStatementReportContent: React.FC<{
  params: AccountStatementParams;
  setTotalItems?: (total: number) => void;
}> = ({ params, setTotalItems }) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const { openWindow } = useWindowManager();
  const { uiMode } = useUserPreferences();
  const { voucherTypes } = useVoucherTypes();
  const {
    save: saveVoucher,
    approve,
    reject,
    confirmCustody,
    post,
    cancel: cancelVoucher,
    reverse,
    print: printVoucher
  } = useVoucherActions();

  const isWindowsMode = uiMode === 'windows';
  const [data, setData] = useState<AccountStatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<VoucherFormConfig | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accountingApi.getAccountStatement(
        params.accountId,
        params.fromDate || undefined,
        params.toDate || undefined,
        params.includeUnposted,
        params.costCenterId,
        params.currency
      );
      setData(result);
    } catch (err: any) {
      setError(err?.message || t('accountStatement.loading'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params.accountId, params.fromDate, params.toDate, params.includeUnposted, params.costCenterId, params.currency, t]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const sortedEntries = useMemo(
    () => sortAccountStatementEntries(data?.entries || []),
    [data?.entries]
  );

  useEffect(() => {
    if (setTotalItems) setTotalItems(sortedEntries.length);
  }, [setTotalItems, sortedEntries.length]);

  const totals = useMemo(
    () => ({
      debit: data?.totalDebit || 0,
      credit: data?.totalCredit || 0
    }),
    [data]
  );

  const resolveVoucherForm = (voucherLike: any) => {
    const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

    const matchByFormId = (formId?: string | null) =>
      voucherTypes.find((type) => formId && (type.id === formId || (type as any)._typeId === formId));

    const getJournalFallbackForm = () =>
      voucherTypes.find((type) => {
        const baseType = normalize((type as any)?.baseType);
        const code = normalize(type?.code);
        const id = normalize(type?.id);
        const name = normalize(type?.name);
        return (
          baseType.includes('journal') ||
          code.includes('journal') ||
          code === 'jv' ||
          id.includes('journal') ||
          id.includes('jv') ||
          name.includes('journal')
        );
      });

    let formDefinition = matchByFormId(voucherLike?.formId);

    if (!formDefinition) {
      const rawType = normalize(voucherLike?.type);
      const originType = normalize(voucherLike?.metadata?.originType);
      const candidateTypes = [rawType, originType].filter(Boolean);

      formDefinition = voucherTypes.find((type) => {
        const code = normalize(type.code);
        const id = normalize(type.id);
        const baseType = normalize((type as any)?.baseType);
        return candidateTypes.some((candidate) => candidate === code || candidate === id || candidate === baseType);
      });

      if (formDefinition) {
        return formDefinition;
      }

      const typeKeywords: Record<string, string[]> = {
        journal_entry: ['journal', 'journal_entry', 'jv'],
        jv: ['journal', 'journal_entry', 'jv'],
        payment: ['payment', 'pv'],
        payment_voucher: ['payment', 'pv'],
        receipt: ['receipt', 'rv'],
        receipt_voucher: ['receipt', 'rv'],
        opening_balance: ['opening', 'balance'],
        fx_revaluation: ['fx_revaluation', 'revaluation', 'journal'],
        reversal: ['reversal', 'reverse', 'rv'],
        purchase_invoice: ['purchase_invoice', 'purchase', 'invoice', 'pinv', 'ap_invoice', 'journal'],
        purchase_return: ['purchase_return', 'purchase', 'return', 'pr', 'journal'],
        sales_invoice: ['sales_invoice', 'sales', 'invoice', 'sinv', 'ar_invoice', 'journal'],
        sales_return: ['sales_return', 'sales', 'return', 'sr', 'journal']
      };

      const keywords = Array.from(
        new Set(
          candidateTypes.reduce<string[]>((acc, type) => {
            acc.push(...(typeKeywords[type] || []));
            return acc;
          }, [])
        )
      );

      formDefinition = voucherTypes.find((type) => {
        const formIdLower = (type.id || '').toLowerCase();
        const formNameLower = (type.name || '').toLowerCase();
        const formCodeLower = (type.code || '').toLowerCase();

        return keywords.some((keyword) =>
          formIdLower.includes(keyword) ||
          formNameLower.includes(keyword) ||
          formCodeLower.includes(keyword)
        );
      });
    }

    return formDefinition || getJournalFallbackForm();
  };

  const handleOpenVoucher = async (voucherId: string) => {
    try {
      const fullVoucher = await accountingApi.getVoucher(voucherId);
      let formDefinition = resolveVoucherForm(fullVoucher);

      if (!formDefinition && fullVoucher?.reversalOfVoucherId) {
        try {
          const parentVoucher = await accountingApi.getVoucher(fullVoucher.reversalOfVoucherId);
          formDefinition = resolveVoucherForm(parentVoucher);
        } catch {
          // Ignore fallback lookup failure and show the standard missing form error below.
        }
      }

      if (!formDefinition) {
        errorHandler.showError({
          code: 'VOUCH_NOT_FOUND',
          message: `Cannot find form definition for voucher type: ${fullVoucher.type}`,
          severity: 'ERROR'
        } as any);
        return;
      }

      if (isWindowsMode) {
        openWindow({
          type: 'voucher',
          title: `View ${formDefinition.name} - ${fullVoucher.voucherNo || ''}`,
          data: { ...fullVoucher, voucherConfig: formDefinition }
        });
        return;
      }

      setModalType(formDefinition);
      setEditingVoucher(fullVoucher);
      setIsModalOpen(true);
    } catch (openError) {
      console.error('Failed to open voucher:', openError);
      errorHandler.showError({
        code: 'FETCH_ERROR',
        message: 'Failed to load voucher details',
        severity: 'ERROR'
      } as any);
    }
  };

  const handleSaveWeb = async (payload: any) => {
    await saveVoucher('modal', payload);
    await fetchReport();
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-8 text-center text-[var(--color-text-muted)]">
          {t('accountStatement.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-8 text-center text-[var(--color-text-muted)]">
          {t('accountStatement.selectPrompt')}
        </div>
      </div>
    );
  }

  const baseCurrency = data.baseCurrency || '';
  const accountCurrency = data.accountCurrency || '';
  const showBaseColumns = Boolean(baseCurrency && accountCurrency && baseCurrency !== accountCurrency);
  const columnCount = showBaseColumns ? 11 : 8;

  return (
    <div className="h-full overflow-auto p-4 space-y-4 bg-slate-50" id="account-statement-report">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
          <div className="flex flex-wrap gap-3 justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                {t('accountStatement.account')}
              </span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {data.accountCode} — {data.accountName}{' '}
                {data.accountCurrency && (
                  <span className="text-[var(--color-text-muted)] text-xs">({data.accountCurrency})</span>
                )}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                {t('accountStatement.period')}
              </span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {formatCompanyDate(data.fromDate, settings)} → {formatCompanyDate(data.toDate, settings)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                {t('accountStatement.baseCurrency')}
              </span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{baseCurrency || '—'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                {t('accountStatement.openingBalance', { currency: accountCurrency || baseCurrency })}
              </span>
              <span className={`text-sm font-semibold ${data.openingBalance < 0 ? 'text-red-600' : 'text-[var(--color-text-primary)]'}`}>
                {currencyFormat(data.openingBalance, accountCurrency || baseCurrency)}
              </span>
            </div>
          </div>
          {(params.costCenterId || params.currency || params.includeUnposted) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {params.costCenterId && (
                <span className="text-[11px] font-semibold text-slate-600 border border-slate-200 bg-white rounded-full px-2 py-1">
                  {t('accountStatement.costCenter', { defaultValue: 'Cost Center' })}:{' '}
                  {params.costCenterLabel || params.costCenterId}
                </span>
              )}
              {params.currency && (
                <span className="text-[11px] font-semibold text-slate-600 border border-slate-200 bg-white rounded-full px-2 py-1">
                  {t('accountStatement.currency', { defaultValue: 'Currency' })}: {params.currency}
                </span>
              )}
              {params.includeUnposted && (
                <span className="text-[11px] font-semibold text-slate-600 border border-slate-200 bg-white rounded-full px-2 py-1">
                  {t('accountStatement.includingUnposted', { defaultValue: 'Including unposted vouchers' })}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border)]">
            <thead className="bg-[var(--color-bg-tertiary)]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">{t('accountStatement.date')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32">{t('accountStatement.voucher')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('accountStatement.description')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">{t('accountStatement.debit', { currency: accountCurrency || baseCurrency })}</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">{t('accountStatement.credit', { currency: accountCurrency || baseCurrency })}</th>
                {showBaseColumns && (
                  <>
                    <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">{t('accountStatement.debitBase')}</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">{t('accountStatement.creditBase')}</th>
                  </>
                )}
                <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-24">{t('accountStatement.fxRate')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32">{t('accountStatement.balance', { currency: accountCurrency || baseCurrency })}</th>
                {showBaseColumns && (
                  <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32">{t('accountStatement.balanceBase')}</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-[var(--color-bg-primary)] divide-y divide-[var(--color-border)]">
              <tr className="bg-[var(--color-bg-tertiary)] font-semibold">
                <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)]" />
                <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">—</td>
                <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">{t('accountStatement.opening')}</td>
                <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">{t('accountStatement.openingBalance', { currency: accountCurrency || baseCurrency })}</td>
                <td className="px-4 py-2 text-right text-sm text-[var(--color-text-secondary)]">—</td>
                <td className="px-4 py-2 text-right text-sm text-[var(--color-text-secondary)]">—</td>
                {showBaseColumns && (
                  <>
                    <td className="px-4 py-2 text-right text-sm text-[var(--color-text-secondary)]">—</td>
                    <td className="px-4 py-2 text-right text-sm text-[var(--color-text-secondary)]">—</td>
                  </>
                )}
                <td className="px-4 py-2 text-right text-sm text-[var(--color-text-secondary)]">—</td>
                <td className={`px-4 py-2 text-right text-sm font-mono ${data.openingBalance < 0 ? 'text-red-600' : 'text-[var(--color-text-primary)]'}`}>
                  {currencyFormat(data.openingBalance, accountCurrency || baseCurrency)}
                </td>
                {showBaseColumns && (
                  <td className={`px-4 py-2 text-right text-sm font-mono ${data.openingBalanceBase && data.openingBalanceBase < 0 ? 'text-red-600' : 'text-[var(--color-text-primary)]'}`}>
                    {currencyFormat(data.openingBalanceBase ?? 0, baseCurrency)}
                  </td>
                )}
              </tr>

              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                    {t('accountStatement.noEntries')}
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-[var(--color-bg-tertiary)] transition-colors">
                    <td className="px-4 py-2 text-sm text-[var(--color-text-muted)] font-mono">{index + 1}</td>
                    <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
                      {formatCompanyDate(entry.date, settings)}
                    </td>
                    <td
                      className="px-4 py-2 text-sm font-semibold text-primary-700 whitespace-nowrap cursor-pointer flex items-center gap-1"
                      onClick={() => handleOpenVoucher(entry.voucherId)}
                    >
                      {entry.voucherNo || entry.voucherId}
                      <ArrowUpRight size={14} className="text-primary-500" />
                    </td>
                    <td className="px-4 py-2 text-sm text-[var(--color-text-primary)]">{entry.description || '—'}</td>
                    <td className="px-4 py-2 text-right text-sm font-mono text-[var(--color-text-primary)]">
                      {entry.debit ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-mono text-[var(--color-text-primary)]">
                      {entry.credit ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    {showBaseColumns && (
                      <>
                        <td className="px-4 py-2 text-right text-sm font-mono text-[var(--color-text-primary)]">
                          {entry.baseDebit !== undefined ? entry.baseDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-mono text-[var(--color-text-primary)]">
                          {entry.baseCredit !== undefined ? entry.baseCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2 text-right text-sm font-mono text-[var(--color-text-muted)]">
                      {entry.exchangeRate ? entry.exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 4 }) : '—'}
                    </td>
                    <td className={`px-4 py-2 text-right text-sm font-mono font-semibold ${entry.balance < 0 ? 'text-red-600' : 'text-[var(--color-text-primary)]'}`}>
                      {entry.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    {showBaseColumns && (
                      <td className={`px-4 py-2 text-right text-sm font-mono font-semibold ${entry.baseBalance && entry.baseBalance < 0 ? 'text-red-600' : 'text-[var(--color-text-primary)]'}`}>
                        {(entry.baseBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-[var(--color-bg-tertiary)] font-bold border-t border-[var(--color-border)]">
              <tr>
                <td colSpan={4} className="px-4 py-2 text-right text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{t('accountStatement.totals')}</td>
                <td className="px-4 py-2 text-right font-mono text-sm text-primary-700">
                  {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {accountCurrency || baseCurrency}
                </td>
                <td className="px-4 py-2 text-right font-mono text-sm text-primary-700">
                  {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {accountCurrency || baseCurrency}
                </td>
                {showBaseColumns && (
                  <>
                    <td className="px-4 py-2 text-right font-mono text-sm text-primary-700">
                      {(data.totalBaseDebit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {baseCurrency}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm text-primary-700">
                      {(data.totalBaseCredit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {baseCurrency}
                    </td>
                  </>
                )}
                <td className="px-4 py-2" />
                <td className="px-4 py-2" />
                {showBaseColumns && <td className="px-4 py-2" />}
              </tr>
              <tr>
                <td colSpan={columnCount - (showBaseColumns ? 2 : 1)} className="px-4 py-2 text-right text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  {t('accountStatement.closingBalance')}
                </td>
                <td className={`px-4 py-2 text-right font-mono text-sm font-bold ${data.closingBalance < 0 ? 'text-red-700' : 'text-[var(--color-text-primary)]'}`}>
                  {currencyFormat(data.closingBalance, accountCurrency || baseCurrency)}
                </td>
                {showBaseColumns && (
                  <td className={`px-4 py-2 text-right font-mono text-sm font-bold ${data.closingBalanceBase && data.closingBalanceBase < 0 ? 'text-red-700' : 'text-[var(--color-text-primary)]'}`}>
                    {currencyFormat(data.closingBalanceBase ?? 0, baseCurrency)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {modalType && (
        <VoucherEntryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          voucherType={modalType}
          uiMode={uiMode}
          onSave={handleSaveWeb}
          initialData={editingVoucher}
          onApprove={async (id) => { await approve(id); await fetchReport(); }}
          onReject={async (id) => { await reject(id); await fetchReport(); }}
          onConfirm={async (id) => { await confirmCustody(id); await fetchReport(); }}
          onPost={async (id) => { await post(id); await fetchReport(); }}
          onCancel={async (id) => { await cancelVoucher(id); await fetchReport(); }}
          onReverse={async (id) => { await reverse(id); await fetchReport(); }}
          onPrint={(id) => printVoucher(id)}
        />
      )}
    </div>
  );
};

const AccountStatementPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const [searchParams] = useSearchParams();

  const defaultParams = useMemo<AccountStatementParams | undefined>(() => {
    const accountId = searchParams.get('accountId') || '';
    if (!accountId) return undefined;
    const includeUnposted = searchParams.get('includeUnposted') === 'true';
    const currency = searchParams.get('currency') || undefined;
    const costCenterId = searchParams.get('costCenterId') || undefined;
    return {
      accountId,
      fromDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
      toDate: format(endOfYear(new Date()), 'yyyy-MM-dd'),
      includeUnposted,
      currency,
      costCenterId
    };
  }, [searchParams]);

  const handleExportExcel = useCallback(
    async (params: AccountStatementParams) => {
      if (!params.accountId) return;

      try {
        const report = await accountingApi.getAccountStatement(
          params.accountId,
          params.fromDate,
          params.toDate,
          params.includeUnposted,
          params.costCenterId,
          params.currency
        );
        const entries = sortAccountStatementEntries(report.entries || []);
        const accountCurrency = report.accountCurrency || report.baseCurrency;

        exportToExcel(
          entries,
          [
            { header: t('accountStatement.date'), key: 'date' },
            { header: t('accountStatement.voucher'), key: 'voucherNo' },
            { header: t('accountStatement.description'), key: 'description' },
            { header: t('accountStatement.debit', { currency: accountCurrency }), key: 'debit', isNumber: true },
            { header: t('accountStatement.credit', { currency: accountCurrency }), key: 'credit', isNumber: true },
            { header: t('accountStatement.fxRate'), key: 'exchangeRate', isNumber: true },
            { header: t('accountStatement.balance', { currency: accountCurrency }), key: 'balance', isNumber: true }
          ],
          `Account-Statement-${report.accountCode}-${report.toDate}`,
          t('accountStatement.title'),
          `${report.accountCode} - ${report.accountName}`
        );
      } catch (error: any) {
        errorHandler.showError({
          code: 'EXPORT_FAILED',
          message: error?.message || t('accountStatement.exportFailed', { defaultValue: 'Failed to export account statement' }),
          severity: 'ERROR'
        } as any);
      }
    },
    [t]
  );

  return (
    <AccountsProvider>
      <CostCentersProvider>
        <ReportContainer<AccountStatementParams>
          title={t('accountStatement.title')}
          subtitle={t('accountStatement.subtitle')}
          initiator={AccountStatementInitiator}
          ReportContent={AccountStatementReportContent}
          onExportExcel={handleExportExcel}
          defaultParams={defaultParams}
          config={{ paginated: false }}
        />
      </CostCentersProvider>
    </AccountsProvider>
  );
};

export default AccountStatementPage;
