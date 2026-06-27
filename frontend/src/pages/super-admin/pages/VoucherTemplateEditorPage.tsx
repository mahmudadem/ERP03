import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { superAdminVoucherTypesApi } from '../../../api/superAdmin';
import {
  FieldLibraryEntry,
  superAdminFieldLibraryApi,
} from '../../../api/superAdmin/fieldLibrary';
import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import { FieldDefinition } from '../../../designer-engine/types/FieldDefinition';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import {
  SuperAdminHeader,
  SuperAdminPage,
  SuperAdminPanel,
} from '../../../modules/super-admin/components/SuperAdminPage';

const FIELD_TYPE_OPTIONS = [
  { value: 'TEXT', i18nKey: 'text', label: 'Text' },
  { value: 'TEXTAREA', i18nKey: 'textarea', label: 'Textarea' },
  { value: 'NUMBER', i18nKey: 'number', label: 'Number' },
  { value: 'DATE', i18nKey: 'date', label: 'Date' },
  { value: 'CHECKBOX', i18nKey: 'checkbox', label: 'Checkbox (Boolean)' },
  { value: 'RELATION', i18nKey: 'relation', label: 'Relation' },
  { value: 'SELECT', i18nKey: 'select', label: 'Select' },
  { value: 'ACCOUNT_SELECT', i18nKey: 'accountSelect', label: 'Account Select' },
  { value: 'CURRENCY_SELECT', i18nKey: 'currencySelect', label: 'Currency Select' },
  { value: 'account-selector', i18nKey: 'accountSelector', label: 'Account Selector' },
  { value: 'party-selector', i18nKey: 'partySelector', label: 'Party Selector' },
  { value: 'customer-account-selector', i18nKey: 'customerAccountSelector', label: 'Customer + Account Selector' },
  { value: 'vendor-account-selector', i18nKey: 'vendorAccountSelector', label: 'Vendor + Account Selector' },
  { value: 'item-selector', i18nKey: 'itemSelector', label: 'Item Selector' },
  { value: 'warehouse-selector', i18nKey: 'warehouseSelector', label: 'Warehouse Selector' },
  { value: 'currency-selector', i18nKey: 'currencySelector', label: 'Currency Selector' },
  { value: 'cost-center-selector', i18nKey: 'costCenterSelector', label: 'Cost Center Selector' },
  { value: 'currency-exchange', i18nKey: 'currencyExchange', label: 'Currency Exchange' },
] as const;

const MODULE_OPTIONS = [
  { value: 'ACCOUNTING', i18nKey: 'accounting', label: 'Accounting' },
  { value: 'SALES', i18nKey: 'sales', label: 'Sales' },
  { value: 'PURCHASE', i18nKey: 'purchase', label: 'Purchase' },
  { value: 'INVENTORY', i18nKey: 'inventory', label: 'Inventory' },
  { value: 'POS', i18nKey: 'pos', label: 'POS' },
] as const;

const FIELD_CLASS_OPTIONS = [
  { value: 'system_core', label: 'System Core' },
  { value: 'system_optional', label: 'System Optional' },
  { value: 'computed', label: 'Computed / Readonly' },
  { value: 'custom_metadata', label: 'Custom Metadata' },
] as const;

type FieldScope = 'header' | 'line';
type SuggestedField = Partial<FieldDefinition> & {
  id: string;
  label: string;
  type: any;
  fieldLibraryVersion?: number;
};

const shouldOfferLibraryEntry = (entry: FieldLibraryEntry, templateCode: string | undefined, scope: FieldScope) => {
  if (entry.deprecated) return false;

  const normalizedTemplateCode = String(templateCode || '').toLowerCase();
  if (
    entry.supportedTypes?.length &&
    normalizedTemplateCode &&
    !entry.supportedTypes.map(type => type.toLowerCase()).includes(normalizedTemplateCode)
  ) {
    return false;
  }

  if (
    entry.excludedTypes?.length &&
    normalizedTemplateCode &&
    entry.excludedTypes.map(type => type.toLowerCase()).includes(normalizedTemplateCode)
  ) {
    return false;
  }

  if (scope === 'line') {
    return entry.sectionHint === 'BODY';
  }

  return entry.sectionHint !== 'BODY';
};

const libraryTypeToDesignerType = (type: string): FieldDefinition['type'] => {
  const normalized = type.toLowerCase();
  if (normalized === 'text') return 'TEXT';
  if (normalized === 'textarea') return 'TEXTAREA';
  if (normalized === 'number' || normalized === 'amount') return 'NUMBER';
  if (normalized === 'date') return 'DATE';
  if (normalized === 'select') return 'SELECT';
  if (normalized === 'checkbox' || normalized === 'boolean') return 'CHECKBOX';
  if (normalized === 'relation') return 'RELATION';
  return type as FieldDefinition['type'];
};

const libraryEntryToField = (entry: FieldLibraryEntry): SuggestedField => ({
  id: entry.id,
  name: entry.id,
  label: entry.label,
  type: libraryTypeToDesignerType(entry.type),
  required: entry.alwaysMandatory ?? false,
  readOnly: entry.fieldClass === 'computed',
  isPosting: false,
  postingRole: null,
  fieldClass: entry.fieldClass,
  bindingTarget: entry.fieldClass === 'custom_metadata' ? 'metadata.customFields' : 'payload',
  nameLocked: entry.fieldClass !== 'custom_metadata',
  computed: entry.fieldClass === 'computed',
  schemaVersion: 2,
  relationTarget: entry.selectorBinding?.collection,
  fieldLibraryVersion: entry.version,
});
// Simple Tab Component
const Tabs = ({ active, onChange, tabs }: { active: string, onChange: (t: string) => void, tabs: Array<{ id: string; label: string }> }) => (
  <div className="border-b border-gray-200 mb-4">
    <nav className="-mb-px flex space-x-8">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
            ${active === tab.id
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
          `}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  </div>
);

const buildFieldPatch = (current: FieldDefinition, updates: Partial<FieldDefinition>): FieldDefinition => {
  const next = { ...current, ...updates };

  if (!next.id) {
    next.id = next.name || `f_${Date.now()}`;
  }

  if (!next.name && next.id) {
    next.name = next.id;
  }

  if (next.fieldClass === 'custom_metadata') {
    next.bindingTarget = 'metadata.customFields';
    next.isPosting = false;
    next.postingRole = null;
    next.nameLocked = false;
  } else {
    next.bindingTarget = 'payload';
    next.nameLocked = next.nameLocked ?? false;
  }

  if (next.fieldClass === 'computed') {
    next.readOnly = true;
    next.computed = true;
  }

  return next;
};

const fieldKey = (field: Partial<FieldDefinition>) => field.id || field.name || '';

const applyFieldLibraryRules = (
  field: FieldDefinition,
  entriesById: Map<string, FieldLibraryEntry>,
): FieldDefinition => {
  const entry = entriesById.get(fieldKey(field));
  const next = buildFieldPatch(field, {});
  if (!entry) return next;

  next.label = entry.label;
  next.type = libraryTypeToDesignerType(entry.type);
  next.fieldClass = entry.fieldClass as any;
  next.relationTarget = entry.selectorBinding?.collection || next.relationTarget;
  (next as any).fieldLibraryVersion = entry.version;

  if (entry.alwaysMandatory) {
    next.required = true;
    (next as any).mandatory = true;
  }

  return buildFieldPatch(next, {});
};

const isOfficialField = (field: FieldDefinition) => {
  return field.fieldClass !== 'custom_metadata' || field.bindingTarget !== 'metadata.customFields';
};

const buildTableColumnFromField = (field: SuggestedField) => ({
  fieldId: field.id,
  label: field.label,
  type: field.type,
  width: field.type === 'TEXT' || field.type === 'TEXTAREA' ? '220px' : '120px',
  mandatory: field.required ?? false,
  readOnly: field.readOnly ?? false,
});

// Field Editor Component
const FieldListEditor = ({
  fields,
  onChange,
  t,
  templateCode,
  scope,
  fieldLibraryEntries,
}: {
  fields: FieldDefinition[];
  onChange: (f: FieldDefinition[]) => void;
  t: (k: string, o?: any) => string;
  templateCode?: string;
  scope: FieldScope;
  fieldLibraryEntries: FieldLibraryEntry[];
}) => {
  const entriesById = new Map(fieldLibraryEntries.map((entry) => [entry.id, entry]));
  const existingFieldIds = new Set(fields.map(field => field.id || field.name));
  const missingLibraryFields = fieldLibraryEntries
    .filter(entry => shouldOfferLibraryEntry(entry, templateCode, scope))
    .map(libraryEntryToField)
    .filter(field => !existingFieldIds.has(field.id))
    .sort((a, b) => a.label.localeCompare(b.label));

  const addField = () => {
    onChange([...fields, {
      id: `f_${Date.now()}`,
      name: '',
      label: t('superAdmin.voucherTemplatesEditor.fields.newField', { defaultValue: 'New Field' }),
      type: 'TEXT',
      required: false,
      readOnly: false,
      isPosting: false,
      postingRole: null,
      fieldClass: 'custom_metadata',
      bindingTarget: 'metadata.customFields',
      nameLocked: false,
      computed: false,
      schemaVersion: 2,
    }]);
  };

  const addLibraryField = (field: SuggestedField) => {
    onChange([...fields, buildFieldPatch(field as FieldDefinition, {})]);
  };

  const updateField = (index: number, updates: Partial<FieldDefinition>) => {
    const newFields = [...fields];
    newFields[index] = applyFieldLibraryRules(
      buildFieldPatch(newFields[index], updates),
      entriesById,
    );
    onChange(newFields);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={18} className="mt-0.5 flex-none" />
        <div>
          <div className="font-semibold">{t(`Superadmin editing is unrestricted.`)}</div>
          <div className="text-xs leading-5">
            Changing official field names, types, or classes can break backend payloads. Use custom metadata fields for extra informational fields.
          </div>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">{t(`Available Field Library fields`)}</div>
            <div className="text-xs text-gray-500">{t(`Add official fields from Layer 1, then control placement and required status on this template.`)}</div>
          </div>
          <Button variant="secondary" onClick={addField}>
            <Plus size={14} className="mr-1" />
            Custom metadata
          </Button>
        </div>
        {missingLibraryFields.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {missingLibraryFields.map(field => (
              <button
                key={field.id}
                type="button"
                onClick={() => addLibraryField(field)}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                title={`${field.id} / ${field.type}`}
              >
                <Plus size={12} />
                {field.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500">{t(`No missing Field Library fields for this scope.`)}</div>
        )}
      </div>

      {fields.map((rawField, idx) => {
        const field = applyFieldLibraryRules(rawField, entriesById);
        return (
        <div key={idx} className="flex items-start space-x-4 p-4 bg-gray-50 rounded border border-gray-200">
          <div className="grid grid-cols-5 gap-4 flex-1">
            {(() => {
              const libraryEntry = entriesById.get(fieldKey(field));
              const isAlwaysMandatory = Boolean(libraryEntry?.alwaysMandatory);
              return (
                <>
            <div>
              <div className="flex items-center gap-2">
                <label className="block text-xs font-medium text-gray-500">{t('superAdmin.voucherTemplatesEditor.fields.label', { defaultValue: 'Label' })}</label>
                {isOfficialField(field) && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">{t(`Official`)}</span>
                )}
              </div>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={field.label}
                onChange={e => updateField(idx, { label: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t('superAdmin.voucherTemplatesEditor.fields.dataProperty', { defaultValue: 'Name (Data Property)' })}</label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={field.name}
                onChange={e => updateField(idx, { name: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500">
                {field.bindingTarget === 'metadata.customFields'
                  ? t('superAdmin.voucherTemplatesEditor.fields.customMetadataHint', { defaultValue: 'Stored in metadata.customFields' })
                  : t('superAdmin.voucherTemplatesEditor.fields.backendPayloadHint', { defaultValue: 'Posted as a backend payload field' })}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t('superAdmin.voucherTemplatesEditor.fields.type', { defaultValue: 'Type' })}</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={field.type}
                onChange={e => updateField(idx, { type: e.target.value as any })}
              >
                {FIELD_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {t(`superAdmin.voucherTemplatesEditor.fieldTypes.${option.i18nKey}`, { defaultValue: option.label })}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-4 mt-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  checked={Boolean(field.required || isAlwaysMandatory)}
                  disabled={isAlwaysMandatory}
                  onChange={e => updateField(idx, { required: e.target.checked })}
                />
                <span className="ml-2 text-sm text-gray-600">{t('superAdmin.voucherTemplatesEditor.fields.required', { defaultValue: 'Required' })}</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  checked={field.readOnly}
                  onChange={e => updateField(idx, { readOnly: e.target.checked })}
                />
                <span className="ml-2 text-sm text-gray-600">{t('superAdmin.voucherTemplatesEditor.fields.readonly', { defaultValue: 'Readonly' })}</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t('superAdmin.voucherTemplatesEditor.fields.classification', { defaultValue: 'Classification' })}</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={field.fieldClass || 'system_optional'}
                onChange={e => updateField(idx, { fieldClass: e.target.value as any })}
              >
                {FIELD_CLASS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
                </>
              );
            })()}
          </div>
          <button
            type="button"
            onClick={() => removeField(idx)}
            className="mt-6 inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            title={t('superAdmin.voucherTemplatesEditor.actions.remove', { defaultValue: 'Remove' })}
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      );
      })}
    </div>
  );
};

export const VoucherTemplateEditorPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [activeTab, setActiveTab] = useState('General');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [fieldLibraryEntries, setFieldLibraryEntries] = useState<FieldLibraryEntry[]>([]);

  // State for the definition
  const [definition, setDefinition] = useState<Partial<VoucherTypeDefinition>>({
    name: '',
    code: '',
    module: 'ACCOUNTING',
    headerFields: [],
    tableColumns: [],
    layout: {},
    schemaVersion: 2,
    workflow: { approvalRequired: false }
  });

  useEffect(() => {
    loadPageData();
  }, [id, isNew]);

  useEffect(() => {
    setJsonText(JSON.stringify(definition, null, 2));
  }, [definition]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      const fieldLibraryPromise = superAdminFieldLibraryApi.list();
      const templatePromise = !isNew && id ? superAdminVoucherTypesApi.list() : Promise.resolve([]);
      const [libraryEntries, templates] = await Promise.all([fieldLibraryPromise, templatePromise]);
      const entriesById = new Map(libraryEntries.map((entry) => [entry.id, entry]));

      setFieldLibraryEntries(libraryEntries);

      if (!isNew && id) {
        const found = templates.find(t => t.id === id);
        if (found) {
          // Ensure layout.lineFields exists.
          const safeDef = {
            ...found,
            headerFields: (found.headerFields || []).map((field: FieldDefinition) =>
              applyFieldLibraryRules(field, entriesById),
            ),
            layout: {
              ...found.layout,
              sections: (found.layout as any)?.sections || [],
              lineFields: ((found.layout as any)?.lineFields || []).map((field: FieldDefinition) =>
                applyFieldLibraryRules(field, entriesById),
              ),
            }
          };
          setDefinition(safeDef);
        } else {
          setError(t('superAdmin.voucherTemplatesEditor.errors.templateNotFound', { defaultValue: 'Template not found' }));
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setError(null);
      setLoading(true);
      const entriesById = new Map(fieldLibraryEntries.map((entry) => [entry.id, entry]));
      const definitionToSave = {
        ...definition,
        headerFields: (definition.headerFields || []).map((field: FieldDefinition) =>
          applyFieldLibraryRules(field, entriesById),
        ),
        layout: {
          ...definition.layout,
          lineFields: (((definition.layout as any)?.lineFields || []) as FieldDefinition[]).map((field) =>
            applyFieldLibraryRules(field, entriesById),
          ),
        },
      };
      
      if (isNew) {
        await superAdminVoucherTypesApi.create(definitionToSave);
      } else if (id) {
        await superAdminVoucherTypesApi.update(id, definitionToSave);
      }
      navigate('/super-admin/voucher-templates');
    } catch (err: any) {
      setError(t('superAdmin.voucherTemplatesEditor.errors.saveFailed', { defaultValue: 'Save Failed: ' }) + err.message);
      setLoading(false);
    }
  };

  const updateDef = (updates: Partial<VoucherTypeDefinition>) => {
    setDefinition(prev => ({ ...prev, ...updates }));
  };

  const updateLayout = (updates: any) => {
    setDefinition(prev => ({ ...prev, layout: { ...prev.layout, ...updates } }));
  };

  const lineFieldsForTable = ((definition.layout as any)?.lineFields || []) as FieldDefinition[];
  const existingTableColumnIds = new Set((definition.tableColumns || []).map((col: any) => col.fieldId || col.id));
  const missingTableColumns = lineFieldsForTable
    .filter(field => field.id && !existingTableColumnIds.has(field.id))
    .sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id)));

  const addSupportedTableColumn = (field: SuggestedField) => {
    setDefinition(prev => {
      const lineFields = ((prev.layout as any)?.lineFields || []) as FieldDefinition[];
      const hasLineField = lineFields.some(lineField => (lineField.id || lineField.name) === field.id);
      const nextLineFields = hasLineField
        ? lineFields
        : [...lineFields, buildFieldPatch(field as FieldDefinition, {})];

      return {
        ...prev,
        tableColumns: [...(prev.tableColumns || []), buildTableColumnFromField(field) as any],
        layout: {
          ...prev.layout,
          lineFields: nextLineFields,
        },
      };
    });
  };

  return (
    <SuperAdminPage className="max-w-[1200px]">
      <SuperAdminHeader
        title={isNew ? t('superAdmin.voucherTemplatesEditor.titleCreate', { defaultValue: 'Create Template' }) : t('superAdmin.voucherTemplatesEditor.titleEdit', { name: definition.name, defaultValue: `Edit ${definition.name}` })}
        description="Edit official system metadata templates. Structural changes affect future company initialization and designer behavior."
        meta={definition.code || 'Voucher template'}
        actions={
          <>
          <Button variant="secondary" onClick={() => navigate('/super-admin/voucher-templates')}>{t('superAdmin.voucherTemplatesEditor.actions.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button onClick={handleSave} disabled={loading}>{t('superAdmin.voucherTemplatesEditor.actions.saveTemplate', { defaultValue: 'Save Template' })}</Button>
          </>
        }
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <SuperAdminPanel className="p-5">
        <Tabs 
          active={activeTab} 
          onChange={setActiveTab} 
          tabs={[
            { id: 'General', label: t('superAdmin.voucherTemplatesEditor.tabs.general', { defaultValue: 'General' }) },
            { id: 'Header Fields', label: t('superAdmin.voucherTemplatesEditor.tabs.headerFields', { defaultValue: 'Header Fields' }) },
            { id: 'Line Fields', label: t('superAdmin.voucherTemplatesEditor.tabs.lineFields', { defaultValue: 'Line Fields' }) },
            { id: 'Table Columns', label: t('superAdmin.voucherTemplatesEditor.tabs.tableColumns', { defaultValue: 'Table Columns' }) },
            { id: 'JSON', label: t('superAdmin.voucherTemplatesEditor.tabs.json', { defaultValue: 'JSON' }) }
          ]} 
        />

        {activeTab === 'General' && (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('superAdmin.voucherTemplatesEditor.general.templateName', { defaultValue: 'Template Name' })}</label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={definition.name}
                onChange={e => updateDef({ name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('superAdmin.voucherTemplatesEditor.general.code', { defaultValue: 'Code (Unique)' })}</label>
              <input
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={definition.code}
                onChange={e => updateDef({ code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('superAdmin.voucherTemplatesEditor.general.module', { defaultValue: 'Module' })}</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={definition.module}
                onChange={e => updateDef({ module: e.target.value as any })}
              >
                {MODULE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {t(`superAdmin.voucherTemplatesEditor.modules.${option.i18nKey}`, { defaultValue: option.label })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'Header Fields' && (
          <FieldListEditor 
            fields={definition.headerFields || []} 
            onChange={fields => updateDef({ headerFields: fields })}
            t={t}
            templateCode={definition.code}
            scope="header"
            fieldLibraryEntries={fieldLibraryEntries}
          />
        )}

        {activeTab === 'Line Fields' && (
          <FieldListEditor 
            fields={definition.layout?.lineFields || []} 
            onChange={fields => updateLayout({ lineFields: fields })}
            t={t}
            templateCode={definition.code}
            scope="line"
            fieldLibraryEntries={fieldLibraryEntries}
          />
        )}

        {activeTab === 'Table Columns' && (
          <div className="space-y-4">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <div className="font-semibold">{t(`Table Columns are the visible line grid.`)}</div>
              <div className="text-xs leading-5">
                They point to Line Fields by Field ID. Add the line field from the Field Library first, then expose it here when it should appear in the grid.
              </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-4">
              <div className="mb-3">
                <div className="text-sm font-semibold text-gray-900">{t(`Available line fields`)}</div>
                <div className="text-xs text-gray-500">{t(`Line fields on this voucher template that are not currently visible in the table.`)}</div>
              </div>
              {missingTableColumns.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {missingTableColumns.map(field => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => addSupportedTableColumn(field)}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      title={`${field.id} / ${field.type}`}
                    >
                      <Plus size={12} />
                      {field.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">{t(`No missing line fields for this table.`)}</div>
              )}
            </div>

            {(definition.tableColumns || []).map((col, idx) => (
              <div key={idx} className="flex items-center space-x-4 p-4 bg-gray-50 rounded border border-gray-200">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500">{t('superAdmin.voucherTemplatesEditor.tableColumns.fieldId', { defaultValue: 'Field ID (must match Line Field ID)' })}</label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={col.fieldId}
                    onChange={e => {
                      const newCols = [...(definition.tableColumns || [])];
                      newCols[idx] = { ...newCols[idx], fieldId: e.target.value };
                      updateDef({ tableColumns: newCols });
                    }}
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-500">{t('superAdmin.voucherTemplatesEditor.tableColumns.width', { defaultValue: 'Width' })}</label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={col.width}
                    onChange={e => {
                      const newCols = [...(definition.tableColumns || [])];
                      newCols[idx] = { ...newCols[idx], width: e.target.value };
                      updateDef({ tableColumns: newCols });
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateDef({ tableColumns: definition.tableColumns?.filter((_, i) => i !== idx) })}
                  className="mt-6 inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            ))}
            <Button 
              variant="secondary" 
              onClick={() => updateDef({ tableColumns: [...(definition.tableColumns || []), { fieldId: '', width: '20%' }] })}
            >
              + {t('superAdmin.voucherTemplatesEditor.actions.addColumn', { defaultValue: 'Add Column' })}
            </Button>
          </div>
        )}

        {activeTab === 'JSON' && (
          <div>
            <p className="text-sm text-gray-500 mb-2">{t('superAdmin.voucherTemplatesEditor.jsonHelp', { defaultValue: 'Advanced: Edit the raw JSON definition directly.' })}</p>
            <textarea
              className="w-full h-96 font-mono text-sm p-4 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                try {
                  setDefinition(JSON.parse(e.target.value));
                  setError(null);
                } catch (err) {
                  setError(t('superAdmin.voucherTemplatesEditor.errors.invalidJson', { defaultValue: 'Invalid JSON' }));
                }
              }}
              spellCheck={false}
            />
          </div>
        )}
      </SuperAdminPanel>
    </SuperAdminPage>
  );
};
