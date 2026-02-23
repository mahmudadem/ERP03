import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, startOfYear, endOfYear } from 'date-fns';
import { accountingApi, AccountStatementData } from '../../../api/accountingApi';
import { Button } from '../../../components/ui/Button';
import { AccountSelector } from '../components/shared/AccountSelector';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { AlertTriangle, ArrowUpRight, Filter, Printer, RefreshCw, Search } from 'lucide-react';
import { exportToExcel, exportElementToPDF } from '../../../utils/exportUtils';
import { useTranslation } from 'react-i18next';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useVoucherTypes } from '../../../hooks/useVoucherTypes';
import { errorHandler } from '../../../services/errorHandler';
import { VoucherFormConfig } from '../voucher-wizard/types';
import { VoucherEntryModal } from '../components/VoucherEntryModal';
import { useVoucherActions } from '../../../hooks/useVoucherActions';
import { AccountsProvider } from '../../../context/AccountsContext';

const currencyFormat = (value: number, currency?: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
};

const AccountStatementPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useCompanySettings();
  const { t } = useTranslation('accounting');
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

  // Modal State for Web Mode
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<VoucherFormConfig | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);

  // Support drill-down from Trial Balance via ?accountId=xxx
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => searchParams.get('accountId') || '');
  const [fromDate, setFromDate] = useState<string>(() => {
    // Default to start of current year to show more context
    return format(startOfYear(new Date()), 'yyyy-MM-dd');
  });
  const [toDate, setToDate] = useState<string>(() => {
    return format(endOfYear(new Date()), 'yyyy-MM-dd');
  });

  const [data, setData] = useState<AccountStatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeUnposted, setIncludeUnposted] = useState<boolean>(false);

  const baseCurrency = data?.baseCurrency || '';
  const accountCurrency = data?.accountCurrency || '';
  const showBaseColumns = data && baseCurrency && accountCurrency && baseCurrency !== accountCurrency;
  const columnCount = showBaseColumns ? 10 : 7;


  const fetchReport = async () => {
    if (!selectedAccountId) {
      setError(t('accountStatement.selectPrompt'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await accountingApi.getAccountStatement(
        selectedAccountId,
        fromDate || undefined,
        toDate || undefined,
        includeUnposted
      );
      setData(result);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t('accountStatement.loading'));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // auto-load if account already selected
    if (selectedAccountId) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleEntries = data?.entries || [];

  const totals = useMemo(() => {
    if (!data) return { debit: 0, credit: 0 };
    return {
      debit: data.totalDebit,
      credit: data.totalCredit
    };
  }, [data]);

  const handlePrint = () => {
    window.print();
  };

  const handleOpenVoucher = async (voucherId: string) => {
    try {
      const fullVoucher = await accountingApi.getVoucher(voucherId);
      
      // Find form definition: 1. Try by ID/_typeId, 2. Fallback to keywords
      let formDefinition = voucherTypes.find(t => 
        fullVoucher.formId && (t.id === fullVoucher.formId || (t as any)._typeId === fullVoucher.formId)
      );

      if (!formDefinition) {
        formDefinition = voucherTypes.find(t => {
          const typeKeywords: Record<string, string[]> = {
            'journal_entry': ['journal', 'journal_entry'],
            'payment': ['payment'],
            'receipt': ['receipt'],
            'opening_balance': ['opening', 'balance'],
            'fx_revaluation': ['fx_revaluation', 'revaluation', 'journal']
          };
          
          const keywords = typeKeywords[fullVoucher.type] || [];
          const formIdLower = (t.id || '').toLowerCase();
          const formNameLower = (t.name || '').toLowerCase();
          const formCodeLower = (t.code || '').toLowerCase();
          
          return keywords.some(kw => 
            formIdLower.includes(kw) || 
            formNameLower.includes(kw) ||
            formCodeLower.includes(kw)
          );
        });
      }

      if (formDefinition) {
        if (isWindowsMode) {
          openWindow(formDefinition, fullVoucher);
        } else {
          setModalType(formDefinition);
          setEditingVoucher(fullVoucher);
          setIsModalOpen(true);
        }
      } else {
        errorHandler.showError({
          code: 'VOUCH_NOT_FOUND',
          message: `Cannot find form definition for voucher type: ${fullVoucher.type}`,
          severity: 'ERROR'
        } as any);
      }
    } catch (error) {
      console.error('Failed to open voucher:', error);
      errorHandler.showError({
        code: 'FETCH_ERROR',
        message: 'Failed to load voucher details',
        severity: 'ERROR'
      } as any);
    }
  };

  const handleSaveWeb = async (data: any) => {
    await saveVoucher('modal', data);
    fetchReport();
    setIsModalOpen(false);
  };

  return (
    <AccountsProvider>
      <div className="space-y-6 pb-20 print:pb-0">
      <div className="flex items-start justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('accountStatement.title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t('accountStatement.subtitle')}
          </p>
          {data && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              {t('accountStatement.period')}: {formatCompanyDate(data.fromDate, settings)} → {formatCompanyDate(data.toDate, settings)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  exportToExcel(
                    data.entries,
                    [
                      { header: t('accountStatement.date'), key: 'date' },
                      { header: t('accountStatement.voucher'), key: 'voucherNo' },
                      { header: t('accountStatement.description'), key: 'description' },
                      { header: t('accountStatement.debit', { currency: accountCurrency || baseCurrency }), key: 'debit', isNumber: true },
                      { header: t('accountStatement.credit', { currency: accountCurrency || baseCurrency }), key: 'credit', isNumber: true },
                      { header: t('accountStatement.fxRate'), key: 'exchangeRate', isNumber: true },
                      { header: t('accountStatement.balance', { currency: accountCurrency || baseCurrency }), key: 'balance', isNumber: true }
                    ],
                    `Account-Statement-${data.accountCode}-${data.toDate}`,
                    t('accountStatement.title'),
                    `${data.accountCode} - ${data.accountName}`
                  )
                }
                className="flex items-center gap-1"
              >
                {t('accountStatement.exportExcel')}
              </Button>
              <Button variant="secondary" onClick={() => exportElementToPDF('account-statement-report', 'Account-Statement')} className="flex items-center gap-1">
                {t('accountStatement.exportPDF')}
              </Button>
            </>
          )}
          <Button onClick={handlePrint} variant="secondary" className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> {t('accountStatement.print')}
          </Button>
          <Button onClick={fetchReport} variant="primary" className="flex items-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            {t('accountStatement.load')}
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('accountStatement.title')}</h1>
        {data && (
          <p className="text-sm text-gray-600">
            {data.accountCode} - {data.accountName} | {formatCompanyDate(data.fromDate, settings)} → {formatCompanyDate(data.toDate, settings)}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">{t('accountStatement.account')}</label>
            <AccountSelector
              value={selectedAccountId}
              onChange={(account) => {
                setSelectedAccountId(account ? account.id : '');
              }}
              placeholder={t('accountStatement.selectPrompt')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">{t('accountStatement.from')}</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">{t('accountStatement.to')}</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={includeUnposted}
                onChange={(e) => setIncludeUnposted(e.target.checked)}
                className="rounded border-[var(--color-border)]"
              />
              {t('accountStatement.includeUnposted')}
            </label>
            <Button onClick={fetchReport} variant="primary" className="flex-1 flex items-center justify-center gap-2">
              <Search className="w-4 h-4" /> {t('accountStatement.loadStatement')}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {data ? (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden" id="account-statement-report">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex flex-wrap gap-3 justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{t('accountStatement.account')}</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {data.accountCode} — {data.accountName} {data.accountCurrency && <span className="text-[var(--color-text-muted)] text-xs">({data.accountCurrency})</span>}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{t('accountStatement.baseCurrency')}</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{baseCurrency || '—'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{t('accountStatement.openingBalance', { currency: accountCurrency || baseCurrency })}</span>
              <span className={`text-sm font-semibold ${data.openingBalance < 0 ? 'text-red-600' : 'text-[var(--color-text-primary)]'}`}>
                {currencyFormat(data.openingBalance, accountCurrency || baseCurrency)}
              </span>
            </div>
            {showBaseColumns && (
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{t('accountStatement.openingBalanceBase')}</span>
                <span className={`text-sm font-semibold ${data.openingBalanceBase && data.openingBalanceBase < 0 ? 'text-red-600' : 'text-[var(--color-text-primary)]'}`}>
                  {currencyFormat(data.openingBalanceBase ?? 0, baseCurrency)}
                </span>
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
                  <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)]"></td>
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

                {loading ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-8 text-center text-[var(--color-text-muted)]">{t('accountStatement.loading')}</td>
                  </tr>
                ) : visibleEntries.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-8 text-center text-[var(--color-text-muted)]">{t('accountStatement.noEntries')}</td>
                  </tr>
                ) : (
                  visibleEntries.map((entry, index) => (
                    <tr key={entry.id} className="hover:bg-[var(--color-bg-tertiary)] transition-colors">
                      <td className="px-4 py-2 text-sm text-[var(--color-text-muted)] font-mono">{index + 1}</td>
                      <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
                        {formatCompanyDate(entry.date, settings)}
                      </td>
                      <td className="px-4 py-2 text-sm font-semibold text-primary-700 whitespace-nowrap cursor-pointer flex items-center gap-1" onClick={() => handleOpenVoucher(entry.voucherId)}>
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
              {data && (
                <tfoot className="bg-[var(--color-bg-tertiary)] font-bold border-t border-[var(--color-border)]">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{t('accountStatement.totals')}</td>
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
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2"></td>
                    {showBaseColumns && <td className="px-4 py-2"></td>}
                  </tr>
                  <tr>
                    <td colSpan={showBaseColumns ? columnCount - 2 : columnCount - 1} className="px-4 py-2 text-right text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{t('accountStatement.closingBalance')}</td>
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
              )}
            </table>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6 text-center text-[var(--color-text-muted)]">
            {t('accountStatement.selectPrompt')}
          </div>
        )
      )}
      
      {/* Web View Modal */}
      {modalType && (
        <VoucherEntryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          voucherType={modalType}
          uiMode={uiMode}
          onSave={handleSaveWeb}
          initialData={editingVoucher}
          onApprove={async (id) => { await approve(id); fetchReport(); }}
          onReject={async (id) => { await reject(id); fetchReport(); }}
          onConfirm={async (id) => { await confirmCustody(id); fetchReport(); }}
          onPost={async (id) => { await post(id); fetchReport(); }}
          onCancel={async (id) => { await cancelVoucher(id); fetchReport(); }}
          onReverse={async (id) => { await reverse(id); fetchReport(); }}
          onPrint={(id) => printVoucher(id)}
        />
      )}
      </div>
    </AccountsProvider>
  );
};

export default AccountStatementPage;
