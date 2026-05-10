import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, ChevronRight, Plus, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  AiCertificationCategory,
  AiCertificationResult,
  AiCertificationStatus,
  AiModelProfile,
  AiModelStatus,
  AiModelWarningLevel,
  ManualCertificationPayload,
  ProviderHealthResponse,
  SuperAdminCompany,
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

const unwrap = <T,>(response: any): T => (response?.data ?? response) as T;

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

const diagnosticTone = (status: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (status) {
    case 'passed': return 'green';
    case 'failed': return 'red';
    default: return 'slate';
  }
};

const listToText = (values: string[]) => values.join(', ');
const textToList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

const CERTIFICATION_CATEGORIES: AiCertificationCategory[] = [
  'GENERAL_CHAT', 'ACCOUNTING', 'FINANCE_REPORTING', 'SALES',
  'PURCHASES', 'INVENTORY', 'HR', 'CRM',
  'TOOL_CALLING', 'DATA_FILTERING', 'PROPOSAL_DRAFT', 'ANALYTICS',
];

const certificationStatusTone = (status: AiCertificationStatus): 'green' | 'amber' | 'red' | 'slate' => {
  switch (status) {
    case 'CERTIFIED': return 'green';
    case 'WARNING': return 'amber';
    case 'FAILED': return 'red';
    case 'EXPIRED': return 'slate';
    default: return 'slate';
  }
};

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

export const AiModelProfilesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [profiles, setProfiles] = useState<AiModelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [companies, setCompanies] = useState<SuperAdminCompany[]>([]);
  const [diagnosticCompanyId, setDiagnosticCompanyId] = useState('');
  const [diagnosticResult, setDiagnosticResult] = useState<ProviderHealthResponse | null>(null);

  // Modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertAiModelProfilePayload>(emptyForm);

  // Certification state
  const [certifications, setCertifications] = useState<AiCertificationResult[]>([]);
  const [certSaving, setCertSaving] = useState(false);
  const [shellCertCategory, setShellCertCategory] = useState<AiCertificationCategory>('GENERAL_CHAT');
  const [showManualCertModal, setShowManualCertModal] = useState(false);
  const [manualCertForm, setManualCertForm] = useState<Partial<ManualCertificationPayload>>({
    maxScore: 100,
    status: 'CERTIFIED',
    toolContractVersion: '1.0.0',
    dataFilterPolicyVersion: '1.0.0',
    testSuiteVersion: '',
    summary: '',
  });

  const isEditing = selectedId !== null;
  const selectedProfile = profiles.find(p => p.id === selectedId);

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

  const loadCompanies = async () => {
    try {
      const response = await superAdminApi.getAllCompanies();
      const loadedCompanies = unwrap<SuperAdminCompany[]>(response);
      setCompanies(loadedCompanies);
      setDiagnosticCompanyId(current => current || loadedCompanies[0]?.id || '');
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const loadCertifications = async (profileId: string) => {
    try {
      const result = await superAdminApi.getAiModelProfileCertifications(profileId);
      setCertifications(unwrap<AiCertificationResult[]>(result));
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  useEffect(() => {
    loadProfiles();
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadCertifications(selectedId);
    } else {
      setCertifications([]);
    }
  }, [selectedId]);

  // ── Modal open/close ──
  const openCreateModal = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setDiagnosticResult(null);
    setCertifications([]);
    setShowProfileModal(true);
  };

  const openEditModal = (profile: AiModelProfile) => {
    setSelectedId(profile.id);
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
    });
    setDiagnosticResult(null);
    setShowProfileModal(true);
  };

  const closeModal = () => {
    setShowProfileModal(false);
    setSelectedId(null);
    setForm(emptyForm);
    setDiagnosticResult(null);
    setCertifications([]);
  };

  // ── Handlers ──
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
      if (selectedId === profile.id) closeModal();
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

  const handleRunDiagnostics = async () => {
    if (!selectedId || !diagnosticCompanyId) return;
    try {
      setTesting(true);
      const result = await superAdminApi.runAiModelProfileDiagnostics(selectedId, diagnosticCompanyId);
      setDiagnosticResult(unwrap<ProviderHealthResponse>(result));
      errorHandler.showSuccess(t('superAdmin.aiModels.messages.diagnosticsRan'));
      await loadProfiles();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setTesting(false);
    }
  };

  const handleRecordManualCert = async () => {
    if (!selectedId) return;
    try {
      setCertSaving(true);
      const profileHash = selectedProfile?.profileHash || '';
      await superAdminApi.recordGlobalCertification(selectedId, {
        profileHash,
        category: manualCertForm.category!,
        moduleId: manualCertForm.moduleId || undefined,
        skillId: manualCertForm.skillId || undefined,
        score: manualCertForm.score!,
        maxScore: manualCertForm.maxScore!,
        status: manualCertForm.status!,
        testSuiteVersion: manualCertForm.testSuiteVersion!,
        toolContractVersion: manualCertForm.toolContractVersion!,
        dataFilterPolicyVersion: manualCertForm.dataFilterPolicyVersion!,
        summary: manualCertForm.summary!,
      });
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.recorded'));
      setShowManualCertModal(false);
      await loadCertifications(selectedId);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setCertSaving(false);
    }
  };

  const handleRunShellCert = async () => {
    if (!selectedId) return;
    try {
      setCertSaving(true);
      const profileHash = selectedProfile?.profileHash || '';
      await superAdminApi.runGlobalCertification(selectedId, {
        profileHash,
        category: shellCertCategory,
      });
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.shellRan'));
      await loadCertifications(selectedId);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setCertSaving(false);
    }
  };

  const handleExpireCertification = async (certificationId: string) => {
    if (!window.confirm(t('superAdmin.aiModels.certifications.confirmExpire'))) return;
    try {
      await superAdminApi.expireCertification(certificationId);
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.expired'));
      await loadCertifications(selectedId!);
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

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
      {/* ── Page header ── */}
      <SuperAdminHeader
        title={t('superAdmin.aiModels.title')}
        description={t('superAdmin.aiModels.description')}
        meta={t('superAdmin.aiModels.meta', stats)}
        actions={
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
        }
      />

      {/* ── Full-width table ── */}
      <div className="space-y-4">
        <SuperAdminSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('superAdmin.aiModels.search')}
        />
        <SuperAdminTable>
          <thead className="bg-slate-50">
            <tr>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.model')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.status')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.tools')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.diagnostics')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.tags')}</th>
              <th className={tableHeadCellClass}>{t('superAdmin.aiModels.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {searchedProfiles.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <SuperAdminEmptyState title={t('superAdmin.aiModels.empty')} />
                </td>
              </tr>
            ) : searchedProfiles.map(profile => (
              <tr key={profile.id} className={tableRowClass}>
                <td className={tableCellClass}>
                  <button onClick={() => openEditModal(profile)} className="text-left">
                    <div className="font-medium text-blue-700 hover:underline">{profile.modelName}</div>
                    <div className="font-mono text-xs text-slate-500">{profile.provider}</div>
                  </button>
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
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditModal(profile)} className="text-sm font-medium text-blue-700 hover:text-blue-900">
                      {t('superAdmin.aiModels.actions.edit')}
                    </button>
                    <button onClick={() => handleDelete(profile)} className="text-sm font-medium text-red-600 hover:text-red-800">
                      {t('superAdmin.aiModels.actions.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </SuperAdminTable>
      </div>

      {/* ── Profile Modal ── */}
      {showProfileModal && (
        <SuperAdminModal
          title={isEditing ? t('superAdmin.aiModels.form.editTitle') : t('superAdmin.aiModels.form.createTitle')}
          subtitle={isEditing && selectedProfile ? `${selectedProfile.provider} / ${selectedProfile.modelId || selectedProfile.modelName}` : undefined}
          onClose={closeModal}
          size="xl"
          footer={
            <div className="flex items-center justify-between">
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
                <FormInput label={t('superAdmin.aiModels.form.provider')} value={form.provider} onChange={value => setForm({ ...form, provider: value })} />
                <FormInput label={t('superAdmin.aiModels.form.modelName')} value={form.modelName} onChange={value => setForm({ ...form, modelName: value })} />
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
                <FormInput label={t('superAdmin.aiModels.form.dataFilterPolicyId')} value={form.dataFilterPolicyId || ''} onChange={value => setForm({ ...form, dataFilterPolicyId: value || undefined })} />
                <FormInput label={t('superAdmin.aiModels.form.safetyPolicyId')} value={form.safetyPolicyId || ''} onChange={value => setForm({ ...form, safetyPolicyId: value || undefined })} />
              </div>
              <FormInput label={t('superAdmin.aiModels.form.systemPromptPolicyId')} value={form.systemPromptPolicyId || ''} onChange={value => setForm({ ...form, systemPromptPolicyId: value || undefined })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormCheckbox label={t('superAdmin.aiModels.form.enabled')} checked={form.enabled ?? true} onChange={checked => setForm({ ...form, enabled: checked })} />
              </div>
            </div>

            {/* ── Sections below only shown when editing an existing profile ── */}
            {isEditing && (
              <>
                <SectionDivider />

                {/* ── Section 2: Diagnostics ── */}
                <div className="space-y-3">
                  <SectionHeader
                    icon={<Activity className="h-4 w-4 text-indigo-500" />}
                    title={t('superAdmin.aiModels.diagnosticsPanel.title')}
                  />
                  <p className="text-xs text-slate-500">{t('superAdmin.aiModels.diagnosticsPanel.subtitle')}</p>

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                    <div className="flex items-end gap-3">
                      <label className="flex-1 text-sm">
                        <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.diagnosticsPanel.company')}</span>
                        <select
                          value={diagnosticCompanyId}
                          onChange={event => setDiagnosticCompanyId(event.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                        >
                          {companies.map(company => (
                            <option key={company.id} value={company.id}>{company.name || company.id}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={handleRunDiagnostics}
                        disabled={testing || !diagnosticCompanyId}
                        className="flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
                      >
                        <RefreshCw className={clsx('h-4 w-4', testing && 'animate-spin')} />
                        {testing ? t('superAdmin.aiModels.actions.testing') : t('superAdmin.aiModels.actions.runDiagnostics')}
                      </button>
                    </div>

                    {diagnosticResult && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          <SuperAdminBadge tone={diagnosticResult.ready ? 'green' : 'red'}>
                            {diagnosticResult.ready
                              ? t('superAdmin.aiModels.diagnosticsPanel.chatReady')
                              : t('superAdmin.aiModels.diagnosticsPanel.chatNotReady')}
                          </SuperAdminBadge>
                          <SuperAdminBadge tone={diagnosticResult.toolDiagnostics?.erpToolsReady ? 'green' : 'amber'}>
                            {diagnosticResult.toolDiagnostics?.recommendedMode || 'unavailable'}
                          </SuperAdminBadge>
                        </div>
                        {(diagnosticResult.checks || []).map(check => (
                          <div key={check.id} className="rounded border border-indigo-100 bg-white px-3 py-2 text-sm">
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
                  </div>
                </div>

                <SectionDivider />

                {/* ── Section 3: Certifications ── */}
                <div className="space-y-3">
                  <SectionHeader
                    icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
                    title={t('superAdmin.aiModels.certifications.title')}
                  />
                  <p className="text-xs text-slate-500">{t('superAdmin.aiModels.certifications.disclaimer')}</p>

                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const profileHash = selectedProfile?.profileHash || '';
                          setManualCertForm({
                            profileHash,
                            category: undefined,
                            moduleId: undefined,
                            skillId: undefined,
                            score: undefined,
                            maxScore: 100,
                            status: 'CERTIFIED',
                            testSuiteVersion: '',
                            toolContractVersion: '1.0.0',
                            dataFilterPolicyVersion: '1.0.0',
                            summary: '',
                          });
                          setShowManualCertModal(true);
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                      >
                        <Plus className="h-3 w-3" />
                        {t('superAdmin.aiModels.certifications.recordManual')}
                      </button>
                    </div>

                    {/* Shell certification form */}
                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                      <div className="mb-2 text-xs font-medium text-slate-700">{t('superAdmin.aiModels.certifications.runShell')}</div>
                      <div className="flex items-end gap-2">
                        <label className="block flex-1 text-xs">
                          <span className="mb-0.5 block text-slate-600">{t('superAdmin.aiModels.certifications.form.profileHash')}</span>
                          <input
                            type="text"
                            readOnly
                            value={selectedProfile?.profileHash || ''}
                            className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="block text-xs">
                          <span className="mb-0.5 block text-slate-600">{t('superAdmin.aiModels.certifications.form.category')}</span>
                          <select
                            value={shellCertCategory}
                            onChange={e => setShellCertCategory(e.target.value as AiCertificationCategory)}
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                          >
                            {CERTIFICATION_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{t(`superAdmin.aiModels.certifications.categories.${cat}`)}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          onClick={handleRunShellCert}
                          disabled={certSaving}
                          className="flex items-center gap-1.5 rounded bg-slate-950 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          <RefreshCw className={clsx('h-3 w-3', certSaving && 'animate-spin')} />
                          {t('superAdmin.aiModels.certifications.runShell')}
                        </button>
                      </div>
                    </div>

                    {/* Certification list */}
                    {certifications.length === 0 ? (
                      <div className="py-6 text-center text-sm text-slate-500">{t('superAdmin.aiModels.certifications.empty')}</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-emerald-50">
                            <tr className="text-left text-slate-600">
                              <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.category')}</th>
                              <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.status')}</th>
                              <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.score')}</th>
                              <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.testedBy')}</th>
                              <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.testedAt')}</th>
                              <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.summary')}</th>
                              <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.actions')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-100">
                            {certifications.map(cert => (
                              <tr key={cert.id} className="bg-white">
                                <td className="px-3 py-2">{t(`superAdmin.aiModels.certifications.categories.${cert.category}`)}</td>
                                <td className="px-3 py-2">
                                  <SuperAdminBadge tone={certificationStatusTone(cert.status)}>{cert.status}</SuperAdminBadge>
                                </td>
                                <td className="px-3 py-2">{cert.score}/{cert.maxScore}</td>
                                <td className="px-3 py-2">{cert.testedBy}</td>
                                <td className="px-3 py-2">{new Date(cert.testedAt).toLocaleDateString()}</td>
                                <td className="max-w-[160px] truncate px-3 py-2" title={cert.summary}>{cert.summary}</td>
                                <td className="px-3 py-2">
                                  {cert.status !== 'EXPIRED' && (
                                    <button
                                      onClick={() => handleExpireCertification(cert.id)}
                                      className="text-xs font-medium text-red-600 hover:text-red-800"
                                    >
                                      {t('superAdmin.aiModels.certifications.expire')}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </SuperAdminModal>
      )}

      {/* ── Manual Certification Modal (nested) ── */}
      {showManualCertModal && selectedId && (
        <SuperAdminModal
          title={t('superAdmin.aiModels.certifications.recordManual')}
          onClose={() => setShowManualCertModal(false)}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowManualCertModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('superAdmin.aiModels.actions.cancel')}
              </button>
              <button
                onClick={handleRecordManualCert}
                disabled={certSaving || !manualCertForm.category || !manualCertForm.testSuiteVersion || !manualCertForm.summary}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {certSaving ? '...' : t('superAdmin.aiModels.certifications.recordManual')}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
              <span className="font-medium">Profile Hash:</span> {selectedProfile?.profileHash || '\u2014'}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.certifications.form.category')}</span>
              <select
                value={manualCertForm.category || ''}
                onChange={e => setManualCertForm({ ...manualCertForm, category: e.target.value as AiCertificationCategory })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">\u2014 Select \u2014</option>
                {CERTIFICATION_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{t(`superAdmin.aiModels.certifications.categories.${cat}`)}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput label={t('superAdmin.aiModels.certifications.form.moduleId')} value={manualCertForm.moduleId || ''} onChange={v => setManualCertForm({ ...manualCertForm, moduleId: v || undefined })} />
              <FormInput label={t('superAdmin.aiModels.certifications.form.skillId')} value={manualCertForm.skillId || ''} onChange={v => setManualCertForm({ ...manualCertForm, skillId: v || undefined })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput label={t('superAdmin.aiModels.certifications.form.score')} type="number" value={String(manualCertForm.score || 0)} onChange={v => setManualCertForm({ ...manualCertForm, score: Number(v) || 0 })} />
              <FormInput label={t('superAdmin.aiModels.certifications.form.maxScore')} type="number" value={String(manualCertForm.maxScore || 100)} onChange={v => setManualCertForm({ ...manualCertForm, maxScore: Number(v) || 100 })} />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.certifications.form.status')}</span>
              <select
                value={manualCertForm.status || 'CERTIFIED'}
                onChange={e => setManualCertForm({ ...manualCertForm, status: e.target.value as AiCertificationStatus })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {(['CERTIFIED', 'WARNING', 'FAILED', 'EXPIRED'] as AiCertificationStatus[]).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <FormInput label={t('superAdmin.aiModels.certifications.form.testSuiteVersion')} value={manualCertForm.testSuiteVersion || ''} onChange={v => setManualCertForm({ ...manualCertForm, testSuiteVersion: v })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput label={t('superAdmin.aiModels.certifications.form.toolContractVersion')} value={manualCertForm.toolContractVersion || '1.0.0'} onChange={v => setManualCertForm({ ...manualCertForm, toolContractVersion: v })} />
              <FormInput label={t('superAdmin.aiModels.certifications.form.dataFilterPolicyVersion')} value={manualCertForm.dataFilterPolicyVersion || '1.0.0'} onChange={v => setManualCertForm({ ...manualCertForm, dataFilterPolicyVersion: v })} />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.certifications.form.summary')}</span>
              <textarea
                value={manualCertForm.summary || ''}
                onChange={e => setManualCertForm({ ...manualCertForm, summary: e.target.value })}
                className="min-h-16 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </SuperAdminModal>
      )}
    </SuperAdminPage>
  );
};

// ── Reusable form helpers ──
const FormInput: React.FC<{
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}> = ({ label, value, type = 'text', onChange }) => (
  <label className="block text-sm">
    <span className="mb-1 block font-medium text-slate-700">{label}</span>
    <input type={type} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
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