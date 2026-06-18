/**
 * AiSetupWizardPage.tsx
 *
 * Linear, 5-step wizard for setting up a brand-new AI model end-to-end.
 * Replaces the "bounce between 4 different pages" experience with a single
 * guided flow:
 *
 *   1. Provider     — pick or register an AI provider (OpenAI, OpenRouter, etc.)
 *   2. Model        — pick or register a model on that provider
 *   3. Platform Key — give the platform an API key + budget so it can serve tenants
 *   4. Test         — run live diagnostics against the provider/model
 *   5. Certify      — certify the model for ERP module categories so tools unlock
 *
 * Each step persists to the backend immediately. You can leave at any step
 * and pick up where you left off — there is no in-memory wizard state to lose.
 * Existing CRUD pages (AI Providers / Models / Runtime Profiles / Cert Modal)
 * remain available as power-user editing surfaces.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx'; import { useNavigate } from 'react-router-dom'; import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Cpu, HelpCircle, Key, Plus, RefreshCw, Rocket, Server, Shield, ShieldCheck, Sparkles, XCircle} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import {
  AiCertificationCategory,
  AiModelProfile,
  AiPlatformApiKey,
  AiProvider,
  AiRuntimeProfile,
  ProviderHealthResponse,
  superAdminApi,
} from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useConfirm } from '../../../hooks/useConfirm';

// ─── Configuration ──────────────────────────────────────────────────────────

type StepId = 'provider' | 'model' | 'platformKey' | 'test' | 'certify';

const STEPS: { id: StepId; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'provider',    label: 'Provider',     description: 'Pick or register the AI provider (OpenAI, OpenRouter, …)', icon: Server },
  { id: 'model',       label: 'Model',        description: 'Choose the specific model on that provider',              icon: Cpu },
  { id: 'platformKey', label: 'Platform Key', description: 'Save the platform API key + budget',                      icon: Key },
  { id: 'test',        label: 'Test',         description: 'Run live diagnostics end-to-end',                         icon: Sparkles },
  { id: 'certify',     label: 'Certify',      description: 'Certify the model for ERP categories',                    icon: ShieldCheck },
];

const PROVIDER_TYPE_OPTIONS = [
  { value: 'openai',            label: 'OpenAI',            defaultBaseUrl: 'https://api.openai.com/v1' },
  { value: 'openai_compatible', label: 'OpenAI-compatible', defaultBaseUrl: 'https://openrouter.ai/api/v1' },
  { value: 'google_gemini',     label: 'Google Gemini',     defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1' },
  { value: 'anthropic',         label: 'Anthropic',         defaultBaseUrl: 'https://api.anthropic.com/v1' },
  { value: 'ollama',            label: 'Ollama (local)',    defaultBaseUrl: 'http://localhost:11434/v1' },
  { value: 'custom',            label: 'Custom',            defaultBaseUrl: '' },
] as const;

const CERT_CATEGORIES: AiCertificationCategory[] = [
  'GENERAL_CHAT', 'ACCOUNTING', 'FINANCE_REPORTING', 'SALES',
  'PURCHASES', 'INVENTORY', 'HR', 'CRM',
  'TOOL_CALLING', 'DATA_FILTERING', 'PROPOSAL_DRAFT', 'ANALYTICS',
];

const unwrap = <T,>(value: any): T => (value?.data !== undefined ? value.data : value) as T;

// ─── Stepper UI ─────────────────────────────────────────────────────────────

interface StepperProps {
  currentStep: StepId;
  completedSteps: Set<StepId>;
  onStepClick: (stepId: StepId) => void;
}

const Stepper: React.FC<StepperProps> = ({ currentStep, completedSteps, onStepClick }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <ol className="flex flex-wrap items-center gap-2 sm:gap-0">
        {STEPS.map((step, idx) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = step.id === currentStep;
          const isClickable = isCompleted || isCurrent;
          const Icon = step.icon;
          return (
            <React.Fragment key={step.id}>
              <li className="flex items-center">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                    isCurrent && 'bg-slate-900 text-white shadow-sm',
                    !isCurrent && isCompleted && 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
                    !isCurrent && !isCompleted && 'text-slate-500',
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold',
                      isCurrent && 'border-white bg-white text-slate-900',
                      !isCurrent && isCompleted && 'border-emerald-600 bg-emerald-600 text-white',
                      !isCurrent && !isCompleted && 'border-slate-300 bg-white text-slate-400',
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <span>{idx + 1}</span>}
                  </span>
                  <span className="hidden sm:flex flex-col items-start text-left">
                    <span className="text-xs uppercase tracking-wide opacity-75">Step {idx + 1}</span>
                    <span className="text-sm leading-tight">{step.label}</span>
                  </span>
                  <Icon className="h-4 w-4 sm:hidden" />
                </button>
              </li>
              {idx < STEPS.length - 1 && (
                <li className="hidden sm:block px-1 text-slate-300">
                  <ChevronRight className="h-4 w-4" />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
};

// ─── Step shell (consistent layout for every step) ──────────────────────────

interface StepShellProps {
  title: string;
  helpText: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
}

const StepShell: React.FC<StepShellProps> = ({
  title,
  helpText,
  children,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  nextLoading = false,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{helpText}</p>
    </div>
    <div>{children}</div>
    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <span />
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || nextLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {nextLoading ? <Spinner size="sm" /> : <ArrowRight className="h-4 w-4" />}
          {nextLabel}
        </button>
      )}
    </div>
  </div>
);

// ─── Main wizard page ───────────────────────────────────────────────────────

interface WizardState {
  providerId: string | null;
  modelProfileId: string | null;
  runtimeProfileId: string | null;
  diagnosticsPassed: boolean;
  certifiedCategories: AiCertificationCategory[];
}

const initialState: WizardState = {
  providerId: null,
  modelProfileId: null,
  runtimeProfileId: null,
  diagnosticsPassed: false,
  certifiedCategories: [],
};

export const AiSetupWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<StepId>('provider');
  const [state, setState] = useState<WizardState>(initialState);

  // Data from backend
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [models, setModels] = useState<AiModelProfile[]>([]);
  const [runtimes, setRuntimes] = useState<AiRuntimeProfile[]>([]);
  const [vaultKeys, setVaultKeys] = useState<AiPlatformApiKey[]>([]);

  const refresh = async () => {
    try {
      const [pRes, mRes, rRes, kRes] = await Promise.all([
        superAdminApi.getAiProviders(),
        superAdminApi.getAiModelProfiles(),
        superAdminApi.getAiRuntimeProfiles(),
        superAdminApi.getAiApiKeys(),
      ]);
      setProviders(unwrap<AiProvider[]>(pRes));
      setModels(unwrap<AiModelProfile[]>(mRes));
      setRuntimes(unwrap<AiRuntimeProfile[]>(rRes));
      setVaultKeys(unwrap<AiPlatformApiKey[]>(kRes));
    } catch (err: any) {
      errorHandler.showError(err);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const completedSteps = useMemo(() => {
    const set = new Set<StepId>();
    if (state.providerId) set.add('provider');
    if (state.modelProfileId) set.add('model');
    if (state.runtimeProfileId) set.add('platformKey');
    if (state.diagnosticsPassed) set.add('test');
    if (state.certifiedCategories.length > 0) set.add('certify');
    return set;
  }, [state]);

  const selectedProvider = providers.find(p => p.id === state.providerId) || null;
  const selectedModel = models.find(m => m.id === state.modelProfileId) || null;

  const goNext = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx >= 0 && idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };

  const goBack = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1].id);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-indigo-600" />
            Set up an AI model
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Walk through provider → model → key → test → certify. Each step saves immediately; you can leave and come back.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/super-admin/ai-management')}
          className="text-sm text-slate-600 hover:text-slate-900 underline"
        >
          Save &amp; exit
        </button>
      </div>

      <Stepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={setCurrentStep}
      />

      {currentStep === 'provider' && (
        <StepProvider
          providers={providers}
          selectedProviderId={state.providerId}
          onSelect={(id) => setState(s => ({ ...s, providerId: id }))}
          onSaved={refresh}
          onNext={() => state.providerId && goNext()}
        />
      )}

      {currentStep === 'model' && (
        <StepModel
          provider={selectedProvider}
          models={models}
          selectedModelId={state.modelProfileId}
          onSelect={(id) => setState(s => ({ ...s, modelProfileId: id }))}
          onSaved={refresh}
          onBack={goBack}
          onNext={() => state.modelProfileId && goNext()}
        />
      )}

      {currentStep === 'platformKey' && (
        <StepPlatformKey
          provider={selectedProvider}
          model={selectedModel}
          runtimes={runtimes}
          vaultKeys={vaultKeys}
          onVaultRefresh={refresh}
          onSaved={async (rt) => {
            setState(s => ({ ...s, runtimeProfileId: rt.id }));
            await refresh();
          }}
          onBack={goBack}
          onNext={() => state.runtimeProfileId && goNext()}
        />
      )}

      {currentStep === 'test' && (
        <StepTest
          model={selectedModel}
          onPassed={() => setState(s => ({ ...s, diagnosticsPassed: true }))}
          onBack={goBack}
          onNext={() => state.diagnosticsPassed && goNext()}
        />
      )}

      {currentStep === 'certify' && (
        <StepCertify
          model={selectedModel}
          onCertified={(cat) => setState(s => ({ ...s, certifiedCategories: Array.from(new Set([...s.certifiedCategories, cat])) }))}
          onBack={goBack}
          onFinish={() => navigate('/super-admin/ai-management')}
        />
      )}
    </div>
  );
};

export default AiSetupWizardPage;

// ─── Step 1: Provider ───────────────────────────────────────────────────────

const StepProvider: React.FC<{
  providers: AiProvider[];
  selectedProviderId: string | null;
  onSelect: (id: string) => void;
  onSaved: () => Promise<void>;
  onNext: () => void;
}> = ({ providers, selectedProviderId, onSelect, onSaved, onNext }) => {
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'openai_compatible' as typeof PROVIDER_TYPE_OPTIONS[number]['value'],
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      errorHandler.showError(new Error('Name is required'));
      return;
    }
    try {
      setSaving(true);
      const result: any = await superAdminApi.createAiProvider({
        name: form.name.trim(),
        type: form.type as any,
        defaultBaseUrl: form.defaultBaseUrl,
        authType: 'api_key',
        byok: true,
        enabled: true,
        supportsTools: true,
        supportsJsonMode: true,
        supportsModelSync: form.type === 'openai' || form.type === 'openai_compatible',
      });
      const created = unwrap<AiProvider>(result);
      await onSaved();
      onSelect(created.id);
      setShowNewForm(false);
      errorHandler.showSuccess(`Provider "${created.name}" created`);
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepShell
      title="Choose or register a provider"
      helpText="A provider is the company that hosts the AI model — like OpenAI, OpenRouter, or Anthropic. Pick an existing one or register a new one below."
      onNext={onNext}
      nextDisabled={!selectedProviderId}
      nextLabel="Continue to model"
    >
      <div className="space-y-3">
        {providers.length === 0 && !showNewForm && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <Server className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">No providers yet. Register your first one.</p>
          </div>
        )}

        {providers.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {providers.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className={clsx(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition',
                  selectedProviderId === p.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                )}
              >
                <div className="rounded-md bg-slate-100 p-2">
                  <Server className="h-4 w-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 truncate">{p.name}</span>
                    {p.enabled ? (
                      <span className="text-xs text-emerald-700">enabled</span>
                    ) : (
                      <span className="text-xs text-slate-400">disabled</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{p.type} · {p.defaultBaseUrl}</div>
                </div>
                {selectedProviderId === p.id && <CheckCircle2 className="h-5 w-5 text-indigo-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {!showNewForm ? (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            <Plus className="h-4 w-4" />
            Register a new provider
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Display name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. OpenRouter"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => {
                    const next = e.target.value as typeof form.type;
                    const opt = PROVIDER_TYPE_OPTIONS.find(o => o.value === next);
                    setForm(f => ({ ...f, type: next, defaultBaseUrl: opt?.defaultBaseUrl ?? f.defaultBaseUrl }));
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {PROVIDER_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Base URL</label>
              <input
                type="text"
                value={form.defaultBaseUrl}
                onChange={e => setForm(f => ({ ...f, defaultBaseUrl: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
          <HelpCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>What gets created:</strong> An <code>AiProvider</code> entry — name, type, and base URL.
            No API key is saved here; you&apos;ll add the platform key in Step 3.
          </span>
        </div>
      </div>
    </StepShell>
  );
};

// ─── Step 2: Model ──────────────────────────────────────────────────────────

const StepModel: React.FC<{
  provider: AiProvider | null;
  models: AiModelProfile[];
  selectedModelId: string | null;
  onSelect: (id: string) => void;
  onSaved: () => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}> = ({ provider, models, selectedModelId, onSelect, onSaved, onBack, onNext }) => {
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    modelName: '',
    displayName: '',
    maxContextTokens: 128000,
    supportsToolCalling: true,
    scope: 'GLOBAL' as 'GLOBAL' | 'TENANT',
  });

  const modelsForProvider = useMemo(
    () => models.filter(m => m.providerId === provider?.id || m.provider === provider?.type),
    [models, provider],
  );

  const handleCreate = async () => {
    if (!provider) return;
    if (!form.modelName.trim()) {
      errorHandler.showError(new Error('Model name is required'));
      return;
    }
    try {
      setSaving(true);
      const result: any = await superAdminApi.createAiModelProfile({
        provider: provider.type,
        providerId: provider.id,
        modelName: form.modelName.trim(),
        displayName: form.displayName.trim() || form.modelName.trim(),
        status: 'experimental',
        supportsToolCalling: form.supportsToolCalling,
        supportsStructuredJson: true,
        maxContextTokens: form.maxContextTokens,
        textOnlyMode: !form.supportsToolCalling,
        baseUrl: provider.defaultBaseUrl || undefined,
        scope: form.scope,
        enabled: true,
      });
      const created = unwrap<AiModelProfile>(result);
      await onSaved();
      onSelect(created.id);
      setShowNewForm(false);
      errorHandler.showSuccess(`Model "${created.displayName || created.modelName}" created`);
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepShell
      title="Choose or register a model"
      helpText={
        provider
          ? `Pick a model on ${provider.name}, or register a new one. The model is what tenants will actually call.`
          : 'Go back and pick a provider first.'
      }
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!selectedModelId}
      nextLabel="Continue to platform key"
    >
      <div className="space-y-3">
        {modelsForProvider.length === 0 && !showNewForm && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <Cpu className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">
              No models registered for {provider?.name || 'this provider'} yet.
            </p>
          </div>
        )}

        {modelsForProvider.length > 0 && (
          <div className="grid gap-2">
            {modelsForProvider.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                className={clsx(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition',
                  selectedModelId === m.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                )}
              >
                <div className="rounded-md bg-slate-100 p-2">
                  <Cpu className="h-4 w-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    {m.displayName || m.modelName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    <code>{m.modelName}</code>
                    {' · '}status: {m.status}
                    {m.supportsToolCalling ? ' · tools' : ' · text-only'}
                  </div>
                </div>
                {selectedModelId === m.id && <CheckCircle2 className="h-5 w-5 text-indigo-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {!showNewForm ? (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            disabled={!provider}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Register a new model
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Model ID (as required by provider)
                </label>
                <input
                  type="text"
                  value={form.modelName}
                  onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))}
                  placeholder="e.g. anthropic/claude-sonnet-4.6"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Display name</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder="optional friendly name"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Max context tokens</label>
                <input
                  type="number"
                  value={form.maxContextTokens}
                  onChange={e => setForm(f => ({ ...f, maxContextTokens: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
                <input
                  type="checkbox"
                  checked={form.supportsToolCalling}
                  onChange={e => setForm(f => ({ ...f, supportsToolCalling: e.target.checked }))}
                />
                Supports tool calling
              </label>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Scope</label>
                <select
                  value={form.scope}
                  onChange={e => setForm(f => ({ ...f, scope: e.target.value as 'GLOBAL' | 'TENANT' }))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="GLOBAL">Global (available to all tenants)</option>
                  <option value="TENANT">Tenant (company-specific)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
          <HelpCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>What gets created:</strong> An <code>AiModelProfile</code> tied to the chosen provider.
            Still no API key — that&apos;s next.
          </span>
        </div>
      </div>
    </StepShell>
  );
};

// ─── Step 3: Platform Key ───────────────────────────────────────────────────

const StepPlatformKey: React.FC<{
  provider: AiProvider | null;
  model: AiModelProfile | null;
  runtimes: AiRuntimeProfile[];
  vaultKeys: AiPlatformApiKey[];
  onVaultRefresh: () => Promise<void>;
  onSaved: (rt: AiRuntimeProfile) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}> = ({ provider, model, runtimes, vaultKeys, onVaultRefresh, onSaved, onBack, onNext }) => {
  const existing = runtimes.find(r => r.modelProfileId === model?.id);
  const providerVaultKeys = useMemo(
    () => vaultKeys.filter(k => k.providerId === provider?.id),
    [vaultKeys, provider],
  );
  const defaultMode: 'vault' | 'paste' = providerVaultKeys.length > 0 ? 'vault' : 'paste';
  const [mode, setMode] = useState<'vault' | 'paste'>(defaultMode);
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState<string>(providerVaultKeys[0]?.id || '');
  const [apiKey, setApiKey] = useState('');
  const [budget, setBudget] = useState<number | ''>(existing?.maxRequestsPerInterval || 1000);
  const [interval, setInterval] = useState<'minute' | 'hour' | 'day' | 'month'>(existing?.requestInterval || 'day');
  const [saving, setSaving] = useState(false);
  const [savingVault, setSavingVault] = useState(false);
  const [showAddToVault, setShowAddToVault] = useState(false);
  const [vaultLabel, setVaultLabel] = useState('');
  const [vaultKeyValue, setVaultKeyValue] = useState('');

  // Re-sync mode/selection when provider changes or vault refreshes
  useEffect(() => {
    if (providerVaultKeys.length > 0 && !providerVaultKeys.some(k => k.id === selectedVaultKeyId)) {
      setSelectedVaultKeyId(providerVaultKeys[0].id);
    }
    if (providerVaultKeys.length === 0 && mode === 'vault') {
      setMode('paste');
    }
  }, [providerVaultKeys, selectedVaultKeyId, mode]);

  const handleAddToVault = async () => {
    if (!provider) return;
    if (!vaultLabel.trim()) return errorHandler.showError(new Error('Label is required'));
    if (!vaultKeyValue.trim()) return errorHandler.showError(new Error('API key is required'));
    try {
      setSavingVault(true);
      const result: any = await superAdminApi.createAiApiKey({
        label: vaultLabel.trim(),
        providerId: provider.id,
        apiKey: vaultKeyValue.trim(),
      });
      const created = unwrap<AiPlatformApiKey>(result);
      await onVaultRefresh();
      setSelectedVaultKeyId(created.id);
      setMode('vault');
      setShowAddToVault(false);
      setVaultLabel('');
      setVaultKeyValue('');
      errorHandler.showSuccess(`Saved "${created.label}" to vault`);
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setSavingVault(false);
    }
  };

  const handleSave = async () => {
    if (!provider || !model) return;
    // Validation depends on mode
    if (mode === 'vault') {
      if (!selectedVaultKeyId) {
        errorHandler.showError(new Error('Pick a key from the vault first'));
        return;
      }
    } else if (mode === 'paste') {
      if (!existing && !apiKey.trim()) {
        errorHandler.showError(new Error('API key is required'));
        return;
      }
    }
    try {
      setSaving(true);
      const payload: any = {
        providerId: provider.id,
        modelProfileId: model.id,
        status: 'active' as const,
        maxRequestsPerInterval: budget ? Number(budget) : undefined,
        requestInterval: interval,
      };
      if (mode === 'vault') {
        payload.apiKeyId = selectedVaultKeyId;
      } else if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }
      const result: any = existing
        ? await superAdminApi.updateAiRuntimeProfile(existing.id, payload)
        : await superAdminApi.createAiRuntimeProfile(payload);
      const rt = unwrap<AiRuntimeProfile>(result);
      await onSaved(rt);
      errorHandler.showSuccess(existing ? 'Platform key updated' : 'Platform key saved');
      onNext();
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepShell
      title="Save the platform API key"
      helpText="The platform uses this key to call the model on behalf of tenants who are on credits-mode. Set a budget cap so a runaway loop can't burn through your credits."
      onBack={onBack}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
          <div><span className="text-slate-500">Provider:</span> <span className="font-medium text-slate-900">{provider?.name || '—'}</span></div>
          <div><span className="text-slate-500">Model:</span> <span className="font-medium text-slate-900">{model?.displayName || model?.modelName || '—'}</span></div>
        </div>

        {existing && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              A platform key is already saved for this model
              {existing.credentialHint && <span className="font-mono">({existing.credentialHint})</span>}.
              Pick a new vault key or paste one to replace it, or leave both blank to keep the existing key.
            </div>
          </div>
        )}

        {/* Mode toggle: vault vs paste */}
        <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('vault')}
            disabled={providerVaultKeys.length === 0}
            className={clsx(
              'rounded-md px-3 py-1.5 font-medium transition',
              mode === 'vault'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700',
              providerVaultKeys.length === 0 && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Key className="inline h-3 w-3 mr-1" />
            Pick from vault ({providerVaultKeys.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={clsx(
              'rounded-md px-3 py-1.5 font-medium transition',
              mode === 'paste' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            Paste a new key
          </button>
        </div>

        {mode === 'vault' && providerVaultKeys.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Choose a saved key</label>
            <div className="grid gap-2">
              {providerVaultKeys.map(k => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setSelectedVaultKeyId(k.id)}
                  className={clsx(
                    'flex items-start gap-3 rounded-lg border p-3 text-left transition',
                    selectedVaultKeyId === k.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <Key className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{k.label}</span>
                      <span className="font-mono text-xs text-slate-500">{k.credentialHint}</span>
                      {k.lastValidationStatus === 'valid' && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Valid
                        </span>
                      )}
                      {k.lastValidationStatus === 'invalid' && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700">
                          <XCircle className="h-3 w-3" /> Invalid
                        </span>
                      )}
                    </div>
                    {k.notes && <div className="text-xs text-slate-500 mt-0.5 italic">{k.notes}</div>}
                  </div>
                  {selectedVaultKeyId === k.id && (
                    <CheckCircle2 className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Manage your saved keys at{' '}
              <a href="/super-admin/ai-api-keys" target="_blank" rel="noreferrer" className="text-indigo-700 underline">
                API Key Vault
              </a>
              .
            </p>
          </div>
        )}

        {mode === 'paste' && (
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {existing ? 'Replace API key (optional)' : 'API key'}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={existing ? 'Leave blank to keep existing key' : 'sk-…'}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-slate-500">Encrypted at rest. Never displayed back to anyone after save.</p>
            </div>
            {!showAddToVault ? (
              <button
                type="button"
                onClick={() => { setShowAddToVault(true); setVaultKeyValue(apiKey); }}
                className="text-xs text-indigo-700 hover:text-indigo-900 underline"
              >
                + Also save this key to the vault (recommended — reuse it for other models)
              </button>
            ) : (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                <div className="text-xs font-medium text-indigo-900">Save to vault</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={vaultLabel}
                    onChange={e => setVaultLabel(e.target.value)}
                    placeholder="Label (e.g. OpenRouter personal)"
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={vaultKeyValue}
                    onChange={e => setVaultKeyValue(e.target.value)}
                    placeholder="API key"
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddToVault}
                    disabled={savingVault}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingVault ? <Spinner size="sm" /> : <Check className="h-3 w-3" />}
                    Save to vault &amp; select
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddToVault(false)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max requests per interval</label>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              placeholder="leave blank for no cap"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Interval</label>
            <select
              value={interval}
              onChange={e => setInterval(e.target.value as any)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="minute">per minute</option>
              <option value="hour">per hour</option>
              <option value="day">per day</option>
              <option value="month">per month</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !provider || !model}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? <Spinner size="sm" /> : <Key className="h-4 w-4" />}
            {existing ? 'Update and continue' : 'Save and continue'}
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
          <HelpCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>What gets created:</strong> An active <code>AiPlatformRuntimeProfile</code> linking the
            provider + model + the selected key. Picking from the vault reuses a key you&apos;ve already
            saved (and tested) without retyping it.
          </span>
        </div>
      </div>
    </StepShell>
  );
};

// ─── Step 4: Test ───────────────────────────────────────────────────────────

const StepTest: React.FC<{
  model: AiModelProfile | null;
  onPassed: () => void;
  onBack: () => void;
  onNext: () => void;
}> = ({ model, onPassed, onBack, onNext }) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ProviderHealthResponse | null>(null);

  const handleRun = async () => {
    if (!model) return;
    try {
      setRunning(true);
      setResult(null);
      // Use the platform-scoped diagnostic so the saved Step-3 key is consulted —
      // not a tenant company's settings.
      const res: any = await superAdminApi.runPlatformDiagnostics(model.id);
      const payload = unwrap<ProviderHealthResponse>(res);
      setResult(payload);
      if (payload.ready) {
        onPassed();
      }
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setRunning(false);
    }
  };

  const checks = (result?.checks || []) as { id: string; status: string; ok: boolean; detail?: string }[];

  return (
    <StepShell
      title="Test connectivity end-to-end"
      helpText="Runs a live diagnostic against the model using the saved platform key. No tenant data is involved."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!result?.ready}
      nextLabel="Continue to certification"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-slate-600">
            Model: <span className="font-mono text-slate-900">{model?.modelName || '—'}</span>
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={running || !model}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
            {result ? 'Run again' : 'Run diagnostics'}
          </button>
        </div>

        {result && (
          <div className="space-y-2">
            <div
              className={clsx(
                'rounded-lg border p-3 text-sm',
                result.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900',
              )}
            >
              {result.ready ? (
                <span className="font-medium">All checks passed — the platform key works against this model.</span>
              ) : (
                <span className="font-medium">Diagnostics did not pass. Review failures below, fix the issue, then run again.</span>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              {checks.map((c, i) => (
                <div key={i} className="flex items-start justify-between p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {c.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : c.status === 'skipped' ? (
                        <Shield className="h-4 w-4 text-slate-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium text-sm text-slate-900">{c.id}</span>
                      <span className="text-xs text-slate-500">{c.status}</span>
                    </div>
                    {c.detail && <div className="ml-6 mt-1 text-xs text-slate-600">{c.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!result && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">Click "Run diagnostics" to test the live connection.</p>
          </div>
        )}
      </div>
    </StepShell>
  );
};

// ─── Step 5: Certify ────────────────────────────────────────────────────────

const StepCertify: React.FC<{
  model: AiModelProfile | null;
  onCertified: (cat: AiCertificationCategory) => void;
  onBack: () => void;
  onFinish: () => void;
}> = ({ model, onCertified, onBack, onFinish }) => {
  const [certs, setCerts] = useState<Record<string, 'idle' | 'running' | 'passed' | 'failed'>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [selectedCategory, setSelectedCategory] = useState<AiCertificationCategory>('GENERAL_CHAT');
  const [runningAll, setRunningAll] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const runOneCategory = async (category: AiCertificationCategory): Promise<boolean> => {
    if (!model) return false;
    setCerts(c => ({ ...c, [category]: 'running' }));
    setErrors(e => ({ ...e, [category]: null }));
    try {
      const result: any = await superAdminApi.runGlobalCertification(model.id, {
        profileHash: model.profileHash,
        category,
      });
      const payload = unwrap<any>(result);
      if (payload.status === 'CERTIFIED' || payload.status === 'WARNING') {
        setCerts(c => ({ ...c, [category]: 'passed' }));
        onCertified(category);
        return true;
      }
      setCerts(c => ({ ...c, [category]: 'failed' }));
      setErrors(e => ({ ...e, [category]: payload.summary || 'Certification failed' }));
      return false;
    } catch (err: any) {
      setCerts(c => ({ ...c, [category]: 'failed' }));
      setErrors(e => ({ ...e, [category]: err?.message || 'Certification failed' }));
      return false;
    }
  };

  const handleRunCert = async () => {
    const passed = await runOneCategory(selectedCategory);
    if (passed) errorHandler.showSuccess(`Certified for ${selectedCategory}`);
  };

  const handleRunAll = async () => {
    if (!model || runningAll) return;
    const confirmed = await confirm({
      title: 'Run All Certifications',
      tone: 'info',
      message: `Run certification for all ${CERT_CATEGORIES.length} categories, one after another? This can take a few minutes.`
    });
    if (!confirmed) return;
    setRunningAll(true);
    try {
      let okCount = 0;
      for (const cat of CERT_CATEGORIES) {
        const ok = await runOneCategory(cat);
        if (ok) okCount += 1;
      }
      errorHandler.showSuccess(`Done — ${okCount} of ${CERT_CATEGORIES.length} categories certified`);
    } finally {
      setRunningAll(false);
    }
  };

  const passedCount = Object.values(certs).filter(s => s === 'passed').length;

  return (
    <StepShell
      title="Certify the model for ERP categories"
      helpText="Pick a category and certify. You can certify for multiple categories — each one unlocks tool access for that part of the ERP."
      onBack={onBack}
    >
      {confirmDialog}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value as AiCertificationCategory)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {CERT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleRunCert}
            disabled={!model || certs[selectedCategory] === 'running' || runningAll}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {certs[selectedCategory] === 'running' ? (
              <Spinner size="sm" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Certify
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <span className="text-sm text-indigo-900">
            <strong>Or certify everything:</strong> run all {CERT_CATEGORIES.length} categories sequentially.
          </span>
          <button
            type="button"
            onClick={handleRunAll}
            disabled={!model || runningAll}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {runningAll ? (
              <Spinner size="sm" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {runningAll ? 'Running all…' : 'Run all categories'}
          </button>
        </div>

        {Object.keys(certs).length > 0 && (
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {Object.entries(certs).map(([cat, status]) => (
              <div key={cat} className="flex items-start justify-between p-3">
                <div className="flex items-center gap-2">
                  {status === 'passed' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                  {status === 'running' && <Spinner size="sm" variant="indigo" />}
                  <span className="font-medium text-sm text-slate-900">{cat}</span>
                  <span className="text-xs text-slate-500">{status}</span>
                </div>
                {status === 'failed' && errors[cat] && (
                  <div className="text-xs text-red-700 max-w-md text-right">{errors[cat]}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {passedCount > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 p-2 flex-shrink-0">
                <Rocket className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-emerald-900">
                  {passedCount === 1 ? '1 category certified — model is live for tenants' : `${passedCount} categories certified`}
                </h3>
                <p className="mt-1 text-sm text-emerald-800">
                  Tenants on credits mode can now use this model for the certified categories.
                </p>
                <button
                  type="button"
                  onClick={onFinish}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Finish — go to AI Overview
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {Object.values(certs).some(s => s === 'failed') && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              If a category failed because of a missing platform key or wrong key, jump back to Step 3 from
              the stepper above. Other failures usually mean the model doesn&apos;t support the required
              capability — try a different category, or skip this one.
            </span>
          </div>
        )}
      </div>
    </StepShell>
  );
};
