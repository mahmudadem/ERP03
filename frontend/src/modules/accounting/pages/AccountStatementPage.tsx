import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountingApi, AccountStatementData } from '../../../api/accountingApi';
import { Button } from '../../../components/ui/Button';
import { AccountSelector } from '../components/shared/AccountSelector';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { AlertTriangle, ArrowUpRight, Filter, Printer, RefreshCw, Search } from 'lucide-react';

const currencyFormat = (value: number, currency?: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
};

const AccountStatementPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useCompanySettings();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [data, setData] = useState<AccountStatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseCurrency = data?.baseCurrency || '';
  const accountCurrency = data?.accountCurrency || '';
  const showBaseColumns = data && baseCurrency && accountCurrency && baseCurrency !== accountCurrency;

  const fetchReport = async () => {
    if (!selectedAccountId) {
      setError('Please select an account');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await accountingApi.getAccountStatement(selectedAccountId, fromDate || undefined, toDate || undefined);
      setData(result);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load account statement. Please try again.');
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

  const handleOpenVoucher = (voucherId: string) => {
    navigate(`/accounting/vouchers/${voucherId}`);
  };

  return (
    <div className="space-y-6 pb-20 print:pb-0">
      <div className="flex items-start justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Account Statement</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Running balance per account with opening and closing balances.
          </p>
          {data && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Period: {formatCompanyDate(data.fromDate, settings)} → {formatCompanyDate(data.toDate, settings)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} variant="secondary" className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button onClick={fetchReport} variant="primary" className="flex items-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            Load
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Account Statement</h1>
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
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Account</label>
            <AccountSelector
              value={selectedAccountId}
              onChange={(account) => {
                setSelectedAccountId(account ? account.id : '');
              }}
              placeholder="Select an account"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchReport} variant="primary" className="flex-1 flex items-center justify-center gap-2">
              <Search className="w-4 h-4" /> Load Statement
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
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex flex-wrap gap-3 justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Account</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {data.accountCode} — {data.accountName} {data.accountCurrency && <span className="text-[var(--color-text-muted)] text-xs">({data.accountCurrency})</span>}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Base Currency</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{baseCurrency || '—'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Opening Balance ({accountCurrency || baseCurrency})</span>
              <span className={`text-sm font-semibold ${data.openingBalance < 0 ? 'text-red-600' : 'text-[var(--color-text-primary)]'}`}>
                {currencyFormat(data.openingBalance, accountCurrency || baseCurrency)}
              </span>
            </div>
            {showBaseColumns && (
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Opening Balance (Base)</span>
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
                  <th className="px-4 py-2 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32">Voucher</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">Debit ({accountCurrency || baseCurrency})</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">Credit ({accountCurrency || baseCurrency})</th>
                  {showBaseColumns && (
                    <>
                      <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">Debit (Base)</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28">Credit (Base)</th>
                    </>
                  )}
                  <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32">Balance ({accountCurrency || baseCurrency})</th>
                  {showBaseColumns && (
                    <th className="px-4 py-2 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32">Balance (Base)</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-[var(--color-bg-primary)] divide-y divide-[var(--color-border)]">
                <tr className="bg-[var(--color-bg-tertiary)] font-semibold">
                  <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">—</td>
                  <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">Opening</td>
                  <td className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">Opening Balance</td>
                  <td className="px-4 py-2 text-right text-sm text-[var(--color-text-secondary)]">—</td>
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
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)]">Loading...</td>
                  </tr>
                ) : visibleEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)]">No entries for this period.</td>
                  </tr>
                ) : (
                  visibleEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[var(--color-bg-tertiary)] transition-colors">
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
                    <td colSpan={3} className="px-4 py-2 text-right text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Totals</td>
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
                    {showBaseColumns && <td className="px-4 py-2"></td>}
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-right text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Closing Balance</td>
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
            Select an account and date range, then click Load to view the statement.
          </div>
        )
      )}
    </div>
  );
};

export default AccountStatementPage;
