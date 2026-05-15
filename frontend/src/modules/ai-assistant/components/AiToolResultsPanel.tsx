import React from 'react';
import { useTranslation } from 'react-i18next';
import { Database, AlertTriangle } from 'lucide-react';
import { AiToolCallResultDTO } from '../../../api/aiAssistantApi';

interface Props {
  toolResults: AiToolCallResultDTO[];
}

const asNumber = (v: unknown): number => (typeof v === 'number' ? v : 0);

const fmt = (n: number) => new Intl.NumberFormat().format(n);

export const AiToolResultsPanel: React.FC<Props> = ({ toolResults }) => {
  const { t } = useTranslation('aiAssistant');

  if (!toolResults || toolResults.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      {toolResults.map((tool, idx) => (
        <div key={`${tool.toolName}-${idx}`} className="rounded-xl border border-indigo-100 bg-white shadow-sm p-4 mt-2">
          <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-600 mb-4 uppercase tracking-wider">
            <Database className="w-4 h-4" />
            <span>{t('chat.toolData', 'Data Tool Result')}</span>
            <span className="text-indigo-300 mx-1">•</span>
            <span className="font-mono text-[10px] normal-case bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-700">{tool.toolName}</span>
            {((tool as any).durationMs || (tool as any).round) && (
              <span className="text-[9px] text-gray-400 normal-case ml-auto flex items-center gap-2">
                {(tool as any).round && <span>Round {(tool as any).round}</span>}
                {(tool as any).durationMs && <span>{(tool as any).durationMs}ms</span>}
              </span>
            )}
          </div>

          {!tool.result?.success && (
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
              <div>
                <div className="font-medium">{t('chat.toolUnavailable', 'Data unavailable')}</div>
                <div>{tool.result?.error || t('chat.toolUnavailableDesc', 'Could not retrieve tool data for this request.')}</div>
              </div>
            </div>
          )}

          {tool.result?.success && tool.toolName === 'accounting.getTrialBalanceSummary' && (
            <TrialBalanceView data={tool.result.data || {}} />
          )}

          {tool.result?.success && tool.toolName === 'accounting.getAccountBalance' && (
            <AccountBalanceView data={tool.result.data || {}} />
          )}

          {tool.result?.success && tool.toolName === 'accounting.getProfitAndLoss' && (
            <ProfitAndLossView data={tool.result.data || {}} />
          )}

          {tool.result?.success && tool.toolName === 'accounting.getBalanceSheet' && (
            <BalanceSheetView data={tool.result.data || {}} />
          )}
        </div>
      ))}
    </div>
  );
};

const TrialBalanceView: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const { t } = useTranslation('aiAssistant');
  const topAccounts = (data.topAccounts as Array<Record<string, unknown>> | undefined) || [];

  return (
    <div className="space-y-2 text-xs text-gray-700">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label={t('chat.totalDebit', 'Total Debit')} value={fmt(asNumber(data.totalDebit))} />
        <Stat label={t('chat.totalCredit', 'Total Credit')} value={fmt(asNumber(data.totalCredit))} />
        <Stat label={t('chat.difference', 'Difference')} value={fmt(asNumber(data.difference))} />
        <Stat label={t('chat.accounts', 'Accounts')} value={fmt(asNumber(data.accountCount))} />
      </div>

      <div className="overflow-x-auto mt-3 border border-gray-100 rounded-lg shadow-sm">
        <table className="min-w-full text-left divide-y divide-gray-100">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="px-3 py-2 text-xs font-semibold text-gray-600">{t('chat.code', 'Code')}</th>
              <th className="px-3 py-2 text-xs font-semibold text-gray-600">{t('chat.account', 'Account')}</th>
              <th className="px-3 py-2 text-xs font-semibold text-gray-600 text-right">{t('chat.balance', 'Balance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {topAccounts.slice(0, 5).map((acc, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-3 py-2 font-mono text-gray-500">{String(acc.code || '')}</td>
                <td className="px-3 py-2 font-medium text-gray-800">{String(acc.name || '')}</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(asNumber(acc.netBalance))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AccountBalanceView: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div className="space-y-3 text-xs text-gray-700">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Stat label={t('chat.balance', 'Balance')} value={fmt(asNumber(data.balance))} />
        <Stat label={t('chat.totalDebit', 'Total Debit')} value={fmt(asNumber(data.debit))} />
        <Stat label={t('chat.totalCredit', 'Total Credit')} value={fmt(asNumber(data.credit))} />
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">{t('chat.code', 'Code')}</span>
          <span className="font-mono font-medium text-gray-900">{String(data.accountCode || '')}</span>
        </div>
        <div className="flex items-center justify-between gap-3 mt-1">
          <span className="text-gray-500">{t('chat.account', 'Account')}</span>
          <span className="font-medium text-gray-900 text-right">{String(data.accountName || '')}</span>
        </div>
        <div className="flex items-center justify-between gap-3 mt-1">
          <span className="text-gray-500">{t('chat.classification', 'Classification')}</span>
          <span className="font-medium text-gray-900">{String(data.classification || '')}</span>
        </div>
      </div>
    </div>
  );
};

const ProfitAndLossView: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const { t } = useTranslation('aiAssistant');
  const revenueBreakdown = (data.revenueBreakdown as { items?: Array<Record<string, unknown>> } | undefined)?.items || [];
  const expensesBreakdown = (data.expensesBreakdown as { items?: Array<Record<string, unknown>> } | undefined)?.items || [];

  return (
    <div className="space-y-2 text-xs text-gray-700">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Stat label={t('chat.revenue', 'Revenue')} value={fmt(asNumber(data.revenue))} />
        <Stat label={t('chat.expenses', 'Expenses')} value={fmt(asNumber(data.expenses))} />
        <Stat label={t('chat.netProfit', 'Net Profit')} value={fmt(asNumber(data.netProfit))} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <MiniList title={t('chat.topRevenueAccounts', 'Top Revenue Accounts')} items={revenueBreakdown.slice(0, 5)} />
        <MiniList title={t('chat.topExpenseAccounts', 'Top Expense Accounts')} items={expensesBreakdown.slice(0, 5)} />
      </div>
    </div>
  );
};

const BalanceSheetView: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div className="space-y-2 text-xs text-gray-700">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label={t('chat.totalAssets', 'Total Assets')} value={fmt(asNumber(data.totalAssets))} />
        <Stat label={t('chat.totalLiabilities', 'Total Liabilities')} value={fmt(asNumber(data.totalLiabilities))} />
        <Stat label={t('chat.totalEquity', 'Total Equity')} value={fmt(asNumber(data.totalEquity))} />
        <Stat label={t('chat.difference', 'Difference')} value={fmt(asNumber(data.difference))} />
      </div>

      <div className="text-[11px] text-gray-600">
        {t('chat.balanceStatus', 'Balance status')}: {Boolean(data.isBalanced) ? t('chat.balanced', 'Balanced') : t('chat.imbalanced', 'Imbalanced')}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-gradient-to-b from-white to-gray-50/50 border border-gray-100 rounded-lg px-3 py-2.5 shadow-sm">
    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 font-medium">{label}</div>
    <div className="font-semibold text-gray-900 text-base">{value}</div>
  </div>
);

const MiniList: React.FC<{ title: string; items: Array<Record<string, unknown>> }> = ({ title, items }) => (
  <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
    <div className="text-xs font-semibold text-gray-800 mb-2">{title}</div>
    <div className="space-y-1.5">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between gap-3">
          <span className="truncate text-gray-600 text-[11px]">{String(item.accountName || item.name || '')}</span>
          <span className="font-medium text-gray-900 text-[11px]">{fmt(asNumber(item.amount ?? item.balance ?? item.netBalance))}</span>
        </div>
      ))}
    </div>
  </div>
);

export default AiToolResultsPanel;
