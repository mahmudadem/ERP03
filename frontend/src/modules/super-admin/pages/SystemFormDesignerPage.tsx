/**
 * SystemFormDesignerPage.tsx
 *
 * Super Admin page for editing system voucher type default layouts.
 *
 * Workflow:
 *   1. Load all system voucher types.
 *   2. Click "Design Layout" on a row.
 *   3. Opens DocumentDesigner in a modal with system template data.
 *   4. Saves only the uiModeOverrides back to the system template.
 */

import React, { useState, useEffect, createContext, useMemo, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next'; import { LayoutTemplate, Pencil, Save, X, CheckCircle, AlertTriangle, FileJson, Columns3, Type} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { superAdminVoucherTypesApi } from '../../../api/superAdmin/voucherTypes';
import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import { DocumentDesigner } from '../../tools/forms-designer/components/DocumentDesigner';
import { DocumentFormConfig, DocumentRule, DocumentAction } from '../../tools/forms-designer/types';
import AccountsContext, { Account } from '../../../context/AccountsContext';
import { CompanyAccessContext, CompanyAccessContextValue } from '../../../context/CompanyAccessContext';

// ── Mock Context Providers for Super Admin Designer ──

const MockDesignerShell: React.FC<{ children: ReactNode }> = ({ children }) => {
  const noop = useCallback(async () => {}, []);
  const noopSync = useCallback(() => {}, []);

  const mockCompanyValue = useMemo<CompanyAccessContextValue>(() => ({
    companyId: 'SYSTEM',
    company: null,
    permissions: [],
    resolvedPermissions: [],
    moduleBundles: [],
    isSuperAdmin: true,
    isOwner: false,
    loading: false,
    permissionsLoaded: true,
    setCompanyId: noopSync,
    loadActiveCompany: noop,
    switchCompany: noop,
    refreshPermissions: noop,
    loadPermissionsForActiveCompany: noop,
    refreshCompany: noop,
  }), [noop, noopSync]);

  const mockAccountsValue = useMemo(() => ({
    accounts: [] as Account[],
    validAccounts: [] as Account[],
    isLoading: false,
    error: null,
    refreshAccounts: noop,
    getAccountByCode: (() => undefined) as (code: string) => Account | undefined,
    getAccountById: (() => undefined) as (id: string) => Account | undefined,
    createAccount: (async () => ({} as Account)) as (data: any) => Promise<Account>,
  }), [noop]);

  return (
    <CompanyAccessContext.Provider value={mockCompanyValue}>
      <AccountsContext.Provider value={mockAccountsValue}>
        {children}
      </AccountsContext.Provider>
    </CompanyAccessContext.Provider>
  );
};

// ── Adapter: VoucherTypeDefinition -> DocumentFormConfig ──

const isEmptyLayout = (overrides: any): boolean => {
  if (!overrides) return true;
  const classicFields = overrides.classic?.sections
    ? Object.values(overrides.classic.sections).reduce((sum: number, s: any) => sum + (s.fields?.length || 0), 0)
    : 0;
  const windowsFields = overrides.windows?.sections
    ? Object.values(overrides.windows.sections).reduce((sum: number, s: any) => sum + (s.fields?.length || 0), 0)
    : 0;
  return classicFields === 0 && windowsFields === 0;
};

const buildInitialLayout = (template: VoucherTypeDefinition): { classic: { sections: Record<string, { order: number; fields: any[] }> }; windows: { sections: Record<string, { order: number; fields: any[] }> } } => {
  const logicalSections: Record<string, { title: string; fieldIds: string[] }> = {};
  const logicalLayout = (template.layout as any)?.sections;
  if (Array.isArray(logicalLayout)) {
    logicalLayout.forEach((s: any) => {
      logicalSections[s.id] = { title: s.title, fieldIds: s.fieldIds || [] };
    });
  }

  const headerFieldIds = logicalSections['header']?.fieldIds || [];
  const lineFieldIds = logicalSections['lines']?.fieldIds || [];
  const extraFieldIds = Object.entries(logicalSections)
    .filter(([key]) => key !== 'header' && key !== 'lines')
    .flatMap(([, s]) => s.fieldIds);

  const isWindows = (mode: string) => mode === 'windows';

  const buildMode = (mode: string) => {
    const w = isWindows(mode);
    const sections: Record<string, { order: number; fields: any[] }> = {
      HEADER: { order: 0, fields: [] },
      BODY: { order: 1, fields: [] },
      EXTRA: { order: 2, fields: [] },
      FOOTER: { order: 3, fields: [] },
      ACTIONS: { order: 4, fields: [] },
    };

    // Place header fields: date(6), currency(4), rate(4), ref(10), desc(24)
    let row = 0;
    let col = 0;
    headerFieldIds.forEach((fieldId: string) => {
      const fieldDef = (template.headerFields || []).find((f: any) => (f.id || f.fieldId || f.name) === fieldId);
      const type = String(fieldDef?.type || '').toLowerCase();
      const span = w ? 6 : (type.includes('date') ? 6 : type.includes('currency') || type.includes('select') ? 4 : type.includes('textarea') || type.includes('description') || type.includes('note') ? 24 : (24 - col < 6 ? 24 - col : 6));
      if (col + span > 24) { row++; col = 0; }
      sections.HEADER.fields.push({ fieldId, row, col, colSpan: span });
      col += span;
    });

    // Place lineItems in BODY (full width)
    lineFieldIds.forEach((fieldId: string) => {
      sections.BODY.fields.push({ fieldId, row: 0, col: 0, colSpan: 24 });
    });

    // Place extra fields
    row = 0; col = 0;
    extraFieldIds.forEach((fieldId: string) => {
      const span = w ? 8 : 24;
      if (col + span > 24) { row++; col = 0; }
      sections.EXTRA.fields.push({ fieldId, row, col, colSpan: span });
      col += span;
    });

    // Place actions as compact row (mode-specific display)
    const actionFields = (template.actions || []).filter((a: any) => a.enabled).map((a: any, i: number) => ({
      fieldId: `action_${a.type}`,
      row: 0,
      col: i * (w ? 4 : 6),
      colSpan: w ? 4 : 6,
      displayMode: 'compact' as const,
      isCompact: true,
    }));
    sections.ACTIONS.fields = actionFields;

    return { order: 0, sections };
  };

  return {
    classic: { sections: buildMode('classic').sections as any },
    windows: { sections: buildMode('windows').sections as any },
  };
};

const systemTemplateToFormConfig = (template: VoucherTypeDefinition): DocumentFormConfig => {
  const systemFields = (template.headerFields || []).map((f: any) => ({
    id: f.id || f.fieldId || f.name || '',
    label: f.label || f.name || f.id || '',
    type: mapFieldTypeToDesigner(f.type),
    category: f.mandatory || f.required ? ('core' as const) : ('shared' as const),
    mandatory: f.mandatory || f.required || false,
    autoManaged: f.autoManaged || f.calculated || f.readOnly || false,
    sectionHint: inferSectionHint(f.id || f.fieldId || f.name || ''),
  }));

  const availableFields: any[] = [];

  const defaultRules: DocumentRule[] = (template.rules || []).map((r: any) => ({
    id: r.id || '',
    label: r.label || '',
    enabled: r.enabled || false,
    description: r.description || '',
  }));

  const defaultActions: DocumentAction[] = (template.actions || []).map((a: any) => ({
    type: a.type || 'print',
    label: a.label || '',
    enabled: a.enabled || false,
  }));

  const uiOverrides = template.uiModeOverrides && !isEmptyLayout(template.uiModeOverrides)
    ? template.uiModeOverrides
    : buildInitialLayout(template);

  return {
    id: template.id || template.code || '',
    name: template.name || template.code || 'Untitled',
    code: template.code || '',
    module: template.module || '',
    prefix: (template.code || 'V').slice(0, 3).toUpperCase(),
    startNumber: 1,
    isMultiLine: template.isMultiLine ?? true,
    rules: defaultRules,
    actions: defaultActions,
    uiModeOverrides: uiOverrides,
    tableColumns: (template.tableColumns || []).map((c: any) => ({
      id: c.fieldId || c.id || '',
      fieldId: c.fieldId || c.id || '',
      labelOverride: c.label || c.labelOverride || '',
      type: c.type || 'TEXT',
      required: c.required || c.mandatory || false,
      mandatory: c.mandatory || c.required || false,
      readOnly: c.readOnly,
      calculated: c.calculated,
      autoManaged: c.autoManaged,
      width: c.width,
    })),
    formType: template.formType || template.code || '',
    voucherType: template.voucherType || template.code || '',
    persona: template.persona || '',
    baseType: template.baseType || template.code || '',
    isSystemDefault: true,
    isSystemGenerated: true,
    isLocked: true,
    enabled: true,
    headerFields: systemFields,
    lineFields: (template.layout?.lineFields || []).map((f: any) => ({
      id: f.id || f.fieldId || '',
      label: f.label || f.name || '',
      type: f.type || 'TEXT',
      required: f.required || f.mandatory || false,
    })),
  };
};

const mapFieldTypeToDesigner = (type: string): any => {
  const t = String(type || '').toLowerCase();
  if (t.includes('number')) return 'number';
  if (t.includes('date')) return 'date';
  if (t.includes('select') || t.includes('currency')) return 'select';
  if (t.includes('account-selector')) return 'account-selector';
  if (t.includes('cost-center')) return 'cost-center-selector';
  if (t.includes('party') || t.includes('customer') || t.includes('vendor')) return 'party-selector';
  if (t.includes('item')) return 'item-selector';
  if (t.includes('warehouse')) return 'warehouse-selector';
  if (t.includes('textarea')) return 'textarea';
  return 'text';
};

const inferSectionHint = (fieldId: string): 'HEADER' | 'BODY' | 'EXTRA' | 'FOOTER' | 'ACTIONS' => {
  const lower = String(fieldId).toLowerCase();
  if (lower.includes('action_') || lower.includes('print') || lower.includes('download')) return 'ACTIONS';
  if (lower.includes('note') || lower.includes('description') || lower.includes('reference')) return 'EXTRA';
  if (lower.includes('date') || lower.includes('currency') || lower.includes('rate') || lower.includes('account')) return 'HEADER';
  return 'HEADER';
};

// ── Component ──

const SystemFormDesignerPage: React.FC = () => {
  const { t } = useTranslation('common');

  const [templates, setTemplates] = useState<VoucherTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<VoucherTypeDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminVoucherTypesApi.list();
      setTemplates(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load system templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLayout = async (config: DocumentFormConfig) => {
    if (!editingTemplate) return;
    setSaving(true);
    setSaveError(null);
    try {
      await superAdminVoucherTypesApi.updateLayout(editingTemplate.id!, config.uiModeOverrides);
      setSavedTemplateId(editingTemplate.id!);
      setTimeout(() => setSavedTemplateId(null), 3000);
      setEditingTemplate(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const getModuleBadge = (module?: string) => {
    const colorMap: Record<string, string> = {
      accounting: 'bg-blue-100 text-blue-700',
      sales: 'bg-emerald-100 text-emerald-700',
      purchase: 'bg-amber-100 text-amber-700',
      purchases: 'bg-amber-100 text-amber-700',
      inventory: 'bg-purple-100 text-purple-700',
    };
    const key = String(module || '').toLowerCase();
    return colorMap[key] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-lg">
              <LayoutTemplate size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t(`System Form Designer`)}</h1>
              <p className="text-sm text-slate-500">
                Edit default layouts for system voucher types. New companies automatically receive these layouts.
              </p>
            </div>
          </div>
          <button
            onClick={loadTemplates}
            disabled={loading}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Spinner size="sm" />
            Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="text-red-600 shrink-0" size={20} />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        )}

        {/* Save Success Toast */}
        {savedTemplateId && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <CheckCircle className="text-green-600 shrink-0" size={20} />
            <span className="text-green-800 text-sm font-medium">{t(`Layout saved successfully`)}</span>
          </div>
        )}

        {/* Save Error Banner */}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="text-red-600 shrink-0" size={20} />
            <span className="text-red-800 text-sm">{saveError}</span>
          </div>
        )}

        {/* Templates Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Spinner size="lg" variant="secondary" className="mx-auto mb-3" />
              <p className="text-slate-500 text-sm">{t(`Loading system templates...`)}</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileJson size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t(`No system templates found`)}</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t(`Template`)}</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t(`Code`)}</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t(`Module`)}</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t(`Fields`)}</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t(`Layout`)}</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t(`Action`)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((template) => {
                  const hasLayout = template.uiModeOverrides &&
                    (Object.keys(template.uiModeOverrides.classic?.sections || {}).length > 0 ||
                     Object.keys(template.uiModeOverrides.windows?.sections || {}).length > 0);

                  return (
                    <tr key={template.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getModuleBadge(template.module)}`}>
                            <Type size={14} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{template.name}</p>
                            <p className="text-xs text-slate-400">{template.voucherType || template.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-mono">
                          {template.code}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getModuleBadge(template.module)}`}>
                          {template.module || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Columns3 size={14} className="text-slate-400" />
                          {(template.headerFields || []).length} header
                          <span className="text-slate-300">|</span>
                          {(template.tableColumns || []).length} columns
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${hasLayout ? 'text-green-600' : 'text-amber-600'}`}>
                          {hasLayout ? (
                            <>
                              <CheckCircle size={12} />
                              Designed
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={12} />
                              Not set
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setEditingTemplate(template)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors"
                        >
                          <Pencil size={13} />
                          Design Layout
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Designer Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col">
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Modal Header */}
            <div className="h-14 bg-slate-900 text-white px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <LayoutTemplate size={18} className="text-indigo-400" />
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <span className="text-white/60">{t(`System Wizard`)}</span>
                  <span className="text-white/30 font-normal">/</span>
                  <span className="text-indigo-400">{editingTemplate.name}</span>
                </h2>
                <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  {editingTemplate.code}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {saving && (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 mr-2">
                    <Spinner size="xs" />
                    Saving...
                  </span>
                )}
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Close without saving"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Designer */}
            <div className="flex-1 overflow-hidden">
              <MockDesignerShell>
                <DocumentDesigner
                  initialConfig={systemTemplateToFormConfig(editingTemplate)}
                  systemFields={systemTemplateToFormConfig(editingTemplate).headerFields || []}
                  availableFields={[]}
                  availableTableColumns={editingTemplate.tableColumns || []}
                  defaultRules={systemTemplateToFormConfig(editingTemplate).rules || []}
                  defaultActions={systemTemplateToFormConfig(editingTemplate).actions || []}
                  onSave={handleSaveLayout}
                  onCancel={() => setEditingTemplate(null)}
                  hideHeader={true}
                />
              </MockDesignerShell>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemFormDesignerPage;
