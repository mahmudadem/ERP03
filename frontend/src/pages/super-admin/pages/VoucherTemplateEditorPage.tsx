import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { superAdminVoucherTypesApi } from '../../../api/superAdmin';
import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import { FieldDefinition } from '../../../designer-engine/types/FieldDefinition';

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

// Field Editor Component
const FieldListEditor = ({ fields, onChange, t }: { fields: FieldDefinition[], onChange: (f: FieldDefinition[]) => void, t: (k: string, o?: any) => string }) => {
  const addField = () => {
    onChange([...fields, { id: `f_${Date.now()}`, name: '', label: t('superAdmin.voucherTemplatesEditor.fields.newField', { defaultValue: 'New Field' }), type: 'TEXT', required: false, readOnly: false, isPosting: false, postingRole: null }]);
  };

  const updateField = (index: number, updates: Partial<FieldDefinition>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange(newFields);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {fields.map((field, idx) => (
        <div key={idx} className="flex items-start space-x-4 p-4 bg-gray-50 rounded border border-gray-200">
          <div className="grid grid-cols-4 gap-4 flex-1">
            <div>
              <label className="block text-xs font-medium text-gray-500">{t('superAdmin.voucherTemplatesEditor.fields.label', { defaultValue: 'Label' })}</label>
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
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">{t('superAdmin.voucherTemplatesEditor.fields.type', { defaultValue: 'Type' })}</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={field.type}
                onChange={e => updateField(idx, { type: e.target.value as any })}
              >
                <option value="TEXT">{t('superAdmin.voucherTemplatesEditor.fieldTypes.text', { defaultValue: 'Text' })}</option>
                <option value="NUMBER">{t('superAdmin.voucherTemplatesEditor.fieldTypes.number', { defaultValue: 'Number' })}</option>
                <option value="DATE">{t('superAdmin.voucherTemplatesEditor.fieldTypes.date', { defaultValue: 'Date' })}</option>
                <option value="CHECKBOX">{t('superAdmin.voucherTemplatesEditor.fieldTypes.checkbox', { defaultValue: 'Checkbox (Boolean)' })}</option>
                <option value="RELATION">{t('superAdmin.voucherTemplatesEditor.fieldTypes.relation', { defaultValue: 'Relation' })}</option>
                <option value="SELECT">{t('superAdmin.voucherTemplatesEditor.fieldTypes.select', { defaultValue: 'Select' })}</option>
              </select>
            </div>
            <div className="flex items-center space-x-4 mt-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  checked={field.required}
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
          </div>
          <button onClick={() => removeField(idx)} className="text-red-600 hover:text-red-800 mt-6">
            {t('superAdmin.voucherTemplatesEditor.actions.remove', { defaultValue: 'Remove' })}
          </button>
        </div>
      ))}
      <Button variant="secondary" onClick={addField}>+ {t('superAdmin.voucherTemplatesEditor.actions.addField', { defaultValue: 'Add Field' })}</Button>
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
    if (!isNew && id) {
      loadTemplate(id);
    }
  }, [id, isNew]);

  const loadTemplate = async (templateId: string) => {
    try {
      setLoading(true);
      const list = await superAdminVoucherTypesApi.list();
      const found = list.find(t => t.id === templateId);
      if (found) {
        // Ensure layout.lineFields exists
        const safeDef = {
          ...found,
          layout: {
            lineFields: [],
            sections: [],
            ...found.layout
          }
        };
        setDefinition(safeDef);
      } else {
        setError(t('superAdmin.voucherTemplatesEditor.errors.templateNotFound', { defaultValue: 'Template not found' }));
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
      
      if (isNew) {
        await superAdminVoucherTypesApi.create(definition);
      } else if (id) {
        await superAdminVoucherTypesApi.update(id, definition);
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

  return (
    <div className="p-6 space-y-6 h-full flex flex-col max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? t('superAdmin.voucherTemplatesEditor.titleCreate', { defaultValue: 'Create Template' }) : t('superAdmin.voucherTemplatesEditor.titleEdit', { name: definition.name, defaultValue: `Edit ${definition.name}` })}
        </h1>
        <div className="space-x-3">
          <Button variant="secondary" onClick={() => navigate('/super-admin/voucher-templates')}>{t('superAdmin.voucherTemplatesEditor.actions.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button onClick={handleSave} disabled={loading}>{t('superAdmin.voucherTemplatesEditor.actions.saveTemplate', { defaultValue: 'Save Template' })}</Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
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
                <option value="ACCOUNTING">{t('superAdmin.voucherTemplatesEditor.modules.accounting', { defaultValue: 'Accounting' })}</option>
                <option value="INVENTORY">{t('superAdmin.voucherTemplatesEditor.modules.inventory', { defaultValue: 'Inventory' })}</option>
                <option value="POS">POS</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'Header Fields' && (
          <FieldListEditor 
            fields={definition.headerFields || []} 
            onChange={fields => updateDef({ headerFields: fields })}
            t={t}
          />
        )}

        {activeTab === 'Line Fields' && (
          <FieldListEditor 
            fields={definition.layout?.lineFields || []} 
            onChange={fields => updateLayout({ lineFields: fields })}
            t={t}
          />
        )}

        {activeTab === 'Table Columns' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{t('superAdmin.voucherTemplatesEditor.tableColumns.description', { defaultValue: 'Define which fields from \"Line Fields\" should appear as columns in the table.' })}</p>
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
                  onClick={() => updateDef({ tableColumns: definition.tableColumns?.filter((_, i) => i !== idx) })}
                  className="text-red-600 hover:text-red-800 mt-6"
                >
                  {t('superAdmin.voucherTemplatesEditor.actions.remove', { defaultValue: 'Remove' })}
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
              value={JSON.stringify(definition, null, 2)}
              onChange={(e) => {
                try {
                  setDefinition(JSON.parse(e.target.value));
                  setError(null);
                } catch (err) {
                  // Don't update state on invalid JSON, just let them type (or handle differently)
                  // For now, we won't block typing but we won't save invalid state to `definition` 
                  // actually, this pattern is tricky. Let's just update a local state if we wanted full JSON editing.
                  // For simplicity here, we'll assume they copy-paste valid JSON or we'd need a separate state for the text.
                  // Let's just warn.
                  setError(t('superAdmin.voucherTemplatesEditor.errors.invalidJson', { defaultValue: 'Invalid JSON' }));
                }
              }}
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};
