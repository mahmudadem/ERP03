import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { superAdminApi, AiTool, AiToolEnablementPolicy, AiModelToolPolicy } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ArrowLeft, Skull } from 'lucide-react';
import {
  SuperAdminBadge,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminPanel,
  tableCellClass,
} from '../components/SuperAdminPage';

const unwrap = <T,>(response: any): T => (response?.data ?? response) as T;

const modeTone = (mode: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (mode) {
    case 'read-only': return 'blue';
    case 'proposal': return 'amber';
    case 'write': return 'red';
    default: return 'slate';
  }
};

const riskTone = (risk: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (risk) {
    case 'low': return 'green';
    case 'medium': return 'amber';
    case 'high': return 'amber';
    case 'blocked': return 'red';
    default: return 'slate';
  }
};

const sensitivityTone = (sensitivity: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (sensitivity) {
    case 'low': return 'green';
    case 'medium': return 'amber';
    case 'high': return 'red';
    default: return 'slate';
  }
};

const statusTone = (status: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (status) {
    case 'active': return 'green';
    case 'disabled': return 'slate';
    case 'unavailable': return 'amber';
    case 'deprecated': return 'red';
    default: return 'slate';
  }
};

const JsonBlock: React.FC<{ data: any; fallback?: string }> = ({ data, fallback }) => {
  if (!data) {
    return <span className="text-sm text-slate-400">{fallback || 'Not specified'}</span>;
  }
  if (typeof data === 'object' && Object.keys(data).length === 0) {
    return <span className="text-sm text-slate-400">{fallback || 'Not specified'}</span>;
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
};

export const AiToolDetailPage: React.FC<{ toolNameProp?: string; onBack?: () => void }> = ({ toolNameProp, onBack }) => {
  const params = useParams<{ toolName: string }>();
  const toolName = toolNameProp || params.toolName;
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [tool, setTool] = useState<AiTool | null>(null);
  const [enablementPolicy, setEnablementPolicy] = useState<AiToolEnablementPolicy | null>(null);
  const [modelPolicies, setModelPolicies] = useState<AiModelToolPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingTool, setTogglingTool] = useState(false);
  const [editingKeywords, setEditingKeywords] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [savingKeywords, setSavingKeywords] = useState(false);

  useEffect(() => {
    if (toolName) {
      loadTool();
    }
  }, [toolName]);

  const loadTool = async () => {
    try {
      setLoading(true);
      const [toolRes, policiesRes, modelPoliciesRes] = await Promise.all([
        superAdminApi.getAiTool(toolName!),
        superAdminApi.getAiToolEnablementPolicies().catch(() => ({ data: [] })),
        superAdminApi.getAiModelToolPolicies().catch(() => ({ data: [] })),
      ]);
      const toolData = unwrap<AiTool>(toolRes);
      setTool(toolData);

      const policies = unwrap<AiToolEnablementPolicy[]>(policiesRes);
      const matchingPolicy = policies.find((p: AiToolEnablementPolicy) => p.toolName === toolName);
      setEnablementPolicy(matchingPolicy || null);

      const modelPoliciesData = unwrap<AiModelToolPolicy[]>(modelPoliciesRes);
      const relevantModelPolicies = modelPoliciesData.filter((p: AiModelToolPolicy) => p.toolName === toolName);
      setModelPolicies(relevantModelPolicies);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!tool) return;
    try {
      setTogglingTool(true);
      if (tool.enabled !== false && tool.status !== 'disabled') {
        await superAdminApi.disableAiTool(tool.name);
      } else {
        await superAdminApi.enableAiTool(tool.name);
      }
      await loadTool();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setTogglingTool(false);
    }
  };

  const handleStartEditKeywords = () => {
    setKeywordsInput((tool?.chatKeywords || []).join('\n'));
    setEditingKeywords(true);
  };

  const handleSaveKeywords = async () => {
    if (!tool) return;
    try {
      setSavingKeywords(true);
      const keywords = keywordsInput.split('\n').map(k => k.trim()).filter(Boolean);
      await superAdminApi.updateAiToolKeywords(tool.name, keywords);
      errorHandler.showSuccess(t('superAdmin.aiTools.keywords.saved', { defaultValue: 'Keywords saved' }));
      await loadTool();
      setEditingKeywords(false);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSavingKeywords(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminPage>
        <SuperAdminLoading label={t('superAdmin.aiTools.title', { defaultValue: 'Loading AI Tool' })} />
      </SuperAdminPage>
    );
  }

  if (!tool) {
    return (
      <SuperAdminPage>
        <SuperAdminHeader title={t('superAdmin.aiTools.title', { defaultValue: 'AI Tool Catalog' })} />
        <div className="py-12 text-center text-slate-500">{t(`Tool not found.`)}</div>
      </SuperAdminPage>
    );
  }

  const blocked = tool.mode === 'write' && tool.riskLevel === 'blocked';

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.aiTools.detail.title', { name: tool.name, defaultValue: `AI Tool: ${tool.name}` })}
        description={tool.description || ''}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => onBack ? onBack() : navigate('/super-admin/ai-tools')}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('superAdmin.aiTools.actions.viewDetails', { defaultValue: 'Back to Catalog' }).replace('Details', 'Back')}
            </button>
            {!blocked && (
              <button
                onClick={handleToggle}
                disabled={togglingTool}
                className={clsx(
                  'rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50',
                  tool.enabled !== false && tool.status !== 'disabled'
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                )}
              >
                {togglingTool
                  ? '...'
                  : tool.enabled !== false && tool.status !== 'disabled'
                    ? t('superAdmin.aiTools.actions.disable', { defaultValue: 'Disable Tool' })
                    : t('superAdmin.aiTools.actions.enable', { defaultValue: 'Enable Tool' })
                }
              </button>
            )}
          </div>
        }
      />

      {/* Blocked Warning */}
      {blocked && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-black bg-black/5 px-4 py-3 text-sm font-semibold text-black">
          <Skull className="h-5 w-5" />
          {t('superAdmin.aiTools.detail.blockedWarning', { defaultValue: 'This is a WRITE tool and is permanently blocked for safety.' })}
        </div>
      )}

      {/* Unavailable Reason */}
      {tool.status === 'unavailable' && tool.unavailableReason && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('superAdmin.aiTools.detail.unavailableReason', {
            reason: tool.unavailableReason,
            defaultValue: `This tool is unavailable because: ${tool.unavailableReason}`,
          })}
        </div>
      )}

      {/* Description & Usage */}
      {tool.description && (
        <SuperAdminPanel>
          <div className="border-b border-[var(--sa-border)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--sa-text)]">
              {t('superAdmin.aiTools.detail.about', { defaultValue: 'About This Tool' })}
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                {t('superAdmin.aiTools.detail.description', { defaultValue: 'Description' })}
              </dt>
              <dd className="mt-1 text-sm text-[var(--sa-text)]">{tool.description}</dd>
            </div>
            {tool.whenToUse && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                  {t('superAdmin.aiTools.detail.whenToUse', { defaultValue: 'When to Use' })}
                </dt>
                <dd className="mt-1 text-sm text-[var(--sa-text)]">{tool.whenToUse}</dd>
              </div>
            )}
            {tool.examples && tool.examples.length > 0 && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                  {t('superAdmin.aiTools.detail.examples', { defaultValue: 'Example Prompts' })}
                </dt>
                <dd className="mt-1">
                  <ul className="list-disc pl-5 space-y-1">
                    {tool.examples.map((ex, i) => (
                      <li key={i} className="text-sm text-slate-700 font-mono">{ex}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {tool.safetyNotes && tool.safetyNotes.length > 0 && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                  {t('superAdmin.aiTools.detail.safetyNotes', { defaultValue: 'Safety Notes' })}
                </dt>
                <dd className="mt-1">
                  <ul className="list-disc pl-5 space-y-1">
                    {tool.safetyNotes.map((note, i) => (
                      <li key={i} className="text-sm text-slate-700">{note}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </div>
        </SuperAdminPanel>
      )}

      {/* Tool Properties */}
      <SuperAdminPanel>
        <div className="border-b border-[var(--sa-border)] px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--sa-text)]">
            {t('superAdmin.aiTools.detail.properties', { defaultValue: 'Properties' })}
          </h2>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{t('superAdmin.aiTools.detail.readOnly', { defaultValue: 'Read-only' })}</span>
        </div>
        <div className="p-5">
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                {t('superAdmin.aiTools.columns.namespace', { defaultValue: 'Namespace' })}
              </dt>
              <dd className="mt-1 font-mono text-sm text-[var(--sa-text)]">{tool.namespace}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                {t('superAdmin.aiTools.columns.module', { defaultValue: 'Module' })}
              </dt>
              <dd className="mt-1 text-sm text-[var(--sa-text)]">{tool.module}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                {t('superAdmin.aiTools.columns.category', { defaultValue: 'Category' })}
              </dt>
              <dd className="mt-1 text-sm text-[var(--sa-text)]">{tool.category}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                {t('superAdmin.aiTools.columns.mode', { defaultValue: 'Mode' })}
              </dt>
              <dd className="mt-1">
                {tool.mode === 'write' ? (
                  <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                    <Skull className="h-3 w-3" />
                    {t('superAdmin.aiTools.modes.write', { defaultValue: 'BLOCKED' })}
                  </span>
                ) : (
                  <SuperAdminBadge tone={modeTone(tool.mode)}>
                    {t(`superAdmin.aiTools.modes.${tool.mode}`, { defaultValue: tool.mode })}
                  </SuperAdminBadge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                {t('superAdmin.aiTools.columns.status', { defaultValue: 'Status' })}
              </dt>
              <dd className="mt-1">
                <SuperAdminBadge tone={statusTone(tool.status)}>
                  {t(`superAdmin.aiTools.statuses.${tool.status}`, { defaultValue: tool.status })}
                </SuperAdminBadge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                {t('superAdmin.aiTools.columns.riskLevel', { defaultValue: 'Risk Level' })}
              </dt>
              <dd className="mt-1">
                <SuperAdminBadge tone={riskTone(tool.riskLevel)}>
                  {t(`superAdmin.aiTools.riskLevels.${tool.riskLevel}`, { defaultValue: tool.riskLevel })}
                </SuperAdminBadge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                {t('superAdmin.aiTools.columns.dataSensitivity', { defaultValue: 'Sensitivity' })}
              </dt>
              <dd className="mt-1">
                <SuperAdminBadge tone={sensitivityTone(tool.dataSensitivity)}>
                  {t(`superAdmin.aiTools.sensitivity.${tool.dataSensitivity}`, { defaultValue: tool.dataSensitivity })}
                </SuperAdminBadge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                Enabled
              </dt>
              <dd className="mt-1">
                <SuperAdminBadge tone={tool.enabled !== false ? 'green' : 'slate'}>
                  {tool.enabled !== false ? 'Yes' : 'No'}
                </SuperAdminBadge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">
                {t('superAdmin.aiTools.columns.implemented', { defaultValue: 'Implementation' })}
              </dt>
              <dd className="mt-1">
                {tool.implemented ? (
                  <SuperAdminBadge tone="green">
                    {t('superAdmin.aiTools.implementationStatus.implemented', { defaultValue: 'Implemented' })}
                  </SuperAdminBadge>
                ) : (
                  <SuperAdminBadge tone="slate">
                    {t('superAdmin.aiTools.implementationStatus.planned', { defaultValue: 'Planned' })}
                  </SuperAdminBadge>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </SuperAdminPanel>

      {/* Required Permissions */}
      {(tool.requiredPermissions && tool.requiredPermissions.length > 0) && (
        <SuperAdminPanel>
          <div className="border-b border-[var(--sa-border)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--sa-text)]">
              {t('superAdmin.aiTools.detail.permissions', { defaultValue: 'Required Permissions' })}
            </h2>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {tool.requiredPermissions.map((perm) => (
                <span key={perm} className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{perm}</span>
              ))}
            </div>
          </div>
        </SuperAdminPanel>
      )}

      {/* Required Modules */}
      {(tool.requiredModules && tool.requiredModules.length > 0) && (
        <SuperAdminPanel>
          <div className="border-b border-[var(--sa-border)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--sa-text)]">
              {t('superAdmin.aiTools.detail.requiredModules', { defaultValue: 'Required Modules' })}
            </h2>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {tool.requiredModules.map((mod) => (
                <span key={mod} className="rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{mod}</span>
              ))}
            </div>
          </div>
        </SuperAdminPanel>
      )}

      {/* Chat Keywords */}
      {tool.implemented && (
        <SuperAdminPanel>
          <div className="border-b border-[var(--sa-border)] px-5 py-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--sa-text)]">
              {t('superAdmin.aiTools.detail.chatKeywords', { defaultValue: 'Chat Keywords' })}
            </h2>
            {!editingKeywords && (
              <button
                onClick={handleStartEditKeywords}
                className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
              >
                {t('superAdmin.aiTools.actions.edit', { defaultValue: 'Edit' })}
              </button>
            )}
          </div>
          <div className="p-5">
            {editingKeywords ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  {t('superAdmin.aiTools.keywords.help', { defaultValue: 'One keyword per line. Supports English, Arabic, and Turkish. Keywords are matched case-insensitively.' })}
                </p>
                <textarea
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  rows={8}
                  className="w-full rounded-md border border-slate-300 p-3 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={t('superAdmin.aiTools.keywords.placeholder', { defaultValue: 'Enter one keyword per line...' })}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveKeywords}
                    disabled={savingKeywords}
                    className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {savingKeywords ? '...' : t('superAdmin.aiTools.actions.save', { defaultValue: 'Save' })}
                  </button>
                  <button
                    onClick={() => setEditingKeywords(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t('superAdmin.aiTools.actions.cancel', { defaultValue: 'Cancel' })}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap gap-2">
                  {(tool.chatKeywords || []).map((kw, i) => (
                    <span key={i} className="rounded bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-700">{kw}</span>
                  ))}
                </div>
                {(tool.chatKeywords || []).length === 0 && (
                  <p className="text-sm text-slate-400">{t('superAdmin.aiTools.keywords.none', { defaultValue: 'No keywords configured. Click Edit to add.' })}</p>
                )}
              </div>
            )}
          </div>
        </SuperAdminPanel>
      )}

      {/* Input Schema */}
      <SuperAdminPanel>
          <div className="border-b border-[var(--sa-border)] px-5 py-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--sa-text)]">
              {t('superAdmin.aiTools.detail.inputSchema', { defaultValue: 'Input Schema' })}
            </h2>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{t('superAdmin.aiTools.detail.readOnly', { defaultValue: 'Read-only' })}</span>
          </div>
          <div className="p-5">
            <JsonBlock data={tool.inputSchema} />
          </div>
        </SuperAdminPanel>

        <SuperAdminPanel>
          <div className="border-b border-[var(--sa-border)] px-5 py-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--sa-text)]">
              {t('superAdmin.aiTools.detail.outputSchema', { defaultValue: 'Output Schema' })}
            </h2>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{t('superAdmin.aiTools.detail.readOnly', { defaultValue: 'Read-only' })}</span>
          </div>
          <div className="p-5">
            <JsonBlock data={tool.outputSchema} />
          </div>
        </SuperAdminPanel>

      {/* Enablement Policy */}
      <SuperAdminPanel>
        <div className="border-b border-[var(--sa-border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--sa-text)]">
            {t('superAdmin.aiTools.detail.enablementPolicy', { defaultValue: 'Enablement Policy' })}
          </h2>
        </div>
        <div className="p-5">
          {enablementPolicy ? (
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">{t(`Enabled`)}</dt>
                <dd className="mt-1">
                  <SuperAdminBadge tone={enablementPolicy.enabled ? 'green' : 'slate'}>
                    {enablementPolicy.enabled ? 'Yes' : 'No'}
                  </SuperAdminBadge>
                </dd>
              </div>
              {enablementPolicy.maxUsagePerDay && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">{t(`Max Usage/Day`)}</dt>
                  <dd className="mt-1 text-sm text-[var(--sa-text)]">{enablementPolicy.maxUsagePerDay}</dd>
                </div>
              )}
              {enablementPolicy.allowedRoles && enablementPolicy.allowedRoles.length > 0 && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">{t(`Allowed Roles`)}</dt>
                  <dd className="mt-1">
                    <div className="flex flex-wrap gap-1">
                      {enablementPolicy.allowedRoles.map((role) => (
                        <span key={role} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{role}</span>
                      ))}
                    </div>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-[var(--sa-muted)]">{t(`No enablement policy configured for this tool.`)}</p>
          )}
        </div>
      </SuperAdminPanel>

      {/* Model Policies */}
      {modelPolicies.length > 0 && (
        <SuperAdminPanel>
          <div className="border-b border-[var(--sa-border)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--sa-text)]">
              {t('superAdmin.aiTools.detail.modelPolicy', { defaultValue: 'Model Policy' })}
            </h2>
          </div>
          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                  <tr>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wide text-[var(--sa-muted)]'}>{t(`Model`)}</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wide text-[var(--sa-muted)]'}>{t(`Allowed`)}</th>
                  </tr>
                </thead>
                <tbody>
                  {modelPolicies.map((policy) => (
                    <tr key={policy.id} className="border-b border-slate-50">
                      <td className={tableCellClass}>{policy.modelName || policy.modelId}</td>
                      <td className={tableCellClass}>
                        <SuperAdminBadge tone={policy.allowed ? 'green' : 'red'}>
                          {policy.allowed ? 'Allowed' : 'Blocked'}
                        </SuperAdminBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SuperAdminPanel>
      )}
    </SuperAdminPage>
  );
};