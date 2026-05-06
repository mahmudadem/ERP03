/**
 * AiAssistantSettingsPage.tsx
 *
 * Settings page for AI Assistant provider configuration.
 * Uses the shared ModuleSettingsLayout component.
 * Allows company admins to select provider preset, configure API keys, and toggle the module.
 *
 * Provider presets auto-fill endpoint and model fields.
 * The backend receives 'openai_compatible' for OpenAI, OpenRouter, Groq, and Custom.
 * Only 'mock' and 'ollama' are sent as distinct provider types.
 *
 * React best practices applied:
 * - Static data hoisted outside component (PROVIDER_PRESETS, PRESET_LABEL_FALLBACKS)
 * - Derived state computed during render (currentPreset, isCustom, showApiKeyField)
 * - Functional setState for preset changes
 * - Early returns for permission check
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Key, Globe, ToggleLeft, AlertTriangle, Sparkles, Server, BarChart3 } from 'lucide-react';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import { aiAssistantApi, AiSettingsDTO, AiUsageAnalyticsResponse } from '../../../api/aiAssistantApi';
import { useRBAC } from '../../../api/rbac/useRBAC';

// ── Types ──────────────────────────────────────────────────────────────────────

type AiProviderType = 'mock' | 'openai_compatible' | 'ollama';

interface ProviderPreset {
  id: string;
  providerType: AiProviderType;
  endpoint: string;
  defaultModel: string;
  requiresApiKey: boolean;
}

// ── Static data (hoisted outside component — rerender-hoist-jsx) ──────────────

const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'mock',        providerType: 'mock',               endpoint: '',                                    defaultModel: 'mock-assistant',               requiresApiKey: false },
  { id: 'openai',      providerType: 'openai_compatible',  endpoint: 'https://api.openai.com/v1',          defaultModel: 'gpt-4o',                       requiresApiKey: true  },
  { id: 'openrouter',  providerType: 'openai_compatible',  endpoint: 'https://openrouter.ai/api/v1',       defaultModel: 'openai/gpt-oss-120b:free',      requiresApiKey: true  },
  { id: 'groq',        providerType: 'openai_compatible',  endpoint: 'https://api.groq.com/openai/v1',     defaultModel: 'llama-3.3-70b-versatile',        requiresApiKey: true  },
  { id: 'ollama',      providerType: 'ollama',             endpoint: 'http://localhost:11434/v1',          defaultModel: 'llama3',                        requiresApiKey: false },
  { id: 'custom',      providerType: 'openai_compatible',  endpoint: '',                                    defaultModel: '',                              requiresApiKey: true  },
];

const PRESET_LABEL_FALLBACKS: Record<string, string> = {
  mock: 'Mock (Development)',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  ollama: 'Ollama (Local)',
  custom: 'Custom',
};

const PRESET_DESC_FALLBACKS: Record<string, string> = {
  mock: 'Returns simulated responses. Safe for development. No API key needed.',
  openai: 'GPT-4o and other OpenAI models. Requires an API key.',
  openrouter: 'Access 200+ models. Requires an OpenRouter API key.',
  groq: 'Ultra-fast inference. Requires a Groq API key.',
  ollama: 'Run models locally. No cloud API key needed.',
  custom: 'Use any OpenAI-compatible endpoint manually.',
};

// ── Helper: resolve loaded settings back to preset id ──────────────────────────

function resolvePresetId(provider: string, apiEndpoint: string): string {
  if (provider === 'mock') return 'mock';
  if (provider === 'ollama') return 'ollama';
  const matched = PROVIDER_PRESETS.find(
    (p) => p.providerType === 'openai_compatible' && p.id !== 'custom' && p.endpoint === apiEndpoint
  );
  return matched ? matched.id : 'custom';
}

// ── Component ───────────────────────────────────────────────────────────────────

export const AiAssistantSettingsPage: React.FC = () => {
  const { t } = useTranslation('aiAssistant');
  const { hasPermission } = useRBAC();

  const canManage = hasPermission('ai-assistant.settings.manage');
  const canView = hasPermission('ai-assistant.settings.view');

  // ── State ──────────────────────────────────────────────────────────────────

  const [settings, setSettings] = useState<AiSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('provider');
  const [error, setError] = useState<string | null>(null);

  const [presetId, setPresetId] = useState('mock');
  const [provider, setProvider] = useState<AiProviderType>('mock');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [maxRequestsPerDay, setMaxRequestsPerDay] = useState(100);
  const [isEnabled, setIsEnabled] = useState(true);
  const [usageAnalytics, setUsageAnalytics] = useState<AiUsageAnalyticsResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // ── Derived state (rerender-derived-state-no-effect) ────────────────────────

  const currentPreset = useMemo(
    () => PROVIDER_PRESETS.find((p) => p.id === presetId) ?? PROVIDER_PRESETS[5],
    [presetId]
  );

  const isCustom = presetId === 'custom';
  const showApiKeyField = provider !== 'mock' && currentPreset.requiresApiKey;
  const showProviderFields = provider !== 'mock';

  // ── Load settings ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!canView) return;

    let cancelled = false;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const result = await aiAssistantApi.getSettings();
        if (cancelled) return;
        const config = result.config;
        setSettings(config);
        setProvider(config.provider as AiProviderType);
        setModel(config.model || '');
        setApiEndpoint(config.apiEndpoint || '');
        setMaxTokens(config.maxTokensPerRequest || 4096);
        setMaxRequestsPerDay(config.maxRequestsPerDay || 100);
        setIsEnabled(config.isEnabled);
        setPresetId(resolvePresetId(config.provider, config.apiEndpoint || ''));
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.error?.message || err?.message || 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSettings();
    return () => { cancelled = true; };
  }, [canView]);

  useEffect(() => {
    if (!canView) return;

    let cancelled = false;

    const loadUsage = async () => {
      try {
        setUsageLoading(true);
        const result = await aiAssistantApi.getUsageAnalytics(50);
        if (!cancelled) setUsageAnalytics(result);
      } catch {
        if (!cancelled) setUsageAnalytics(null);
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    };

    loadUsage();
    return () => { cancelled = true; };
  }, [canView]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePresetChange = useCallback((newPresetId: string) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === newPresetId);
    if (!preset) return;

    setPresetId(newPresetId);
    setProvider(preset.providerType);

    if (newPresetId === 'custom') {
      setApiEndpoint('');
      setModel('');
    } else {
      setApiEndpoint(preset.endpoint);
      setModel(preset.defaultModel);
    }
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      const payload: Record<string, any> = {
        provider,
        model: model || undefined,
        maxTokensPerRequest: maxTokens || 4096,
        maxRequestsPerDay: maxRequestsPerDay || 100,
        isEnabled,
      };

      if (provider !== 'mock') {
        payload.apiKey = apiKey || undefined;
        payload.apiEndpoint = apiEndpoint || undefined;
      }

      const result = await aiAssistantApi.updateSettings(payload);
      setSettings(result.config);
      setApiKey('');
      const usage = await aiAssistantApi.getUsageAnalytics(50);
      setUsageAnalytics(usage);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [provider, model, apiKey, apiEndpoint, maxTokens, maxRequestsPerDay, isEnabled]);

  // ── Computed: has changes ──────────────────────────────────────────────────

  const hasChanges = settings && (
    settings.provider !== provider ||
    (settings.model || '') !== model ||
    settings.maxTokensPerRequest !== maxTokens ||
    settings.maxRequestsPerDay !== maxRequestsPerDay ||
    settings.isEnabled !== isEnabled ||
    (provider !== 'mock' && apiKey !== '') ||
    (provider !== 'mock' && (settings.apiEndpoint || '') !== apiEndpoint)
  );

  // ── Early return: no permission (js-early-exit) ────────────────────────────

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('settings.noPermission')}</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ModuleSettingsLayout
      title={t('settings.title', 'AI Assistant Settings')}
      subtitle={t('settings.subtitle', 'Configure the AI provider and preferences for your company.')}
      tabs={[
        { id: 'provider', label: t('settings.providerTab', 'Provider'), icon: Globe },
        { id: 'security', label: t('settings.securityTab', 'Security'), icon: Shield },
        { id: 'analytics', label: t('settings.analyticsTab', 'Analytics'), icon: BarChart3 },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'provider' && (
        <SettingsSection
          title={t('settings.providerTab', 'AI Provider')}
          description={t('settings.providerDesc', 'Select and configure the AI provider for your company.')}
          onSave={canManage ? handleSave : () => {}}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          {error && (
            <div className="mb-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {/* Enable/Disable */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                disabled={!canManage}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {t('settings.enableAssistant', 'Enable AI Assistant')}
                </span>
                <p className="text-xs text-gray-400">
                  {t('settings.enableAssistantDesc', 'When disabled, users cannot access the AI Assistant chat.')}
                </p>
              </div>
            </label>
          </div>

          {/* Provider Preset Dropdown */}
          <div className="mb-4">
            <label htmlFor="provider-preset" className="block text-sm font-medium text-gray-700 mb-1">
              <Server className="w-4 h-4 inline mr-1" />
              {t('settings.selectProvider', 'AI Provider')}
            </label>
            <select
              id="provider-preset"
              value={presetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              disabled={!canManage}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {PROVIDER_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {t(`settings.preset${preset.id.charAt(0).toUpperCase() + preset.id.slice(1)}`, PRESET_LABEL_FALLBACKS[preset.id])}
                </option>
              ))}
            </select>
          </div>

          {/* Preset description */}
          <div className="mb-6 px-3 py-2 bg-gray-50 border border-gray-100 rounded-md text-sm text-gray-500">
            {t(`settings.preset${currentPreset.id.charAt(0).toUpperCase() + currentPreset.id.slice(1)}Desc`, PRESET_DESC_FALLBACKS[currentPreset.id])}
            {currentPreset.endpoint && (
              <span className="ml-1 text-xs font-mono text-gray-400">
                ({currentPreset.endpoint})
              </span>
            )}
            {!currentPreset.requiresApiKey && currentPreset.id !== 'mock' && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                {t('settings.noApiKeyRequired', 'No API key')}
              </span>
            )}
            {currentPreset.requiresApiKey && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                {t('settings.apiKeyRequired', 'API key required')}
              </span>
            )}
          </div>

          {/* Provider Configuration Fields */}
          {showProviderFields && (
            <div className="space-y-4 mb-6 pl-4 border-l-2 border-indigo-200">
              {/* API Key */}
              {showApiKeyField && (
                <div>
                  <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
                    <Key className="w-4 h-4 inline mr-1" />
                    {t('settings.apiKey', 'API Key')}
                  </label>
                  <input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={settings?.hasApiKey ? '••••••••' : t('settings.apiKeyPlaceholder', 'Enter your API key')}
                    disabled={!canManage}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                  {settings?.hasApiKey && (
                    <p className="text-xs text-gray-400 mt-1">
                      {t('settings.apiKeySet', 'An API key is already configured. Enter a new one to replace it.')}
                    </p>
                  )}
                </div>
              )}

              {/* API Endpoint */}
              <div>
                <label htmlFor="api-endpoint" className="block text-sm font-medium text-gray-700 mb-1">
                  <Globe className="w-4 h-4 inline mr-1" />
                  {t('settings.apiEndpoint', 'API Endpoint')}
                </label>
                <input
                  id="api-endpoint"
                  type="text"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  disabled={!canManage || !isCustom}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm ${
                    !isCustom ? 'bg-gray-50 text-gray-600' : ''
                  }`}
                />
                {!isCustom && canManage && (
                  <p className="text-xs text-gray-400 mt-1">
                    {t('settings.endpointPresetLocked', 'Switch to "Custom" to edit the endpoint URL.')}
                  </p>
                )}
              </div>

              {/* Model */}
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  {t('settings.model', 'Model')}
                </label>
                <input
                  id="model"
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={currentPreset.defaultModel || 'gpt-4o'}
                  disabled={!canManage}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700">
              {t('settings.advanced', 'Advanced')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="max-tokens" className="block text-sm text-gray-600 mb-1">
                  {t('settings.maxTokens', 'Max Tokens per Request')}
                </label>
                <input
                  id="max-tokens"
                  type="number"
                  value={maxTokens || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaxTokens(val === '' ? 0 : parseInt(val) || 0);
                  }}
                  onBlur={() => {
                    if (!maxTokens || maxTokens < 256) setMaxTokens(4096);
                  }}
                  disabled={!canManage}
                  min={256}
                  max={32768}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
              <div>
                <label htmlFor="max-requests" className="block text-sm text-gray-600 mb-1">
                  {t('settings.maxRequests', 'Max Requests per Day')}
                </label>
                <input
                  id="max-requests"
                  type="number"
                  value={maxRequestsPerDay || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaxRequestsPerDay(val === '' ? 0 : parseInt(val) || 0);
                  }}
                  onBlur={() => {
                    if (!maxRequestsPerDay || maxRequestsPerDay < 1) setMaxRequestsPerDay(100);
                  }}
                  disabled={!canManage}
                  min={1}
                  max={10000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Current Config Info */}
          {settings && (
            <div className="text-xs text-gray-400 mt-4 pt-4 border-t">
              {t('settings.currentProvider', 'Current Provider')}: <strong>{settings.provider}</strong>
              {settings.model && <> | {t('settings.currentModel', 'Model')}: <strong>{settings.model}</strong></>}
              {' | '}{t('settings.hasApiKey', 'API Key')}: <strong>{settings.hasApiKey ? '✓' : '✗'}</strong>
              {' | '}{t('settings.lastUpdated', 'Updated')}: {new Date(settings.updatedAt).toLocaleString()}
            </div>
          )}
        </SettingsSection>
      )}

      {activeTab === 'security' && (
        <SettingsSection
          title={t('settings.securityTab', 'Security & Safety')}
          description={t('settings.securityDesc', 'Learn about the security and safety design of the AI Assistant.')}
          onSave={() => {}}
          hideSaveButton
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  {t('settings.safetyTitle', 'Advisory-Only Design')}
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  {t('settings.safetyDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-amber-800">
                  {t('settings.apiKeySecurity', 'API Key Security')}
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  {t('settings.apiKeySecurityDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <ToggleLeft className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-gray-800">
                  {t('settings.rateLimiting', 'Rate Limiting')}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('settings.rateLimitingDesc')}
                </p>
              </div>
            </div>
          </div>
        </SettingsSection>
      )}

      {activeTab === 'analytics' && (
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
      )}
    </ModuleSettingsLayout>
  );
};

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md border bg-white p-3">
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-1 text-lg font-semibold text-gray-800">{value}</div>
  </div>
);

export default AiAssistantSettingsPage;
