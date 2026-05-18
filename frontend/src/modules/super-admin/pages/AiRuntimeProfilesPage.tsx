import React, { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Activity, CheckCircle2, Key, Plus, Save, Server, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  AiModelProfile,
  AiPlatformApiKey,
  AiProvider,
  AiRuntimeInterval,
  AiRuntimeProfile,
  AiRuntimeProfileStatus,
  superAdminApi,
  UpsertAiRuntimeProfilePayload,
} from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import {
  SuperAdminBadge,
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminSearchInput,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
} from '../components/SuperAdminPage';
import { useSuperAdminTable } from '../hooks/useSuperAdminTable';

const unwrap = <T,>(response: any): T => (response?.data ?? response) as T;

const STATUS_VALUES: AiRuntimeProfileStatus[] = ['active', 'paused', 'disabled'];
const INTERVAL_VALUES: AiRuntimeInterval[] = ['minute', 'hour', 'day', 'month'];

const emptyForm: UpsertAiRuntimeProfilePayload = {
  providerId: '',
  modelProfileId: '',
  status: 'paused',
  requestInterval: 'day',
  notes: '',
};

const statusTone = (status: AiRuntimeProfileStatus): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (status) {
    case 'active': return 'green';
    case 'paused': return 'amber';
    case 'disabled': return 'red';
    default: return 'slate';
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

type ViewState =
  | { mode: 'list' }
  | { mode: 'creating' }
  | { mode: 'editing', profileId: string };

export const AiRuntimeProfilesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = useState<AiRuntimeProfile[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [models, setModels] = useState<AiModelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({ mode: 'list' });
  const [form, setForm] = useState<UpsertAiRuntimeProfilePayload>(emptyForm);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);
  const [vaultKeys, setVaultKeys] = useState<AiPlatformApiKey[]>([]);
  const [keyMode, setKeyMode] = useState<'vault' | 'paste'>('vault');
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState<string>('');

  const selectedProfile = viewState.mode === 'editing' ? profiles.find(profile => profile.id === viewState.profileId) || null : null;
  const isEditing = viewState.mode === 'editing';

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileRes, providerRes, modelRes, keyRes] = await Promise.all([
        superAdminApi.getAiRuntimeProfiles(),
        superAdminApi.getAiProviders(),
        superAdminApi.getAiModelProfiles(),
        superAdminApi.getAiApiKeys(),
      ]);
      setProfiles(unwrap<AiRuntimeProfile[]>(profileRes));
      setProviders(unwrap<AiProvider[]>(providerRes).filter(provider => provider.enabled));
      setModels(
        unwrap<AiModelProfile[]>(modelRes).filter(profile => profile.scope === 'GLOBAL' && profile.enabled !== false)
      );
      setVaultKeys(unwrap<AiPlatformApiKey[]>(keyRes));
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const providerVaultKeys = useMemo(
    () => vaultKeys.filter(k => k.providerId === form.providerId),
    [vaultKeys, form.providerId],
  );

  // Whenever the selected provider changes, reset mode + selection to a sensible default.
  useEffect(() => {
    if (providerVaultKeys.length > 0) {
      setKeyMode('vault');
      if (!providerVaultKeys.some(k => k.id === selectedVaultKeyId)) {
        setSelectedVaultKeyId(providerVaultKeys[0].id);
      }
    } else {
      setKeyMode('paste');
      setSelectedVaultKeyId('');
    }
    // intentionally not depending on selectedVaultKeyId to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerVaultKeys.length, form.providerId]);

  useEffect(() => {
    loadData();
  }, []);

  const modelsForProvider = useMemo(
    () => models.filter(model => model.providerId === form.providerId),
    [models, form.providerId],
  );

  const resetForm = () => {
    const firstProvider = providers[0];
    const firstModel = firstProvider ? models.find(model => model.providerId === firstProvider.id) : undefined;
    setViewState({ mode: 'list' });
    setForm({
      ...emptyForm,
      providerId: firstProvider?.id || '',
      modelProfileId: firstModel?.id || '',
    });
    setApiKeyInput('');
  };

  useEffect(() => {
    if (!loading && viewState.mode === 'creating' && providers.length > 0 && !form.providerId) {
      const firstProvider = providers[0];
      const firstModel = models.find(model => model.providerId === firstProvider.id);
      setForm(prev => ({
        ...prev,
        providerId: firstProvider.id,
        modelProfileId: firstModel?.id || '',
      }));
    }
  }, [loading, viewState.mode, providers, models, form.providerId]);

  // Deep-link from the Certification Manager's "Fix it" button: if the URL has
  // ?modelProfileId=<id>, jump straight into the edit or create flow for that
  // model so the superadmin doesn't have to hunt for the row.
  useEffect(() => {
    if (loading || deepLinkApplied) return;
    const targetModelProfileId = searchParams.get('modelProfileId');
    if (!targetModelProfileId) return;
    const targetModel = models.find(m => m.id === targetModelProfileId);
    if (!targetModel) return;
    const existing = profiles.find(p => p.modelProfileId === targetModelProfileId);
    if (existing) {
      // Open the existing runtime profile so they can update the key
      setViewState({ mode: 'editing', profileId: existing.id });
      setForm({
        providerId: existing.providerId,
        modelProfileId: existing.modelProfileId,
        status: existing.status,
        maxRequestsPerInterval: existing.maxRequestsPerInterval || undefined,
        requestInterval: existing.requestInterval,
        notes: existing.notes || '',
      });
    } else {
      // No runtime profile yet — open the create form pre-filled with this model
      setViewState({ mode: 'creating' });
      setForm({
        ...emptyForm,
        providerId: targetModel.providerId,
        modelProfileId: targetModel.id,
      });
    }
    setDeepLinkApplied(true);
    // Clear the query param so a refresh doesn't keep re-applying it
    const next = new URLSearchParams(searchParams);
    next.delete('modelProfileId');
    setSearchParams(next, { replace: true });
  }, [loading, deepLinkApplied, searchParams, models, profiles, setSearchParams]);

  const selectProfile = (profile: AiRuntimeProfile) => {
    setViewState({ mode: 'editing', profileId: profile.id });
    setForm({
      providerId: profile.providerId,
      modelProfileId: profile.modelProfileId,
      status: profile.status,
      maxRequestsPerInterval: profile.maxRequestsPerInterval || undefined,
      requestInterval: profile.requestInterval,
      notes: profile.notes || '',
    });
    setApiKeyInput('');
  };

  const handleProviderChange = (providerId: string) => {
    const nextModel = models.find(model => model.providerId === providerId);
    setForm(prev => ({
      ...prev,
      providerId,
      modelProfileId: nextModel?.id || '',
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: UpsertAiRuntimeProfilePayload = {
        ...form,
        notes: form.notes?.trim() || '',
      };
      if (keyMode === 'vault' && selectedVaultKeyId) {
        payload.apiKeyId = selectedVaultKeyId;
      } else if (apiKeyInput.trim()) {
        payload.apiKey = apiKeyInput.trim();
      }

      if (viewState.mode === 'editing') {
        await superAdminApi.updateAiRuntimeProfile(viewState.profileId, payload);
        errorHandler.showSuccess(t('superAdmin.aiRuntimeProfiles.messages.updated'));
      } else if (viewState.mode === 'creating') {
        await superAdminApi.createAiRuntimeProfile(payload);
        errorHandler.showSuccess(t('superAdmin.aiRuntimeProfiles.messages.created'));
      }

      resetForm();
      await loadData();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (profile: AiRuntimeProfile) => {
    if (!window.confirm(t('superAdmin.aiRuntimeProfiles.confirmDelete', { model: profile.modelDisplayName }))) return;
    try {
      await superAdminApi.deleteAiRuntimeProfile(profile.id);
      errorHandler.showSuccess(t('superAdmin.aiRuntimeProfiles.messages.deleted'));
      if (viewState.mode === 'editing' && viewState.profileId === profile.id) resetForm();
      await loadData();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const {
    data: searchedProfiles,
    searchQuery,
    setSearchQuery,
  } = useSuperAdminTable({
    data: profiles,
    searchFields: ['providerName', 'modelDisplayName', 'status'],
    initialSort: { field: 'providerName', direction: 'asc' },
  });

  const stats = useMemo(() => ({
    total: profiles.length,
    active: profiles.filter(profile => profile.status === 'active').length,
  }), [profiles]);

  if (loading) {
    return (
      <SuperAdminPage>
        <SuperAdminLoading label={t('superAdmin.aiRuntimeProfiles.loading')} />
      </SuperAdminPage>
    );
  }

  return (
    <SuperAdminPage>
      {viewState.mode === 'list' && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 flex items-center justify-between gap-3">
          <span>
            <strong>Setting up a new AI model?</strong> Use the guided wizard — it handles provider, model,
            key, test, and certification in one linear flow.
          </span>
          <button
            type="button"
            onClick={() => window.location.assign('/super-admin/ai-setup')}
            className="flex-shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Open setup wizard
          </button>
        </div>
      )}
      <SuperAdminHeader
        title={t('superAdmin.aiRuntimeProfiles.title')}
        description={t('superAdmin.aiRuntimeProfiles.description')}
        meta={t('superAdmin.aiRuntimeProfiles.meta', stats)}
        actions={
          viewState.mode === 'list' && (
            <button
              onClick={() => {
                const firstProvider = providers[0];
                const firstModel = firstProvider ? models.find(model => model.providerId === firstProvider.id) : undefined;
                setForm({
                  ...emptyForm,
                  providerId: firstProvider?.id || '',
                  modelProfileId: firstModel?.id || '',
                });
                setApiKeyInput('');
                setViewState({ mode: 'creating' });
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              {t('superAdmin.aiRuntimeProfiles.actions.new')}
            </button>
          )
        }
      />

      {viewState.mode === 'list' ? (
        <div className="space-y-4">
          <SuperAdminSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('superAdmin.aiRuntimeProfiles.search')}
          />

          <SuperAdminTable>
            <thead className="bg-slate-50">
              <tr>
                <th className={tableHeadCellClass}>{t('superAdmin.aiRuntimeProfiles.columns.provider')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiRuntimeProfiles.columns.model')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiRuntimeProfiles.columns.credential')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiRuntimeProfiles.columns.limit')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiRuntimeProfiles.columns.usage')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiRuntimeProfiles.columns.status')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiRuntimeProfiles.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {searchedProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <SuperAdminEmptyState title={t('superAdmin.aiRuntimeProfiles.empty')} />
                  </td>
                </tr>
              ) : searchedProfiles.map(profile => (
                <tr key={profile.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <button onClick={() => selectProfile(profile)} className="text-left">
                      <div className="font-medium text-blue-700 hover:underline">{profile.providerName}</div>
                      <div className="text-xs text-slate-500">{profile.providerType}</div>
                    </button>
                  </td>
                  <td className={tableCellClass}>
                    <div className="font-medium text-slate-900">{profile.modelDisplayName}</div>
                    <div className="text-xs text-slate-500">{profile.modelId}</div>
                  </td>
                  <td className={tableCellClass}>
                    {profile.hasCredential ? (
                      <div className="flex flex-col gap-1">
                        <SuperAdminBadge tone="green">{t('superAdmin.aiRuntimeProfiles.credential.configured')}</SuperAdminBadge>
                        <span className="font-mono text-xs text-slate-500">{profile.credentialHint || '****'}</span>
                      </div>
                    ) : (
                      <SuperAdminBadge tone="red">{t('superAdmin.aiRuntimeProfiles.credential.missing')}</SuperAdminBadge>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    <div className="text-sm text-slate-700">
                      {profile.maxRequestsPerInterval
                        ? t('superAdmin.aiRuntimeProfiles.limitValue', {
                            count: profile.maxRequestsPerInterval,
                            interval: t(`superAdmin.aiRuntimeProfiles.intervals.${profile.requestInterval}`),
                          })
                        : t('superAdmin.aiRuntimeProfiles.unlimited')}
                    </div>
                  </td>
                  <td className={tableCellClass}>
                    <div className="text-sm text-slate-700">
                      {t('superAdmin.aiRuntimeProfiles.windowUsage', { count: profile.currentWindowRequestCount || 0 })}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t('superAdmin.aiRuntimeProfiles.totalUsage', { count: profile.totalSuccessfulRequests || 0 })}
                    </div>
                  </td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={statusTone(profile.status)}>
                      {t(`superAdmin.aiRuntimeProfiles.status.${profile.status}`)}
                    </SuperAdminBadge>
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => selectProfile(profile)} className="text-sm font-medium text-blue-700 hover:text-blue-900">
                        {t('superAdmin.aiRuntimeProfiles.actions.edit')}
                      </button>
                      <button onClick={() => handleDelete(profile)} className="text-sm font-medium text-red-600 hover:text-red-800">
                        {t('superAdmin.aiRuntimeProfiles.actions.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </SuperAdminTable>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-6 w-6 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900">
                {viewState.mode === 'editing'
                  ? t('superAdmin.aiRuntimeProfiles.form.editTitle')
                  : t('superAdmin.aiRuntimeProfiles.form.createTitle')}
              </h2>
            </div>
            <button onClick={resetForm} className="text-sm font-medium text-slate-500 hover:text-slate-700">Cancel</button>
          </div>

          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiRuntimeProfiles.form.provider')}</span>
              <select
                value={form.providerId}
                onChange={event => handleProviderChange(event.target.value)}
                disabled={isEditing}
                className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
              >
                <option value="" disabled>{t('superAdmin.aiRuntimeProfiles.form.selectProvider')}</option>
                {providers.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} · {provider.type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiRuntimeProfiles.form.model')}</span>
              <select
                value={form.modelProfileId}
                onChange={event => setForm({ ...form, modelProfileId: event.target.value })}
                disabled={isEditing || !form.providerId}
                className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
              >
                <option value="" disabled>{t('superAdmin.aiRuntimeProfiles.form.selectModel')}</option>
                {modelsForProvider.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.displayName} · {model.modelId}
                  </option>
                ))}
              </select>
            </label>

            {isEditing && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {t('superAdmin.aiRuntimeProfiles.form.identityLocked')}
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
                  <Key className="h-4 w-4" />
                  {t('superAdmin.aiRuntimeProfiles.form.apiKey', 'API key')}
                </span>
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setKeyMode('vault')}
                    disabled={providerVaultKeys.length === 0}
                    className={clsx(
                      'rounded-md px-3 py-1 font-medium transition',
                      keyMode === 'vault' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
                      providerVaultKeys.length === 0 && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    Pick from vault ({providerVaultKeys.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeyMode('paste')}
                    className={clsx(
                      'rounded-md px-3 py-1 font-medium transition',
                      keyMode === 'paste' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    Paste a new key
                  </button>
                </div>
              </div>

              {keyMode === 'vault' && providerVaultKeys.length > 0 && (
                <div className="grid gap-2">
                  {providerVaultKeys.map(k => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setSelectedVaultKeyId(k.id)}
                      className={clsx(
                        'flex items-start gap-3 rounded-lg border p-2.5 text-left transition',
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
                          {k.lastValidationStatus === 'unknown' && (
                            <span className="text-xs text-slate-400">Not tested</span>
                          )}
                        </div>
                        {k.notes && <div className="text-xs text-slate-500 mt-0.5 italic">{k.notes}</div>}
                      </div>
                      {selectedVaultKeyId === k.id && (
                        <CheckCircle2 className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                  <p className="text-xs text-slate-500">
                    Manage saved keys at{' '}
                    <a href="/super-admin/ai-api-keys" target="_blank" rel="noreferrer" className="text-indigo-700 underline">
                      API Key Vault
                    </a>
                    .
                  </p>
                </div>
              )}

              {keyMode === 'paste' && (
                <div>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={event => setApiKeyInput(event.target.value)}
                    placeholder={isEditing
                      ? t('superAdmin.aiRuntimeProfiles.form.apiKeyReplacePlaceholder', 'Leave blank to keep existing key')
                      : t('superAdmin.aiRuntimeProfiles.form.apiKeyPlaceholder', 'sk-…')}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {isEditing
                      ? t('superAdmin.aiRuntimeProfiles.form.apiKeyReplaceHint', 'Leave blank to keep the existing key, or paste a new one to replace it.')
                      : t('superAdmin.aiRuntimeProfiles.form.apiKeyHint', 'Encrypted at rest. Never displayed back to anyone after save.')}
                    {' '}
                    {providerVaultKeys.length === 0 && (
                      <>Tip: save this key to the{' '}
                        <a href="/super-admin/ai-api-keys" target="_blank" rel="noreferrer" className="text-indigo-700 underline">
                          API Key Vault
                        </a>{' '}to reuse it on other models.
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiRuntimeProfiles.form.status')}</span>
                <select
                  value={form.status || 'paused'}
                  onChange={event => setForm({ ...form, status: event.target.value as AiRuntimeProfileStatus })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  {STATUS_VALUES.map(status => (
                    <option key={status} value={status}>
                      {t(`superAdmin.aiRuntimeProfiles.status.${status}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiRuntimeProfiles.form.maxRequests')}</span>
                <input
                  type="number"
                  min="0"
                  value={form.maxRequestsPerInterval ?? ''}
                  onChange={event => setForm({
                    ...form,
                    maxRequestsPerInterval: event.target.value === '' ? undefined : Number(event.target.value),
                  })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiRuntimeProfiles.form.interval')}</span>
              <select
                value={form.requestInterval || 'day'}
                onChange={event => setForm({ ...form, requestInterval: event.target.value as AiRuntimeInterval })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {INTERVAL_VALUES.map(interval => (
                  <option key={interval} value={interval}>
                    {t(`superAdmin.aiRuntimeProfiles.intervals.${interval}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiRuntimeProfiles.form.notes')}</span>
              <textarea
                value={form.notes || ''}
                onChange={event => setForm({ ...form, notes: event.target.value })}
                className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            {selectedProfile && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div className="mb-2 flex items-center gap-1 font-medium text-slate-800">
                  <Activity className="h-4 w-4" />
                  {t('superAdmin.aiRuntimeProfiles.form.runtimeStats')}
                </div>
                <div>{t('superAdmin.aiRuntimeProfiles.windowUsage', { count: selectedProfile.currentWindowRequestCount || 0 })}</div>
                <div>{t('superAdmin.aiRuntimeProfiles.totalUsage', { count: selectedProfile.totalSuccessfulRequests || 0 })}</div>
                <div>{t('superAdmin.aiRuntimeProfiles.form.lastUsed')}: {formatDateTime(selectedProfile.lastUsedAt)}</div>
                <div>{t('superAdmin.aiRuntimeProfiles.form.lastFailure')}: {selectedProfile.lastFailureReason || '—'}</div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
              <div />
              <div className="flex items-center gap-2">
                <button onClick={resetForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.providerId || !form.modelProfileId}
                  className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? t('superAdmin.aiRuntimeProfiles.actions.saving') : t('superAdmin.aiRuntimeProfiles.actions.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SuperAdminPage>
  );
};

export default AiRuntimeProfilesPage;
