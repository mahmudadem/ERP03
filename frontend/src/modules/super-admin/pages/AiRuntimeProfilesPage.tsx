import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Key, Plus, Save, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AiModelProfile,
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
  const [profiles, setProfiles] = useState<AiRuntimeProfile[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [models, setModels] = useState<AiModelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({ mode: 'list' });
  const [form, setForm] = useState<UpsertAiRuntimeProfilePayload>(emptyForm);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const selectedProfile = viewState.mode === 'editing' ? profiles.find(profile => profile.id === viewState.profileId) || null : null;
  const isEditing = viewState.mode === 'editing';

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileRes, providerRes, modelRes] = await Promise.all([
        superAdminApi.getAiRuntimeProfiles(),
        superAdminApi.getAiProviders(),
        superAdminApi.getAiModelProfiles(),
      ]);
      setProfiles(unwrap<AiRuntimeProfile[]>(profileRes));
      setProviders(unwrap<AiProvider[]>(providerRes).filter(provider => provider.enabled));
      setModels(
        unwrap<AiModelProfile[]>(modelRes).filter(profile => profile.scope === 'GLOBAL' && profile.enabled !== false)
      );
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

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
      if (apiKeyInput.trim()) {
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

            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1 font-medium text-slate-700">
                <Key className="h-4 w-4" />
                {t('superAdmin.aiRuntimeProfiles.form.apiKey')}
              </span>
              <input
                type="password"
                value={apiKeyInput}
                onChange={event => setApiKeyInput(event.target.value)}
                placeholder={isEditing
                  ? t('superAdmin.aiRuntimeProfiles.form.apiKeyReplacePlaceholder')
                  : t('superAdmin.aiRuntimeProfiles.form.apiKeyPlaceholder')}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-500">
                {isEditing
                  ? t('superAdmin.aiRuntimeProfiles.form.apiKeyReplaceHint')
                  : t('superAdmin.aiRuntimeProfiles.form.apiKeyHint')}
              </p>
            </label>

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
