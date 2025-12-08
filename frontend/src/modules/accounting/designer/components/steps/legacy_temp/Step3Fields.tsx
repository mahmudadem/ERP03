import React from 'react';
import { VoucherTypeConfig, Translation, VoucherTypeField } from '../../../types';

interface Props {
    config: VoucherTypeConfig;
    updateConfig: (updates: Partial<VoucherTypeConfig>) => void;
    t: Translation;
}

import { AVAILABLE_FIELDS, FieldTemplate } from './constants';

const Step3Fields: React.FC<Props> = ({ config, updateConfig, t }) => {
    const activeFieldIds = new Set(config.fields.map(f => f.id));

    const toggleField = (template: FieldTemplate) => {
        if (activeFieldIds.has(template.id)) {
            // Remove field
            updateConfig({
                fields: config.fields.filter(f => f.id !== template.id)
            });
        } else {
            // Add field
            const newField: VoucherTypeField = {
                id: template.id,
                order: config.fields.length,
                visible: true,
                required: false,
                label: template.defaultLabel,
                colSpan: template.defaultSpan,
                uiModeOverrides: {
                    classic: {
                        section: template.section,
                        colSpan: template.defaultSpan
                    }
                }
            };
            updateConfig({
                fields: [...config.fields, newField]
            });
        }
    };

    const isFieldVisible = (template: FieldTemplate) => {
        if (config.mode === 'multiLine') {
            // In multi-line mode, account and counterAccount are usually in the line items table, not header
            if (template.id === 'account' || template.id === 'counterAccount') return false;
        } else {
            // In single-line mode, lineItems are not relevant here
        }
        return true;
    };

    return (
        <div className="space-y-6 p-4">
            <div className="border-b pb-4 mb-4 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {t.fieldSelection || 'Field Selection'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t.fieldSelectionDesc || 'Choose which fields to include in this voucher type.'}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AVAILABLE_FIELDS.filter(isFieldVisible).map(field => {
                    const isSelected = activeFieldIds.has(field.id);
                    return (
                        <div 
                            key={field.id}
                            onClick={() => toggleField(field)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {field.defaultLabel.en}
                                </span>
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                    isSelected 
                                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                                        : 'border-gray-300 dark:border-gray-600'
                                }`}>
                                    {isSelected && (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                                    {field.section}
                                </span>
                                {field.id === 'date' || field.id === 'description' ? (
                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">Recommended</span>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Selected Fields Summary */}
            <div className="mt-8 pt-6 border-t dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    {t.selectedFields || 'Selected Fields Configuration'}
                </h3>
                
                {config.fields.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 italic">
                        {t.noFieldsSelected || 'No fields selected yet.'}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {config.fields.map((field, index) => (
                            <div key={field.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {field.label?.en || field.id}
                                </span>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={field.required}
                                            onChange={(e) => {
                                                const newFields = [...config.fields];
                                                newFields[index] = { ...field, required: e.target.checked };
                                                updateConfig({ fields: newFields });
                                            }}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{t.required || 'Required'}</span>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Step3Fields;
