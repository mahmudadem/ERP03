/**
 * SuperAdminDiagnosticsModal.tsx
 *
 * Dedicated modal for running model diagnostics using the Super Admin's own API key.
 * Does NOT use any tenant's data or settings — the admin provides their own key.
 * The key is used only for the test and is never stored.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  AiModelProfile,
  ProviderHealthResponse,
  superAdminApi,
} from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import {
  SuperAdminBadge,
  SuperAdminModal,
} from './SuperAdminPage';

interface SuperAdminDiagnosticsModalProps {
  profile: AiModelProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const SuperAdminDiagnosticsModal: React.FC<SuperAdminDiagnosticsModalProps> = ({
  profile,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation('common');

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ProviderHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill baseUrl from profile
  useEffect(() => {
    if (isOpen && profile) {
      setBaseUrl(profile.baseUrl || '');
      setApiKey('');
      setResult(null);
      setError(null);
      setShowKey(false);
    }
  }, [isOpen, profile]);

  const profileLabel = useMemo(() => {
    if (!profile) return '';
    return `${profile.modelId || profile.modelName} · ${profile.providerId || profile.provider}`;
  }, [profile]);

  const handleRunDiagnostics = async () => {
    if (!profile || !apiKey.trim()) return;
    try {
      setTesting(true);
      setError(null);
      const response = await superAdminApi.runAdminDiagnostics(profile.id, {
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || undefined,
      });
      setResult(response as ProviderHealthResponse);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Diagnostics failed');
      setResult(null);
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    setShowKey(false);
    setResult(null);
    setError(null);
    onClose();
  };

  if (!isOpen || !profile) return null;

  return (
    <SuperAdminModal
      title={t('superAdmin.aiModels.diagnosticsModal.title', 'Run Diagnostics')}
      subtitle={profileLabel}
      onClose={handleClose}
      size="lg"
      footer={
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-400">
            {t('superAdmin.aiModels.diagnosticsModal.apiKeyFooterNote', 'Your API key is not stored and is only used for this test.')}
          </p>
          <button
            onClick={handleClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('superAdmin.aiModels.diagnosticsModal.close', 'Close')}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Info box */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              {t('superAdmin.aiModels.diagnosticsModal.infoText', 'Diagnostics test provider connection and model capabilities using YOUR API key. The key is used only for this test and is never stored or logged.')}
            </p>
          </div>
        </div>

        {/* Model Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {t('superAdmin.aiModels.diagnosticsModal.modelInfo', 'Model Info')}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Provider:</span>
              <span className="ml-2 font-medium text-slate-800">{profile.provider}</span>
            </div>
            <div>
              <span className="text-slate-500">Provider ID:</span>
              <span className="ml-2 font-mono text-xs text-slate-600">{profile.providerId || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Model:</span>
              <span className="ml-2 font-medium text-slate-800">{profile.modelId || profile.modelName}</span>
            </div>
            <div>
              <span className="text-slate-500">Status:</span>
              <SuperAdminBadge
                tone={profile.status === 'recommended' ? 'green' : profile.status === 'tested' ? 'blue' : profile.status === 'experimental' ? 'amber' : 'slate'}
              >
                {t(`superAdmin.aiModels.status.${profile.status}`, profile.status)}
              </SuperAdminBadge>
            </div>
          </div>
        </div>

        {/* Base URL */}
        <div>
          <label htmlFor="admin-diag-baseurl" className="block text-sm font-medium text-slate-700 mb-1">
            {t('superAdmin.aiModels.diagnosticsModal.baseUrl', 'Base URL')}
          </label>
          <input
            id="admin-diag-baseurl"
            type="text"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">
            Pre-filled from profile. Edit to override.
          </p>
        </div>

        {/* API Key */}
        <div>
          <label htmlFor="admin-diag-apikey" className="block text-sm font-medium text-slate-700 mb-1">
            {t('superAdmin.aiModels.diagnosticsModal.apiKey', 'Your API Key')}
          </label>
          <div className="relative">
            <input
              id="admin-diag-apikey"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={t('superAdmin.aiModels.diagnosticsModal.apiKeyPlaceholder', 'Enter your API key for this test')}
              className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {t('superAdmin.aiModels.diagnosticsModal.apiKeyHelp', 'The key is used only for this test and is never stored or logged.')}
          </p>
        </div>

        {/* Run button */}
        <button
          onClick={handleRunDiagnostics}
          disabled={testing || !apiKey.trim()}
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={clsx('h-4 w-4', testing && 'animate-spin')} />
          {testing
            ? t('superAdmin.aiModels.actions.testing', 'Testing...')
            : t('superAdmin.aiModels.diagnosticsModal.runWithKey', 'Run Diagnostics')
          }
        </button>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {t('superAdmin.aiModels.diagnosticsModal.results', 'Results')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <SuperAdminBadge tone={result.ready ? 'green' : 'red'}>
                {result.ready
                  ? t('superAdmin.aiModels.diagnosticsPanel.chatReady', 'Chat ready')
                  : t('superAdmin.aiModels.diagnosticsPanel.chatNotReady', 'Chat not ready')
                }
              </SuperAdminBadge>
              {result.toolDiagnostics && (
                <SuperAdminBadge tone={result.toolDiagnostics.erpToolsReady ? 'green' : 'amber'}>
                  {result.toolDiagnostics.recommendedMode || 'unavailable'}
                </SuperAdminBadge>
              )}
            </div>
            {(result.checks || []).map(check => (
              <div key={check.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                <div className="font-medium text-slate-800">
                  {t(`superAdmin.aiModels.diagnosticsPanel.checks.${check.id}`, check.id)}:
                  {' '}
                  <SuperAdminBadge tone={check.status === 'passed' ? 'green' : check.status === 'failed' ? 'red' : 'slate'}>
                    {t(`superAdmin.aiModels.diagnostics.${check.status}`, check.status)}
                  </SuperAdminBadge>
                </div>
                {check.detail && <div className="mt-0.5 text-xs text-slate-500">{check.detail}</div>}
              </div>
            ))}
          </div>
        )}

        {/* No results placeholder */}
        {!result && !error && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            {t('superAdmin.aiModels.diagnosticsModal.noResults', 'Click "Run Diagnostics" to test the provider connection.')}
          </div>
        )}
      </div>
    </SuperAdminModal>
  );
};