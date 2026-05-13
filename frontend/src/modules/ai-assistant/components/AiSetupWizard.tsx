/**
 * AiSetupWizard.tsx
 *
 * 3-step setup wizard for first-time AI configuration.
 * Shows only when AI module is activated but no provider is configured yet.
 *
 * Step 1: Choose Mode (CREDITS or BYOK)
 * Step 2: Configure Provider & Model
 * Step 3: Test & Activate
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Key,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Zap,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import {
  aiAssistantApi,
  CertifiedProfileEntry,
  TenantAiProviderOption,
  TenantAiProviderModelOption,
  ProviderHealthResponse,
} from '../../../api/aiAssistantApi';

// ── Types ───────────────────────────────────────────────────────────────────────

export interface AiSetupWizardProps {
  onComplete: () => void;
  isConfigured: boolean;
}

type WizardStep = 1 | 2 | 3;
type SetupMode = 'CREDITS' | 'BYOK';

type DiagnosticStatus = 'idle' | 'running' | 'passed' | 'failed';

// ── Component ────────────────────────────────────────────────────────────────────

export const AiSetupWizard: React.FC<AiSetupWizardProps> = ({
  onComplete,
  isConfigured,
}) => {
  const { t } = useTranslation('aiAssistant');

  // ── Wizard state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>(1);
  const [mode, setMode] = useState<SetupMode>('CREDITS');

  // Step 2 — CREDITS
  const [certifiedModels, setCertifiedModels] = useState<CertifiedProfileEntry[]>([]);
  const [certifiedModelsLoading, setCertifiedModelsLoading] = useState(false);
  const [selectedModelEntry, setSelectedModelEntry] = useState<CertifiedProfileEntry | null>(null);

  // Step 2 — BYOK
  const [providers, setProviders] = useState<TenantAiProviderOption[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [modelOptions, setModelOptions] = useState<TenantAiProviderModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [byokModel, setByokModel] = useState('');
  const [byokApiKey, setByokApiKey] = useState('');
  const [byokEndpoint, setByokEndpoint] = useState('');

  // Step 3 — Diagnostic
  const [diagStatus, setDiagStatus] = useState<DiagnosticStatus>('idle');
  const [diagResult, setDiagResult] = useState<ProviderHealthResponse | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

  // Activation
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  // ── Don't render if already configured ──────────────────────────────────────

  if (isConfigured) return null;

  // ── Load data when entering step 2 ──────────────────────────────────────────

  const loadCertifiedModels = useCallback(async () => {
    try {
      setCertifiedModelsLoading(true);
      const result = await aiAssistantApi.listTenantCertifiedProfiles({ scope: 'ALL' });
      setCertifiedModels(result);
    } catch {
      setCertifiedModels([]);
    } finally {
      setCertifiedModelsLoading(false);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      setProvidersLoading(true);
      const result = await aiAssistantApi.listAvailableProviders();
      setProviders(result.filter((p) => p.enabled));
    } catch {
      setProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  const loadProviderModels = useCallback(async (providerId: string) => {
    try {
      setModelsLoading(true);
      const result = await aiAssistantApi.listProviderModels(providerId);
      setModelOptions(result);
    } catch {
      setModelOptions([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 2 && mode === 'CREDITS' && certifiedModels.length === 0) {
      loadCertifiedModels();
    }
  }, [step, mode, certifiedModels.length, loadCertifiedModels]);

  useEffect(() => {
    if (step === 2 && mode === 'BYOK' && providers.length === 0) {
      loadProviders();
    }
  }, [step, mode, providers.length, loadProviders]);

  useEffect(() => {
    if (selectedProviderId && mode === 'BYOK') {
      loadProviderModels(selectedProviderId);
    } else {
      setModelOptions([]);
    }
  }, [selectedProviderId, mode, loadProviderModels]);

  // ── Determine selected provider option ──────────────────────────────────────

  const selectedProvider = providers.find((p) => p.id === selectedProviderId) ?? null;

  // ── Can proceed from step 2? ────────────────────────────────────────────────

  const canProceedFromStep2 = mode === 'CREDITS'
    ? selectedModelEntry !== null
    : selectedProviderId !== '' && byokModel.trim() !== '' && (byokApiKey.trim() !== '' || (selectedProvider?.authType === 'none'));

  // ── Step navigation ─────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  // ── Step 3: Run diagnostic ──────────────────────────────────────────────────

  const runDiagnostic = useCallback(async () => {
    // First, save the settings so diagnostics can test them
    try {
      setDiagStatus('running');
      setDiagError(null);

      // Build settings payload based on mode
      const payload: Record<string, unknown> = {
        isEnabled: true,
      };

      if (mode === 'CREDITS' && selectedModelEntry) {
        const profile = selectedModelEntry.profile as Record<string, unknown>;
        payload.runtimeMode = 'CREDITS';
        payload.mode = 'certified_profile';
        payload.provider = (profile.provider as string) || 'openai_compatible';
        payload.model = (profile.modelId as string) || (profile.modelName as string) || '';
        payload.apiEndpoint = (profile.baseUrl as string) || undefined;
        payload.providerId = (profile.providerId as string) || '';
        payload.selectedModelProfileId = (profile.id as string) || '';
        payload.selectedProfileHash = (profile.profileHash as string) || '';
      } else if (mode === 'BYOK') {
        payload.runtimeMode = 'BYOK';
        payload.mode = 'legacy_unverified';
        payload.providerId = selectedProviderId;
        payload.provider = selectedProvider?.type || 'openai_compatible';
        payload.model = byokModel;
        payload.apiEndpoint = byokEndpoint || selectedProvider?.defaultBaseUrl || undefined;
        payload.apiKey = byokApiKey || undefined;
      }

      await aiAssistantApi.updateSettings(payload);

      // Then run diagnostics
      const result = await aiAssistantApi.checkProviderHealth();
      setDiagResult(result);
      setDiagStatus(result.ready !== false && result.success !== false ? 'passed' : 'failed');
    } catch (err: any) {
      setDiagResult(null);
      setDiagError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        t('setupWizard.diagnosticFailed', 'Connection test failed. Check your settings.')
      );
      setDiagStatus('failed');
    }
  }, [mode, selectedModelEntry, selectedProviderId, selectedProvider, byokModel, byokApiKey, byokEndpoint, t]);

  // Auto-run diagnostic when entering step 3
  useEffect(() => {
    if (step === 3 && diagStatus === 'idle') {
      runDiagnostic();
    }
  }, [step, diagStatus, runDiagnostic]);

  // ── Step 3: Activate ─────────────────────────────────────────────────────────

  const handleActivate = async () => {
    try {
      setActivating(true);
      setActivationError(null);

      // Settings are already saved from diagnostic step,
      // but we ensure isEnabled=true and save again to be safe
      const payload: Record<string, unknown> = { isEnabled: true };

      if (mode === 'CREDITS' && selectedModelEntry) {
        const profile = selectedModelEntry.profile as Record<string, unknown>;
        payload.runtimeMode = 'CREDITS';
        payload.mode = 'certified_profile';
        payload.provider = (profile.provider as string) || 'openai_compatible';
        payload.model = (profile.modelId as string) || (profile.modelName as string) || '';
        payload.apiEndpoint = (profile.baseUrl as string) || undefined;
        payload.providerId = (profile.providerId as string) || '';
        payload.selectedModelProfileId = (profile.id as string) || '';
        payload.selectedProfileHash = (profile.profileHash as string) || '';
      } else if (mode === 'BYOK') {
        payload.runtimeMode = 'BYOK';
        payload.mode = 'legacy_unverified';
        payload.providerId = selectedProviderId;
        payload.provider = selectedProvider?.type || 'openai_compatible';
        payload.model = byokModel;
        payload.apiEndpoint = byokEndpoint || selectedProvider?.defaultBaseUrl || undefined;
        payload.apiKey = byokApiKey || undefined;
      }

      await aiAssistantApi.updateSettings(payload);
      onComplete();
    } catch (err: any) {
      setActivationError(
        err?.response?.data?.error?.message ||
        err?.message ||
        t('setupWizard.activationError', 'Failed to activate. Please try again.')
      );
    } finally {
      setActivating(false);
    }
  };

  // ── Step indicator ──────────────────────────────────────────────────────────

  const StepIndicator: React.FC = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-300 ${
              s < step
                ? 'bg-indigo-600 text-white'
                : s === step
                ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
          </div>
          {s < 3 && (
            <div
              className={`h-0.5 w-12 transition-colors duration-300 ${
                s < step ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // ── Render step 1 ────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          {t('setupWizard.step1Title', 'Choose Mode')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('setupWizard.step1Description', 'How would you like to use AI?')}
        </p>
      </div>

      <div className="space-y-3">
        {/* CREDITS option */}
        <button
          type="button"
          onClick={() => setMode('CREDITS')}
          className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200 ${
            mode === 'CREDITS'
              ? 'border-indigo-500 bg-indigo-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
              mode === 'CREDITS' ? 'bg-indigo-600' : 'bg-gray-100'
            }`}>
              <Zap className={`w-6 h-6 ${mode === 'CREDITS' ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${mode === 'CREDITS' ? 'text-indigo-900' : 'text-gray-900'}`}>
                  {t('setupWizard.creditsMode', 'Use AI Credits')}
                </span>
                {mode === 'CREDITS' && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
                    ✓
                  </span>
                )}
              </div>
              <p className={`text-sm mt-1 ${mode === 'CREDITS' ? 'text-indigo-700' : 'text-gray-500'}`}>
                {t('setupWizard.creditsDescription', 'No API key needed. Use platform-provided AI.')}
              </p>
            </div>
          </div>
        </button>

        {/* BYOK option */}
        <button
          type="button"
          onClick={() => setMode('BYOK')}
          className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200 ${
            mode === 'BYOK'
              ? 'border-indigo-500 bg-indigo-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
              mode === 'BYOK' ? 'bg-indigo-600' : 'bg-gray-100'
            }`}>
              <Key className={`w-6 h-6 ${mode === 'BYOK' ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${mode === 'BYOK' ? 'text-indigo-900' : 'text-gray-900'}`}>
                  {t('setupWizard.byokMode', 'Bring Your Own Key')}
                </span>
                {mode === 'BYOK' && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
                    ✓
                  </span>
                )}
              </div>
              <p className={`text-sm mt-1 ${mode === 'BYOK' ? 'text-indigo-700' : 'text-gray-500'}`}>
                {t('setupWizard.byokDescription', 'Connect your own AI provider.')}
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  // ── Render step 2 ────────────────────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          {t('setupWizard.step2Title', 'Configure Provider')}
        </h2>
        <p className="text-sm text-gray-500">
          {mode === 'CREDITS'
            ? t('setupWizard.step2CreditsDesc', 'Select a certified model from the platform.')
            : t('setupWizard.step2ByokDesc', 'Enter your provider details and API key.')}
        </p>
      </div>

      {mode === 'CREDITS' ? renderCreditsConfig() : renderByokConfig()}
    </div>
  );

  // ── CREDITS model browser ─────────────────────────────────────────────────────

  const renderCreditsConfig = () => {
    if (certifiedModelsLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          <span className="ml-3 text-sm text-gray-500">
            {t('settings.certifiedModels.loading', 'Loading certified models...')}
          </span>
        </div>
      );
    }

    if (certifiedModels.length === 0) {
      return (
        <div className="text-center py-12">
          <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-500">
            {t('settings.certifiedModels.empty', 'No certified models available')}
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {certifiedModels.map((entry) => {
          const profile = entry.profile as Record<string, unknown>;
          const modelName = String(profile.modelId || profile.modelName || '');
          const providerName = String(profile.provider || profile.providerId || '');
          const status = String(profile.status || '');
          const isBordered = entry === selectedModelEntry;
          const topCert = entry.certifications?.[0];
          const categories = entry.certifications?.map((c) => c.category).join(', ') || '';

          return (
            <button
              key={String(profile.id || modelName)}
              type="button"
              onClick={() => setSelectedModelEntry(entry)}
              className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                isBordered
                  ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {modelName}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{providerName}</div>
                  {status && (
                    <span className={`inline-block mt-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${
                      status === 'recommended' ? 'bg-green-100 text-green-700'
                        : status === 'tested' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {t(`settings.modelStatuses.${status}`, status)}
                    </span>
                  )}
                  {categories && (
                    <div className="text-xs text-gray-400 mt-1 truncate">{categories}</div>
                  )}
                </div>
                {isBordered && (
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 ml-2" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // ── BYOK configuration ───────────────────────────────────────────────────────

  const renderByokConfig = () => (
    <div className="space-y-5">
      {/* Provider dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('settings.selectProvider', 'AI Provider')}
        </label>
        {providersLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
            <span className="text-sm text-gray-500">{t('settings.providersLoading', 'Loading providers...')}</span>
          </div>
        ) : (
          <select
            value={selectedProviderId}
            onChange={(e) => {
              setSelectedProviderId(e.target.value);
              setByokModel('');
            }}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          >
            <option value="">{t('setupWizard.selectProvider', 'Select a provider...')}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.byok ? ` (BYOK)` : ''}
                {p.supportsTools ? ` · ${t('settings.providerCapTools', 'Tools')}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Model dropdown / input */}
      {selectedProviderId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.model', 'Model')}
          </label>
          {modelsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="text-sm text-gray-500">{t('settings.modelsLoading', 'Loading models...')}</span>
            </div>
          ) : modelOptions.length > 0 ? (
            <select
              value={byokModel}
              onChange={(e) => setByokModel(e.target.value)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              <option value="">{t('setupWizard.selectModel', 'Select a model...')}</option>
              {modelOptions.map((m) => {
                const p = m.profile as Record<string, unknown>;
                const name = String(p.modelId || p.modelName || '');
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          ) : (
            <input
              type="text"
              value={byokModel}
              onChange={(e) => setByokModel(e.target.value)}
              placeholder={t('settings.modelPlaceholder', 'e.g., gpt-4o, claude-3-opus')}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            />
          )}
        </div>
      )}

      {/* API key */}
      {selectedProviderId && selectedProvider && selectedProvider.authType !== 'none' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.apiKey', 'API Key')}
          </label>
          <input
            type="password"
            value={byokApiKey}
            onChange={(e) => setByokApiKey(e.target.value)}
            placeholder={t('settings.apiKeyPlaceholder', 'Enter your API key')}
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          />
        </div>
      )}

      {/* Endpoint */}
      {selectedProviderId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.apiEndpoint', 'API Endpoint')}
          </label>
          <input
            type="text"
            value={byokEndpoint || selectedProvider?.defaultBaseUrl || ''}
            onChange={(e) => setByokEndpoint(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          />
          {selectedProvider?.defaultBaseUrl && (
            <p className="mt-1 text-xs text-gray-400">
              {t('settings.endpointFromProvider', 'Endpoint set by provider. Switch to Custom to edit.')}
            </p>
          )}
        </div>
      )}
    </div>
  );

  // ── Render step 3 ────────────────────────────────────────────────────────────

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          {t('setupWizard.step3Title', 'Test & Activate')}
        </h2>
        <p className="text-sm text-gray-500">
          {diagStatus === 'running'
            ? t('setupWizard.testingConnection', 'Testing your AI connection...')
            : t('setupWizard.step3Description', 'We will test your connection and activate the AI Assistant.')}
        </p>
      </div>

      {/* Diagnostic result card */}
      <div className={`rounded-xl border-2 p-6 text-center transition-all duration-300 ${
        diagStatus === 'passed'
          ? 'border-green-300 bg-green-50'
          : diagStatus === 'failed'
          ? 'border-red-300 bg-red-50'
          : 'border-gray-200 bg-gray-50'
      }`}>
        {diagStatus === 'running' && (
          <>
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">
              {t('setupWizard.testingConnection', 'Testing your AI connection...')}
            </p>
          </>
        )}
        {diagStatus === 'passed' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="text-sm text-green-700 font-medium">
              {t('setupWizard.diagnosticPassed', 'Connection test passed! AI is ready.')}
            </p>
          </>
        )}
        {diagStatus === 'failed' && (
          <>
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-red-700 font-medium">
              {t('setupWizard.diagnosticFailed', 'Connection test failed. Check your settings.')}
            </p>
            {diagError && (
              <p className="text-xs text-red-500 mt-2 max-w-md mx-auto">{diagError}</p>
            )}
            {diagResult?.checks && (
              <div className="mt-4 text-left max-w-md mx-auto">
                {diagResult.checks.map((check, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-sm">
                    {check.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-gray-700">{check.id}: {check.detail || (check.ok ? '✓' : '✗')}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary of chosen config */}
      {diagStatus !== 'idle' && diagStatus !== 'running' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <h4 className="font-medium text-gray-700 mb-2">
            {t('setupWizard.configurationSummary', 'Configuration Summary')}
          </h4>
          <div className="space-y-1.5 text-gray-600">
            <div className="flex justify-between">
              <span>{t('setupWizard.modeLabel', 'Mode')}:</span>
              <span className="font-medium text-gray-900">{mode === 'CREDITS' ? t('setupWizard.creditsMode', 'Use AI Credits') : t('setupWizard.byokMode', 'Bring Your Own Key')}</span>
            </div>
            {mode === 'CREDITS' && selectedModelEntry && (
              <div className="flex justify-between">
                <span>{t('settings.model', 'Model')}:</span>
                <span className="font-medium text-gray-900">{String((selectedModelEntry.profile as Record<string, unknown>).modelId || (selectedModelEntry.profile as Record<string, unknown>).modelName || '')}</span>
              </div>
            )}
            {mode === 'BYOK' && (
              <>
                <div className="flex justify-between">
                  <span>{t('settings.selectProvider', 'AI Provider')}:</span>
                  <span className="font-medium text-gray-900">{selectedProvider?.name || selectedProviderId}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('settings.model', 'Model')}:</span>
                  <span className="font-medium text-gray-900">{byokModel}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Activation error */}
      {activationError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {activationError}
        </div>
      )}
    </div>
  );

  // ── Overall layout ───────────────────────────────────────────────────────────

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="w-full max-w-[600px] bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('setupWizard.title', 'Set Up AI Assistant')}
          </h1>
        </div>

        {/* Step indicator */}
        <StepIndicator />

        {/* Step content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={diagStatus === 'running' || activating}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('setupWizard.back', 'Back')}
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={step === 2 && !canProceedFromStep2}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('setupWizard.next', 'Next')}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-3">
              {diagStatus === 'failed' && (
                <button
                  type="button"
                  onClick={runDiagnostic}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t('setupWizard.retryTest', 'Retry Test')}
                </button>
              )}
              <button
                type="button"
                onClick={handleActivate}
                disabled={activating || diagStatus === 'running' || diagStatus === 'idle'}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('setupWizard.activating', 'Activating...')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('setupWizard.activateButton', 'Activate AI Assistant')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiSetupWizard;