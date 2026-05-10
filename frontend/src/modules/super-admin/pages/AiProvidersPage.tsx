import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  AiProvider,
  AiProviderAuthType,
  AiProviderRegistryType,
  superAdminApi,
  UpsertAiProviderPayload,
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

const PROVIDER_TYPES: AiProviderRegistryType[] = ['openai', 'openai_compatible', 'google_gemini', 'anthropic', 'ollama', 'custom'];
const AUTH_TYPES: AiProviderAuthType[] = ['api_key', 'bearer', 'none', 'custom'];

const emptyForm: UpsertAiProviderPayload = {
  name: '',
  type: 'openai',
  defaultBaseUrl: '',
  authType: 'api_key',
  enabled: true,
  supportsTools: false,
  supportsJsonMode: false,
  supportsModelSync: false,
  notes: '',
};

const typeTone = (type: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (type) {
    case 'openai': return 'green';
    case 'openai_compatible': return 'blue';
    case 'google_gemini': return 'amber';
    case 'anthropic': return 'red';
    case 'ollama': return 'slate';
    case 'custom': return 'slate';
    default: return 'slate';
  }
};

const authTone = (auth: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (auth) {
    case 'api_key': return 'blue';
    case 'bearer': return 'green';
    case 'none': return 'slate';
    case 'custom': return 'amber';
    default: return 'slate';
  }
};

export const AiProvidersPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertAiProviderPayload>(emptyForm);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await superAdminApi.getAiProviders();
      setProviders(unwrap<AiProvider[]>(response));
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const selectProvider = (provider: AiProvider) => {
    setSelectedId(provider.id);
    setForm({
      name: provider.name,
      type: provider.type,
      defaultBaseUrl: provider.defaultBaseUrl || '',
      authType: provider.authType,
      enabled: provider.enabled,
      supportsTools: provider.supportsTools,
      supportsJsonMode: provider.supportsJsonMode,
      supportsModelSync: provider.supportsModelSync,
      notes: provider.notes || '',
    });
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (selectedId) {
        await superAdminApi.updateAiProvider(selectedId, form);
        errorHandler.showSuccess(t('superAdmin.aiProviders.messages.updated'));
      } else {
        await superAdminApi.createAiProvider(form);
        errorHandler.showSuccess(t('superAdmin.aiProviders.messages.created'));
      }
      resetForm();
      await loadProviders();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleEnable = async (providerId: string) => {
    try {
      await superAdminApi.enableAiProvider(providerId);
      errorHandler.showSuccess(t('superAdmin.aiProviders.messages.enabled'));
      await loadProviders();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleDisable = async (providerId: string) => {
    try {
      await superAdminApi.disableAiProvider(providerId);
      errorHandler.showSuccess(t('superAdmin.aiProviders.messages.disabled'));
      await loadProviders();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const {
    data: searchedProviders,
    searchQuery,
    setSearchQuery,
  } = useSuperAdminTable({
    data: providers,
    searchFields: ['name', 'type', 'defaultBaseUrl'],
    initialSort: { field: 'name', direction: 'asc' },
  });

  const stats = useMemo(() => ({
    total: providers.length,
    enabled: providers.filter(p => p.enabled).length,
  }), [providers]);

  if (loading) {
    return (
      <SuperAdminPage>
        <SuperAdminLoading label={t('superAdmin.aiProviders.loading')} />
      </SuperAdminPage>
    );
  }

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.aiProviders.title')}
        description={t('superAdmin.aiProviders.description')}
        meta={t('superAdmin.aiProviders.meta', stats)}
        actions={
          <button onClick={resetForm} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" />
            {t('superAdmin.aiProviders.actions.new')}
          </button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <SuperAdminSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('superAdmin.aiProviders.search')}
          />
          <SuperAdminTable>
            <thead className="bg-slate-50">
              <tr>
                <th className={tableHeadCellClass}>{t('superAdmin.aiProviders.columns.name')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiProviders.columns.type')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiProviders.columns.baseUrl')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiProviders.columns.auth')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiProviders.columns.capabilities')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiProviders.columns.status')}</th>
                <th className={tableHeadCellClass}>{t('superAdmin.aiProviders.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {searchedProviders.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <SuperAdminEmptyState title={t('superAdmin.aiProviders.empty')} />
                  </td>
                </tr>
              ) : searchedProviders.map(provider => (
                <tr key={provider.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <button onClick={() => selectProvider(provider)} className="text-left">
                      <div className="font-medium text-blue-700 hover:underline">{provider.name}</div>
                    </button>
                  </td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={typeTone(provider.type)}>
                      {t(`superAdmin.aiProviders.types.${provider.type}`)}
                    </SuperAdminBadge>
                  </td>
                  <td className={tableCellClass}>
                    <div className="max-w-[180px] truncate font-mono text-xs text-slate-500" title={provider.defaultBaseUrl || ''}>
                      {provider.defaultBaseUrl || '—'}
                    </div>
                  </td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={authTone(provider.authType)}>
                      {t(`superAdmin.aiProviders.authTypes.${provider.authType}`)}
                    </SuperAdminBadge>
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex flex-wrap gap-1">
                      {provider.supportsTools && <SuperAdminBadge tone="blue">{t('superAdmin.aiProviders.flags.tools')}</SuperAdminBadge>}
                      {provider.supportsJsonMode && <SuperAdminBadge tone="green">{t('superAdmin.aiProviders.flags.json')}</SuperAdminBadge>}
                      {provider.supportsModelSync && <SuperAdminBadge tone="amber">{t('superAdmin.aiProviders.flags.sync')}</SuperAdminBadge>}
                    </div>
                  </td>
                  <td className={tableCellClass}>
                    <SuperAdminBadge tone={provider.enabled ? 'green' : 'red'}>
                      {provider.enabled ? t('superAdmin.aiProviders.status.enabled') : t('superAdmin.aiProviders.status.disabled')}
                    </SuperAdminBadge>
                  </td>
                  <td className={tableCellClass}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => selectProvider(provider)} className="text-sm font-medium text-blue-700 hover:text-blue-900">
                        {t('superAdmin.aiProviders.actions.edit')}
                      </button>
                      {provider.enabled ? (
                        <button onClick={() => handleDisable(provider.id)} className="text-sm font-medium text-amber-600 hover:text-amber-800">
                          {t('superAdmin.aiProviders.actions.disable')}
                        </button>
                      ) : (
                        <button onClick={() => handleEnable(provider.id)} className="text-sm font-medium text-green-600 hover:text-green-800">
                          {t('superAdmin.aiProviders.actions.enable')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </SuperAdminTable>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">
              {selectedId ? t('superAdmin.aiProviders.form.editTitle') : t('superAdmin.aiProviders.form.createTitle')}
            </h2>
          </div>

          <div className="space-y-3">
            <FormInput
              label={t('superAdmin.aiProviders.form.name')}
              value={form.name || ''}
              onChange={value => setForm({ ...form, name: value })}
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiProviders.form.type')}</span>
              <select
                value={form.type}
                onChange={event => setForm({ ...form, type: event.target.value as AiProviderRegistryType })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {PROVIDER_TYPES.map(type => (
                  <option key={type} value={type}>{t(`superAdmin.aiProviders.types.${type}`)}</option>
                ))}
              </select>
            </label>
            <FormInput
              label={t('superAdmin.aiProviders.form.baseUrl')}
              value={form.defaultBaseUrl || ''}
              onChange={value => setForm({ ...form, defaultBaseUrl: value })}
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiProviders.form.authType')}</span>
              <select
                value={form.authType || 'api_key'}
                onChange={event => setForm({ ...form, authType: event.target.value as AiProviderAuthType })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {AUTH_TYPES.map(auth => (
                  <option key={auth} value={auth}>{t(`superAdmin.aiProviders.authTypes.${auth}`)}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <FormCheckbox
                label={t('superAdmin.aiProviders.flags.tools')}
                checked={form.supportsTools || false}
                onChange={checked => setForm({ ...form, supportsTools: checked })}
              />
              <FormCheckbox
                label={t('superAdmin.aiProviders.flags.json')}
                checked={form.supportsJsonMode || false}
                onChange={checked => setForm({ ...form, supportsJsonMode: checked })}
              />
              <FormCheckbox
                label={t('superAdmin.aiProviders.flags.sync')}
                checked={form.supportsModelSync || false}
                onChange={checked => setForm({ ...form, supportsModelSync: checked })}
              />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiProviders.form.notes')}</span>
              <textarea
                value={form.notes || ''}
                onChange={event => setForm({ ...form, notes: event.target.value })}
                className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            {selectedId && (
              <button
                type="button"
                onClick={() => {
                  const provider = providers.find(p => p.id === selectedId);
                  if (provider) {
                    if (provider.enabled) {
                      handleDisable(provider.id);
                    } else {
                      handleEnable(provider.id);
                    }
                  }
                }}
                className={clsx(
                  'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium',
                  providers.find(p => p.id === selectedId)?.enabled
                    ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                    : 'border-green-200 text-green-700 hover:bg-green-50'
                )}
              >
                {providers.find(p => p.id === selectedId)?.enabled
                  ? t('superAdmin.aiProviders.form.disable')
                  : t('superAdmin.aiProviders.form.enable')}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? t('superAdmin.aiProviders.actions.saving') : t('superAdmin.aiProviders.actions.save')}
            </button>
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