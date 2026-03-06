import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { DatePicker } from '../components/shared/DatePicker';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { accountingApi, BalanceSheetData, BalanceSheetLine } from '../../../api/accountingApi';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { exportToExcel } from '../../../utils/exportUtils';
import { formatCompanyDate, getCompanyToday } from '../../../utils/dateUtils';
import { Button } from '../../../components/ui/Button';

interface BalanceSheetParams {
  asOfDate: string;
}

const formatAmount = (value: number, currency: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
};

const BalanceSheetSection: React.FC<{
  title: string;
  section: BalanceSheetData['assets'];
  currency: string;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  subtitle: string;
  totalLabel: string;
  emptyLabel: string;
}> = ({ title, section, currency, collapsed, onToggle, subtitle, totalLabel, emptyLabel }) => {
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{totalLabel}</p>
          <p className="text-lg font-bold text-slate-900 font-mono">{formatAmount(section.total, currency)}</p>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {visibleLines.length === 0 && <div className="px-4 py-8 text-center text-slate-500 text-sm">{emptyLabel}</div>}
        {visibleLines.map((line) => {
          const hasChildren = parentIds.has(line.accountId);
          const indent = Math.min(line.level, 6) * 16;
          const balanceClass = line.balance < 0 ? 'text-red-600' : 'text-slate-900';

          return (
            <div
              key={line.accountId}
              className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition-colors"
              style={{ paddingLeft: `${indent + 8}px` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {line.isParent || hasChildren ? (
                  <button
                    onClick={() => onToggle(line.accountId)}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500"
                    aria-label={collapsed.has(line.accountId) ? 'Expand' : 'Collapse'}
                  >
                    {collapsed.has(line.accountId) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                )}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-500">{line.code}</span>
                    <span className="text-sm text-slate-900 truncate">{line.name}</span>
                  </div>
                </div>
              </div>
              <div className={`font-mono text-sm font-semibold ${balanceClass}`}>{formatAmount(line.balance, currency)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BalanceSheetInitiator: React.FC<{
  onSubmit: (params: BalanceSheetParams) => void;
  initialParams?: BalanceSheetParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const [asOfDate, setAsOfDate] = useState(() => initialParams?.asOfDate || getCompanyToday(settings));

  useEffect(() => {
    if (!initialParams) {
      setAsOfDate(getCompanyToday(settings));
      return;
    }
    setAsOfDate(initialParams.asOfDate);
  }, [initialParams, settings]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ asOfDate });
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            {t('balanceSheet.asOfDate', { defaultValue: 'As of Date' })}
          </label>
          <DatePicker value={asOfDate} onChange={setAsOfDate} className="w-full" />
        </div>
        <div />
        <div>
          <Button type="submit" className="bg-slate-900 hover:bg-black text-white">
            {t('trialBalance.generate')}
          </Button>
        </div>
      </div>
    </form>
  );
};

const BalanceSheetReportContent: React.FC<{ params: BalanceSheetParams }> = ({ params }) => {
  const { t } = useTranslation('accounting');
  const { company } = useCompanyAccess();
  const { settings } = useCompanySettings();
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await accountingApi.getBalanceSheet(params.asOfDate);
        const payload = (response as any)?.data || response;
        setData(payload);
        setCollapsed(new Set());
      } catch (err: any) {
        setError(err?.message || t('balanceSheet.loadError', { defaultValue: 'Failed to load Balance Sheet. Please try again.' }));
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.asOfDate, t]);

  const baseCurrency = data?.baseCurrency || company?.baseCurrency || '';

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalLabel = t('balanceSheet.total');
  const subtitleText = t('balanceSheet.totalsShownIn', {
    currency: baseCurrency || t('balanceSheet.baseCurrencyLabel'),
  });

  const difference =
    data && Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity) > 0.01
      ? data.totalAssets - data.totalLiabilitiesAndEquity
      : 0;

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">
              {t('cashFlow.periodLabel', { defaultValue: 'Report Period' })}
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {formatCompanyDate(params.asOfDate, settings)}
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500 border border-slate-200 bg-slate-50 rounded-full px-2 py-1">
            {t('balanceSheet.baseCurrency')}: {baseCurrency || '—'}
          </span>
          {data && (
            <span
              className={`text-xs font-semibold rounded-full px-2 py-1 border ${
                data.isBalanced
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}
            >
              {data.isBalanced ? t('balanceSheet.balanced') : t('balanceSheet.outOfBalance')}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-5">
        {loading && !data ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500">{t('balanceSheet.loading')}</div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{t('balanceSheet.totalAssets')}</span>
                  <span className="text-lg font-bold text-slate-900 font-mono">{formatAmount(data.totalAssets, baseCurrency)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{t('balanceSheet.totalLiabilitiesEquity')}</span>
                  <span className="text-lg font-bold text-slate-900 font-mono">
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
                      side:
                        difference > 0
                          ? t('balanceSheet.assets', { defaultValue: 'Assets' })
                          : t('balanceSheet.liabilities', { defaultValue: 'Liabilities' }),
                    })}
                  </span>
                </div>
              )}
              {data.isBalanced && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                  <CheckCircle2 size={16} />
                  <span className="text-sm">{t('balanceSheet.balanced')}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500">{t('balanceSheet.noData')}</div>
        )}
      </div>
    </div>
  );
};

const BalanceSheetPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();

  const handleExportExcel = async (params: BalanceSheetParams) => {
    const response = await accountingApi.getBalanceSheet(params.asOfDate);
    const data = (response as any)?.data || response;
    const baseCurrency = data.baseCurrency || '';
    const rows: any[] = [];

    const pushSection = (section: BalanceSheetData['assets'], label: string) => {
      section.accounts.forEach((account) =>
        rows.push({ section: label, code: account.code, name: account.name, balance: account.balance })
      );
      rows.push({
        section: label,
        code: '',
        name: t('balanceSheet.totalOfSection', { section: label }),
        balance: section.total,
      });
    };

    pushSection(data.assets, t('balanceSheet.assets'));
    pushSection(data.liabilities, t('balanceSheet.liabilities'));
    pushSection(data.equity, t('balanceSheet.equity'));

    await exportToExcel(
      rows,
      [
        { header: t('balanceSheet.section', { defaultValue: 'Section' }), key: 'section' },
        { header: t('balanceSheet.code', { defaultValue: 'Code' }), key: 'code' },
        { header: t('balanceSheet.account', { defaultValue: 'Account' }), key: 'name' },
        {
          header: `${t('balanceSheet.balance', { defaultValue: 'Balance' })} (${baseCurrency})`,
          key: 'balance',
          isNumber: true,
        },
      ],
      `Balance-Sheet-${params.asOfDate}`,
      t('balanceSheet.title'),
      t('balanceSheet.asOf', { date: formatCompanyDate(params.asOfDate, settings) })
    );
  };

  return (
    <ReportContainer<BalanceSheetParams>
      title={t('balanceSheet.title')}
      subtitle={t('balanceSheet.subtitle')}
      initiator={BalanceSheetInitiator}
      ReportContent={BalanceSheetReportContent}
      onExportExcel={handleExportExcel}
      defaultParams={{ asOfDate: getCompanyToday(settings) }}
      config={{ paginated: false }}
    />
  );
};

export default BalanceSheetPage;

