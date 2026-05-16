/**
 * AiProvidersPage.tsx
 *
 * Rebuilt for clarity:
 * - Provider list with clear capability badges
 * - Edit/Create form in a focused modal instead of inline panel
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

const PROVIDER_TYPES: AiProviderRegistryType[] = ['openai', 'openai_compatible', 'google_gemini', 'anthropic', 'ollama', 'custom'];
const AUTH_TYPES: AiProviderAuthType[] = ['api_key', 'bearer', 'none', 'custom'];

const emptyForm: UpsertAiProviderPayload = {
  name: '',
  type: 'openai',
  defaultBaseUrl: '',
  authType: 'api_key',
  byok: true,
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
    default: return 'slate';
  }
};

// ── Form helpers ───────────────────────────────────────────────────────────────

const FormInput: React.FC<{
  label: string; value: string; type?: string;
  onChange: (v: string) => void;
}> = ({ label, value, type = 'text', onChange }) => (
  <label className="block text-sm">
    <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
  </label>
);

const FormCheckbox: React.FC<{
  label: string; description?: string; checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer hover:bg-slate-100">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 rounded border-slate-300 text-indigo-600"
    />
    <div>
      <span className="block text-sm text-slate-700">{label}</span>
      {description && <span className="text-xs text-slate-400">{description}</span>}
    </div>
  </label>
);

// ── Provider form modal ────────────────────────────────────────────────────────

const ProviderFormModal: React.FC<{
  isOpen: boolean;
  isEditing: boolean;
  form: UpsertAiProviderPayload;
  saving: boolean;
  selectedProvider: AiProvider | undefined;
  onChange: (form: UpsertAiProviderPayload) => void;
  onSave: () => void;
  onToggleStatus: () => void;
  onClose: () => void;
  t: (key: string, fallback?: string, params?: any) => string;
}> = ({ isOpen, isEditing, form, saving, selectedProvider, onChange, onSave, onToggleStatus, onClose, t }) => {
  if (!isOpen) return null;

  return (
    <SuperAdminModal
      title={isEditing
        ? t('superAdmin.aiProviders.form.editTitle', 'Edit Provider')
        : t('superAdmin.aiProviders.form.createTitle', 'New Provider')}
      subtitle={isEditing && selectedProvider ? selectedProvider.name : undefined}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex items-center justify-between">
          <div>
            {isEditing && selectedProvider && (
              <button
                type="button"
                onClick={onToggleStatus}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedProvider.enabled
                    ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                    : 'border-green-200 text-green-700 hover:bg-green-50'
                }`}
              >
                {selectedProvider.enabled
                  ? t('superAdmin.aiProviders.form.disable', 'Disable')
                  : t('superAdmin.aiProviders.form.enable', 'Enable')
                }
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('superAdmin.aiModels.actions.cancel', 'Cancel')}
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving
                ? t('superAdmin.aiProviders.actions.saving', 'Saving…')
                : t('superAdmin.aiProviders.actions.save', 'Save')
              }
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <FormInput
          label={t('superAdmin.aiProviders.form.name', 'Name')}
          value={form.name || ''}
          onChange={(v) => onChange({ ...form, name: v })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              {t('superAdmin.aiProviders.form.type', 'Provider Type')}
            </span>
            <select
              value={form.type}
              onChange={(e) => onChange({ ...form, type: e.target.value as AiProviderRegistryType })}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {PROVIDER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`superAdmin.aiProviders.types.${type}`, type)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              {t('superAdmin.aiProviders.form.authType', 'Auth Type')}
            </span>
            <select
              value={form.authType || 'api_key'}
              onChange={(e) => onChange({ ...form, authType: e.target.value as AiProviderAuthType })}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {AUTH_TYPES.map((auth) => (
                <option key={auth} value={auth}>
                  {t(`superAdmin.aiProviders.authTypes.${auth}`, auth)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <FormInput
          label={t('superAdmin.aiProviders.form.baseUrl', 'Default Base URL')}
          value={form.defaultBaseUrl || ''}
          onChange={(v) => onChange({ ...form, defaultBaseUrl: v })}
        />

        <FormCheckbox
          label={t('superAdmin.aiProviders.flags.byok', 'BYOK — customers bring their own API key')}
          description={t('superAdmin.aiProviders.form.byokHint', 'If unchecked, the platform manages credentials internally.')}
          checked={form.byok !== false}
          onChange={(v) => onChange({ ...form, byok: v })}
        />

        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">
            {t('superAdmin.aiProviders.form.capabilities', 'Capabilities')}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <FormCheckbox
              label={t('superAdmin.aiProviders.flags.tools', 'Tool Calling')}
              checked={form.supportsTools || false}
              onChange={(v) => onChange({ ...form, supportsTools: v })}
            />
            <FormCheckbox
              label={t('superAdmin.aiProviders.flags.json', 'JSON Mode')}
              checked={form.supportsJsonMode || false}
              onChange={(v) => onChange({ ...form, supportsJsonMode: v })}
            />
            <FormCheckbox
              label={t('superAdmin.aiProviders.flags.sync', 'Model Sync')}
              checked={form.supportsModelSync || false}
              onChange={(v) => onChange({ ...form, supportsModelSync: v })}
            />
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            {t('superAdmin.aiProviders.form.notes', 'Notes')}
          </span>
          <textarea
            value={form.notes || ''}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
    </SuperAdminModal>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

export const AiProvidersPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertAiProviderPayload>(emptyForm);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setProviders(unwrap<AiProvider[]>(await superAdminApi.getAiProviders()));
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProviders(); }, []);

  const openCreate = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (provider: AiProvider) => {
    setSelectedId(provider.id);
    setForm({
      name: provider.name,
      type: provider.type,
      defaultBaseUrl: provider.defaultBaseUrl || '',
      authType: provider.authType,
      byok: provider.byok !== false,
      enabled: provider.enabled,
      supportsTools: provider.supportsTools,
      supportsJsonMode: provider.supportsJsonMode,
      supportsModelSync: provider.supportsModelSync,
      notes: provider.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
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
      closeModal();
      await loadProviders();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedId) return;
    const provider = providers.find((p) => p.id === selectedId);
    if (!provider) return;
    try {
      if (provider.enabled) {
        await superAdminApi.disableAiProvider(selectedId);
        errorHandler.showSuccess(t('superAdmin.aiProviders.messages.disabled'));
      } else {
        await superAdminApi.enableAiProvider(selectedId);
        errorHandler.showSuccess(t('superAdmin.aiProviders.messages.enabled'));
      }
      closeModal();
      await loadProviders();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const { data: searchedProviders, searchQuery, setSearchQuery } = useSuperAdminTable({
    data: providers,
    searchFields: ['name', 'type', 'defaultBaseUrl'],
    initialSort: { field: 'name', direction: 'asc' },
  });

  const stats = useMemo(() => ({
    total: providers.length,
    enabled: providers.filter((p) => p.enabled).length,
  }), [providers]);

  const selectedProvider = providers.find((p) => p.id === selectedId);

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
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            {t('superAdmin.aiProviders.actions.new')}
          </button>
        }
      />

      <div className="mb-4">
        <SuperAdminSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('superAdmin.aiProviders.search')}
        />
      </div>

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
          ) : searchedProviders.map((provider) => (
            <tr key={provider.id} className={tableRowClass}>
              {/* Name */}
              <td className={tableCellClass}>
                <button onClick={() => openEdit(provider)} className="text-left group">
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium text-blue-700 group-hover:underline">{provider.name}</span>
                  </div>
                </button>
              </td>

              {/* Type */}
              <td className={tableCellClass}>
                <SuperAdminBadge tone={typeTone(provider.type)}>
                  {t(`superAdmin.aiProviders.types.${provider.type}`, provider.type)}
                </SuperAdminBadge>
              </td>

              {/* Base URL */}
              <td className={tableCellClass}>
                <div
                  className="max-w-[200px] truncate font-mono text-xs text-slate-500"
                  title={provider.defaultBaseUrl || ''}
                >
                  {provider.defaultBaseUrl || '—'}
                </div>
              </td>

              {/* Auth */}
              <td className={tableCellClass}>
                <div className="flex flex-wrap gap-1">
                  <SuperAdminBadge tone="slate">
                    {t(`superAdmin.aiProviders.authTypes.${provider.authType}`, provider.authType)}
                  </SuperAdminBadge>
                  <SuperAdminBadge tone={provider.byok === false ? 'green' : 'blue'}>
                    {provider.byok === false
                      ? t('superAdmin.aiProviders.flags.erpManaged', 'Managed')
                      : t('superAdmin.aiProviders.flags.byok', 'BYOK')}
                  </SuperAdminBadge>
                </div>
              </td>

              {/* Capabilities */}
              <td className={tableCellClass}>
                <div className="flex flex-wrap gap-1">
                  {provider.supportsTools && (
                    <SuperAdminBadge tone="blue">
                      {t('superAdmin.aiProviders.flags.tools', 'Tools')}
                    </SuperAdminBadge>
                  )}
                  {provider.supportsJsonMode && (
                    <SuperAdminBadge tone="green">
                      {t('superAdmin.aiProviders.flags.json', 'JSON')}
                    </SuperAdminBadge>
                  )}
                  {provider.supportsModelSync && (
                    <SuperAdminBadge tone="amber">
                      {t('superAdmin.aiProviders.flags.sync', 'Sync')}
                    </SuperAdminBadge>
                  )}
                  {!provider.supportsTools && !provider.supportsJsonMode && !provider.supportsModelSync && (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              </td>

              {/* Status */}
              <td className={tableCellClass}>
                <SuperAdminBadge tone={provider.enabled ? 'green' : 'red'}>
                  {provider.enabled
                    ? t('superAdmin.aiProviders.status.enabled', 'Enabled')
                    : t('superAdmin.aiProviders.status.disabled', 'Disabled')
                  }
                </SuperAdminBadge>
              </td>

              {/* Actions */}
              <td className={tableCellClass}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEdit(provider)}
                    className="text-sm font-medium text-blue-700 hover:text-blue-900"
                  >
                    {t('superAdmin.aiProviders.actions.edit', 'Edit')}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (provider.enabled) {
                          await superAdminApi.disableAiProvider(provider.id);
                          errorHandler.showSuccess(t('superAdmin.aiProviders.messages.disabled'));
                        } else {
                          await superAdminApi.enableAiProvider(provider.id);
                          errorHandler.showSuccess(t('superAdmin.aiProviders.messages.enabled'));
                        }
                        await loadProviders();
                      } catch (error: any) {
                        errorHandler.showError(error);
                      }
                    }}
                    className={`text-sm font-medium ${
                      provider.enabled
                        ? 'text-amber-600 hover:text-amber-800'
                        : 'text-green-600 hover:text-green-800'
                    }`}
                  >
                    {provider.enabled
                      ? t('superAdmin.aiProviders.actions.disable', 'Disable')
                      : t('superAdmin.aiProviders.actions.enable', 'Enable')
                    }
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </SuperAdminTable>

      <ProviderFormModal
        isOpen={showModal}
        isEditing={Boolean(selectedId)}
        form={form}
        saving={saving}
        selectedProvider={selectedProvider}
        onChange={setForm}
        onSave={handleSave}
        onToggleStatus={handleToggleStatus}
        onClose={closeModal}
        t={t as any}
      />
    </SuperAdminPage>
  );
};
