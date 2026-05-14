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
import { useTranslation } from 'react-i18next';
import {
  LayoutTemplate,
  Pencil,
  Save,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FileJson,
  Columns3,
  Type,
} from 'lucide-react';
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

const systemTemplateToFormConfig = (template: VoucherTypeDefinition): DocumentFormConfig => {
  const allFields = [...(template.headerFields || []), ...(template.tableColumns || [])];

  const systemFields = allFields.map((f: any) => ({
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

  const uiOverrides = template.uiModeOverrides || { classic: { sections: {} }, windows: { sections: {} } };

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
              <h1 className="text-2xl font-bold text-slate-900">System Form Designer</h1>
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
            <Loader2 size={16} className={loading ? 'animate-spin' : 'hidden'} />
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
            <span className="text-green-800 text-sm font-medium">Layout saved successfully</span>
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
              <Loader2 className="animate-spin mx-auto mb-3 text-slate-400" size={32} />
              <p className="text-slate-500 text-sm">Loading system templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileJson size={40} className="mx-auto mb-3 opacity-30" />
              <p>No system templates found</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Template</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Module</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Fields</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Layout</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
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
                <h2 className="font-bold text-sm">
                  Designing: {editingTemplate.name}
                </h2>
                <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  {editingTemplate.code}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {saving && (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 mr-2">
                    <Loader2 size={12} className="animate-spin" />
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
