import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Filter, Plus, RefreshCw, Save, Shield, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  AiProvider,
  AiModelProfile,
  AiModelStatus,
  AiModelWarningLevel,
  superAdminApi,
  UpsertAiModelProfilePayload,
} from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import {
  SuperAdminBadge,
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminModal,
  SuperAdminPage,
  SuperAdminSearchInput,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
} from '../components/SuperAdminPage';
import { useSuperAdminTable } from '../hooks/useSuperAdminTable';
import { ActionMenu, ActionMenuItem } from '../components/ActionMenu';
import { CertificationManagerModal } from '../components/CertificationManagerModal';
import { SuperAdminDiagnosticsModal } from '../components/SuperAdminDiagnosticsModal';

const unwrap = <T,>(response: any): T => (response?.data ?? response) as T;

const emptyForm: UpsertAiModelProfilePayload = {
  provider: 'openai_compatible',
  modelName: '',
  displayName: '',
  status: 'custom',
  supportsToolCalling: false,
  supportsStructuredJson: false,
  maxContextTokens: 4096,
  recommendedUseCases: [],
  tags: [],
  warningLevel: 'warning',
  textOnlyMode: true,
  warningMessage: '',
  scope: 'GLOBAL',
  enabled: true,
  toolMode: undefined,
  dataFilterPolicyId: undefined,
  safetyPolicyId: undefined,
  systemPromptPolicyId: undefined,
  creditCost: 1,
};

const statusTone = (status: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (status) {
    case 'recommended': return 'green';
    case 'tested': return 'blue';
    case 'experimental': return 'amber';
    case 'custom': return 'slate';
    default: return 'slate';
  }
};

const diagnosticTone = (status: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (status) {
    case 'passed': return 'green';
    case 'failed': return 'red';
    default: return 'slate';
  }
};

const listToText = (values: string[]) => values.join(', ');
const textToList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

// ── Section divider used inside modal ──
const SectionDivider = () => <hr className="border-t border-slate-200" />;

// ── Section header used inside modal ──
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; badge?: React.ReactNode }> = ({ icon, title, badge }) => (
  <div className="flex items-center gap-2">
    {icon}
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {badge}
  </div>
);

type ViewState =
  | { mode: 'list' }
  | { mode: 'creating' }
  | { mode: 'editing', profileId: string }
  | { mode: 'diagnostics', profileId: string }
  | { mode: 'certifications', profileId: string };

export const AiModelProfilesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [profiles, setProfiles] = useState<AiModelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [providers, setProviders] = useState<AiProvider[]>([]);

  // Profile edit modal state
  const [viewState, setViewState] = useState<ViewState>({ mode: 'list' });
  const [form, setForm] = useState<UpsertAiModelProfilePayload>(emptyForm);

  const isEditing = viewState.mode === 'editing';
  const selectedProfile = viewState.mode === 'editing' || viewState.mode === 'diagnostics' || viewState.mode === 'certifications' 
    ? profiles.find(p => p.id === viewState.profileId) 
    : null;

  // ── Data loading ──
  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await superAdminApi.getAiModelProfiles();
      setProfiles(unwrap<AiModelProfile[]>(response));
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await superAdminApi.getAiProviders();
      setProviders(unwrap<AiProvider[]>(response));
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  useEffect(() => {
    loadProfiles();
    loadProviders();
  }, []);

  // ── Modal open/close ──
  const applyProviderToForm = (baseForm: UpsertAiModelProfilePayload, provider: AiProvider): UpsertAiModelProfilePayload => ({
    ...baseForm,
    providerId: provider.id,
    provider: provider.type,
    baseUrl: provider.defaultBaseUrl || undefined,
  });

  const openCreateModal = () => {
    setForm(providers[0] ? applyProviderToForm(emptyForm, providers[0]) : emptyForm);
    setViewState({ mode: 'creating' });
  };

  const openEditModal = (profile: AiModelProfile) => {
    setForm({
      provider: profile.provider,
      modelName: profile.modelName,
      status: profile.status,
      supportsToolCalling: profile.supportsToolCalling,
      supportsStructuredJson: profile.supportsStructuredJson,
      maxContextTokens: profile.maxContextTokens,
      recommendedUseCases: profile.recommendedUseCases || [],
      tags: profile.tags || [],
      warningLevel: profile.warningLevel,
      textOnlyMode: profile.textOnlyMode,
      warningMessage: profile.warningMessage || '',
      scope: profile.scope,
      providerId: profile.providerId,
      modelId: profile.modelId,
      displayName: profile.displayName,
      baseUrl: profile.baseUrl || undefined,
      temperature: profile.temperature,
      maxOutputTokens: profile.maxOutputTokens,
      toolMode: profile.toolMode,
      timeoutMs: profile.timeoutMs,
      retryPolicy: profile.retryPolicy,
      safetyPolicyId: profile.safetyPolicyId || undefined,
      systemPromptPolicyId: profile.systemPromptPolicyId || undefined,
      dataFilterPolicyId: profile.dataFilterPolicyId || undefined,
      enabled: profile.enabled,
      creditCost: profile.creditCost ?? 1,
    });
    setViewState({ mode: 'editing', profileId: profile.id });
  };

  const closeModal = () => {
    setViewState({ mode: 'list' });
    setForm(emptyForm);
  };

  // ── Handlers ──
  const handleSave = async () => {
    try {
      setSaving(true);
      if (viewState.mode === 'editing') {
        await superAdminApi.updateAiModelProfile(viewState.profileId, form);
        errorHandler.showSuccess(t('superAdmin.aiModels.messages.updated'));
      } else {
        await superAdminApi.createAiModelProfile(form);
        errorHandler.showSuccess(t('superAdmin.aiModels.messages.created'));
      }
      closeModal();
      await loadProfiles();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (profile: AiModelProfile) => {
    if (!window.confirm(t('superAdmin.aiModels.confirmDelete', { model: profile.modelName }))) return;
    try {
      await superAdminApi.deleteAiModelProfile(profile.id);
      errorHandler.showSuccess(t('superAdmin.aiModels.messages.deleted'));
      if (viewState.mode === 'editing' && viewState.profileId === profile.id) closeModal();
      await loadProfiles();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await superAdminApi.syncAiModelProfiles();
      const result = unwrap<{ synced: number }>(response);
      errorHandler.showSuccess(t('superAdmin.aiModels.messages.synced', { count: result.synced }));
      await loadProfiles();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSyncing(false);
    }
  };

  // ── Provider filter ──
  const [providerFilter, setProviderFilter] = useState<string>('__all__');

  const uniqueProviderIds = useMemo(() => {
    const ids = new Set(profiles.map(p => p.providerId || p.provider));
    return Array.from(ids).sort();
  }, [profiles]);

  const providerLookup = useMemo(() => {
    const map = new Map<string, AiProvider>();
    for (const p of providers) map.set(p.id, p);
    return map;
  }, [providers]);

  // ── Search & stats ──
  const {
    data: searchedProfiles,
    searchQuery,
    setSearchQuery,
  } = useSuperAdminTable({
    data: profiles,
    searchFields: ['provider', 'modelName', 'status'],
    initialSort: { field: 'provider', direction: 'asc' },
  });

  const displayedProfiles = useMemo(() => {
    if (providerFilter === '__all__') return searchedProfiles;
    return searchedProfiles.filter(p => (p.providerId || p.provider) === providerFilter);
  }, [searchedProfiles, providerFilter]);

  const stats = useMemo(() => ({
    total: profiles.length,
    recommended: profiles.filter(profile => profile.status === 'recommended').length,
    tested: profiles.filter(profile => profile.status === 'tested').length,
    passed: profiles.filter(profile => profile.lastDiagnosticStatus === 'passed').length,
  }), [profiles]);

  // ── Loading state ──
  if (loading) {
    return (
      <SuperAdminPage>
        <SuperAdminLoading label={t('superAdmin.aiModels.loading')} />
      </SuperAdminPage>
    );
  }

  // ── Render ──
  return (
    <SuperAdminPage>
      <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 flex items-center justify-between gap-3">
        <span>
          <strong>Setting up a new AI model?</strong> Use the guided wizard instead of editing each piece by hand.
        </span>
        <button
          type="button"
          onClick={() => window.location.assign('/super-admin/ai-setup')}
          className="flex-shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Open setup wizard
        </button>
      </div>
      {/* ── Page header ── */}
      <SuperAdminHeader
        title={t('superAdmin.aiModels.title')}
        description={t('superAdmin.aiModels.description')}
        meta={t('superAdmin.aiModels.meta', stats)}
        actions={
          viewState.mode === 'list' && (
            <div className="flex flex-wrap gap-2">
              <button onClick={openCreateModal} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Plus className="h-4 w-4" />
                {t('superAdmin.aiModels.actions.new')}
              </button>
              <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                <RefreshCw className={clsx('h-4 w-4', syncing && 'animate-spin')} />
                {t('superAdmin.aiModels.actions.sync')}
              </button>
            </div>
          )
        }
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <SuperAdminSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('superAdmin.aiModels.search')}
          />
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="__all__">{t('superAdmin.aiModels.filterAllProviders', 'All providers')}</option>
              {uniqueProviderIds.map(id => {
                const provider = providerLookup.get(id);
                const label = provider ? provider.name : id;
                return <option key={id} value={id}>{label}</option>;
              })}
            </select>
          </div>
        </div>
        <SuperAdminTable>
          <thead className="bg-slate-50">
            <tr>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.model')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.provider')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.status')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.tools')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.diagnostics')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.tags')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {displayedProfiles.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <SuperAdminEmptyState title={t('superAdmin.aiModels.empty')} />
                </td>
              </tr>
            ) : displayedProfiles.map(profile => {
              const profileProvider = providerLookup.get(profile.providerId || '');
              const providerDisplay = profileProvider ? profileProvider.name : (profile.providerId || profile.provider);
              return (
                <tr key={profile.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <button onClick={() => openEditModal(profile)} className="text-left">
                      <div className="font-medium text-blue-700 hover:underline">{profile.displayName || profile.modelName}</div>
                      {profile.modelId && <div className="font-mono text-xs text-slate-500">{profile.modelId}</div>}
                    </button>
                  </td>
                  <td className={tableCellClass}>
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {providerDisplay}
                    </span>
                  </td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={statusTone(profile.status)}>
                      {t(`superAdmin.aiModels.status.${profile.status}`)}
                    </SuperAdminBadge>
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex flex-wrap gap-1">
                      {profile.supportsToolCalling && <SuperAdminBadge tone="blue">{t('superAdmin.aiModels.flags.native')}</SuperAdminBadge>}
                      {profile.textOnlyMode && <SuperAdminBadge tone="slate">{t('superAdmin.aiModels.flags.textOnly')}</SuperAdminBadge>}
                      {profile.supportsStructuredJson && <SuperAdminBadge tone="green">{t('superAdmin.aiModels.flags.json')}</SuperAdminBadge>}
                    </div>
                  </td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={diagnosticTone(profile.lastDiagnosticStatus)}>
                      {t(`superAdmin.aiModels.diagnostics.${profile.lastDiagnosticStatus}`)}
                    </SuperAdminBadge>
                    {profile.lastDiagnosticMode && <div className="mt-1 text-xs text-slate-500">{profile.lastDiagnosticMode}</div>}
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {(profile.tags || []).slice(0, 4).map(tag => (
                        <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(profile)}
                        title={t('superAdmin.aiModels.actions.edit')}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <Bot className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewState({ mode: 'diagnostics', profileId: profile.id })}
                        title={t('superAdmin.aiModels.actions.runDiagnostics', 'Run Diagnostics')}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                      >
                        <Activity className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewState({ mode: 'certifications', profileId: profile.id })}
                        title={t('superAdmin.aiModels.certifications.openModal', 'Manage Certifications')}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-green-50 hover:text-green-600 transition-colors"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(profile)}
                        title={t('superAdmin.aiModels.actions.delete')}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </SuperAdminTable>
      </div>
      {(viewState.mode === 'creating' || viewState.mode === 'editing') && (
        <SuperAdminModal
          title={isEditing ? t('superAdmin.aiModels.form.editTitle') : t('superAdmin.aiModels.form.createTitle')}
          onClose={closeModal}
          size="lg"
          footer={
            <div className="flex w-full items-center justify-between">
              <div>
                {isEditing && selectedProfile && (
                  <button
                    onClick={() => { handleDelete(selectedProfile); closeModal(); }}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('superAdmin.aiModels.actions.delete')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={closeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {t('superAdmin.aiModels.actions.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? t('superAdmin.aiModels.actions.saving') : t('superAdmin.aiModels.actions.save')}
                </button>
              </div>
            </div>
          }
        >

          <div className="space-y-6">
            {/* ── Section 1: Profile Details ── */}
            <div className="space-y-4">
              <SectionHeader
                icon={<Bot className="h-4 w-4 text-slate-500" />}
                title={t('superAdmin.aiModels.modal.profileDetails')}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.form.provider')}</span>
                  {providers.length > 0 ? (
                    <select
                      value={form.providerId || ''}
                      onChange={event => {
                        const selectedProvider = providers.find(provider => provider.id === event.target.value);
                        if (selectedProvider) {
                          setForm(applyProviderToForm(form, selectedProvider));
                        }
                      }}
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                    >
                      {!providers.some(provider => provider.id === form.providerId) && form.providerId && (
                        <option value={form.providerId}>{form.providerId} ({t('superAdmin.aiModels.form.providerLegacy', 'legacy')})</option>
                      )}
                      <option value="" disabled>{t('superAdmin.aiModels.form.selectProvider', 'Select provider')}</option>
                      {providers.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name} · {provider.type}{provider.enabled ? '' : ` (${t('superAdmin.aiProviders.status.disabled')})`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <FormInput label="" value={form.provider} onChange={value => setForm({ ...form, provider: value, providerId: value })} />
                  )}
                  {form.providerId && (
                    <p className="mt-1 text-xs text-slate-500">{form.providerId}</p>
                  )}
                </label>
                <FormInput
                  label={t('superAdmin.aiModels.form.modelName', 'Technical Model Name')}
                  value={form.modelName}
                  disabled={isEditing}
                  onChange={value => {
                    const updated: Partial<UpsertAiModelProfilePayload> = { modelName: value };
                    if (!isEditing && (!form.displayName || form.displayName === form.modelName)) {
                      updated.displayName = value;
                    }
                    setForm({ ...form, ...updated });
                  }}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  label={t('superAdmin.aiModels.form.displayName', 'Display Name (Friendly Label)')}
                  value={form.displayName || ''}
                  onChange={value => setForm({ ...form, displayName: value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.form.status')}</span>
                  <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as AiModelStatus })} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    {['recommended', 'tested', 'experimental', 'custom'].map(status => (
                      <option key={status} value={status}>{t(`superAdmin.aiModels.status.${status}`)}</option>
                    ))}
                  </select>
                </label>
                <FormInput
                  label={t('superAdmin.aiModels.form.maxContextTokens')}
                  type="number"
                  value={String(form.maxContextTokens)}
                  onChange={value => setForm({ ...form, maxContextTokens: Number(value) || 4096 })}
                />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.form.warningLevel')}</span>
                  <select value={form.warningLevel} onChange={event => setForm({ ...form, warningLevel: event.target.value as AiModelWarningLevel })} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    {['none', 'info', 'warning', 'danger'].map(level => (
                      <option key={level} value={level}>{t(`superAdmin.aiModels.warningLevel.${level}`)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput label={t('superAdmin.aiModels.form.tags')} value={listToText(form.tags || [])} onChange={value => setForm({ ...form, tags: textToList(value) })} />
                <FormInput label={t('superAdmin.aiModels.form.useCases')} value={listToText(form.recommendedUseCases || [])} onChange={value => setForm({ ...form, recommendedUseCases: textToList(value) })} />
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.form.warningMessage')}</span>
                <textarea value={form.warningMessage} onChange={event => setForm({ ...form, warningMessage: event.target.value })} className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormCheckbox label={t('superAdmin.aiModels.form.nativeTools')} checked={form.supportsToolCalling} onChange={checked => setForm({ ...form, supportsToolCalling: checked })} />
                <FormCheckbox label={t('superAdmin.aiModels.form.structuredJson')} checked={form.supportsStructuredJson} onChange={checked => setForm({ ...form, supportsStructuredJson: checked })} />
                <FormCheckbox label={t('superAdmin.aiModels.form.textOnly')} checked={form.textOnlyMode} onChange={checked => setForm({ ...form, textOnlyMode: checked })} />
              </div>
            </div>

            {/* ── Runtime Configuration ── */}
            <SectionDivider />
            <div className="space-y-4">
              <SectionHeader
                icon={<Bot className="h-4 w-4 text-violet-500" />}
                title={t('superAdmin.aiModels.form.runtimeConfig')}
              />
              <p className="text-xs text-slate-500">{t('superAdmin.aiModels.form.runtimeConfigSubtitle')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.form.scope')}</span>
                  <select value={form.scope || 'GLOBAL'} onChange={event => setForm({ ...form, scope: event.target.value as 'GLOBAL' | 'TENANT' })} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    <option value="GLOBAL">GLOBAL</option>
                    <option value="TENANT">TENANT</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.form.toolMode')}</span>
                  <select value={form.toolMode || ''} onChange={event => setForm({ ...form, toolMode: (event.target.value || undefined) as any })} className="w-full rounded-md border border-slate-300 px-3 py-2">
                    <option value="">Auto (from flags)</option>
                    <option value="native_tools">Native Tools</option>
                    <option value="text_plan">Text Plan</option>
                    <option value="json_only">JSON Only</option>
                    <option value="none">None (text-only)</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput label={t('superAdmin.aiModels.form.temperature')} type="number" value={String(form.temperature ?? 0.7)} onChange={value => setForm({ ...form, temperature: Number(value) || 0.7 })} />
                <FormInput label={t('superAdmin.aiModels.form.maxOutputTokens')} type="number" value={String(form.maxOutputTokens ?? 4096)} onChange={value => setForm({ ...form, maxOutputTokens: Number(value) || 4096 })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput label={t('superAdmin.aiModels.form.timeoutMs')} type="number" value={String(form.timeoutMs ?? 120000)} onChange={value => setForm({ ...form, timeoutMs: Number(value) || 120000 })} />
                <FormInput label={t('superAdmin.aiModels.form.retryPolicy')} value={form.retryPolicy || 'default'} onChange={value => setForm({ ...form, retryPolicy: value || 'default' })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FormInput
                    label={t('superAdmin.aiModels.form.creditCost', { defaultValue: 'Credit cost per chat' })}
                    type="number"
                    value={String(form.creditCost ?? 1)}
                    onChange={value => {
                      const n = Number(value);
                      setForm({ ...form, creditCost: Number.isFinite(n) && n >= 0 ? n : 1 });
                    }}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {t('superAdmin.aiModels.form.creditCostHint', {
                      defaultValue: 'Credits debited per successful chat. Use higher values (e.g. 30 for GPT-4) for expensive models so the platform doesn\'t lose money on flat-rate pricing. Default: 1.',
                    })}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormCheckbox label={t('superAdmin.aiModels.form.enabled')} checked={form.enabled ?? true} onChange={checked => setForm({ ...form, enabled: checked })} />
              </div>
              </div>
            </div>
        </SuperAdminModal>
      )}
      {/* ── Diagnostics Modal ── */}
      {viewState.mode === 'diagnostics' && selectedProfile && (
        <SuperAdminDiagnosticsModal
          profile={selectedProfile}
          isOpen={true}
          onClose={() => {
            setViewState({ mode: 'list' });
          }}
        />
      )}

      {/* ── Certification Manager Modal ── */}
      {viewState.mode === 'certifications' && selectedProfile && (
        <CertificationManagerModal
          profile={selectedProfile}
          isOpen={true}
          onClose={() => {
            setViewState({ mode: 'list' });
          }}
          onCertChange={() => { loadProfiles(); }}
        />
      )}

    </SuperAdminPage>
  );
};

// ── Reusable form helpers ──
const FormInput: React.FC<{
  label: string;
  value: string;
  type?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, type = 'text', disabled = false, onChange }) => (
  <label className="block text-sm">
    <span className="mb-1 block font-medium text-slate-700">{label}</span>
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
      className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
    />
  </label>
);

const FormCheckbox: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    <span>{label}</span>
  </label>
);
