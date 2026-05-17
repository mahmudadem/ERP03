/**
 * useAiSettings.ts
 *
 * Custom hook that encapsulates all state management, effects, and handlers
 * for the AI Assistant settings page. Keeps the page component purely
 * presentational (layout + composition).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  aiAssistantApi,
  AiSettingsDTO,
  AiUsageAnalyticsResponse,
  ProviderHealthResponse,
  CertifiedProfileEntry,
  AiCertificationResult,
  AiCertificationCategory,
  TenantAiProviderOption,
  TenantAiProviderModelOption,
} from '../../../api/aiAssistantApi';
import type { AiProviderType, ConversationContextMode } from '../utils/settingsHelpers';
import { PROVIDER_PRESETS, resolvePresetId, resolveProviderChange } from '../utils/settingsHelpers';

export function useAiSettings(canView: boolean, canManage: boolean) {
  const { t } = useTranslation('aiAssistant');

  // ── State ──────────────────────────────────────────────────────────────────

  const [settings, setSettings] = useState<AiSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [presetId, setPresetId] = useState('mock');
  const [provider, setProvider] = useState<AiProviderType>('mock');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [maxRequestsPerDay, setMaxRequestsPerDay] = useState(100);
  const [conversationContextMode, setConversationContextMode] = useState<ConversationContextMode>('balanced');
  const [includePreviousToolResults, setIncludePreviousToolResults] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);
  const [allowUnverifiedModels, setAllowUnverifiedModels] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<'BYOK' | 'CREDITS' | 'DISABLED'>('BYOK');
  const [allowedRuntimeModes, setAllowedRuntimeModes] = useState<Array<'BYOK' | 'CREDITS' | 'DISABLED'>>(['BYOK', 'CREDITS']);
  const [usageAnalytics, setUsageAnalytics] = useState<AiUsageAnalyticsResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<ProviderHealthResponse | null>(null);
  const [healthTesting, setHealthTesting] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Certified Models & Registration state
  const [showCertifiedModels, setShowCertifiedModels] = useState(false);
  const [selectedCertifiedProfile, setSelectedCertifiedProfile] = useState<CertifiedProfileEntry | null>(null);
  const [erp03AvailableModels, setErp03AvailableModels] = useState<CertifiedProfileEntry[]>([]);
  const [erp03ModelsLoading, setErp03ModelsLoading] = useState(false);
  const [selectedErp03Profile, setSelectedErp03Profile] = useState<CertifiedProfileEntry | null>(null);

  // Inline Registration & Certification state
  const [registeredProfileId, setRegisteredProfileId] = useState<string | null>(null);
  const [registeredProfileData, setRegisteredProfileData] = useState<Record<string, unknown> | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredDiagnosticResult, setRegisteredDiagnosticResult] = useState<ProviderHealthResponse | null>(null);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [registeredCertResult, setRegisteredCertResult] = useState<AiCertificationResult | null>(null);
  const [registeredCertCategory, setRegisteredCertCategory] = useState<AiCertificationCategory>('GENERAL_CHAT');
  const [isRunningCert, setIsRunningCert] = useState(false);
  const [isDeprecating, setIsDeprecating] = useState(false);

  // Dynamic provider state
  const [availableProviders, setAvailableProviders] = useState<TenantAiProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [providerModels, setProviderModels] = useState<TenantAiProviderModelOption[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  // ── Derived state ───────────────────────────────────────────────────────────

  const currentPreset = useMemo(
    () => PROVIDER_PRESETS.find((p) => p.id === presetId) ?? PROVIDER_PRESETS[5],
    [presetId]
  );

  const selectedProviderOption = useMemo(
    () => availableProviders.find((p) => p.id === selectedProviderId) ?? null,
    [selectedProviderId, availableProviders]
  );

  const useDynamicProvider = selectedProviderOption !== null;
  const isCustom = presetId === 'custom';

  const showApiKeyField = runtimeMode === 'BYOK' && (() => {
    if (provider === 'mock') return false;
    if (selectedProviderOption) {
      return selectedProviderOption.byok && ['api_key', 'bearer', 'custom'].includes(selectedProviderOption.authType);
    }
    return currentPreset.requiresApiKey;
  })();

  const showProviderFields = provider !== 'mock';
  const modelFieldId = useDynamicProvider && providerModels.length > 0 ? 'model-select' : 'model-input';

  const certificationMatch = useMemo((): { entry: CertifiedProfileEntry; isGlobal: boolean } | null => {
    if (runtimeMode !== 'BYOK' || !model || erp03AvailableModels.length === 0) return null;
    const resolvedProviderType = selectedProviderOption?.type || provider;
    const resolvedProviderId = selectedProviderOption?.id || '';
    const matched = erp03AvailableModels.find((entry) => {
      const p = entry.profile as Record<string, unknown>;
      const profileModelId = String(p.modelId || p.modelName || '');
      const profileProvider = String(p.provider || p.providerId || '');
      return profileModelId === model && (profileProvider === resolvedProviderType || profileProvider === resolvedProviderId || profileProvider === currentPreset.providerType);
    });
    if (!matched) return null;
    const isGlobal = matched.certifications?.some((c) => c.scope === 'GLOBAL') ?? false;
    return { entry: matched, isGlobal };
  }, [runtimeMode, model, provider, selectedProviderOption, currentPreset.providerType, erp03AvailableModels]);

  // ── Effects ─────────────────────────────────────────────────────────────────

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
        setConversationContextMode(config.conversationContextMode || 'balanced');
        setIncludePreviousToolResults(config.includePreviousToolResults !== false);
        setIsEnabled(config.isEnabled);
        setAllowUnverifiedModels(config.allowUnverifiedModels === true);
        setPresetId(resolvePresetId(config.provider, config.apiEndpoint || ''));
        if (config.runtimeMode) setRuntimeMode(config.runtimeMode as any);
        if (Array.isArray(config.allowedRuntimeModes)) setAllowedRuntimeModes(config.allowedRuntimeModes as any);
        if (config.providerId) {
          setSelectedProviderId(config.providerId);
        } else if (config.provider === 'mock') {
          setSelectedProviderId('__mock__');
        } else if (!config.providerId && config.provider && config.provider !== 'mock') {
          setSelectedProviderId('');
        }
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

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    const loadModels = async () => {
      try {
        setErp03ModelsLoading(true);
        // In CREDITS mode, ask the backend to filter out any certified model that doesn't
        // have an active platform runtime profile — otherwise tenants could pick a model
        // the platform can't actually serve and get a 403 mid-chat.
        const mode = runtimeMode === 'CREDITS' ? 'CREDITS' : 'BYOK';
        const result = await aiAssistantApi.listTenantCertifiedProfiles({ scope: 'ALL', mode });
        if (!cancelled) setErp03AvailableModels(result);
      } catch {
        if (!cancelled) setErp03AvailableModels([]);
      } finally {
        if (!cancelled) setErp03ModelsLoading(false);
      }
    };
    loadModels();
    return () => { cancelled = true; };
  }, [canView, runtimeMode]);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    const loadProviders = async () => {
      try {
        setProvidersLoading(true);
        const result = await aiAssistantApi.listAvailableProviders();
        if (!cancelled) setAvailableProviders(result.filter((p) => p.enabled));
      } catch {
        if (!cancelled) setAvailableProviders([]);
      } finally {
        if (!cancelled) setProvidersLoading(false);
      }
    };
    loadProviders();
    return () => { cancelled = true; };
  }, [canView]);

  useEffect(() => {
    if (!selectedProviderOption) {
      setProviderModels([]);
      return;
    }
    let cancelled = false;
    const loadModels = async () => {
      try {
        setModelsLoading(true);
        const result = await aiAssistantApi.listProviderModels(selectedProviderOption.id);
        if (!cancelled) setProviderModels(result);
      } catch {
        if (!cancelled) setProviderModels([]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    };
    loadModels();
    return () => { cancelled = true; };
  }, [selectedProviderOption]);

  useEffect(() => {
    if (!canView || !settings || erp03ModelsLoading) return;
    const profileId = settings.selectedModelProfileId;
    const profileHash = settings.selectedProfileHash;
    const mode = settings.mode;
    if (!profileId) return;
    const matchedCertified = erp03AvailableModels.find(
      (entry) => entry.profile.id === profileId && entry.profile.profileHash === profileHash
    );
    if (matchedCertified) {
      setSelectedErp03Profile(matchedCertified);
      return;
    }
    if (mode === 'certified_profile' || mode === 'custom_uncertified') {
      let cancelled = false;
      const fetchProfile = async () => {
        try {
          const profileData = await aiAssistantApi.getTenantCustomModelProfile(profileId);
          if (!cancelled) {
            setRegisteredProfileId(profileId);
            setRegisteredProfileData(profileData as unknown as Record<string, unknown>);
          }
        } catch {
          if (!cancelled) {
            setRegisteredProfileId(null);
            setRegisteredProfileData(null);
          }
        }
      };
      fetchProfile();
      return () => { cancelled = true; };
    }
  }, [canView, settings, erp03AvailableModels, erp03ModelsLoading]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleProviderChange = useCallback((newProviderId: string) => {
    setHealthResult(null);
    setHealthError(null);
    setSelectedCertifiedProfile(null);
    setRegisteredProfileId(null);
    setRegisteredProfileData(null);
    const resolved = resolveProviderChange(newProviderId, availableProviders);
    if (resolved) {
      setSelectedProviderId(resolved.selectedProviderId);
      setPresetId(resolved.presetId);
      setProvider(resolved.provider);
      setApiEndpoint(resolved.apiEndpoint);
      setModel(resolved.model);
    }
  }, [availableProviders]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      setHealthResult(null);
      setHealthError(null);
      const payload: Record<string, any> = {
        provider,
        model: model || undefined,
        maxTokensPerRequest: maxTokens || 4096,
        maxRequestsPerDay: maxRequestsPerDay || 100,
        conversationContextMode,
        includePreviousToolResults,
        isEnabled,
        allowUnverifiedModels,
        runtimeMode,
        mode: settings?.mode || 'legacy_unverified',
        providerId: selectedProviderOption?.id || settings?.providerId || '',
        selectedModelProfileId: settings?.selectedModelProfileId || '',
        selectedProfileHash: settings?.selectedProfileHash || '',
      };
      if (provider !== 'mock') {
        payload.apiKey = apiKey || undefined;
        payload.apiEndpoint = apiEndpoint || undefined;
      }
      if (selectedCertifiedProfile) {
        const profile = selectedCertifiedProfile.profile as Record<string, unknown>;
        payload.mode = 'certified_profile';
        payload.selectedModelProfileId = profile.id;
        payload.selectedProfileHash = profile.profileHash;
        payload.providerId = profile.providerId;
      }
      if (runtimeMode === 'CREDITS' && selectedErp03Profile) {
        const profile = selectedErp03Profile.profile as Record<string, unknown>;
        payload.mode = 'certified_profile';
        payload.selectedModelProfileId = profile.id;
        payload.selectedProfileHash = profile.profileHash;
        payload.providerId = profile.providerId;
        payload.provider = (profile.provider as string) || 'openai_compatible';
        payload.model = (profile.modelId as string) || (profile.modelName as string) || undefined;
        payload.apiEndpoint = (profile.baseUrl as string) || undefined;
      }
      if (runtimeMode === 'BYOK' && !selectedCertifiedProfile && registeredProfileId) {
        const profileData = registeredProfileData as Record<string, unknown> | null;
        if (profileData) {
          payload.mode = 'certified_profile';
          payload.selectedModelProfileId = registeredProfileId;
          payload.selectedProfileHash = profileData.profileHash;
          payload.providerId = profileData.providerId;
        }
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
  }, [provider, model, apiKey, apiEndpoint, maxTokens, maxRequestsPerDay, conversationContextMode, includePreviousToolResults, isEnabled, runtimeMode, selectedCertifiedProfile, registeredProfileId, registeredProfileData, selectedErp03Profile, selectedProviderOption]);

  const handleRunDiagnostics = useCallback(async () => {
    try {
      setHealthTesting(true);
      setHealthError(null);
      const result = await aiAssistantApi.checkProviderHealth();
      setHealthResult(result);
    } catch (err: any) {
      setHealthResult(null);
      setHealthError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        t('settings.diagnosticsFailed', 'Failed to run AI diagnostics')
      );
    } finally {
      setHealthTesting(false);
    }
  }, [t]);

  const handleSelectCertifiedProfile = useCallback((entry: CertifiedProfileEntry) => {
    const profile = entry.profile as Record<string, unknown>;
    const profileProviderId = String(profile.providerId || '');
    const matchedProvider = profileProviderId
      ? availableProviders.find((p) => p.id === profileProviderId)
      : null;
    if (matchedProvider) {
      setSelectedProviderId(matchedProvider.id);
      let legacyType: AiProviderType = 'openai_compatible';
      if (matchedProvider.type === 'ollama') legacyType = 'ollama';
      setProvider(legacyType);
      setApiEndpoint(matchedProvider.defaultBaseUrl || String(profile.baseUrl || ''));
    } else {
      setError(t('settings.certifiedModels.providerUnavailable', 'This certified model belongs to a provider that is not currently available in your provider list. Please ask your administrator to enable that provider.'));
      setShowCertifiedModels(false);
      return;
    }
    setModel(String(profile.modelId || profile.modelName || ''));
    setSelectedCertifiedProfile(entry);
    setRegisteredProfileId(null);
    setRegisteredProfileData(null);
    setShowCertifiedModels(false);
  }, [availableProviders, t]);

  const handleRegisterAndCertify = useCallback(async () => {
    if (!model) return;
    try {
      setIsRegistering(true);
      setError(null);
      const dynamicProviderId = selectedProviderOption?.id;
      const result = await aiAssistantApi.createTenantCustomModelProfile({
        providerId: dynamicProviderId || provider,
        provider: selectedProviderOption?.type || currentPreset.providerType,
        modelId: model,
        displayName: undefined,
        baseUrl: apiEndpoint || selectedProviderOption?.defaultBaseUrl || undefined,
        toolMode: 'text_plan',
        dataFilterPolicyId: 'ai-data-filter-v1',
        safetyPolicyId: 'proposal-draft-sandbox-v1',
        systemPromptPolicyId: 'erp-assistant-base-v1',
        temperature: 0.7,
        maxOutputTokens: 4096,
      });
      setRegisteredProfileData(result);
      setRegisteredProfileId((result as any).id || '');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to register model profile');
    } finally {
      setIsRegistering(false);
    }
  }, [model, provider, currentPreset.providerType, apiEndpoint, selectedProviderOption]);

  const handleRunRegisteredDiagnostics = useCallback(async () => {
    if (!registeredProfileId) return;
    try {
      setIsRunningDiag(true);
      setError(null);
      const result = await aiAssistantApi.runTenantCustomModelDiagnostics(registeredProfileId);
      setRegisteredDiagnosticResult(result);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Diagnostics failed');
    } finally {
      setIsRunningDiag(false);
    }
  }, [registeredProfileId]);

  const handleRunRegisteredCertification = useCallback(async () => {
    if (!registeredProfileId) return;
    const profileHash = (registeredProfileData as any)?.profileHash;
    if (!profileHash) {
      setError('Profile hash not available. Please try registering again.');
      return;
    }
    try {
      setIsRunningCert(true);
      setError(null);
      const result = await aiAssistantApi.runTenantCustomModelCertification(registeredProfileId, {
        profileHash,
        category: registeredCertCategory,
      });
      setRegisteredCertResult(result);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Certification failed');
    } finally {
      setIsRunningCert(false);
    }
  }, [registeredProfileId, registeredProfileData, registeredCertCategory]);

  const handleCancelRegistration = useCallback(() => {
    setRegisteredProfileId(null);
    setRegisteredProfileData(null);
    setRegisteredDiagnosticResult(null);
    setRegisteredCertResult(null);
    setRegisteredCertCategory('GENERAL_CHAT');
  }, []);

  const handleDeprecateProfile = useCallback(async () => {
    if (!registeredProfileId || !canManage) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('settings.customModel.deprecateConfirm', 'Deprecate this model profile? It will be removed from your settings and can no longer be used.'))) return;
    try {
      setIsDeprecating(true);
      setError(null);
      await aiAssistantApi.deleteTenantCustomModelProfile(registeredProfileId);
      handleCancelRegistration();
      const result = await aiAssistantApi.getSettings();
      const config = result.config;
      setSettings(config);
      setProvider(config.provider as AiProviderType);
      setModel(config.model || '');
      setApiEndpoint(config.apiEndpoint || '');
      setMaxTokens(config.maxTokensPerRequest || 4096);
      setMaxRequestsPerDay(config.maxRequestsPerDay || 100);
      setConversationContextMode(config.conversationContextMode || 'balanced');
      setIncludePreviousToolResults(config.includePreviousToolResults !== false);
      setIsEnabled(config.isEnabled);
      setPresetId(resolvePresetId(config.provider, config.apiEndpoint || ''));
      if (config.runtimeMode) setRuntimeMode(config.runtimeMode as any);
      if (Array.isArray(config.allowedRuntimeModes)) setAllowedRuntimeModes(config.allowedRuntimeModes as any);
      if (config.providerId) {
        setSelectedProviderId(config.providerId);
      } else if (config.provider === 'mock') {
        setSelectedProviderId('__mock__');
      } else {
        setSelectedProviderId('');
      }
      setSelectedErp03Profile(null);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to deprecate profile');
    } finally {
      setIsDeprecating(false);
    }
  }, [registeredProfileId, canManage, t, handleCancelRegistration]);

  // ── Computed: has changes ──────────────────────────────────────────────────

  const hasChanges = settings && (
    settings.provider !== provider ||
    (settings.model || '') !== (model || '') ||
    (settings.maxTokensPerRequest || 4096) !== maxTokens ||
    (settings.maxRequestsPerDay || 100) !== maxRequestsPerDay ||
    (settings.conversationContextMode || 'balanced') !== conversationContextMode ||
    (settings.includePreviousToolResults !== false) !== includePreviousToolResults ||
    settings.isEnabled !== isEnabled ||
    (settings.allowUnverifiedModels === true) !== allowUnverifiedModels ||
    (settings.runtimeMode || 'BYOK') !== runtimeMode ||
    (settings.providerId || 'mock') !== (selectedProviderId === '__mock__' ? 'mock' : (selectedProviderId || 'mock')) ||
    (provider !== 'mock' && apiKey !== '') ||
    (provider !== 'mock' && (settings.apiEndpoint || '') !== (apiEndpoint || '')) ||
    (selectedCertifiedProfile !== null && selectedCertifiedProfile.profile.id !== settings?.selectedModelProfileId) ||
    (registeredProfileId !== null && registeredProfileId !== settings?.selectedModelProfileId) ||
    (selectedErp03Profile !== null && selectedErp03Profile.profile.id !== settings?.selectedModelProfileId)
  );
  const hasUnsavedChanges = Boolean(hasChanges);

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    // State
    settings, loading, saving, error,
    presetId, provider, model, apiKey, apiEndpoint,
    maxTokens, maxRequestsPerDay,
    conversationContextMode, includePreviousToolResults,
    isEnabled, allowUnverifiedModels, runtimeMode, allowedRuntimeModes,
    usageAnalytics, usageLoading,
    healthResult, healthTesting, healthError,
    showCertifiedModels, selectedCertifiedProfile,
    erp03AvailableModels, erp03ModelsLoading, selectedErp03Profile,
    registeredProfileId, registeredProfileData,
    registeredDiagnosticResult, registeredCertResult,
    registeredCertCategory,
    isRegistering, isRunningDiag, isRunningCert, isDeprecating,
    availableProviders, selectedProviderId, providerModels,
    providersLoading, modelsLoading,
    // Derived
    currentPreset, selectedProviderOption, useDynamicProvider,
    isCustom, showApiKeyField, showProviderFields, modelFieldId,
    certificationMatch, hasChanges, hasUnsavedChanges,
    // Setters
    setConversationContextMode, setIncludePreviousToolResults,
    setIsEnabled, setAllowUnverifiedModels, setRuntimeMode, setAllowedRuntimeModes,
    setApiKey, setApiEndpoint, setModel, setMaxTokens, setMaxRequestsPerDay,
    setSelectedErp03Profile, setRegisteredCertCategory,
    setShowCertifiedModels,
    // Handlers
    handleProviderChange, handleSave, handleRunDiagnostics,
    handleSelectCertifiedProfile, handleRegisterAndCertify,
    handleRunRegisteredDiagnostics, handleRunRegisteredCertification,
    handleCancelRegistration, handleDeprecateProfile,
  };
}