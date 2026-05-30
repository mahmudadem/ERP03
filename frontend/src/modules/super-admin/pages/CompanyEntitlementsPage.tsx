import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { superAdminApi, Module, SuperAdminCompany } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
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
import { Button } from '../../../components/ui/Button';
import { useConfirm } from '../../../hooks/useConfirm';

/** Platform/boot modules that should not appear as grantable */
const PLATFORM_IDS = ['companyadmin', 'core', 'auth', 'rbac', 'settings', 'system'];

interface EntitlementDetail {
  id: string;
  sourceType: string;
  sourceId: string;
  isActive: boolean;
  items: { id: string; itemType: string; itemKey: string }[];
}

export default function CompanyEntitlementsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  const [company, setCompany] = useState<SuperAdminCompany | null>(null);
  const [entitledModules, setEntitledModules] = useState<string[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementDetail[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const [granting, setGranting] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [aiReportMode, setAiReportMode] = useState<'standard' | 'authoritative'>('standard');
  const [savingReportMode, setSavingReportMode] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [totalPurchased, setTotalPurchased] = useState(0);
  const [totalConsumed, setTotalConsumed] = useState(0);
  const [creditInput, setCreditInput] = useState('');
  const [grantingCredits, setGrantingCredits] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [companies, modulesRes, entitlementsRes, reportModeRes, creditsRes] = await Promise.all([
        superAdminApi.getAllCompanies(),
        superAdminApi.getModules(),
        superAdminApi.getCompanyEntitlements(companyId),
        superAdminApi.getCompanyAiReportMode(companyId),
        superAdminApi.getCompanyAiCredits(companyId),
      ]);

      const found = companies.find((c: SuperAdminCompany) => c.id === companyId);
      setCompany(found || null);
      setAllModules(modulesRes.filter((m: Module) => !PLATFORM_IDS.includes((m.code || m.id).toLowerCase())));
      setEntitledModules(entitlementsRes.modules || []);
      setEntitlements(entitlementsRes.entitlements || []);
      setAiReportMode(reportModeRes.aiReportMode || 'standard');
      setCreditBalance(creditsRes.balance || 0);
      setTotalPurchased(creditsRes.totalPurchased || 0);
      setTotalConsumed(creditsRes.totalConsumed || 0);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGrant = async (moduleKey: string) => {
    if (!companyId) return;
    setGranting(moduleKey);
    try {
      await superAdminApi.grantModuleToCompany(companyId, moduleKey);
      errorHandler.showSuccess(t('superAdmin.companyEntitlements.messages.granted', { defaultValue: `Module '{{moduleKey}}' granted`, moduleKey }));
      setShowGrantModal(false);
      await loadData();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setGranting(null);
    }
  };

  const handleRevoke = async (moduleKey: string) => {
    if (!companyId) return;
    const ok = await confirm({
      title: t('superAdmin.companyEntitlements.confirmRevokeTitle', { defaultValue: 'Revoke module access?' }),
      message: t('superAdmin.companyEntitlements.confirmRevoke', { defaultValue: `Revoke access to module '{{moduleKey}}'? This may affect company users.`, moduleKey }),
      confirmLabel: t('common.revoke', { defaultValue: 'Revoke' }),
      tone: 'danger',
    });
    if (!ok) return;
    setRevoking(moduleKey);
    try {
      await superAdminApi.revokeModuleFromCompany(companyId, moduleKey);
      errorHandler.showSuccess(t('superAdmin.companyEntitlements.messages.revoked', { defaultValue: `Module '{{moduleKey}}' revoked`, moduleKey }));
      await loadData();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setRevoking(null);
    }
  };

  // Modules the company does NOT yet have
  const availableModules = allModules.filter(
    (m) => !entitledModules.includes((m.code || m.id).toLowerCase())
  );
  const filteredAvailable = availableModules.filter((m) => {
    const key = (m.code || m.id).toLowerCase();
    const name = m.name.toLowerCase();
    const q = searchQuery.toLowerCase();
    return key.includes(q) || name.includes(q);
  });

  // Enriched entitled modules (with module name and entitlement source)
  const enrichedModules = entitledModules.map((key) => {
    const mod = allModules.find((m) => (m.code || m.id).toLowerCase() === key);
    const entitlement = entitlements.find((e) =>
      e.items.some((item) => item.itemKey === key)
    );
    return {
      key,
      name: mod?.name || key,
      sourceType: entitlement?.sourceType || 'unknown',
    };
  });

  const handleReportModeChange = async (mode: 'standard' | 'authoritative') => {
    if (!companyId || mode === aiReportMode) return;
    setSavingReportMode(true);
    try {
      await superAdminApi.setCompanyAiReportMode(companyId, mode);
      setAiReportMode(mode);
      errorHandler.showSuccess(t('superAdmin.companyEntitlements.messages.reportModeUpdated', { defaultValue: 'AI report mode updated' }));
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSavingReportMode(false);
    }
  };

  const handleGrantCredits = async () => {
    if (!companyId || !creditInput || isNaN(Number(creditInput))) return;
    setGrantingCredits(true);
    try {
      const amount = Number(creditInput);
      await superAdminApi.grantAiCredits({ companyId, amount });
      errorHandler.showSuccess(t('superAdmin.companyEntitlements.messages.creditsGranted', { defaultValue: `{{amount}} credits granted`, amount }));
      setCreditInput('');
      await loadData();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setGrantingCredits(false);
    }
  };

  const sourceTypeLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'bundle': return t('superAdmin.companyEntitlements.sourceTypes.bundle', { defaultValue: 'Bundle' });
      case 'superadmin_override': return t('superAdmin.companyEntitlements.sourceTypes.superadmin', { defaultValue: 'SuperAdmin' });
      case 'trial': return t('superAdmin.companyEntitlements.sourceTypes.trial', { defaultValue: 'Trial' });
      case 'promotion': return t('superAdmin.companyEntitlements.sourceTypes.promotion', { defaultValue: 'Promotion' });
      default: return sourceType;
    }
  };

  const sourceTypeBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'bundle': return 'blue';
      case 'superadmin_override': return 'green';
      case 'trial': return 'amber';
      case 'promotion': return 'slate';
      default: return 'slate';
    }
  };

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.companyEntitlements.title', { defaultValue: 'Company Modules' })}
        description={
          company
            ? t('superAdmin.companyEntitlements.description', { defaultValue: `Manage module access for {{name}}`, name: company.name })
            : t('superAdmin.companyEntitlements.loading', { defaultValue: 'Loading company...' })
        }
        meta={company?.name || companyId}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/companies')}>
              {t('superAdmin.companyEntitlements.backToCompanies', { defaultValue: '← Back to Companies' })}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowGrantModal(true)} disabled={loading}>
              {t('superAdmin.companyEntitlements.grantModule', { defaultValue: '+ Grant Module' })}
            </Button>
          </div>
        }
      />

      {loading && enrichedModules.length === 0 ? (
        <SuperAdminLoading label={t('superAdmin.companyEntitlements.loading', { defaultValue: 'Loading modules...' })} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* AI Credits */}
          <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-surface)]">
            <div className="border-b border-[var(--sa-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--sa-text)]">
                {t('superAdmin.companyEntitlements.aiCredits.title', { defaultValue: 'AI Credits' })}
              </h2>
            </div>
            <div className="px-4 py-4">
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    {t('superAdmin.companyEntitlements.aiCredits.balance', { defaultValue: 'Current Balance' })}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{creditBalance}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    {t('superAdmin.companyEntitlements.aiCredits.totalPurchased', { defaultValue: 'Total Purchased' })}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{totalPurchased}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    {t('superAdmin.companyEntitlements.aiCredits.totalConsumed', { defaultValue: 'Total Consumed' })}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{totalConsumed}</p>
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('superAdmin.companyEntitlements.aiCredits.grantAmount', { defaultValue: 'Grant Amount' })}
                  </label>
                  <input
                    type="number"
                    value={creditInput}
                    onChange={(e) => setCreditInput(e.target.value)}
                    placeholder={t('superAdmin.companyEntitlements.aiCredits.enterAmount', { defaultValue: 'Enter amount' })}
                    disabled={grantingCredits}
                    className={clsx(
                      'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
                      'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
                      grantingCredits && 'opacity-50 cursor-wait',
                    )}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGrantCredits}
                  disabled={grantingCredits || !creditInput || isNaN(Number(creditInput))}
                >
                  {grantingCredits ? t('superAdmin.companyEntitlements.aiCredits.granting', { defaultValue: 'Granting...' }) : t('superAdmin.companyEntitlements.aiCredits.grant', { defaultValue: 'Grant Credits' })}
                </Button>
              </div>
            </div>
          </div>

          {/* AI Report Mode */}
          <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-surface)]">
            <div className="border-b border-[var(--sa-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--sa-text)]">
                {t('superAdmin.companyEntitlements.aiReportMode.title', { defaultValue: 'AI Report Mode' })}
              </h2>
            </div>
            <div className="px-4 py-4">
              <p className="mb-3 text-xs text-slate-500">
                {t('superAdmin.companyEntitlements.aiReportMode.description', {
                  defaultValue: 'Controls which AI report tools are exposed to this company. "Standard" uses the original summary tools. "Authoritative" uses full ERP report tools with complete context.',
                })}
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={aiReportMode}
                  onChange={(e) => handleReportModeChange(e.target.value as 'standard' | 'authoritative')}
                  disabled={savingReportMode}
                  className={clsx(
                    'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900',
                    'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
                    savingReportMode && 'opacity-50 cursor-wait',
                  )}
                >
                  <option value="standard">
                    {t('superAdmin.companyEntitlements.aiReportMode.standard', { defaultValue: 'Standard (summary tools)' })}
                  </option>
                  <option value="authoritative">
                    {t('superAdmin.companyEntitlements.aiReportMode.authoritative', { defaultValue: 'Authoritative (full report tools)' })}
                  </option>
                </select>
                {savingReportMode && (
                  <span className="text-xs text-slate-400">
                    {t('superAdmin.companyEntitlements.aiReportMode.saving', { defaultValue: 'Saving...' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Granted Modules Table */}
          <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-surface)]">
            <div className="border-b border-[var(--sa-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--sa-text)]">
                {t('superAdmin.companyEntitlements.grantedModules', { defaultValue: 'Granted Modules' })} ({entitledModules.length})
              </h2>
            </div>
            {enrichedModules.length === 0 ? (
              <div className="px-4 py-8">
                <SuperAdminEmptyState
                  title={t('superAdmin.companyEntitlements.noModules', { defaultValue: 'No modules granted yet' })}
                />
              </div>
            ) : (
              <SuperAdminTable>
                <thead className="bg-slate-50">
                  <tr>
                    <th className={tableHeadCellClass}>{t('superAdmin.companyEntitlements.columns.module', { defaultValue: 'Module' })}</th>
                    <th className={tableHeadCellClass}>{t('superAdmin.companyEntitlements.columns.key', { defaultValue: 'Key' })}</th>
                    <th className={tableHeadCellClass}>{t('superAdmin.companyEntitlements.columns.source', { defaultValue: 'Source' })}</th>
                    <th className={tableHeadCellClass}>{t('superAdmin.companyEntitlements.columns.actions', { defaultValue: 'Actions' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {enrichedModules.map((mod) => (
                    <tr key={mod.key} className={tableRowClass}>
                      <td className={`${tableCellClass} font-medium text-slate-950`}>{mod.name}</td>
                      <td className={`${tableCellClass} font-mono text-xs text-slate-600`}>{mod.key}</td>
                      <td className={tableCellClass}>
                        <SuperAdminBadge tone={sourceTypeBadge(mod.sourceType) as any}>
                          {sourceTypeLabel(mod.sourceType)}
                        </SuperAdminBadge>
                      </td>
                      <td className={tableCellClass}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRevoke(mod.key)}
                          disabled={revoking === mod.key}
                        >
                          {revoking === mod.key
                            ? t('superAdmin.companyEntitlements.revoking', { defaultValue: 'Revoking...' })
                            : t('superAdmin.companyEntitlements.revoke', { defaultValue: 'Revoke' })}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </SuperAdminTable>
            )}
          </div>
        </div>
      )}

      {/* Grant Module Modal */}
      {showGrantModal && (
        <SuperAdminModal
          onClose={() => setShowGrantModal(false)}
          title={t('superAdmin.companyEntitlements.grantModal.title', { defaultValue: 'Grant Module Access' })}
          size="lg"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              {t('superAdmin.companyEntitlements.grantModal.description', { defaultValue: 'Select a module to grant access to this company. The module will be added as a SuperAdmin override.' })}
            </p>

            <SuperAdminSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('superAdmin.companyEntitlements.grantModal.searchPlaceholder', { defaultValue: 'Search modules...' })}
            />

            {filteredAvailable.length === 0 ? (
              <SuperAdminEmptyState
                title={t('superAdmin.companyEntitlements.grantModal.noModules', { defaultValue: 'No modules available to grant' })}
              />
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                <SuperAdminTable>
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={tableHeadCellClass}>{t('superAdmin.companyEntitlements.grantModal.moduleName', { defaultValue: 'Module' })}</th>
                      <th className={tableHeadCellClass}>{t('superAdmin.companyEntitlements.grantModal.moduleKey', { defaultValue: 'Key' })}</th>
                      <th className={tableHeadCellClass}>{t('superAdmin.companyEntitlements.grantModal.status', { defaultValue: 'Status' })}</th>
                      <th className={tableHeadCellClass}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredAvailable.map((mod) => {
                      const key = (mod.code || mod.id).toLowerCase();
                      return (
                        <tr key={key} className={tableRowClass}>
                          <td className={`${tableCellClass} font-medium text-slate-950`}>{mod.name}</td>
                          <td className={`${tableCellClass} font-mono text-xs text-slate-600`}>{key}</td>
                          <td className={tableCellClass}>
                            <SuperAdminBadge tone={mod.lifecycleStatus === 'ready' ? 'green' : mod.lifecycleStatus === 'deprecated' ? 'amber' : 'slate'}>
                              {mod.lifecycleStatus}
                            </SuperAdminBadge>
                          </td>
                          <td className={tableCellClass}>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleGrant(key)}
                              disabled={granting !== null}
                            >
                              {granting === key
                                ? t('superAdmin.companyEntitlements.granting', { defaultValue: 'Granting...' })
                                : t('superAdmin.companyEntitlements.grant', { defaultValue: 'Grant' })}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </SuperAdminTable>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowGrantModal(false)}>
                {t('superAdmin.companyEntitlements.grantModal.close', { defaultValue: 'Close' })}
              </Button>
            </div>
          </div>
        </SuperAdminModal>
      )}
      {confirmDialog}
    </SuperAdminPage>
  );
}
