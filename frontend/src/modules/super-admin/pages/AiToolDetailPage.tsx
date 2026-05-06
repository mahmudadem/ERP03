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

const JsonBlock: React.FC<{ data: any }> = ({ data }) => {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
};

export const AiToolDetailPage: React.FC = () => {
  const { toolName } = useParams<{ toolName: string }>();
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [tool, setTool] = useState<AiTool | null>(null);
  const [enablementPolicy, setEnablementPolicy] = useState<AiToolEnablementPolicy | null>(null);
  const [modelPolicies, setModelPolicies] = useState<AiModelToolPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingTool, setTogglingTool] = useState(false);

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
        <div className="py-12 text-center text-slate-500">Tool not found.</div>
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
              onClick={() => navigate('/super-admin/ai-tools')}
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

      {/* Tool Properties */}
      <SuperAdminPanel>
        <div className="border-b border-[var(--sa-border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--sa-text)]">
            {t('superAdmin.aiTools.detail.description', { defaultValue: 'Properties' })}
          </h2>
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

      {/* Input/Output Schemas */}
      <SuperAdminPanel>
        <div className="border-b border-[var(--sa-border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--sa-text)]">
            {t('superAdmin.aiTools.detail.inputSchema', { defaultValue: 'Input Schema' })}
          </h2>
        </div>
        <div className="p-5">
          <JsonBlock data={tool.inputSchema} />
        </div>
      </SuperAdminPanel>

      <SuperAdminPanel>
        <div className="border-b border-[var(--sa-border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--sa-text)]">
            {t('superAdmin.aiTools.detail.outputSchema', { defaultValue: 'Output Schema' })}
          </h2>
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
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">Enabled</dt>
                <dd className="mt-1">
                  <SuperAdminBadge tone={enablementPolicy.enabled ? 'green' : 'slate'}>
                    {enablementPolicy.enabled ? 'Yes' : 'No'}
                  </SuperAdminBadge>
                </dd>
              </div>
              {enablementPolicy.maxUsagePerDay && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">Max Usage/Day</dt>
                  <dd className="mt-1 text-sm text-[var(--sa-text)]">{enablementPolicy.maxUsagePerDay}</dd>
                </div>
              )}
              {enablementPolicy.allowedRoles && enablementPolicy.allowedRoles.length > 0 && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">Allowed Roles</dt>
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
            <p className="text-sm text-[var(--sa-muted)]">No enablement policy configured for this tool.</p>
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
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wide text-[var(--sa-muted)]'}>Model</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wide text-[var(--sa-muted)]'}>Allowed</th>
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