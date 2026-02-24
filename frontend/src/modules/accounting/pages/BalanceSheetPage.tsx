import { useEffect, useMemo, useState } from 'react';
import { accountingApi, BalanceSheetData, BalanceSheetLine } from '../../../api/accountingApi';
import { Button } from '../../../components/ui/Button';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Printer, RefreshCw } from 'lucide-react';
import { exportToExcel, exportElementToPDF } from '../../../utils/exportUtils';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../components/shared/DatePicker';

const formatAmount = (value: number, currency: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
};

const BalanceSheetSection = ({
  title,
  section,
  currency,
  collapsed,
  onToggle,
  subtitle,
  totalLabel,
  emptyLabel
}: {
  title: string;
  section: BalanceSheetData['assets'];
  currency: string;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  subtitle: string;
  totalLabel: string;
  emptyLabel: string;
}) => {
  const lineMap = useMemo(() => new Map(section.accounts.map((line) => [line.accountId, line])), [section.accounts]);
  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    section.accounts.forEach((line) => {
      if (line.parentId) ids.add(line.parentId);
    });
    return ids;
  }, [section.accounts]);

  const isHidden = (line: BalanceSheetLine): boolean => {
    let current = line.parentId || null;
    while (current) {
      if (collapsed.has(current)) return true;
      const parent = lineMap.get(current);
      if (!parent) break;
      current = parent.parentId || null;
    }
    return false;
  };

  const visibleLines = section.accounts.filter((line) => !isHidden(line));

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">{title}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-muted)]">{totalLabel}</p>
          <p className="text-lg font-bold text-[var(--color-text-primary)] font-mono">{formatAmount(section.total, currency)}</p>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {visibleLines.length === 0 && (
          <div className="px-4 py-8 text-center text-[var(--color-text-muted)] text-sm">{emptyLabel}</div>
        )}
        {visibleLines.map((line) => {
          const hasChildren = parentIds.has(line.accountId);
          const indent = Math.min(line.level, 6) * 16;
          const balanceClass = line.balance < 0 ? 'text-red-600' : 'text-[var(--color-text-primary)]';
          return (
            <div
              key={line.accountId}
              className="flex items-center justify-between px-4 py-2 hover:bg-[var(--color-bg-tertiary)] transition-colors"
              style={{ paddingLeft: `${indent + 8}px` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {line.isParent || hasChildren ? (
                  <button
                    onClick={() => onToggle(line.accountId)}
                    className="p-1 rounded hover:bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]"
                    aria-label={collapsed.has(line.accountId) ? 'Expand' : 'Collapse'}
                  >
                    {collapsed.has(line.accountId) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[var(--color-border)]"></span>
                )}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{line.code}</span>
                    <span className="text-sm text-[var(--color-text-primary)] truncate">{line.name}</span>
                  </div>
                </div>
              </div>
              <div className={`font-mono text-sm font-semibold ${balanceClass}`}>
                {formatAmount(line.balance, currency)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BalanceSheetPage: React.FC = () => {
  const { company } = useCompanyAccess();
  const { settings } = useCompanySettings();
  const { t } = useTranslation('accounting');
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const baseCurrency = data?.baseCurrency || company?.baseCurrency || '';

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await accountingApi.getBalanceSheet(asOfDate);
      const payload = (response as any)?.data || response;
      setData(payload);
      setCollapsed(new Set()); // reset tree on refresh
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load Balance Sheet. Please try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfDate]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const totalLabel = t('balanceSheet.total');
  const subtitleText = t('balanceSheet.totalsShownIn', {
    currency: baseCurrency || t('balanceSheet.baseCurrencyLabel')
  });

  const difference =
    data && Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity) > 0.01
      ? data.totalAssets - data.totalLiabilitiesAndEquity
      : 0;

  return (
    <div className="space-y-6 pb-20 print:pb-0">
      <div className="flex flex-wrap gap-4 justify-between items-start print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('balanceSheet.title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t('balanceSheet.subtitle')} — {t('balanceSheet.asOf', { date: formatCompanyDate(asOfDate, settings) })}
            <span className="font-semibold text-[var(--color-text-primary)]">
              {' '}
            </span>
          </p>
          {data && (
            <div className="flex items-center gap-2 mt-2">
              {data.isBalanced ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  <CheckCircle2 size={14} /> {t('balanceSheet.balanced')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                  <AlertTriangle size={14} /> {t('balanceSheet.outOfBalance')}
                </span>
              )}
              <span className="text-xs text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-full px-2 py-0.5">
                {t('balanceSheet.baseCurrency')}: {baseCurrency || '—'}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-2 py-1">
            <DatePicker
              value={asOfDate}
              onChange={setAsOfDate}
              className="w-36 border-none shadow-none focus:ring-0"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (!data) return;
              const rows: any[] = [];
              const pushSection = (section: BalanceSheetData['assets'], label: string) => {
                section.accounts.forEach((a) => rows.push({ section: label, code: a.code, name: a.name, balance: a.balance }));
                rows.push({ section: label, code: '', name: t('balanceSheet.totalOfSection', { section: label }), balance: section.total });
              };
              pushSection(data.assets, t('balanceSheet.assets'));
              pushSection(data.liabilities, t('balanceSheet.liabilities'));
              pushSection(data.equity, t('balanceSheet.equity'));
              exportToExcel(
                rows,
                [
                  { header: t('balanceSheet.section', { defaultValue: 'Section' }), key: 'section' },
                  { header: t('balanceSheet.code', { defaultValue: 'Code' }), key: 'code' },
                  { header: t('balanceSheet.account', { defaultValue: 'Account' }), key: 'name' },
                  { header: `${t('balanceSheet.balance', { defaultValue: 'Balance' })} (${baseCurrency})`, key: 'balance', isNumber: true }
                ],
                `Balance-Sheet-${asOfDate}`,
                t('balanceSheet.title'),
                t('balanceSheet.asOf', { date: formatCompanyDate(asOfDate, settings) })
              );
            }}
            className="flex items-center gap-2"
          >
            {t('balanceSheet.exportExcel')}
          </Button>
          <Button variant="secondary" onClick={() => exportElementToPDF('balance-sheet-report', 'Balance-Sheet')} className="flex items-center gap-2">
            {t('balanceSheet.exportPDF')}
          </Button>
          <Button onClick={handlePrint} variant="secondary" className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> {t('balanceSheet.print')}
          </Button>
          <Button onClick={fetchReport} variant="primary" className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('balanceSheet.refresh')}
          </Button>
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('balanceSheet.title')}</h1>
        <p className="text-sm text-gray-600">{t('balanceSheet.asOf', { date: formatCompanyDate(asOfDate, settings) })}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div id="balance-sheet-report">
      {loading && !data ? (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6 text-center text-[var(--color-text-muted)]">
          {t('balanceSheet.loading')}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:grid-cols-3">
            <BalanceSheetSection
              title={t('balanceSheet.assets')}
              section={data.assets}
              currency={baseCurrency}
              collapsed={collapsed}
              onToggle={toggleCollapse}
              subtitle={subtitleText}
              totalLabel={totalLabel}
              emptyLabel={t('balanceSheet.noAccounts')}
            />
            <BalanceSheetSection
              title={t('balanceSheet.liabilities')}
              section={data.liabilities}
              currency={baseCurrency}
              collapsed={collapsed}
              onToggle={toggleCollapse}
              subtitle={subtitleText}
              totalLabel={totalLabel}
              emptyLabel={t('balanceSheet.noAccounts')}
            />
            <BalanceSheetSection
              title={t('balanceSheet.equity')}
              section={data.equity}
              currency={baseCurrency}
              collapsed={collapsed}
              onToggle={toggleCollapse}
              subtitle={subtitleText}
              totalLabel={totalLabel}
              emptyLabel={t('balanceSheet.noAccounts')}
            />
          </div>

          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-sm p-4 space-y-3 print:shadow-none">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-text-muted)]">{t('balanceSheet.totalAssets')}</span>
                <span className="text-lg font-bold text-[var(--color-text-primary)] font-mono">
                  {formatAmount(data.totalAssets, baseCurrency)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-text-muted)]">{t('balanceSheet.totalLiabilitiesEquity')}</span>
                <span className="text-lg font-bold text-[var(--color-text-primary)] font-mono">
                  {formatAmount(data.totalLiabilitiesAndEquity, baseCurrency)}
                </span>
              </div>
            </div>
            {!data.isBalanced && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                <AlertTriangle size={16} />
                <span className="text-sm">
                  {t('balanceSheet.outOfBalanceBy', {
                    amount: formatAmount(Math.abs(difference), baseCurrency),
                    side: difference > 0 ? t('balanceSheet.assets', { defaultValue: 'Assets' }) : t('balanceSheet.liabilities', { defaultValue: 'Liabilities' })
                  })}
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6 text-center text-[var(--color-text-muted)]">
          {t('balanceSheet.noData')}
        </div>
      )}
      </div>
    </div>
  );
};

export default BalanceSheetPage;
