/**
 * AiApiKeysPage — Super Admin's API key vault.
 *
 * One place to save, label, and validate every API key you use across providers
 * (OpenAI, OpenRouter, Anthropic, etc.). When setting up runtime profiles or
 * running diagnostics, the wizard can pull from this vault so you never have
 * to paste the same key twice.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Key,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  AiPlatformApiKey,
  AiProvider,
  superAdminApi,
} from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';

const unwrap = <T,>(value: any): T => (value?.data !== undefined ? value.data : value) as T;

export const AiApiKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<AiPlatformApiKey[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ label: string; providerId: string; apiKey: string; notes: string }>({
    label: '',
    providerId: '',
    apiKey: '',
    notes: '',
  });
  const [editForm, setEditForm] = useState<{ label: string; apiKey: string; notes: string }>({
    label: '',
    apiKey: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      setLoading(true);
      const [kRes, pRes] = await Promise.all([
        superAdminApi.getAiApiKeys(),
        superAdminApi.getAiProviders(),
      ]);
      setKeys(unwrap<AiPlatformApiKey[]>(kRes));
      setProviders(unwrap<AiProvider[]>(pRes).filter(p => p.enabled));
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const keysByProvider = useMemo(() => {
    const map = new Map<string, AiPlatformApiKey[]>();
    for (const key of keys) {
      const list = map.get(key.providerId) || [];
      list.push(key);
      map.set(key.providerId, list);
    }
    return map;
  }, [keys]);

  const handleCreate = async () => {
    if (!form.label.trim()) return errorHandler.showError(new Error('Label is required'));
    if (!form.providerId) return errorHandler.showError(new Error('Pick a provider'));
    if (!form.apiKey.trim()) return errorHandler.showError(new Error('API key is required'));
    try {
      setSaving(true);
      await superAdminApi.createAiApiKey({
        label: form.label.trim(),
        providerId: form.providerId,
        apiKey: form.apiKey.trim(),
        notes: form.notes.trim() || undefined,
      });
      errorHandler.showSuccess(`Key "${form.label.trim()}" added`);
      setShowCreate(false);
      setForm({ label: '', providerId: '', apiKey: '', notes: '' });
      await refresh();
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      setSaving(true);
      await superAdminApi.updateAiApiKey(id, {
        label: editForm.label.trim() || undefined,
        apiKey: editForm.apiKey.trim() || undefined,
        notes: editForm.notes,
      });
      errorHandler.showSuccess('Key updated');
      setEditingId(null);
      await refresh();
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: AiPlatformApiKey) => {
    if (!window.confirm(`Delete "${key.label}"? This cannot be undone.`)) return;
    try {
      await superAdminApi.deleteAiApiKey(key.id);
      errorHandler.showSuccess('Key deleted');
      await refresh();
    } catch (err: any) {
      errorHandler.showError(err);
    }
  };

  const handleValidate = async (key: AiPlatformApiKey) => {
    try {
      setValidatingId(key.id);
      await superAdminApi.validateAiApiKey(key.id);
      await refresh();
    } catch (err: any) {
      errorHandler.showError(err);
    } finally {
      setValidatingId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Key className="w-6 h-6 text-indigo-600" />
            API Key Vault
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Save, label, and validate the API keys you use across providers. Each key can be tested with one click.
          </p>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add API key
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Add a new API key</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. OpenRouter personal"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Provider</label>
              <select
                value={form.providerId}
                onChange={e => setForm(f => ({ ...f, providerId: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">— pick a provider —</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">API key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
              placeholder="sk-…"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-slate-500">Encrypted at rest. Never displayed back to anyone after save.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. created 2026-05-17, expires never"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save key
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setForm({ label: '', providerId: '', apiKey: '', notes: '' }); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Key list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading vault…
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <Key className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-700">No keys saved yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add your first key — typically one per provider (OpenRouter, OpenAI, Anthropic).
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map(provider => {
            const providerKeys = keysByProvider.get(provider.id) || [];
            if (providerKeys.length === 0) return null;
            return (
              <div key={provider.id} className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 p-3 flex items-center gap-2">
                  <Server className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-900">{provider.name}</span>
                  <span className="text-xs text-slate-500">· {provider.type}</span>
                  <span className="text-xs text-slate-400 ml-auto">{providerKeys.length} key{providerKeys.length > 1 ? 's' : ''}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {providerKeys.map(k => (
                    <li key={k.id} className="p-3">
                      {editingId === k.id ? (
                        <div className="space-y-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={editForm.label}
                              onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                              placeholder="Label"
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                            <input
                              type="password"
                              value={editForm.apiKey}
                              onChange={e => setEditForm(f => ({ ...f, apiKey: e.target.value }))}
                              placeholder="Leave blank to keep current key"
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                              autoComplete="off"
                            />
                          </div>
                          <input
                            type="text"
                            value={editForm.notes}
                            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Notes"
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdate(k.id)}
                              disabled={saving}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900">{k.label}</span>
                              <span className="font-mono text-xs text-slate-500">{k.credentialHint}</span>
                              <ValidationBadge status={k.lastValidationStatus} />
                            </div>
                            {k.lastValidationDetail && (
                              <p className={clsx(
                                'mt-1 text-xs',
                                k.lastValidationStatus === 'invalid' ? 'text-red-700' : 'text-slate-500',
                              )}>
                                {k.lastValidationDetail}
                              </p>
                            )}
                            {k.notes && <p className="mt-1 text-xs text-slate-500 italic">{k.notes}</p>}
                            {k.lastValidatedAt && (
                              <p className="mt-1 text-xs text-slate-400">
                                Last validated {new Date(k.lastValidatedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleValidate(k)}
                              disabled={validatingId === k.id}
                              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                              title="Test that this key authenticates against the provider"
                            >
                              {validatingId === k.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Test
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(k.id);
                                setEditForm({ label: k.label, apiKey: '', notes: k.notes || '' });
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              title="Edit label or rotate key"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(k)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                              title="Delete this key"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Keys whose provider was deleted/disabled */}
          {keys.filter(k => !providers.some(p => p.id === k.providerId)).length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Some keys belong to disabled or deleted providers. Re-enable the provider to use these keys, or delete the orphan keys.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ValidationBadge: React.FC<{ status: AiPlatformApiKey['lastValidationStatus'] }> = ({ status }) => {
  if (status === 'valid') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        Valid
      </span>
    );
  }
  if (status === 'invalid') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        <XCircle className="h-3 w-3" />
        Invalid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      Not tested
    </span>
  );
};

export default AiApiKeysPage;
