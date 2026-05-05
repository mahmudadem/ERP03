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
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [companies, modulesRes, entitlementsRes] = await Promise.all([
        superAdminApi.getAllCompanies(),
        superAdminApi.getModules(),
        superAdminApi.getCompanyEntitlements(companyId),
      ]);

      const found = companies.find((c: SuperAdminCompany) => c.id === companyId);
      setCompany(found || null);
      setAllModules(modulesRes.filter((m: Module) => !PLATFORM_IDS.includes((m.code || m.id).toLowerCase())));
      setEntitledModules(entitlementsRes.modules || []);
      setEntitlements(entitlementsRes.entitlements || []);
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
    if (!window.confirm(t('superAdmin.companyEntitlements.confirmRevoke', { defaultValue: `Revoke access to module '{{moduleKey}}'? This may affect company users.`, moduleKey }))) return;
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
    </SuperAdminPage>
  );
}