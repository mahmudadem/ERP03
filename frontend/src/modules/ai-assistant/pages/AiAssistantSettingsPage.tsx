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
import type { TFunction } from 'i18next';
import {
  Shield,
  Key,
  Globe,
  AlertTriangle,
  Sparkles,
  Server,
  BarChart3,
  Activity,
  CheckCircle2,
  CircleMinus,
  XCircle,
  ShieldCheck,
  ExternalLink,
  ToggleLeft,
} from 'lucide-react';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import {
  aiAssistantApi,
  AiSettingsDTO,
  AiUsageAnalyticsResponse,
  ProviderHealthResponse,
  CertifiedProfileEntry,
  CreateTenantCustomModelProfilePayload,
  AiCertificationResult,
  AiCertificationCategory,
  TenantAiProviderOption,
  TenantAiProviderModelOption,
} from '../../../api/aiAssistantApi';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { CertifiedModelsModal } from '../components/CertifiedModelsModal';

// ── Types ──────────────────────────────────────────────────────────────────────

type AiProviderType = 'mock' | 'openai_compatible' | 'ollama';
type ConversationContextMode = 'minimal' | 'balanced' | 'deep';

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
  mock: 'Mock (Dev Only)',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  ollama: 'Ollama (Local)',
  custom: 'Custom',
};

const PRESET_DESC_FALLBACKS: Record<string, string> = {
  mock: 'Simulated responses for development testing only. Not a real AI provider.',
  openai: 'GPT-4o and other OpenAI models. Requires an API key.',
  openrouter: 'Access 200+ models. Requires an OpenRouter API key.',
  groq: 'Ultra-fast inference. Requires a Groq API key.',
  ollama: 'Run models locally. No cloud API key needed.',
  custom: 'Use any OpenAI-compatible endpoint manually.',
};

const DIAGNOSTIC_CHECK_FALLBACKS: Record<string, string> = {
  network: 'Provider connection',
  inference: 'Model response',
  nativeToolCalling: 'Native tool calling',
  textPlan: 'Guarded text-plan fallback',
};

const DIAGNOSTIC_MODE_FALLBACKS: Record<string, string> = {
  'native-tool-calling': 'Native tool calling',
  'text-plan': 'Guarded text-plan',
  'text-only': 'Text only',
  unavailable: 'Unavailable',
};

const getDiagnosticStatusClasses = (status: string): string => {
  if (status === 'passed') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'failed') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const getDiagnosticStatusIcon = (status: string) => {
  if (status === 'passed') return CheckCircle2;
  if (status === 'failed') return XCircle;
  return CircleMinus;
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
  const [conversationContextMode, setConversationContextMode] = useState<ConversationContextMode>('balanced');
  const [includePreviousToolResults, setIncludePreviousToolResults] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);
  const [runtimeMode, setRuntimeMode] = useState<'BYOK' | 'CREDITS' | 'DISABLED'>('BYOK');
  const [allowedRuntimeModes, setAllowedRuntimeModes] = useState<Array<'BYOK' | 'CREDITS' | 'DISABLED'>>(['BYOK', 'CREDITS']);
  const [usageAnalytics, setUsageAnalytics] = useState<AiUsageAnalyticsResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
const [healthResult, setHealthResult] = useState<ProviderHealthResponse | null>(null);
  const [healthTesting, setHealthTesting] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // ── Certified Models & Registration state ──────────────────────────────────
  const [showCertifiedModels, setShowCertifiedModels] = useState(false);
  const [selectedCertifiedProfile, setSelectedCertifiedProfile] = useState<CertifiedProfileEntry | null>(null);
  // ERP03 AI inline model selection
  const [erp03AvailableModels, setErp03AvailableModels] = useState<CertifiedProfileEntry[]>([]);
  const [erp03ModelsLoading, setErp03ModelsLoading] = useState(false);
  const [selectedErp03Profile, setSelectedErp03Profile] = useState<CertifiedProfileEntry | null>(null);

  // ── Inline Registration & Certification state ──────────────────────────────
  const [registeredProfileId, setRegisteredProfileId] = useState<string | null>(null);
  const [registeredProfileData, setRegisteredProfileData] = useState<Record<string, unknown> | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredDiagnosticResult, setRegisteredDiagnosticResult] = useState<ProviderHealthResponse | null>(null);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [registeredCertResult, setRegisteredCertResult] = useState<AiCertificationResult | null>(null);
  const [registeredCertCategory, setRegisteredCertCategory] = useState<AiCertificationCategory>('GENERAL_CHAT');
  const [isRunningCert, setIsRunningCert] = useState(false);
  const [isDeprecating, setIsDeprecating] = useState(false);

  // ── Dynamic provider state (provider-driven flow) ───────────────────────────
  const [availableProviders, setAvailableProviders] = useState<TenantAiProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [providerModels, setProviderModels] = useState<TenantAiProviderModelOption[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  // ── Derived state (rerender-derived-state-no-effect) ────────────────────────

  const currentPreset = useMemo(
    () => PROVIDER_PRESETS.find((p) => p.id === presetId) ?? PROVIDER_PRESETS[5],
    [presetId]
  );

  // Resolved dynamic provider (from API). Null when using mock/preset/custom.
  const selectedProviderOption = useMemo(
    () => availableProviders.find((p) => p.id === selectedProviderId) ?? null,
    [selectedProviderId, availableProviders]
  );

  // Whether to use dynamic provider flow (vs. hardcoded preset flow).
  // Dynamic providers are the source of truth when available.
  const useDynamicProvider = selectedProviderOption !== null;

  const isCustom = presetId === 'custom';

  // Show API key field when: BYOK mode AND (dynamic provider requires key OR preset requires key)
  const showApiKeyField = runtimeMode === 'BYOK' && (() => {
    if (provider === 'mock') return false;
    if (selectedProviderOption) {
      return selectedProviderOption.byok && ['api_key', 'bearer', 'custom'].includes(selectedProviderOption.authType);
    }
    return currentPreset.requiresApiKey;
  })();

  // Show provider config fields (endpoint, model) for non-mock providers
  const showProviderFields = provider !== 'mock';
  const modelFieldId = useDynamicProvider && providerModels.length > 0 ? 'model-select' : 'model-input';

  // ── Computed: certification match from catalog ─────────────────────────────
  // Check if the current BYOK model+provider matches an existing certified profile
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
        setConversationContextMode(config.conversationContextMode || 'balanced');
        setIncludePreviousToolResults(config.includePreviousToolResults !== false);
        setIsEnabled(config.isEnabled);
        setPresetId(resolvePresetId(config.provider, config.apiEndpoint || ''));
        if (config.runtimeMode) setRuntimeMode(config.runtimeMode as any);
        if (Array.isArray(config.allowedRuntimeModes)) setAllowedRuntimeModes(config.allowedRuntimeModes as any);
        // Restore provider selection: providerId for dynamic, mock/custom sentinels, or preset fallback
        if (config.providerId) {
          setSelectedProviderId(config.providerId);
        } else if (config.provider === 'mock') {
          setSelectedProviderId('__mock__');
        } else if (!config.providerId && config.provider && config.provider !== 'mock') {
          // No providerId saved — keep preset-based selection (selectedProviderId stays '')
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

  // Load certified models for ERP03 AI inline selector
  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    const loadModels = async () => {
      try {
        setErp03ModelsLoading(true);
        const result = await aiAssistantApi.listTenantCertifiedProfiles({ scope: 'ALL' });
        if (!cancelled) setErp03AvailableModels(result);
      } catch {
        if (!cancelled) setErp03AvailableModels([]);
      } finally {
        if (!cancelled) setErp03ModelsLoading(false);
      }
    };
    loadModels();
    return () => { cancelled = true; };
  }, [canView]);

  // ── Load available providers (provider-driven flow) ────────────────────────
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

  // ── Load provider models when selectedProviderId changes ───────────────────
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

  // ── Restore selected profile reference after settings + certified models load ──
  // This bridges the gap between loadSettings() and loadCertifiedModels() so that
  // on page reload, the UI correctly shows the previously selected certified profile
  // or registered custom profile card.
  useEffect(() => {
    if (!canView || !settings || erp03ModelsLoading) return;

    const profileId = settings.selectedModelProfileId;
    const profileHash = settings.selectedProfileHash;
    const mode = settings.mode;

    if (!profileId) return;

    // Case 1: Settings reference a certified profile (GLOBAL or TENANT)
    const matchedCertified = erp03AvailableModels.find(
      (entry) => entry.profile.id === profileId && entry.profile.profileHash === profileHash
    );
    if (matchedCertified) {
      setSelectedErp03Profile(matchedCertified);
      return;
    }

    // Case 2: Settings reference a registered custom profile that is NOT yet certified
    // (mode is 'certified_profile' because save sets it when profileId+hash exist,
    // but the profile won't be in the certified list until actual certification passes)
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
          // Profile may have been deleted/deprecated — ignore silently
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
    // Clear previous state
    setHealthResult(null);
    setHealthError(null);
    setSelectedCertifiedProfile(null);
    setRegisteredProfileId(null);
    setRegisteredProfileData(null);

    if (newProviderId === '__mock__' || newProviderId === 'mock') {
      // Mock provider — built-in
      setSelectedProviderId('__mock__');
      setPresetId('mock');
      setProvider('mock');
      setModel('mock-assistant');
      setApiEndpoint('');
      return;
    }

    if (newProviderId === '__custom__' || newProviderId === 'custom') {
      // Custom provider — manual entry escape hatch
      setSelectedProviderId('__custom__');
      setPresetId('custom');
      setProvider('openai_compatible');
      setApiEndpoint('');
      setModel('');
      return;
    }

    // Legacy preset IDs (openai, openrouter, groq, ollama) — map to closest behavior
    const legacyPreset = PROVIDER_PRESETS.find((p) => p.id === newProviderId);
    if (legacyPreset && !availableProviders.some((p) => p.id === newProviderId)) {
      setSelectedProviderId('');
      setPresetId(newProviderId);
      setProvider(legacyPreset.providerType);
      setApiEndpoint(legacyPreset.endpoint);
      setModel(legacyPreset.defaultModel);
      return;
    }

    // Dynamic provider from API
    setSelectedProviderId(newProviderId);
    const found = availableProviders.find((p) => p.id === newProviderId);
    if (found) {
      // Map provider type to legacy provider type
      let legacyType: AiProviderType = 'openai_compatible';
      if (found.type === 'ollama') legacyType = 'ollama';
      // openai, openai_compatible, google_gemini, anthropic, custom all map to openai_compatible
      setProvider(legacyType);
      setApiEndpoint(found.defaultBaseUrl || '');
      // Model will auto-load via useEffect on selectedProviderId
      setModel('');
    } else {
      // Provider not found in available list — fall back to custom
      setSelectedProviderId('__custom__');
      setPresetId('custom');
      setProvider('openai_compatible');
      setApiEndpoint('');
      setModel('');
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
        runtimeMode,
        mode: 'legacy_unverified',
        providerId: selectedProviderOption?.id || '',
        selectedModelProfileId: '',
        selectedProfileHash: '',
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

      // ERP03 AI mode: use the inline-selected certified model
      if (runtimeMode === 'CREDITS' && selectedErp03Profile) {
        const profile = selectedErp03Profile.profile as Record<string, unknown>;
        payload.mode = 'certified_profile';
        payload.selectedModelProfileId = profile.id;
        payload.selectedProfileHash = profile.profileHash;
        payload.providerId = profile.providerId;
        // For ERP03 AI, provider/model come from the certified profile, not the preset
        payload.provider = (profile.provider as string) || 'openai_compatible';
        payload.model = (profile.modelId as string) || (profile.modelName as string) || undefined;
        payload.apiEndpoint = (profile.baseUrl as string) || undefined;
      }

      // BYOK mode: use the inline-registered certified model
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
    // Try to match the certified profile's providerId with available dynamic providers
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
    // Note: the user must still Save Settings to persist the change
  }, [availableProviders, t]);

  // ── Inline Registration & Certification ────────────────────────────────────

  const handleRegisterAndCertify = useCallback(async () => {
    if (!model) return;
    try {
      setIsRegistering(true);
      setError(null);
      // Use dynamic provider ID when available, otherwise fall back
      const dynamicProviderId = selectedProviderOption?.id;
      const result = await aiAssistantApi.createTenantCustomModelProfile({
        providerId: dynamicProviderId || provider,
        provider: selectedProviderOption?.type || currentPreset.providerType,
        modelId: model,
        displayName: undefined,
        baseUrl: apiEndpoint || selectedProviderOption?.defaultBaseUrl || undefined,
        // ── Auto-configured safe defaults for certification ──
        toolMode: 'text_plan',                    // Safe: guarded text-plan tools
        dataFilterPolicyId: 'ai-data-filter-v1',  // Required for sensitive categories
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
      // Reset all registration state
      handleCancelRegistration();
      // Reload settings to reflect cleared profile reference
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
      // Restore provider selection
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
    (settings.model || '') !== model ||
    settings.maxTokensPerRequest !== maxTokens ||
    settings.maxRequestsPerDay !== maxRequestsPerDay ||
    (settings.conversationContextMode || 'balanced') !== conversationContextMode ||
    (settings.includePreviousToolResults !== false) !== includePreviousToolResults ||
    settings.isEnabled !== isEnabled ||
    (settings.runtimeMode || 'BYOK') !== runtimeMode ||
    (settings.providerId || '') !== (selectedProviderId || '') ||
    (provider !== 'mock' && apiKey !== '') ||
    (provider !== 'mock' && (settings.apiEndpoint || '') !== apiEndpoint) ||
    selectedCertifiedProfile !== null ||
    registeredProfileId !== null ||
    selectedErp03Profile !== null
  );
  const hasUnsavedChanges = Boolean(hasChanges);

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

          {/* Enable/Disable Toggle */}
          <div className="mb-6 flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div>
              <span className="text-sm font-medium text-gray-700">
                {t('settings.enableAssistant', 'Enable AI Assistant')}
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('settings.enableAssistantDesc', 'When disabled, users cannot access the AI Assistant chat.')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              onClick={() => canManage && setIsEnabled(!isEnabled)}
              disabled={!canManage}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                isEnabled ? 'bg-indigo-600' : 'bg-gray-300'
              } ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Config wrapper — dimmed when disabled */}
          <div className={isEnabled ? '' : 'opacity-40 pointer-events-none select-none'}>

            {/* Runtime Mode Radio Buttons */}
            {allowedRuntimeModes.length > 1 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Shield className="w-4 h-4 inline mr-1" />
                  {t('settings.runtimeMode', 'Connection Mode')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {allowedRuntimeModes.map((mode) => {
                    const isActive = runtimeMode === mode;
                    const modeKey = mode === 'CREDITS' ? 'CREDITS' : mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => canManage && setRuntimeMode(mode)}
                        disabled={!canManage}
                        className={`relative flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all ${
                          isActive
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        } ${!canManage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isActive ? 'border-indigo-600' : 'border-gray-300'
                          }`}>
                            {isActive && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                          </div>
                          <span className={`text-sm font-medium ${isActive ? 'text-indigo-700' : 'text-gray-700'}`}>
                            {t(`settings.runtimeMode${modeKey}`, mode)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 ml-6">
                          {t(`settings.runtimeMode${modeKey}Desc`, '')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Certified Models Reference (always visible) */}
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-indigo-800">
                    {t('settings.certifiedModelsReferenceTitle', 'Certified Models')}
                  </h3>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    {t('settings.certifiedModelsReferenceDesc', 'See which models are tested and certified by the platform.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCertifiedModels(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('settings.certifiedModels.openModal', 'Browse Certified Models')}
                  </button>
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* BYOK Mode — Full provider config + custom model flow       */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {runtimeMode === 'BYOK' && (
              <>
                {/* Provider Dropdown — dynamic from API + built-in fallbacks */}
                <div className="mb-4">
                  <label htmlFor="provider-select" className="block text-sm font-medium text-gray-700 mb-1">
                    <Server className="w-4 h-4 inline mr-1" />
                    {t('settings.selectProvider', 'AI Provider')}
                  </label>
                  {providersLoading ? (
                    <div className="w-full px-3 py-2.5 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-400">
                      {t('settings.providersLoading', 'Loading providers...')}
                    </div>
                  ) : (
                    <select
                      id="provider-select"
                      value={selectedProviderId || presetId}
                      onChange={(e) => {
                        handleProviderChange(e.target.value);
                      }}
                      disabled={!canManage}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      {/* Mock (Development) — always available */}
                      <option value="__mock__">{t('settings.presetMock', 'Mock (Development)')}</option>
                      {/* Dynamic providers from API */}
                      {availableProviders.length > 0 && (
                        <optgroup label={t('settings.providerGroupAvailable', 'Available Providers')}>
                          {availableProviders.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.byok ? ` (${t('settings.providerByok', 'BYOK')})` : ` (${t('settings.providerManaged', 'Managed')})`}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {/* Fallback built-in presets when no dynamic providers */}
                      {availableProviders.length === 0 && PROVIDER_PRESETS.filter((p) => p.id !== 'mock' && p.id !== 'custom').map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {t(`settings.preset${preset.id.charAt(0).toUpperCase() + preset.id.slice(1)}`, PRESET_LABEL_FALLBACKS[preset.id])}
                        </option>
                      ))}
                      {/* Custom — manual entry escape hatch */}
                      <option value="__custom__">{t('settings.presetCustom', 'Custom')}</option>
                    </select>
                  )}
                </div>

                {/* Provider description / badges */}
                <div className="mb-6 px-3 py-2 bg-gray-50 border border-gray-100 rounded-md text-sm text-gray-500">
                  {selectedProviderOption ? (
                    <>
                      <span className="font-medium text-gray-700">{selectedProviderOption.name}</span>
                      <span className="ml-2 text-xs text-gray-400">({selectedProviderOption.type})</span>
                      {selectedProviderOption.defaultBaseUrl && (
                        <span className="ml-1 text-xs font-mono text-gray-400">({selectedProviderOption.defaultBaseUrl})</span>
                      )}
                      {selectedProviderOption.byok ? (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                          {t('settings.apiKeyRequired', 'API key required')}
                        </span>
                      ) : (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                          {t('settings.noApiKeyRequired', 'No API key')}
                        </span>
                      )}
                      {selectedProviderOption.supportsTools && (
                        <span className="ml-1 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded border border-blue-200">
                          {t('settings.providerCapTools', 'Tools')}
                        </span>
                      )}
                    </>
                  ) : selectedProviderId === '__mock__' || presetId === 'mock' ? (
                    <>
                      {t('settings.presetMockDesc', 'Returns simulated responses. Safe for development. No API key needed.')}
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                        {t('settings.noApiKeyRequired', 'No API key')}
                      </span>
                    </>
                  ) : (
                    <>
                      {t('settings.presetCustomDesc', 'Use any OpenAI-compatible endpoint manually.')}
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                        {t('settings.apiKeyRequired', 'API key required')}
                      </span>
                    </>
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

                    {/* API Endpoint — editable only for custom providers */}
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
                        disabled={!canManage || (!!selectedProviderOption && selectedProviderId !== '__custom__')}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm ${
                          !!selectedProviderOption && selectedProviderId !== '__custom__' ? 'bg-gray-50 text-gray-600' : ''
                        }`}
                      />
                      {!!selectedProviderOption && selectedProviderId !== '__custom__' && canManage && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t('settings.endpointFromProvider', 'Endpoint set by provider. Switch to Custom to edit.')}
                        </p>
                      )}
                      {!selectedProviderOption && !isCustom && canManage && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t('settings.endpointPresetLocked', 'Switch to "Custom" to edit the endpoint URL.')}
                        </p>
                      )}
                    </div>

                    {/* Model — dropdown from provider models or free text */}
                    <div>
                      <label htmlFor={modelFieldId} className="block text-sm font-medium text-gray-700 mb-1">
                        <Sparkles className="w-4 h-4 inline mr-1" />
                        {t('settings.model', 'Model')}
                      </label>
                      {useDynamicProvider && providerModels.length > 0 ? (
                        <>
                          <select
                            id={modelFieldId}
                            value={providerModels.some((m) => String((m.profile as Record<string, unknown>).modelId || (m.profile as Record<string, unknown>).modelName || '') === model) ? model : '__custom__'}
                            onChange={(e) => {
                              if (e.target.value === '__custom__') {
                                setModel('');
                              } else {
                                setModel(e.target.value);
                              }
                            }}
                            disabled={!canManage}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-100"
                          >
                            <option value="__custom__">{t('settings.modelCustomOption', 'Enter custom model name...')}</option>
                            {providerModels.map((m) => {
                              const profileData = m.profile as Record<string, unknown>;
                              const modelId = String(profileData.modelId || profileData.modelName || '');
                              const displayName = String(profileData.displayName || profileData.modelName || modelId);
                              return (
                                <option key={modelId} value={modelId}>
                                  {displayName}
                                </option>
                              );
                            })}
                          </select>
                          {/* Show free text input only when "custom" is selected in dropdown */}
                          {(model === '' || !providerModels.some((m) => String((m.profile as Record<string, unknown>).modelId || (m.profile as Record<string, unknown>).modelName || '') === model)) && (
                            <input
                              id="model-custom"
                              type="text"
                              value={model === '' || providerModels.some((m) => String((m.profile as Record<string, unknown>).modelId || (m.profile as Record<string, unknown>).modelName || '') === model) ? '' : model}
                              onChange={(e) => setModel(e.target.value)}
                              placeholder={t('settings.modelPlaceholder', 'e.g., gpt-4o, claude-3-opus')}
                              disabled={!canManage}
                              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <input
                            id={modelFieldId}
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder={currentPreset.defaultModel || 'gpt-4o'}
                            disabled={!canManage}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          />
                          {useDynamicProvider && modelsLoading && (
                            <p className="text-xs text-gray-400 mt-1">
                              {t('settings.modelsLoading', 'Loading models...')}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Certification Status (BYOK only) */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-800 mb-3">
                    <ShieldCheck className="w-4 h-4 inline mr-1.5 text-indigo-600" />
                    {t('settings.certificationStatus.title', 'Certification Status')}
                  </h3>

                  {/* Scenario A: User selected a certified profile from modal */}
                  {selectedCertifiedProfile ? (
                    <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                        <ShieldCheck className="w-4 h-4" />
                        {t('settings.certifiedModels.selectedProfile', 'Certified Profile Selected')}
                      </div>
                      <div className="mt-1 text-xs text-green-700">
                        {(() => {
                          const p = selectedCertifiedProfile.profile as Record<string, unknown>;
                          const name = String(p.displayName || p.modelName || 'Unknown');
                          return t('settings.certifiedModels.profileSelected', { defaultValue: 'Profile: {{name}}', name });
                        })()}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(() => {
                          const cats = selectedCertifiedProfile.certifications
                            ?.filter((c) => !['blocked', 'deprecated', 'expired'].includes(String(c.status).toLowerCase()))
                            .map((c) => c.category) ?? [];
                          const uniqueCats = [...new Set(cats)];
                          const hasGlobal = selectedCertifiedProfile.certifications?.some((c) => c.scope === 'GLOBAL');
                          const scopeLabel = hasGlobal
                            ? t('settings.certifiedModels.scopeGlobal', 'GLOBAL')
                            : t('settings.certifiedModels.scopeTenant', 'TENANT');
                          const scopeColor = hasGlobal ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200';
                          return (
                            <>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${scopeColor}`}>
                                {scopeLabel}
                              </span>
                              {uniqueCats.map((cat) => (
                                <span key={cat} className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                                  {cat}
                                </span>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      {t('settings.certifiedModels.noProfile', 'No certified profile selected')}
                    </div>
                  )}

                  {/* Browse Certified Models button */}
                  <button
                    type="button"
                    onClick={() => setShowCertifiedModels(true)}
                    className="mb-4 inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('settings.certifiedModels.openModal', 'Browse Certified Models')}
                  </button>

                  {/* Scenario B: Current model matches an existing certified profile */}
                  {certificationMatch && !selectedCertifiedProfile && !registeredProfileId && (
                    <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                        <CheckCircle2 className="w-4 h-4" />
                        {certificationMatch.isGlobal
                          ? t('settings.certificationStatus.globalMatch', 'This model is globally certified')
                          : t('settings.certificationStatus.tenantMatch', 'This model is company certified')
                        }
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(() => {
                          const cats = certificationMatch.entry.certifications
                            ?.filter((c) => !['blocked', 'deprecated', 'expired'].includes(String(c.status).toLowerCase()))
                            .map((c) => c.category) ?? [];
                          const uniqueCats = [...new Set(cats)];
                          const scopeLabel = certificationMatch.isGlobal
                            ? t('settings.certifiedModels.scopeGlobal', 'GLOBAL')
                            : t('settings.certifiedModels.scopeTenant', 'TENANT');
                          const scopeColor = certificationMatch.isGlobal ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200';
                          return (
                            <>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${scopeColor}`}>
                                {scopeLabel}
                              </span>
                              {uniqueCats.map((cat) => (
                                <span key={cat} className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                                  {cat}
                                </span>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                      <p className="mt-2 text-xs text-green-700">
                        {t('settings.certificationStatus.globalMatchDesc', 'Sensitive ERP tools are available for this model.')}
                      </p>
                    </div>
                  )}

                  {/* Scenario C: Model registered but not yet certified */}
                  {registeredProfileId && !selectedCertifiedProfile && !certificationMatch && (
                    <div className="space-y-4">
                      {/* Profile info card */}
                      <div className="rounded-md border border-gray-200 bg-white p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-xs text-gray-500">{t('settings.certificationStatus.profileId', 'Profile ID')}</div>
                            <div className="mt-0.5 font-mono text-sm text-gray-800 truncate" title={registeredProfileId}>
                              {registeredProfileId.length > 20 ? `${registeredProfileId.slice(0, 20)}...` : registeredProfileId}
                            </div>
                          </div>
                          {(registeredProfileData as any)?.modelId && (
                            <div>
                              <div className="text-xs text-gray-500">{t('settings.customModel.modelId', 'Model ID')}</div>
                              <div className="mt-0.5 font-mono text-sm text-gray-800">{String((registeredProfileData as any).modelId)}</div>
                            </div>
                          )}
                          <div>
                            <div className="text-xs text-gray-500">{t('settings.customModel.status', 'Status')}</div>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                {t('settings.certificationStatus.tenantProfile', 'Company Profile')}
                              </span>
                              {registeredCertResult ? (
                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                                  registeredCertResult.status === 'CERTIFIED' ? 'border-green-200 bg-green-100 text-green-800'
                                  : registeredCertResult.status === 'WARNING' ? 'border-amber-200 bg-amber-100 text-amber-800'
                                  : registeredCertResult.status === 'FAILED' ? 'border-red-200 bg-red-100 text-red-800'
                                  : 'border-slate-200 bg-slate-100 text-slate-700'
                                }`}>
                                  {registeredCertResult.status}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  {t('settings.certificationStatus.uncertified', 'Uncertified — sensitive ERP tools are blocked')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Profile Configuration (auto-configured, read-only) */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs font-medium text-gray-500">
                              {t('settings.certificationStatus.profileConfig', 'Auto-Configured Profile Settings')}
                            </span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{t('settings.certificationStatus.configToolMode', 'Tool Mode')}:</span>
                              <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                                {String((registeredProfileData as any)?.toolMode || 'text_plan')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{t('settings.certificationStatus.configDataFilter', 'Data Filter')}:</span>
                              <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                                {String((registeredProfileData as any)?.dataFilterPolicyId || 'ai-data-filter-v1')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{t('settings.certificationStatus.configTemp', 'Temperature')}:</span>
                              <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                                {String((registeredProfileData as any)?.temperature ?? 0.7)}
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-gray-400">
                            {t('settings.certificationStatus.configNote', 'Auto-configured for safe ERP tool access. Contact your administrator to change these settings.')}
                          </p>
                        </div>
                      </div>

                      {/* Diagnostics */}
                      <div className="rounded-md border border-gray-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <Activity className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
                            <div>
                              <h4 className="text-sm font-medium text-gray-800">
                                {t('settings.certificationStatus.runDiagnostics', 'Run Diagnostics')}
                              </h4>
                              <p className="mt-1 text-xs text-amber-700">
                                {t('settings.certificationStatus.diagnosticsDisclaimer', 'Connection and capability test only. This does not certify ERP module compatibility.')}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRunRegisteredDiagnostics}
                            disabled={!canManage || isRunningDiag}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isRunningDiag ? (
                              <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                            ) : (
                              <Activity className="h-4 w-4" />
                            )}
                            {isRunningDiag
                              ? t('settings.customModel.diagnosticsRunning', 'Running diagnostics...')
                              : t('settings.certificationStatus.runDiagnostics', 'Run Diagnostics')}
                          </button>
                        </div>
                        {registeredDiagnosticResult && (
                          <div className="mt-4">
                            <ModelDiagnosticsResult result={registeredDiagnosticResult} t={t} />
                          </div>
                        )}
                      </div>

                      {/* Certification */}
                      <div className="rounded-md border border-gray-200 bg-white p-4">
                        <div className="flex items-start gap-3 mb-4">
                          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
                          <div>
                            <h4 className="text-sm font-medium text-gray-800">
                              {t('settings.certificationStatus.runCertification', 'Run Company Certification')}
                            </h4>
                            <p className="mt-1 text-xs text-gray-400">
                              {t('settings.certificationStatus.certificationDisclaimer', 'Company certification is tenant-scoped only. It does not appear as global recommended.')}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {(registeredProfileData as any)?.profileHash && (
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                {t('settings.customModel.profileHash', 'Profile Hash')}
                              </label>
                              <input
                                type="text"
                                readOnly
                                value={String((registeredProfileData as any).profileHash)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-mono text-gray-500 cursor-default"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">
                              {t('settings.customModel.category', 'Category')}
                            </label>
                            <select
                              value={registeredCertCategory}
                              onChange={(e) => setRegisteredCertCategory(e.target.value as AiCertificationCategory)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                            >
                              <option value="GENERAL_CHAT">General Chat</option>
                              <option value="ACCOUNTING">Accounting</option>
                              <option value="FINANCE_REPORTING">Finance Reporting</option>
                              <option value="SALES">Sales</option>
                              <option value="PURCHASES">Purchases</option>
                              <option value="INVENTORY">Inventory</option>
                              <option value="HR">HR</option>
                              <option value="CRM">CRM</option>
                              <option value="TOOL_CALLING">Tool Calling</option>
                              <option value="DATA_FILTERING">Data Filtering</option>
                              <option value="PROPOSAL_DRAFT">Proposal Draft</option>
                              <option value="ANALYTICS">Analytics</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={handleRunRegisteredCertification}
                            disabled={!canManage || isRunningCert || !(registeredProfileData as any)?.profileHash}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isRunningCert ? (
                              <>
                                <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                                {t('settings.customModel.certRunning', 'Running certification...')}
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4" />
                                {t('settings.certificationStatus.runCertification', 'Run Company Certification')}
                              </>
                            )}
                          </button>
                          {!(registeredProfileData as any)?.profileHash && registeredProfileId && (
                            <p className="text-xs text-amber-700">
                              {t('settings.customModel.noProfileHash', 'Profile hash not available. Run diagnostics first.')}
                            </p>
                          )}
                        </div>
                        {registeredCertResult && (
                          <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-3">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">
                              {t('settings.customModel.certificationResult', 'Certification Result')}
                            </h5>
                            <div className="grid gap-2 sm:grid-cols-2 text-sm">
                              <div>
                                <span className="text-xs text-gray-500">{t('settings.customModel.category', 'Category')}</span>
                                <div className="font-medium text-gray-800">{registeredCertResult.category}</div>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500">{t('settings.customModel.status', 'Status')}</span>
                                <div>
                                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                                    registeredCertResult.status === 'CERTIFIED' ? 'border-green-200 bg-green-100 text-green-800'
                                    : registeredCertResult.status === 'WARNING' ? 'border-amber-200 bg-amber-100 text-amber-800'
                                    : registeredCertResult.status === 'FAILED' ? 'border-red-200 bg-red-100 text-red-800'
                                    : 'border-slate-200 bg-slate-100 text-slate-700'
                                  }`}>
                                    {registeredCertResult.status}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500">Score</span>
                                <div className="font-medium text-gray-800">{registeredCertResult.score}/{registeredCertResult.maxScore}</div>
                              </div>
                              {registeredCertResult.summary && (
                                <div className="sm:col-span-2">
                                  <span className="text-xs text-gray-500">Summary</span>
                                  <div className="text-gray-700">{registeredCertResult.summary}</div>
                                </div>
                              )}
                              {registeredCertResult.failureReasons && registeredCertResult.failureReasons.length > 0 && (
                                <div className="sm:col-span-2">
                                  <span className="text-xs text-gray-500">Failure Reasons</span>
                                  <ul className="mt-1 list-disc list-inside text-sm text-red-700">
                                    {registeredCertResult.failureReasons.map((reason, idx) => (
                                      <li key={idx}>{reason}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cancel registration & Deprecate profile */}
                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleCancelRegistration}
                          className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                        >
                          <XCircle className="h-4 w-4" />
                          {t('settings.certificationStatus.cancelRegistration', 'Cancel Registration')}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeprecateProfile}
                          disabled={!canManage || isDeprecating}
                          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeprecating ? (
                            <>
                              <div className="h-4 w-4 rounded-full border-2 border-gray-600 border-t-transparent animate-spin" />
                              {t('settings.customModel.deprecating', 'Deprecating...')}
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4" />
                              {t('settings.customModel.deprecate', 'Deprecate Profile')}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Scenario D: No match, no registration — show register button */}
                  {!selectedCertifiedProfile && !certificationMatch && !registeredProfileId && (
                    <>
                      <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          {t('settings.certificationStatus.notCertified', 'This model is not certified. Sensitive ERP tools are blocked.')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRegisterAndCertify}
                        disabled={!model || isRegistering}
                        className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRegistering ? (
                          <>
                            <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                            {t('settings.certificationStatus.registering', 'Registering...')}
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            {t('settings.certificationStatus.registerAndCertify', 'Register & Certify This Model')}
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {/* Safety disclaimers */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-400">
                    <div className="rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2">
                      <span className="font-medium text-gray-600">
                        {t('settings.certifiedModels.diagnosticsLabel', 'Diagnostics')}:
                      </span>{' '}
                      {t('settings.certifiedModels.diagnosticsDisclaimer', 'Connection and capability test only. This does not certify ERP module compatibility.')}
                    </div>
                    <div className="rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2">
                      <span className="font-medium text-gray-600">
                        {t('settings.certifiedModels.certificationLabel', 'Certification')}:
                      </span>{' '}
                      {t('settings.certifiedModels.certificationDisclaimer', 'ERP compatibility approval for specific categories/modules.')}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* CREDITS Mode — Inline certified model selector               */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {runtimeMode === 'CREDITS' && (
              <>
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-800 mb-1">
                    <ShieldCheck className="w-4 h-4 inline mr-1.5 text-indigo-600" />
                    {t('settings.erp03AiSelectModel', 'Select AI Model')}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    {t('settings.erp03AiSelectModelDesc', 'Choose from models available on your plan.')}
                  </p>

                  {erp03ModelsLoading ? (
                    <div className="text-sm text-gray-400 py-4 text-center">
                      {t('settings.certifiedModels.loading', 'Loading certified models...')}
                    </div>
                  ) : erp03AvailableModels.length === 0 ? (
                    <div className="text-sm text-gray-400 py-4 text-center">
                      {t('settings.certifiedModels.empty', 'No certified models available')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {erp03AvailableModels.map((entry) => {
                        const profile = entry.profile as Record<string, unknown>;
                        const name = String(profile.displayName || profile.modelName || profile.modelId || 'Unknown');
                        const isSelected = selectedErp03Profile?.profile.id === entry.profile.id;
                        const hasGlobal = entry.certifications?.some((c) => c.scope === 'GLOBAL');
                        const scopeLabel = hasGlobal
                          ? t('settings.certifiedModels.scopeGlobal', 'GLOBAL')
                          : t('settings.certifiedModels.scopeTenant', 'TENANT');
                        const scopeColor = hasGlobal ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
                        const cats = entry.certifications
                          ?.filter((c) => !['blocked', 'deprecated', 'expired'].includes(String(c.status).toLowerCase()))
                          .map((c) => c.category) ?? [];
                        const uniqueCats = [...new Set(cats)].slice(0, 3);

                        return (
                          <div
                            key={String(entry.profile.id)}
                            className={`relative rounded-lg border-2 p-4 transition-all ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                                  <span className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>
                                    {name}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 mb-2">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${scopeColor}`}>
                                    {scopeLabel}
                                  </span>
                                  {uniqueCats.map((cat) => (
                                    <span key={cat} className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedErp03Profile(null);
                                  } else {
                                    setSelectedErp03Profile(entry);
                                  }
                                }}
                                disabled={!canManage}
                                className={`flex-shrink-0 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                } ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {isSelected ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {t('settings.erp03AiChangeModel', 'Change')}
                                  </>
                                ) : (
                                  t('settings.certifiedModels.selectButton', 'Select')
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
                    <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {t('settings.erp03AiNoProviderNeeded', 'No provider or API key needed — ERP03 manages credentials for you.')}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* DISABLED Mode — Info only                                  */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {runtimeMode === 'DISABLED' && (
              <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <ToggleLeft className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-700 mb-1">
                  {t('settings.disabledInfoTitle', 'AI Assistant is disabled')}
                </h3>
                <p className="text-xs text-gray-500">
                  {t('settings.disabledInfoDesc', 'No configuration needed. Contact your administrator to enable AI Assistant for your company.')}
                </p>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Advanced Settings (BYOK + CREDITS only)           */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {runtimeMode !== 'DISABLED' && (
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

                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-700">
                      {t('settings.contextTitle', 'Conversation Context')}
                    </h4>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('settings.contextDesc', 'Controls how much previous chat and ERP tool data is sent to the model. More context improves follow-up answers but may consume more tokens from your API key.')}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="conversation-context-mode" className="block text-sm text-gray-600 mb-1">
                        {t('settings.contextMode', 'Context depth')}
                      </label>
                      <select
                        id="conversation-context-mode"
                        value={conversationContextMode}
                        onChange={(e) => setConversationContextMode(e.target.value as ConversationContextMode)}
                        disabled={!canManage}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-100"
                      >
                        <option value="minimal">{t('settings.contextModeMinimal', 'Minimal - lowest token cost')}</option>
                        <option value="balanced">{t('settings.contextModeBalanced', 'Balanced - recommended')}</option>
                        <option value="deep">{t('settings.contextModeDeep', 'Deep - best continuity, higher cost')}</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-400">
                        {t(`settings.contextMode${conversationContextMode.charAt(0).toUpperCase() + conversationContextMode.slice(1)}Desc`)}
                      </p>
                    </div>

                    <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3">
                      <input
                        type="checkbox"
                        checked={includePreviousToolResults}
                        onChange={(e) => setIncludePreviousToolResults(e.target.checked)}
                        disabled={!canManage}
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-700">
                          {t('settings.includePreviousToolResults', 'Include previous tool results')}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {t('settings.includePreviousToolResultsDesc', 'Lets follow-up questions reuse ERP data already fetched in this chat. Turn off for lower token usage.')}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Model Diagnostics (BYOK + CREDITS only)           */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {runtimeMode !== 'DISABLED' && (
              <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Activity className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-800">
                        {t('settings.diagnosticsTitle', 'Model diagnostics')}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {t('settings.diagnosticsDesc', 'Tests the saved provider with safe prompts. No ERP data is sent.')}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {t('settings.diagnosticsTokenNote', 'This sends a few provider requests and may consume tokens.')}
                      </p>
                      {runtimeMode === 'CREDITS' && (
                        <p className="mt-1 text-xs text-blue-600">
                          {t('settings.diagnosticsCreditsNote', 'Tests the selected model using platform credits.')}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunDiagnostics}
                    disabled={!canManage || healthTesting || hasUnsavedChanges}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {healthTesting ? (
                      <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                    ) : (
                      <Activity className="h-4 w-4" />
                    )}
                    {healthTesting
                      ? t('settings.diagnosticsRunning', 'Testing...')
                      : t('settings.runDiagnostics', 'Run diagnostics')}
                  </button>
                </div>

                {hasUnsavedChanges && (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {t('settings.saveBeforeDiagnostics', 'Save settings before testing this provider and model.')}
                  </div>
                )}

                {healthError && (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {healthError}
                  </div>
                )}

                {healthResult && !hasUnsavedChanges && (
                  <ModelDiagnosticsResult result={healthResult} t={t} />
                )}
              </div>
            )}

            {/* Current Config Info */}
            {settings && (
              <div className="text-xs text-gray-400 mt-4 pt-4 border-t">
                {t('settings.currentProvider', 'Current Provider')}: <strong>{settings.provider}</strong>
                {settings.model && <> | {t('settings.currentModel', 'Model')}: <strong>{settings.model}</strong></>}
                {' | '}{t('settings.hasApiKey', 'API Key')}: <strong>{settings.hasApiKey ? '✓' : '✗'}</strong>
                {' | '}{t('settings.lastUpdated', 'Updated')}: {new Date(settings.updatedAt).toLocaleString()}
              </div>
            )}

          </div>{/* end isEnabled wrapper */}

          {/* Certified Models Modal */}
          <CertifiedModelsModal
            isOpen={showCertifiedModels}
            onClose={() => setShowCertifiedModels(false)}
            onSelectProfile={handleSelectCertifiedProfile}
          />
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

const ModelDiagnosticsResult: React.FC<{
  result: ProviderHealthResponse;
  t: TFunction;
}> = ({ result, t }) => {
  const checks = result.checks ?? [
    {
      id: 'network',
      status: result.networkOk ? 'passed' : 'failed',
      ok: Boolean(result.networkOk),
      detail: result.reason,
    },
    {
      id: 'inference',
      status: result.inferenceOk ? 'passed' : 'failed',
      ok: Boolean(result.inferenceOk),
      detail: result.error,
    },
  ];

  const toolDiagnostics = result.toolDiagnostics;
  const recommendedMode = toolDiagnostics?.recommendedMode ?? 'unavailable';
  const profile = result.modelProfile;

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <div className="flex flex-wrap gap-2">
        <DiagnosticPill
          status={result.ready ? 'passed' : 'failed'}
          label={result.ready
            ? t('settings.diagnosticsChatReady', 'Chat ready')
            : t('settings.diagnosticsChatNotReady', 'Chat not ready')}
        />
        <DiagnosticPill
          status={toolDiagnostics?.erpToolsReady ? 'passed' : 'failed'}
          label={toolDiagnostics?.erpToolsReady
            ? t('settings.diagnosticsToolsReady', 'ERP tools ready')
            : t('settings.diagnosticsToolsLimited', 'ERP tools limited')}
        />
        <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
          {t('settings.diagnosticRecommendedMode', 'Recommended mode')}: {' '}
          {t(
            `settings.diagnosticModes.${recommendedMode}`,
            DIAGNOSTIC_MODE_FALLBACKS[recommendedMode] ?? recommendedMode
          )}
        </span>
      </div>

      {profile && (
        <div className="grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm sm:grid-cols-2">
          <DiagnosticFact
            label={t('settings.diagnosticCatalogStatus', 'Catalog status')}
            value={t(`settings.modelStatuses.${profile.status}`, profile.status)}
          />
          <DiagnosticFact
            label={t('settings.diagnosticNativeCatalog', 'Native in catalog')}
            value={profile.supportsToolCalling ? t('settings.yes', 'Yes') : t('settings.no', 'No')}
          />
          <DiagnosticFact
            label={t('settings.diagnosticStructuredJson', 'Structured JSON')}
            value={profile.supportsStructuredJson ? t('settings.yes', 'Yes') : t('settings.no', 'No')}
          />
          <DiagnosticFact
            label={t('settings.diagnosticTextOnly', 'Catalog text-only mode')}
            value={profile.textOnlyMode ? t('settings.yes', 'Yes') : t('settings.no', 'No')}
          />
          {profile.warningMessage && (
            <div className="text-xs text-amber-700 sm:col-span-2">
              {profile.warningMessage}
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {checks.map((check) => (
          <DiagnosticCheckRow
            key={check.id}
            label={t(
              `settings.diagnosticChecks.${check.id}`,
              DIAGNOSTIC_CHECK_FALLBACKS[check.id] ?? check.id
            )}
            status={check.status}
            detail={check.detail}
            t={t}
          />
        ))}
      </div>
    </div>
  );
};

const DiagnosticPill: React.FC<{ status: string; label: string }> = ({ status, label }) => {
  const Icon = getDiagnosticStatusIcon(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${getDiagnosticStatusClasses(status)}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};

const DiagnosticFact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="mt-0.5 font-medium text-gray-800">{value}</div>
  </div>
);

const DiagnosticCheckRow: React.FC<{
  label: string;
  status: string;
  detail?: string;
  t: TFunction;
}> = ({ label, status, detail, t }) => {
  const Icon = getDiagnosticStatusIcon(status);
  return (
    <div className="flex items-start gap-3 bg-white px-3 py-3">
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
        status === 'passed' ? 'text-green-600' : status === 'failed' ? 'text-red-600' : 'text-gray-400'
      }`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getDiagnosticStatusClasses(status)}`}>
            {t(`settings.diagnosticStatus.${status}`, status)}
          </span>
        </div>
        {detail && (
          <p className="mt-1 break-words text-xs text-gray-500">{detail}</p>
        )}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md border bg-white p-3">
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-1 text-lg font-semibold text-gray-800">{value}</div>
  </div>
);

export default AiAssistantSettingsPage;
