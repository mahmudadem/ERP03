/**
 * SettingsAnalyticsTab.tsx
 *
 * Usage analytics tab for AI Assistant settings.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import type { AiUsageAnalyticsResponse } from '../../../api/aiAssistantApi';

interface SettingsAnalyticsTabProps {
  usageLoading: boolean;
  usageAnalytics: AiUsageAnalyticsResponse | null;
}

export const SettingsAnalyticsTab: React.FC<SettingsAnalyticsTabProps> = ({
  usageLoading,
  usageAnalytics,
}) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <SettingsSection
      title={t('settings.analyticsTitle', 'Usage Analytics')}
      description={t('settings.analyticsDesc', 'Monitor AI assistant usage, performance, and recent activity.')}
      onSave={() => {}}
      hideSaveButton
    >
      {usageLoading && (
        <div className="text-sm text-gray-500">{t('settings.analyticsLoading', 'Loading analytics...')}</div>
      )}

      {!usageLoading && usageAnalytics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCard label={t('settings.todayRequests', 'Today Requests')} value={String(usageAnalytics.summary.todayRequests)} />
            <MetricCard label={t('settings.successCount', 'Success')} value={String(usageAnalytics.summary.successCount)} />
            <MetricCard label={t('settings.failureCount', 'Failures')} value={String(usageAnalytics.summary.failureCount)} />
            <MetricCard label={t('settings.avgLatency', 'Avg Latency (ms)')} value={String(usageAnalytics.summary.avgLatencyMs)} />
            <MetricCard label={t('settings.totalTokens', 'Total Tokens')} value={new Intl.NumberFormat().format(usageAnalytics.summary.totalTokens)} />
          </div>

          <div className="border rounded-md overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">
              {t('settings.recentRequests', 'Recent Requests')}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white border-b">
                  <tr>
                    <th className="text-left px-3 py-2">{t('settings.colTime', 'Time')}</th>
                    <th className="text-left px-3 py-2">{t('settings.colProvider', 'Provider')}</th>
                    <th className="text-left px-3 py-2">{t('settings.colModel', 'Model')}</th>
                    <th className="text-left px-3 py-2">{t('settings.colStatus', 'Status')}</th>
                    <th className="text-right px-3 py-2">{t('settings.colTokens', 'Tokens')}</th>
                    <th className="text-right px-3 py-2">{t('settings.colLatency', 'Latency')}</th>
                  </tr>
                </thead>
                <tbody>
                  {usageAnalytics.recentLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{log.providerType}</td>
                      <td className="px-3 py-2 truncate max-w-[220px]" title={log.model}>{log.model}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{new Intl.NumberFormat().format(log.totalTokens)}</td>
                      <td className="px-3 py-2 text-right">{log.latencyMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!usageLoading && !usageAnalytics && (
        <div className="text-sm text-gray-500">{t('settings.analyticsUnavailable', 'Analytics data is currently unavailable.')}</div>
      )}
    </SettingsSection>
  );
};

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md border bg-white p-3">
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-1 text-lg font-semibold text-gray-800">{value}</div>
  </div>
);