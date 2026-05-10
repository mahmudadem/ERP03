import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertAiModelProfilePayload>(emptyForm);
  const [certifications, setCertifications] = useState<AiCertificationResult[]>([]);
  const [showManualCertModal, setShowManualCertModal] = useState(false);
  const [shellCertCategory, setShellCertCategory] = useState<AiCertificationCategory>('GENERAL_CHAT');
  const [certSaving, setCertSaving] = useState(false);
  const [manualCertForm, setManualCertForm] = useState<Partial<ManualCertificationPayload>>({
    maxScore: 100,
    status: 'CERTIFIED',
    toolContractVersion: '1.0.0',
    dataFilterPolicyVersion: '1.0.0',
    testSuiteVersion: '',
    summary: '',
  });

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

  useEffect(() => {
    loadProfiles();
    loadCompanies();
  }, []);

  const loadCertifications = async (profileId: string) => {
    try {
      const result = await superAdminApi.getAiModelProfileCertifications(profileId);
      setCertifications(unwrap<AiCertificationResult[]>(result));
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  useEffect(() => {
    if (selectedId) {
      loadCertifications(selectedId);
    } else {
      setCertifications([]);
    }
  }, [selectedId]);

  const selectProfile = (profile: AiModelProfile) => {
    setSelectedId(profile.id);
    setDiagnosticResult(null);
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
    });
  };

  const resetForm = () => {
    setSelectedId(null);
    setDiagnosticResult(null);
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
      resetForm();
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
      if (selectedId === profile.id) resetForm();
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
      const selectedProfile = profiles.find(p => p.id === selectedId);
      await superAdminApi.recordGlobalCertification(selectedId, {
        profileHash: selectedProfile?.profileHash || '',
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
      const selectedProfile = profiles.find(p => p.id === selectedId);
      await superAdminApi.runGlobalCertification(selectedId, {
        profileHash: selectedProfile?.profileHash || '',
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
            <button onClick={resetForm} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
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
                    <button onClick={() => selectProfile(profile)} className="text-left">
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
                      <button onClick={() => selectProfile(profile)} className="text-sm font-medium text-blue-700 hover:text-blue-900">
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

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">
              {selectedId ? t('superAdmin.aiModels.form.editTitle') : t('superAdmin.aiModels.form.createTitle')}
            </h2>
          </div>

          <div className="space-y-3">
            <FormInput label={t('superAdmin.aiModels.form.provider')} value={form.provider} onChange={value => setForm({ ...form, provider: value })} />
            <FormInput label={t('superAdmin.aiModels.form.modelName')} value={form.modelName} onChange={value => setForm({ ...form, modelName: value })} />
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
            <FormInput label={t('superAdmin.aiModels.form.tags')} value={listToText(form.tags || [])} onChange={value => setForm({ ...form, tags: textToList(value) })} />
            <FormInput label={t('superAdmin.aiModels.form.useCases')} value={listToText(form.recommendedUseCases || [])} onChange={value => setForm({ ...form, recommendedUseCases: textToList(value) })} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.form.warningMessage')}</span>
              <textarea value={form.warningMessage} onChange={event => setForm({ ...form, warningMessage: event.target.value })} className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <FormCheckbox label={t('superAdmin.aiModels.form.nativeTools')} checked={form.supportsToolCalling} onChange={checked => setForm({ ...form, supportsToolCalling: checked })} />
              <FormCheckbox label={t('superAdmin.aiModels.form.structuredJson')} checked={form.supportsStructuredJson} onChange={checked => setForm({ ...form, supportsStructuredJson: checked })} />
              <FormCheckbox label={t('superAdmin.aiModels.form.textOnly')} checked={form.textOnlyMode} onChange={checked => setForm({ ...form, textOnlyMode: checked })} />
            </div>
            <button onClick={handleSave} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? t('superAdmin.aiModels.actions.saving') : t('superAdmin.aiModels.actions.save')}
            </button>
            {selectedId && (
              <>
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-950">
                    <Activity className="h-4 w-4" />
                    {t('superAdmin.aiModels.diagnosticsPanel.title')}
                  </div>
                  <label className="block text-sm">
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
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
                  >
                    <RefreshCw className={clsx('h-4 w-4', testing && 'animate-spin')} />
                    {testing ? t('superAdmin.aiModels.actions.testing') : t('superAdmin.aiModels.actions.runDiagnostics')}
                  </button>
                  {diagnosticResult && (
                    <div className="mt-3 space-y-2 text-xs text-slate-700">
                      <div className="flex flex-wrap gap-1">
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
                        <div key={check.id} className="rounded border border-indigo-100 bg-white px-2 py-1">
                          <div className="font-medium text-slate-800">
                            {t(`superAdmin.aiModels.diagnosticsPanel.checks.${check.id}`, check.id)}:
                            {' '}
                            {t(`superAdmin.aiModels.diagnostics.${check.status}`, check.status)}
                          </div>
                          {check.detail && <div className="mt-0.5 text-slate-500">{check.detail}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Certifications Section */}
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-950">
                    <ShieldCheck className="h-4 w-4" />
                    {t('superAdmin.aiModels.certifications.title')}
                  </div>
                  <p className="mb-3 text-xs text-slate-600">{t('superAdmin.aiModels.certifications.disclaimer')}</p>

                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const profileHash = profiles.find(p => p.id === selectedId)?.profileHash || '';
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
                      className="flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                    >
                      <Plus className="h-3 w-3" />
                      {t('superAdmin.aiModels.certifications.recordManual')}
                    </button>
                  </div>

                  {/* Run Shell Certification */}
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-white p-2">
                    <div className="mb-1 text-xs font-medium text-slate-700">{t('superAdmin.aiModels.certifications.runShell')}</div>
                    <div className="flex items-end gap-2">
                      <label className="block flex-1 text-xs">
                        <span className="mb-0.5 block text-slate-600">{t('superAdmin.aiModels.certifications.form.profileHash')}</span>
                        <input
                          type="text"
                          readOnly
                          value={profiles.find(p => p.id === selectedId)?.profileHash || ''}
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
                        className="flex items-center gap-1 rounded bg-slate-950 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <RefreshCw className={clsx('h-3 w-3', certSaving && 'animate-spin')} />
                        {t('superAdmin.aiModels.certifications.runShell')}
                      </button>
                    </div>
                  </div>

                  {/* Certification List */}
                  {certifications.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">{t('superAdmin.aiModels.certifications.empty')}</div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-emerald-50">
                          <tr className="text-left text-slate-600">
                            <th className="px-2 py-1 font-medium">{t('superAdmin.aiModels.certifications.columns.category')}</th>
                            <th className="px-2 py-1 font-medium">{t('superAdmin.aiModels.certifications.columns.status')}</th>
                            <th className="px-2 py-1 font-medium">{t('superAdmin.aiModels.certifications.columns.score')}</th>
                            <th className="px-2 py-1 font-medium">{t('superAdmin.aiModels.certifications.columns.testedBy')}</th>
                            <th className="px-2 py-1 font-medium">{t('superAdmin.aiModels.certifications.columns.testedAt')}</th>
                            <th className="px-2 py-1 font-medium">{t('superAdmin.aiModels.certifications.columns.summary')}</th>
                            <th className="px-2 py-1 font-medium">{t('superAdmin.aiModels.certifications.columns.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-100">
                          {certifications.map(cert => (
                            <tr key={cert.id} className="bg-white">
                              <td className="px-2 py-1.5">{t(`superAdmin.aiModels.certifications.categories.${cert.category}`)}</td>
                              <td className="px-2 py-1.5">
                                <SuperAdminBadge tone={certificationStatusTone(cert.status)}>{cert.status}</SuperAdminBadge>
                              </td>
                              <td className="px-2 py-1.5">{cert.score}/{cert.maxScore}</td>
                              <td className="px-2 py-1.5">{cert.testedBy}</td>
                              <td className="px-2 py-1.5">{new Date(cert.testedAt).toLocaleDateString()}</td>
                              <td className="max-w-[120px] truncate px-2 py-1.5" title={cert.summary}>{cert.summary}</td>
                              <td className="px-2 py-1.5">
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

                <button onClick={() => profiles.find(profile => profile.id === selectedId && handleDelete(profile))} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                  {t('superAdmin.aiModels.actions.delete')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
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
                Cancel
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
              <span className="font-medium">Profile Hash:</span> {profiles.find(p => p.id === selectedId)?.profileHash || '—'}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.certifications.form.category')}</span>
              <select
                value={manualCertForm.category || ''}
                onChange={e => setManualCertForm({ ...manualCertForm, category: e.target.value as AiCertificationCategory })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">— Select —</option>
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
