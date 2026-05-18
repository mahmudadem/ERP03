import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { aiAssistantApi } from '../../../api/aiAssistantApi';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

interface UsageSummary {
  period: string;
  totalRequests: number;
  totalTokensUsed: number;
  creditsRemaining?: number;
  requestsByUser: Array<{ userId: string; requests: number }>;
  requestsByDay: Array<{ date: string; count: number }>;
}

export const AiUsageDashboardPage: React.FC = () => {
  const { t } = useTranslation('aiAssistant');
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    aiAssistantApi.getUsageSummary()
      .then((res: any) => {
        setSummary(res);
      })
      .catch((err: any) => {
        setError(err?.message || t('usageDashboard.loadError', 'Failed to load usage data'));
      })
      .finally(() => setLoading(false));
  }, [companyId, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500">{t('usageDashboard.loading', 'Loading usage data...')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2">{t('usageDashboard.title', 'AI Usage Dashboard')}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {t('usageDashboard.period', 'Period')}: {summary.period}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">{t('usageDashboard.totalRequests', 'Total Requests')}</p>
          <p className="text-3xl font-bold">{summary.totalRequests}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">{t('usageDashboard.totalTokens', 'Tokens Used')}</p>
          <p className="text-3xl font-bold">{summary.totalTokensUsed.toLocaleString()}</p>
        </div>
        {summary.creditsRemaining !== undefined && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">{t('usageDashboard.creditsRemaining', 'Credits Remaining')}</p>
            <p className="text-3xl font-bold">{summary.creditsRemaining}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">{t('usageDashboard.requestsByDay', 'Requests by Day')}</h2>
          {summary.requestsByDay.length === 0 ? (
            <p className="text-sm text-gray-400">{t('usageDashboard.noData', 'No data')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">{t('usageDashboard.date', 'Date')}</th>
                  <th className="text-right py-2 font-medium text-gray-500">{t('usageDashboard.count', 'Count')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.requestsByDay.map(row => (
                  <tr key={row.date} className="border-b border-gray-50">
                    <td className="py-2">{row.date}</td>
                    <td className="py-2 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">{t('usageDashboard.requestsByUser', 'Requests by User')}</h2>
          {summary.requestsByUser.length === 0 ? (
            <p className="text-sm text-gray-400">{t('usageDashboard.noData', 'No data')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">{t('usageDashboard.user', 'User')}</th>
                  <th className="text-right py-2 font-medium text-gray-500">{t('usageDashboard.requests', 'Requests')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.requestsByUser.map(row => (
                  <tr key={row.userId} className="border-b border-gray-50">
                    <td className="py-2 font-mono text-xs">{row.userId.slice(0, 12)}...</td>
                    <td className="py-2 text-right">{row.requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={() => navigate('/ai-assistant/settings')}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          &larr; {t('usageDashboard.backToSettings', 'Back to Settings')}
        </button>
      </div>
    </div>
  );
};

export default AiUsageDashboardPage;
