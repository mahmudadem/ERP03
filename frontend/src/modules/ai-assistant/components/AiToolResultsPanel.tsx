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
        <div key={`${tool.toolName}-${idx}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
            <Database className="w-3.5 h-3.5" />
            <span>{t('chat.toolData', 'Data Tool Result')}:</span>
            <span className="font-mono">{tool.toolName}</span>
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

      <table className="w-full text-left border border-gray-200 rounded overflow-hidden">
        <thead className="bg-white">
          <tr>
            <th className="px-2 py-1">{t('chat.code', 'Code')}</th>
            <th className="px-2 py-1">{t('chat.account', 'Account')}</th>
            <th className="px-2 py-1 text-right">{t('chat.balance', 'Balance')}</th>
          </tr>
        </thead>
        <tbody>
          {topAccounts.slice(0, 5).map((acc, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-2 py-1">{String(acc.code || '')}</td>
              <td className="px-2 py-1">{String(acc.name || '')}</td>
              <td className="px-2 py-1 text-right">{fmt(asNumber(acc.netBalance))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ProfitAndLossView: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const { t } = useTranslation('aiAssistant');
  const revenueBreakdown = (data.revenueBreakdown as Array<Record<string, unknown>> | undefined) || [];
  const expensesBreakdown = (data.expensesBreakdown as Array<Record<string, unknown>> | undefined) || [];

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
  <div className="bg-white border border-gray-200 rounded px-2 py-1.5">
    <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
    <div className="font-semibold text-gray-800">{value}</div>
  </div>
);

const MiniList: React.FC<{ title: string; items: Array<Record<string, unknown>> }> = ({ title, items }) => (
  <div className="bg-white border border-gray-200 rounded p-2">
    <div className="text-[11px] font-medium text-gray-700 mb-1">{title}</div>
    <div className="space-y-1">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between gap-2">
          <span className="truncate text-gray-600">{String(item.accountName || item.name || '')}</span>
          <span className="font-medium text-gray-800">{fmt(asNumber(item.amount ?? item.balance ?? item.netBalance))}</span>
        </div>
      ))}
    </div>
  </div>
);

export default AiToolResultsPanel;
