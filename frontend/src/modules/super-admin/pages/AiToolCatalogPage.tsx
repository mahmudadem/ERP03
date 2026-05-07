import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi, AiTool } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { RefreshCw, Skull } from 'lucide-react';
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
  tableSortHeaderClass,
  SortIcon,
} from '../components/SuperAdminPage';
import { useSuperAdminTable } from '../hooks/useSuperAdminTable';

const unwrap = <T,>(response: any): T => (response?.data ?? response) as T;

const statusTone = (status: string): 'slate' | 'green' | 'amber' | 'red' | 'blue' => {
  switch (status) {
    case 'active': return 'green';
    case 'disabled': return 'slate';
    case 'unavailable': return 'amber';
    case 'deprecated': return 'red';
    default: return 'slate';
  }
};

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

export const AiToolCatalogPage: React.FC = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [tools, setTools] = useState<AiTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [togglingTool, setTogglingTool] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterImplemented, setFilterImplemented] = useState('');

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      const filters: Record<string, string> = {};
      if (filterModule) filters.module = filterModule;
      if (filterCategory) filters.category = filterCategory;
      if (filterStatus) filters.status = filterStatus;
      if (filterMode) filters.mode = filterMode;
      if (filterImplemented) filters.implemented = filterImplemented;
      const res = await superAdminApi.getAiTools(filters);
      setTools(unwrap<AiTool[]>(res));
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await superAdminApi.syncAiToolCatalog();
      const result = unwrap<any>(res);
      const count = result?.addedCount ?? result?.newToolsAdded ?? 0;
      errorHandler.showSuccess(t('superAdmin.aiTools.sync.success', { count, defaultValue: `Catalog synced successfully. ${count} new tools added.` }));
      await loadTools();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (tool: AiTool) => {
    const toolName = tool.name;
    try {
      setTogglingTool(toolName);
      if (tool.enabled !== false && tool.status !== 'disabled') {
        await superAdminApi.disableAiTool(toolName);
        errorHandler.showSuccess(t('superAdmin.aiTools.actions.disable', { defaultValue: 'Tool disabled' }));
      } else {
        await superAdminApi.enableAiTool(toolName);
        errorHandler.showSuccess(t('superAdmin.aiTools.actions.enable', { defaultValue: 'Tool enabled' }));
      }
      await loadTools();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setTogglingTool(null);
    }
  };

  const uniqueModules = useMemo(() => [...new Set(tools.map((t) => t.module).filter(Boolean))], [tools]);
  const uniqueCategories = useMemo(() => [...new Set(tools.map((t) => t.category).filter(Boolean))], [tools]);

  const filteredTools = useMemo(() => {
    let result = [...tools];
    if (filterModule) result = result.filter((t) => t.module === filterModule);
    if (filterCategory) result = result.filter((t) => t.category === filterCategory);
    if (filterStatus) result = result.filter((t) => t.status === filterStatus);
    if (filterMode) result = result.filter((t) => t.mode === filterMode);
    if (filterImplemented === 'true') result = result.filter((t) => t.implemented === true);
    if (filterImplemented === 'false') result = result.filter((t) => t.implemented !== true);
    return result;
  }, [tools, filterModule, filterCategory, filterStatus, filterMode, filterImplemented]);

  const {
    data: searchedTools,
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
  } = useSuperAdminTable({
    data: filteredTools,
    searchFields: ['name', 'namespace', 'module', 'category'],
    initialSort: { field: 'name', direction: 'asc' },
  });

  const stats = useMemo(() => ({
    active: tools.filter((t) => t.status === 'active').length,
    disabled: tools.filter((t) => t.status === 'disabled').length,
    unavailable: tools.filter((t) => t.status === 'unavailable').length,
    blocked: tools.filter((t) => t.mode === 'write').length,
    implemented: tools.filter((t) => t.implemented === true).length,
    planned: tools.filter((t) => t.implemented !== true).length,
  }), [tools]);

  const isToolBlocked = (tool: AiTool) => tool.mode === 'write' && (tool as any).riskLevel === 'blocked';

  if (loading) {
    return (
      <SuperAdminPage>
        <SuperAdminLoading label={t('superAdmin.aiTools.title', { defaultValue: 'Loading AI Tools' })} />
      </SuperAdminPage>
    );
  }

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.aiTools.title', { defaultValue: 'AI Tool Catalog' })}
        description={t('superAdmin.aiTools.description', { defaultValue: 'Manage AI assistant tools, enablement policies, and model configurations' })}
        meta={`Active ${stats.active} | Disabled ${stats.disabled} | Unavailable ${stats.unavailable} | Blocked ${stats.blocked} | Implemented ${stats.implemented} | Planned ${stats.planned}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadTools}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('superAdmin.modules.loading', { defaultValue: 'Refresh' })}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={clsx('h-4 w-4', syncing && 'animate-spin')} />
              {syncing
                ? t('superAdmin.aiTools.sync.success', { defaultValue: 'Syncing...' }).replace(/.*\d+.*tools.*/, 'Syncing...')
                : t('superAdmin.aiTools.actions.sync', { defaultValue: 'Sync Catalog' })
              }
            </button>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          <SuperAdminSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('superAdmin.aiTools.filters.search', { defaultValue: 'Search tools...' })}
          />
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{t('superAdmin.aiTools.filters.module', { defaultValue: 'All Modules' })}</option>
            {uniqueModules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{t('superAdmin.aiTools.filters.category', { defaultValue: 'All Categories' })}</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{t('superAdmin.aiTools.filters.status', { defaultValue: 'All Statuses' })}</option>
            <option value="active">{t('superAdmin.aiTools.statuses.active', { defaultValue: 'Active' })}</option>
            <option value="disabled">{t('superAdmin.aiTools.statuses.disabled', { defaultValue: 'Disabled' })}</option>
            <option value="unavailable">{t('superAdmin.aiTools.statuses.unavailable', { defaultValue: 'Unavailable' })}</option>
            <option value="deprecated">{t('superAdmin.aiTools.statuses.deprecated', { defaultValue: 'Deprecated' })}</option>
          </select>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{t('superAdmin.aiTools.filters.mode', { defaultValue: 'All Modes' })}</option>
            <option value="read-only">{t('superAdmin.aiTools.modes.read-only', { defaultValue: 'Read Only' })}</option>
            <option value="proposal">{t('superAdmin.aiTools.modes.proposal', { defaultValue: 'Proposal' })}</option>
            <option value="write">{t('superAdmin.aiTools.modes.write', { defaultValue: 'Write (BLOCKED)' })}</option>
          </select>
          <select
            value={filterImplemented}
            onChange={(e) => setFilterImplemented(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">{t('superAdmin.aiTools.filters.implementation', { defaultValue: 'All Implementations' })}</option>
            <option value="true">{t('superAdmin.aiTools.implementationStatus.implemented', { defaultValue: 'Implemented' })}</option>
            <option value="false">{t('superAdmin.aiTools.implementationStatus.planned', { defaultValue: 'Planned' })}</option>
          </select>
        </div>

        <SuperAdminTable>
          <thead className="bg-slate-50">
            <tr>
              <th
                className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                onClick={() => handleSort('name')}
              >
                {t('superAdmin.aiTools.columns.name', { defaultValue: 'Name' })}
                <SortIcon direction={sortConfig.field === 'name' ? sortConfig.direction : null} />
              </th>
              <th
                className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                onClick={() => handleSort('namespace')}
              >
                {t('superAdmin.aiTools.columns.namespace', { defaultValue: 'Namespace' })}
                <SortIcon direction={sortConfig.field === 'namespace' ? sortConfig.direction : null} />
              </th>
              <th
                className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                onClick={() => handleSort('module')}
              >
                {t('superAdmin.aiTools.columns.module', { defaultValue: 'Module' })}
                <SortIcon direction={sortConfig.field === 'module' ? sortConfig.direction : null} />
              </th>
              <th
                className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                onClick={() => handleSort('category')}
              >
                {t('superAdmin.aiTools.columns.category', { defaultValue: 'Category' })}
                <SortIcon direction={sortConfig.field === 'category' ? sortConfig.direction : null} />
              </th>
              <th
                className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                onClick={() => handleSort('mode')}
              >
                {t('superAdmin.aiTools.columns.mode', { defaultValue: 'Mode' })}
                <SortIcon direction={sortConfig.field === 'mode' ? sortConfig.direction : null} />
              </th>
              <th
                className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                onClick={() => handleSort('status')}
              >
                {t('superAdmin.aiTools.columns.status', { defaultValue: 'Status' })}
                <SortIcon direction={sortConfig.field === 'status' ? sortConfig.direction : null} />
              </th>
              <th
                className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                onClick={() => handleSort('riskLevel')}
              >
                {t('superAdmin.aiTools.columns.riskLevel', { defaultValue: 'Risk Level' })}
                <SortIcon direction={sortConfig.field === 'riskLevel' ? sortConfig.direction : null} />
              </th>
              <th
                className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                onClick={() => handleSort('dataSensitivity')}
              >
                {t('superAdmin.aiTools.columns.dataSensitivity', { defaultValue: 'Sensitivity' })}
                <SortIcon direction={sortConfig.field === 'dataSensitivity' ? sortConfig.direction : null} />
              </th>
              <th
                className={clsx(tableHeadCellClass, tableSortHeaderClass)}
                onClick={() => handleSort('implemented')}
              >
                {t('superAdmin.aiTools.columns.implemented', { defaultValue: 'Implementation' })}
                <SortIcon direction={sortConfig.field === 'implemented' ? sortConfig.direction : null} />
              </th>
              <th className={tableHeadCellClass}>
                {t('superAdmin.aiTools.columns.requiredModules', { defaultValue: 'Required Modules' })}
              </th>
              <th className={tableHeadCellClass}>
                {t('superAdmin.aiTools.columns.actions', { defaultValue: 'Actions' })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {searchedTools.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <SuperAdminEmptyState
                    title={searchQuery ? 'No tools found matching search' : t('superAdmin.aiTools.title', { defaultValue: 'No AI tools found' })}
                  />
                </td>
              </tr>
            ) : (
              searchedTools.map((tool) => {
                const blocked = isToolBlocked(tool);
                return (
                  <tr key={tool.name} className={tableRowClass}>
                    <td className={tableCellClass}>
                      <button
                        onClick={() => navigate(`/super-admin/ai-tools/${encodeURIComponent(tool.name)}`)}
                        className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {tool.name}
                      </button>
                      {tool.description && (
                        <div className="mt-0.5 max-w-xs truncate text-xs text-slate-500">{tool.description}</div>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      <span className="font-mono text-xs text-slate-600">{tool.namespace}</span>
                    </td>
                    <td className={tableCellClass}>
                      <span className="text-sm">{tool.module}</span>
                    </td>
                    <td className={tableCellClass}>
                      <span className="text-sm">{tool.category}</span>
                    </td>
                    <td className={tableCellClass}>
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
                    </td>
                    <td className={tableCellClass}>
                        <span title={tool.status === 'unavailable' && tool.unavailableReason ? tool.unavailableReason : undefined}>
                          <SuperAdminBadge tone={statusTone(tool.status)}>
                            {t(`superAdmin.aiTools.statuses.${tool.status}`, { defaultValue: tool.status })}
                          </SuperAdminBadge>
                        </span>
                    </td>
                    <td className={tableCellClass}>
                      <SuperAdminBadge tone={riskTone(tool.riskLevel)}>
                        {t(`superAdmin.aiTools.riskLevels.${tool.riskLevel}`, { defaultValue: tool.riskLevel })}
                      </SuperAdminBadge>
                    </td>
                    <td className={tableCellClass}>
                      <SuperAdminBadge tone={sensitivityTone(tool.dataSensitivity)}>
                        {t(`superAdmin.aiTools.sensitivity.${tool.dataSensitivity}`, { defaultValue: tool.dataSensitivity })}
                      </SuperAdminBadge>
                    </td>
                    <td className={tableCellClass}>
                      {tool.implemented ? (
                        <SuperAdminBadge tone="green">
                          {t('superAdmin.aiTools.implementationStatus.implemented', { defaultValue: 'Implemented' })}
                        </SuperAdminBadge>
                      ) : (
                        <SuperAdminBadge tone="slate">
                          {t('superAdmin.aiTools.implementationStatus.planned', { defaultValue: 'Planned' })}
                        </SuperAdminBadge>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex flex-wrap gap-1">
                        {(tool.requiredModules || []).slice(0, 2).map((m) => (
                          <span key={m} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{m}</span>
                        ))}
                        {(tool.requiredModules || []).length > 2 && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">
                            +{(tool.requiredModules || []).length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggle(tool)}
                          disabled={blocked || togglingTool === tool.name}
                          className={clsx(
                            'text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed',
                            tool.enabled !== false && tool.status !== 'disabled'
                              ? 'text-amber-700 hover:text-amber-900'
                              : 'text-emerald-700 hover:text-emerald-900'
                          )}
                        >
                          {togglingTool === tool.name
                            ? '...'
                            : tool.enabled !== false && tool.status !== 'disabled'
                              ? t('superAdmin.aiTools.actions.disable', { defaultValue: 'Disable' })
                              : t('superAdmin.aiTools.actions.enable', { defaultValue: 'Enable' })
                          }
                        </button>
                        <button
                          onClick={() => navigate(`/super-admin/ai-tools/${encodeURIComponent(tool.name)}`)}
                          className="text-sm font-medium text-slate-700 hover:text-slate-950"
                        >
                          {t('superAdmin.aiTools.actions.viewDetails', { defaultValue: 'Details' })}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </SuperAdminTable>
      </div>
    </SuperAdminPage>
  );
};