/**
 * VoucherTypesSettingsPage.tsx
 *
 * Per-module Manage Voucher Types settings page. Used by Sales, Purchases,
 * and Accounting via thin wrapper components in their respective modules.
 *
 * Shows:
 *  - Currently installed voucher TYPES (grouped from templates by
 *    canonical voucherType key) for the active module.
 *  - Voucher TYPES available in the system catalog that the company has
 *    not yet installed, with an "Install" button per type.
 *
 * Installing a type copies every form variant of that type into the
 * company catalog as a locked + inactive default (see ff2307e4).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom'; import { AlertCircle, CheckCircle2, DownloadCloud, FileCheck, Info, Layers, PackageCheck} from 'lucide-react';
import { Spinner } from '../../../../components/ui/Spinner';
import { useQueryClient } from '@tanstack/react-query';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { emitCompanyModulesRefresh } from '../../../../utils/companyModulesEvents';
import {
  CatalogTemplate,
  VoucherTypeModule,
  voucherTypeManagementApi,
} from '../../../../api/voucherTypeManagementApi';

interface VoucherTypesSettingsPageProps {
  module: VoucherTypeModule;
  /** Module label used in headings, e.g. "Sales", "Purchases", "Accounting". */
  moduleLabel: string;
  /** Path to the Forms Designer page that owns activation/cloning. */
  formsDesignerPath?: string;
}

interface TypeGroup {
  typeKey: string;
  name: string;
  isInstalled: boolean;
  forms: CatalogTemplate[];
}

const stripPersonaSuffix = (formName: string): string => {
  const stripped = formName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return stripped || formName;
};

const groupCatalog = (templates: CatalogTemplate[]): TypeGroup[] => {
  const byType = new Map<string, CatalogTemplate[]>();
  for (const t of templates) {
    const key = t.voucherType || t.code;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(t);
  }

  const groups: TypeGroup[] = [];
  byType.forEach((forms, typeKey) => {
    const baseName = forms.length === 1
      ? forms[0].name
      : stripPersonaSuffix(forms[0].name);
    // A type counts as installed when every one of its form variants is
    // already in the company catalog. Partial installs surface as
    // available so the user can fill in the gap.
    const isInstalled = forms.every((f) => f.isInstalled);
    groups.push({ typeKey, name: baseName, isInstalled, forms });
  });

  groups.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
};

const variantLabel = (template: CatalogTemplate): string | null => {
  if (template.persona) {
    return template.persona.charAt(0).toUpperCase() + template.persona.slice(1);
  }
  const match = template.name.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
};

const VoucherTypesSettingsPage: React.FC<VoucherTypesSettingsPageProps> = ({
  module,
  moduleLabel,
  formsDesignerPath = '/tools/forms-designer',
}) => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyAccess();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await voucherTypeManagementApi.catalog(module);
      setCatalog(result.available || []);
    } catch (err: any) {
      console.error(`[VoucherTypesSettings] Failed to load catalog for ${module}`, err);
      setError(
        err?.response?.data?.error
          || err?.response?.data?.message
          || err?.message
          || 'Failed to load voucher type catalog.',
      );
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const groups = useMemo(() => groupCatalog(catalog), [catalog]);
  const installedGroups = groups.filter((g) => g.isInstalled);
  const availableGroups = groups.filter((g) => !g.isInstalled);

  const handleInstall = async (group: TypeGroup) => {
    try {
      setInstallingKey(group.typeKey);
      setError(null);
      const templateIds = group.forms.map((f) => f.id);
      const result = await voucherTypeManagementApi.install(module, templateIds);

      // Refresh sidebar / module caches so any newly enabled forms can
      // surface immediately if the user activates them right after.
      emitCompanyModulesRefresh({ companyId, moduleCode: module.toLowerCase() });
      await queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });

      const formsTotal = result.formsCreated + result.formsUpdated;
      setToast(
        `Installed "${group.name}" — ${formsTotal} default form${formsTotal !== 1 ? 's' : ''} added as locked, inactive.`,
      );
      await fetchCatalog();
    } catch (err: any) {
      console.error('[VoucherTypesSettings] Install failed', err);
      setError(
        err?.response?.data?.error
          || err?.response?.data?.message
          || err?.message
          || 'Failed to install voucher type.',
      );
    } finally {
      setInstallingKey(null);
      setTimeout(() => setToast(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Voucher Types — {moduleLabel}</h1>
          <p className="mt-1 text-gray-600">
            Manage which voucher types are installed in your company. Each type bundles one or
            more default form variants that you can activate or clone from{' '}
            <Link to={formsDesignerPath} className="text-primary-600 font-medium hover:underline">
              Forms Designer
            </Link>
            .
          </p>
        </div>

        {/* Locked-defaults reminder banner */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">Installing a type does not activate its forms.</p>
              <p>
                The schemas become available immediately so other modules can reference the type,
                but no sidebar entries appear until you open{' '}
                <Link to={formsDesignerPath} className="font-semibold underline">
                  Tools &rarr; Forms Designer
                </Link>{' '}
                and either <span className="font-semibold">Activate</span> a default form to use
                it as-is, or <span className="font-semibold">Clone</span> it to create an editable
                variant.
              </p>
            </div>
          </div>
        </div>

        {/* Inline error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Toast / success */}
        {toast && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
            <p className="text-sm text-green-800">{toast}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
            <span className="ml-3 text-gray-600">Loading voucher type catalog...</span>
          </div>
        ) : (
          <>
            {/* Installed section */}
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Installed ({installedGroups.length})
                </h2>
              </div>
              {installedGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                  <FileCheck className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    No voucher types installed for {moduleLabel} yet. Pick one from below to install.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {installedGroups.map((group) => (
                    <TypeGroupCard
                      key={group.typeKey}
                      group={group}
                      formsDesignerPath={formsDesignerPath}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Available section */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Available ({availableGroups.length})
                </h2>
              </div>
              {availableGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
                  <p className="text-sm text-gray-600">
                    All {moduleLabel} voucher types from the system catalog are already installed.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {availableGroups.map((group) => (
                    <TypeGroupCard
                      key={group.typeKey}
                      group={group}
                      formsDesignerPath={formsDesignerPath}
                      installing={installingKey === group.typeKey}
                      onInstall={() => handleInstall(group)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

interface TypeGroupCardProps {
  group: TypeGroup;
  formsDesignerPath: string;
  installing?: boolean;
  onInstall?: () => void;
}

const TypeGroupCard: React.FC<TypeGroupCardProps> = ({
  group,
  formsDesignerPath,
  installing,
  onInstall,
}) => {
  const variants = group.forms
    .map(variantLabel)
    .filter((v): v is string => Boolean(v));

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        group.isInstalled
          ? 'border-green-200 bg-green-50/40'
          : 'border-gray-200 bg-white hover:border-primary-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 truncate">{group.name}</h3>
            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
              {group.forms.length} default form{group.forms.length !== 1 ? 's' : ''}
            </span>
            {group.isInstalled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                <CheckCircle2 className="h-3 w-3" /> Installed
              </span>
            )}
          </div>
          {variants.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">Variants: {variants.join(' · ')}</p>
          )}
        </div>

        <div className="flex-shrink-0">
          {group.isInstalled ? (
            <Link
              to={formsDesignerPath}
              className="text-xs text-primary-600 hover:underline whitespace-nowrap"
              title="Open Forms Designer to activate or clone the default forms"
            >
              Open Designer →
            </Link>
          ) : onInstall ? (
            <button
              type="button"
              onClick={onInstall}
              disabled={installing}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                installing
                  ? 'bg-slate-100 text-slate-400 cursor-wait'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {installing ? (
                <>
                  <Spinner size="sm" />
                  Installing
                </>
              ) : (
                <>
                  <DownloadCloud className="h-3 w-3" />
                  Install
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default VoucherTypesSettingsPage;
