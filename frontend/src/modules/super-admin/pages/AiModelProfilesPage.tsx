import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  AiModelProfile,
  AiModelStatus,
  AiModelWarningLevel,
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
            <FormInput label={t('superAdmin.aiModels.form.tags')} value={listToText(form.tags)} onChange={value => setForm({ ...form, tags: textToList(value) })} />
            <FormInput label={t('superAdmin.aiModels.form.useCases')} value={listToText(form.recommendedUseCases)} onChange={value => setForm({ ...form, recommendedUseCases: textToList(value) })} />
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
                <button onClick={() => profiles.find(profile => profile.id === selectedId && handleDelete(profile))} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                  {t('superAdmin.aiModels.actions.delete')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
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
