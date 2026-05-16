/**
 * AiModelProfilesPage.tsx
 *
 * Rebuilt for readability:
 * - Cleaner table with fewer columns and better visual hierarchy
 * - Certification status shown prominently with icon+badge
 * - Profile edit form moved to a dedicated modal (no inline form panel)
 * - Diagnostics and Certifications accessible from a clear action menu
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Filter,
  Plus,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  AiModelProfile,
  AiModelStatus,
  AiModelWarningLevel,
  AiProvider,
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
import { ActionMenu } from '../components/ActionMenu';
import { CertificationManagerModal } from '../components/CertificationManagerModal';
import { SuperAdminDiagnosticsModal } from '../components/SuperAdminDiagnosticsModal';

const unwrap = <T,>(response: any): T => (response?.data ?? response) as T;

// ── Helpers ────────────────────────────────────────────────────────────────────

const emptyForm: UpsertAiModelProfilePayload = {
  provider: 'openai_compatible',
  modelName: '',
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

const listToText = (values: string[]) => values.join(', ');
const textToList = (value: string) => value.split(',').map((s) => s.trim()).filter(Boolean);

// ── Certification status cell ──────────────────────────────────────────────────

const CertStatusCell: React.FC<{ profile: AiModelProfile }> = ({ profile }) => {
  const diag = profile.lastDiagnosticStatus;
  const hasCerts = (profile as any).activeCertificationCount > 0;

  if (diag === 'passed') {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
        <span className="text-xs font-medium text-green-700">Passed</span>
        {(profile as any).lastDiagnosticMode && (
          <span className="text-xs text-slate-400">{(profile as any).lastDiagnosticMode}</span>
        )}
      </div>
    );
  }
  if (diag === 'failed') {
    return (
      <div className="flex items-center gap-1.5">
        <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
        <span className="text-xs font-medium text-red-600">Failed</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Shield className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
      <span className="text-xs text-slate-400">Untested</span>
    </div>
  );
};

// ── Form helpers ───────────────────────────────────────────────────────────────

const FormInput: React.FC<{
  label: string; value: string; type?: string; hint?: string;
  onChange: (v: string) => void;
}> = ({ label, value, type = 'text', hint, onChange }) => (
  <label className="block text-sm">
    <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </label>
);

const FormSelect: React.FC<{
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="block text-sm">
    <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </label>
);

const FormCheckbox: React.FC<{
  label: string; checked: boolean; onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm cursor-pointer hover:bg-slate-100">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="rounded border-slate-300 text-indigo-600"
    />
    <span className="text-slate-700">{label}</span>
  </label>
);

// ── Profile Edit Modal content ─────────────────────────────────────────────────

const ProfileForm: React.FC<{
  form: UpsertAiModelProfilePayload;
  providers: AiProvider[];
  onChange: (form: UpsertAiModelProfilePayload) => void;
}> = ({ form, providers, onChange }) => {
  const { t } = useTranslation('common');

  const applyProvider = (providerId: string) => {
    const p = providers.find((x) => x.id === providerId);
    if (p) {
      onChange({ ...form, providerId: p.id, provider: p.type, baseUrl: p.defaultBaseUrl || undefined });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Core identity ── */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          {t('superAdmin.aiModels.modal.profileDetails', 'Profile Details')}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              {t('superAdmin.aiModels.form.provider', 'Provider')}
            </span>
            {providers.length > 0 ? (
              <select
                value={form.providerId || ''}
                onChange={(e) => applyProvider(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {!providers.some((p) => p.id === form.providerId) && form.providerId && (
                  <option value={form.providerId}>{form.providerId} (legacy)</option>
                )}
                <option value="" disabled>— Select provider —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.type}{p.enabled ? '' : ' (disabled)'}
                  </option>
                ))}
              </select>
            ) : (
              <FormInput
                label=""
                value={form.provider}
                onChange={(v) => onChange({ ...form, provider: v, providerId: v })}
              />
            )}
            {form.providerId && (
              <p className="mt-0.5 text-xs font-mono text-slate-400">{form.providerId}</p>
            )}
          </label>
          <FormInput
            label={t('superAdmin.aiModels.form.modelName', 'Model Name')}
            value={form.modelName}
            onChange={(v) => onChange({ ...form, modelName: v })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <FormSelect
            label={t('superAdmin.aiModels.form.status', 'Status')}
            value={form.status}
            options={['recommended', 'tested', 'experimental', 'custom'].map((s) => ({
              value: s,
              label: t(`superAdmin.aiModels.status.${s}`, s),
            }))}
            onChange={(v) => onChange({ ...form, status: v as AiModelStatus })}
          />
          <FormInput
            label={t('superAdmin.aiModels.form.maxContextTokens', 'Context Tokens')}
            type="number"
            value={String(form.maxContextTokens)}
            onChange={(v) => onChange({ ...form, maxContextTokens: Number(v) || 4096 })}
          />
          <FormSelect
            label={t('superAdmin.aiModels.form.warningLevel', 'Warning Level')}
            value={form.warningLevel}
            options={['none', 'info', 'warning', 'danger'].map((l) => ({
              value: l,
              label: t(`superAdmin.aiModels.warningLevel.${l}`, l),
            }))}
            onChange={(v) => onChange({ ...form, warningLevel: v as AiModelWarningLevel })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormInput
            label={t('superAdmin.aiModels.form.tags', 'Tags')}
            value={listToText(form.tags || [])}
            hint="Comma-separated"
            onChange={(v) => onChange({ ...form, tags: textToList(v) })}
          />
          <FormInput
            label={t('superAdmin.aiModels.form.useCases', 'Use Cases')}
            value={listToText(form.recommendedUseCases || [])}
            hint="Comma-separated"
            onChange={(v) => onChange({ ...form, recommendedUseCases: textToList(v) })}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              {t('superAdmin.aiModels.form.warningMessage', 'Warning Message')}
            </span>
            <textarea
              value={form.warningMessage}
              onChange={(e) => onChange({ ...form, warningMessage: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <FormCheckbox
            label={t('superAdmin.aiModels.form.nativeTools', 'Native Tools')}
            checked={form.supportsToolCalling}
            onChange={(v) => onChange({ ...form, supportsToolCalling: v })}
          />
          <FormCheckbox
            label={t('superAdmin.aiModels.form.structuredJson', 'Structured JSON')}
            checked={form.supportsStructuredJson}
            onChange={(v) => onChange({ ...form, supportsStructuredJson: v })}
          />
          <FormCheckbox
            label={t('superAdmin.aiModels.form.textOnly', 'Text Only')}
            checked={form.textOnlyMode}
            onChange={(v) => onChange({ ...form, textOnlyMode: v })}
          />
        </div>
      </div>

      {/* ── Runtime configuration ── */}
      <div className="border-t border-slate-200 pt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          {t('superAdmin.aiModels.form.runtimeConfig', 'Runtime Configuration')}
        </h4>
        <p className="text-xs text-slate-500 mb-4">
          {t('superAdmin.aiModels.form.runtimeConfigSubtitle', 'Advanced parameters used at inference time.')}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect
            label={t('superAdmin.aiModels.form.scope', 'Scope')}
            value={form.scope || 'GLOBAL'}
            options={[
              { value: 'GLOBAL', label: 'GLOBAL — available to all companies' },
              { value: 'TENANT', label: 'TENANT — company-specific' },
            ]}
            onChange={(v) => onChange({ ...form, scope: v as 'GLOBAL' | 'TENANT' })}
          />
          <FormSelect
            label={t('superAdmin.aiModels.form.toolMode', 'Tool Mode')}
            value={form.toolMode || ''}
            options={[
              { value: '', label: 'Auto (from capability flags)' },
              { value: 'native_tools', label: 'Native Tools' },
              { value: 'text_plan', label: 'Text Plan (guarded)' },
              { value: 'json_only', label: 'JSON Only' },
              { value: 'none', label: 'None (text-only)' },
            ]}
            onChange={(v) => onChange({ ...form, toolMode: (v || undefined) as any })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormInput
            label={t('superAdmin.aiModels.form.temperature', 'Temperature')}
            type="number"
            value={String(form.temperature ?? 0.7)}
            onChange={(v) => onChange({ ...form, temperature: Number(v) || 0.7 })}
          />
          <FormInput
            label={t('superAdmin.aiModels.form.maxOutputTokens', 'Max Output Tokens')}
            type="number"
            value={String(form.maxOutputTokens ?? 4096)}
            onChange={(v) => onChange({ ...form, maxOutputTokens: Number(v) || 4096 })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormInput
            label={t('superAdmin.aiModels.form.timeoutMs', 'Timeout (ms)')}
            type="number"
            value={String(form.timeoutMs ?? 120000)}
            onChange={(v) => onChange({ ...form, timeoutMs: Number(v) || 120000 })}
          />
          <FormInput
            label={t('superAdmin.aiModels.form.retryPolicy', 'Retry Policy')}
            value={form.retryPolicy || 'default'}
            onChange={(v) => onChange({ ...form, retryPolicy: v || 'default' })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <FormInput
            label={t('superAdmin.aiModels.form.dataFilterPolicyId', 'Data Filter Policy')}
            value={form.dataFilterPolicyId || ''}
            onChange={(v) => onChange({ ...form, dataFilterPolicyId: v || undefined })}
          />
          <FormInput
            label={t('superAdmin.aiModels.form.safetyPolicyId', 'Safety Policy')}
            value={form.safetyPolicyId || ''}
            onChange={(v) => onChange({ ...form, safetyPolicyId: v || undefined })}
          />
          <FormInput
            label={t('superAdmin.aiModels.form.systemPromptPolicyId', 'System Prompt Policy')}
            value={form.systemPromptPolicyId || ''}
            onChange={(v) => onChange({ ...form, systemPromptPolicyId: v || undefined })}
          />
        </div>

        <div className="mt-4">
          <FormCheckbox
            label={t('superAdmin.aiModels.form.enabled', 'Enabled')}
            checked={form.enabled ?? true}
            onChange={(v) => onChange({ ...form, enabled: v })}
          />
        </div>
      </div>
    </div>
  );
};

// ── Page component ─────────────────────────────────────────────────────────────

export const AiModelProfilesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [profiles, setProfiles] = useState<AiModelProfile[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Edit modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertAiModelProfilePayload>(emptyForm);

  // Action modals
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [diagnosticsProfile, setDiagnosticsProfile] = useState<AiModelProfile | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [certProfile, setCertProfile] = useState<AiModelProfile | null>(null);

  // Filters
  const [providerFilter, setProviderFilter] = useState('__all__');

  // ── Data loading ──
  const loadAll = async () => {
    try {
      setLoading(true);
      const [profilesRes, providersRes] = await Promise.all([
        superAdminApi.getAiModelProfiles(),
        superAdminApi.getAiProviders(),
      ]);
      setProfiles(unwrap<AiModelProfile[]>(profilesRes));
      setProviders(unwrap<AiProvider[]>(providersRes));
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── Provider lookup ──
  const providerLookup = useMemo(() => {
    const map = new Map<string, AiProvider>();
    for (const p of providers) map.set(p.id, p);
    return map;
  }, [providers]);

  const uniqueProviderIds = useMemo(() => {
    const ids = new Set(profiles.map((p) => p.providerId || p.provider));
    return Array.from(ids).sort();
  }, [profiles]);

  // ── Search + filter ──
  const { data: searchedProfiles, searchQuery, setSearchQuery } = useSuperAdminTable({
    data: profiles,
    searchFields: ['provider', 'modelName', 'status'],
    initialSort: { field: 'provider', direction: 'asc' },
  });

  const displayedProfiles = useMemo(() => {
    if (providerFilter === '__all__') return searchedProfiles;
    return searchedProfiles.filter((p) => (p.providerId || p.provider) === providerFilter);
  }, [searchedProfiles, providerFilter]);

  const stats = useMemo(() => ({
    total: profiles.length,
    recommended: profiles.filter((p) => p.status === 'recommended').length,
    tested: profiles.filter((p) => p.status === 'tested').length,
    passed: profiles.filter((p) => p.lastDiagnosticStatus === 'passed').length,
  }), [profiles]);

  // ── Modal helpers ──
  const applyProviderToForm = (base: UpsertAiModelProfilePayload, provider: AiProvider): UpsertAiModelProfilePayload => ({
    ...base,
    providerId: provider.id,
    provider: provider.type,
    baseUrl: provider.defaultBaseUrl || undefined,
  });

  const openCreateModal = () => {
    setSelectedId(null);
    setForm(providers[0] ? applyProviderToForm(emptyForm, providers[0]) : emptyForm);
    setShowProfileModal(true);
  };

  const openEditModal = (profile: AiModelProfile) => {
    setSelectedId(profile.id);
    setForm({
      provider: profile.provider, modelName: profile.modelName, status: profile.status,
      supportsToolCalling: profile.supportsToolCalling, supportsStructuredJson: profile.supportsStructuredJson,
      maxContextTokens: profile.maxContextTokens, recommendedUseCases: profile.recommendedUseCases || [],
      tags: profile.tags || [], warningLevel: profile.warningLevel, textOnlyMode: profile.textOnlyMode,
      warningMessage: profile.warningMessage || '', scope: profile.scope, providerId: profile.providerId,
      modelId: profile.modelId, displayName: profile.displayName, baseUrl: profile.baseUrl || undefined,
      temperature: profile.temperature, maxOutputTokens: profile.maxOutputTokens, toolMode: profile.toolMode,
      timeoutMs: profile.timeoutMs, retryPolicy: profile.retryPolicy, safetyPolicyId: profile.safetyPolicyId || undefined,
      systemPromptPolicyId: profile.systemPromptPolicyId || undefined, dataFilterPolicyId: profile.dataFilterPolicyId || undefined,
      enabled: profile.enabled,
    });
    setShowProfileModal(true);
  };

  const closeModal = () => {
    setShowProfileModal(false);
    setSelectedId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (selectedId) {
        await superAdminApi.updateAiModelProfile(selectedId, form);
        errorHandler.showSuccess(t('superAdmin.aiModels.messages.updated'));
      } else {
        await superAdminApi.createAiModelProfile(form);
        errorHandler.showSuccess(t('superAdmin.aiModels.messages.created'));
      }
      closeModal();
      await loadAll();
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
      if (selectedId === profile.id) closeModal();
      await loadAll();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = unwrap<{ synced: number }>(await superAdminApi.syncAiModelProfiles());
      errorHandler.showSuccess(t('superAdmin.aiModels.messages.synced', { count: result.synced }));
      await loadAll();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSyncing(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.id === selectedId);

  // ── Render ──
  if (loading) {
    return (
      <SuperAdminPage>
        <SuperAdminLoading label={t('superAdmin.aiModels.loading')} />
      </SuperAdminPage>
    );
  }

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.aiModels.title')}
        description={t('superAdmin.aiModels.description')}
        meta={t('superAdmin.aiModels.meta', stats)}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              {t('superAdmin.aiModels.actions.new')}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={clsx('h-4 w-4', syncing && 'animate-spin')} />
              {t('superAdmin.aiModels.actions.sync')}
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <SuperAdminSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('superAdmin.aiModels.search')}
        />
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="__all__">{t('superAdmin.aiModels.filterAllProviders', 'All providers')}</option>
            {uniqueProviderIds.map((id) => {
              const provider = providerLookup.get(id);
              return <option key={id} value={id}>{provider ? provider.name : id}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Table */}
      <SuperAdminTable>
        <thead className="bg-slate-50">
          <tr>
            <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.model')}</th>
            <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.provider')}</th>
            <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.status')}</th>
            <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.capabilities')}</th>
            <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.diagnostics')}</th>
            <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {displayedProfiles.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <SuperAdminEmptyState title={t('superAdmin.aiModels.empty')} />
              </td>
            </tr>
          ) : displayedProfiles.map((profile) => {
            const profileProvider = providerLookup.get(profile.providerId || '');
            const providerDisplay = profileProvider
              ? profileProvider.name
              : (profile.providerId || profile.provider);

            return (
              <tr key={profile.id} className={tableRowClass}>
                {/* Model name + ID */}
                <td className={tableCellClass}>
                  <button onClick={() => openEditModal(profile)} className="text-left group">
                    <div className="font-medium text-blue-700 group-hover:underline">{profile.modelName}</div>
                    {profile.modelId && (
                      <div className="mt-0.5 font-mono text-xs text-slate-400">{profile.modelId}</div>
                    )}
                    {profile.displayName && profile.displayName !== profile.modelName && (
                      <div className="mt-0.5 text-xs text-slate-400">{profile.displayName}</div>
                    )}
                  </button>
                </td>

                {/* Provider */}
                <td className={tableCellClass}>
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {providerDisplay}
                  </span>
                </td>

                {/* Status */}
                <td className={tableCellClass}>
                  <SuperAdminBadge tone={statusTone(profile.status)}>
                    {t(`superAdmin.aiModels.status.${profile.status}`)}
                  </SuperAdminBadge>
                </td>

                {/* Capabilities */}
                <td className={tableCellClass}>
                  <div className="flex flex-wrap gap-1">
                    {profile.supportsToolCalling && (
                      <SuperAdminBadge tone="blue">Tools</SuperAdminBadge>
                    )}
                    {profile.supportsStructuredJson && (
                      <SuperAdminBadge tone="green">JSON</SuperAdminBadge>
                    )}
                    {profile.textOnlyMode && (
                      <SuperAdminBadge tone="slate">Text-only</SuperAdminBadge>
                    )}
                  </div>
                </td>

                {/* Diagnostics status */}
                <td className={tableCellClass}>
                  <CertStatusCell profile={profile} />
                </td>

                {/* Actions */}
                <td className={tableCellClass}>
                  <ActionMenu items={[
                    {
                      label: t('superAdmin.aiModels.actions.edit'),
                      icon: <Bot className="h-3.5 w-3.5" />,
                      onClick: () => openEditModal(profile),
                    },
                    {
                      label: t('superAdmin.aiModels.actions.runDiagnostics', 'Run Diagnostics'),
                      icon: <Activity className="h-3.5 w-3.5" />,
                      onClick: () => {
                        setDiagnosticsProfile(profile);
                        setShowDiagnosticsModal(true);
                      },
                    },
                    {
                      label: t('superAdmin.aiModels.certifications.openModal', 'Manage Certifications'),
                      icon: <ShieldCheck className="h-3.5 w-3.5" />,
                      onClick: () => {
                        setCertProfile(profile);
                        setShowCertModal(true);
                      },
                    },
                    {
                      label: t('superAdmin.aiModels.actions.delete'),
                      icon: <Trash2 className="h-3.5 w-3.5" />,
                      onClick: () => handleDelete(profile),
                      variant: 'danger' as const,
                    },
                  ]} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </SuperAdminTable>

      {/* ── Profile Edit Modal ── */}
      {showProfileModal && (
        <SuperAdminModal
          title={selectedId
            ? t('superAdmin.aiModels.form.editTitle')
            : t('superAdmin.aiModels.form.createTitle')
          }
          subtitle={selectedId && selectedProfile
            ? `${selectedProfile.provider} / ${selectedProfile.modelId || selectedProfile.modelName}`
            : undefined
          }
          onClose={closeModal}
          size="xl"
          footer={
            <div className="flex items-center justify-between">
              <div>
                {selectedId && selectedProfile && (
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
                <button
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
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
          <ProfileForm form={form} providers={providers} onChange={setForm} />
        </SuperAdminModal>
      )}

      {/* ── Diagnostics Modal ── */}
      {showDiagnosticsModal && diagnosticsProfile && (
        <SuperAdminDiagnosticsModal
          profile={diagnosticsProfile}
          isOpen={showDiagnosticsModal}
          onClose={() => { setShowDiagnosticsModal(false); setDiagnosticsProfile(null); }}
        />
      )}

      {/* ── Certification Modal ── */}
      {showCertModal && certProfile && (
        <CertificationManagerModal
          profile={certProfile}
          isOpen={showCertModal}
          onClose={() => { setShowCertModal(false); setCertProfile(null); }}
          onCertChange={loadAll}
        />
      )}
    </SuperAdminPage>
  );
};
