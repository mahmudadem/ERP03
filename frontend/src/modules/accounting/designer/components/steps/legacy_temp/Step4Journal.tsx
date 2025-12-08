import React from 'react';
import { VoucherTypeConfig, Translation, VoucherLineFieldConfig, Account } from '../../../types';

interface Props {
    config: VoucherTypeConfig;
    updateConfig: (updates: Partial<VoucherTypeConfig>) => void;
    accounts: Account[];
    t: Translation;
}

import { AVAILABLE_LINE_FIELDS, FieldTemplate } from './constants';

const Step4Journal: React.FC<Props> = ({ config, updateConfig, accounts, t }) => {
    
    if (config.mode !== 'multiLine') {
        return (
            <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {t.notApplicable || 'Not Applicable'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    {t.singleLineJournalSkip || 'This step is for multi-line vouchers only. Since you selected Single-line mode, you can skip this step.'}
                </p>
            </div>
        );
    }

    const lineFields = config.lineFields || [];
    const activeLineFieldIds = new Set(lineFields.map(f => f.id));

    const toggleLineField = (template: FieldTemplate) => {
        if (activeLineFieldIds.has(template.id)) {
            updateConfig({
                lineFields: lineFields.filter(f => f.id !== template.id)
            });
        } else {
            const newField: VoucherLineFieldConfig = {
                id: template.id,
                order: lineFields.length,
                visible: true,
                required: false,
                label: template.defaultLabel,
                width: 150,
                align: 'left',
                editable: true
            };
            updateConfig({
                lineFields: [...lineFields, newField]
            });
        }
    };

    const updateLineConstraints = (updates: Partial<typeof config.lineConstraints>) => {
        updateConfig({
            lineConstraints: {
                minRows: 2,
                maxRows: 100,
                requireBalancedLines: true,
                ...config.lineConstraints,
                ...updates
            }
        });
    };

    return (
        <div className="space-y-8 p-4">
            <div className="border-b pb-4 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {t.journalConfiguration || 'Journal Configuration'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t.journalConfigDesc || 'Configure the line items table and validation rules.'}
                </p>
            </div>

            {/* Table Columns */}
            <section>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    {t.tableColumns || 'Table Columns'}
                </h3>
                <div className="flex flex-wrap gap-2 mb-6">
                    {AVAILABLE_LINE_FIELDS.map(field => {
                        const isSelected = activeLineFieldIds.has(field.id);
                        return (
                            <button
                                key={field.id}
                                onClick={() => toggleLineField(field)}
                                className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                                    isSelected
                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                {isSelected && (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {field.defaultLabel.en}
                            </button>
                        );
                    })}
                </div>

                {/* Column Configuration */}
                {lineFields.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-800 dark:text-gray-400">
                                <tr>
                                    <th className="px-4 py-3">{t.column || 'Column'}</th>
                                    <th className="px-4 py-3 text-center">{t.width || 'Width'}</th>
                                    <th className="px-4 py-3 text-center">{t.required || 'Required'}</th>
                                    <th className="px-4 py-3 text-center">{t.editable || 'Editable'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineFields.map((field, index) => (
                                    <tr key={field.id} className="border-b dark:border-gray-700 bg-white dark:bg-gray-800">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                            {field.label?.en || field.id}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="number"
                                                value={field.width || 150}
                                                onChange={(e) => {
                                                    const newFields = [...lineFields];
                                                    newFields[index] = { ...field, width: parseInt(e.target.value) };
                                                    updateConfig({ lineFields: newFields });
                                                }}
                                                className="w-20 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={field.required}
                                                onChange={(e) => {
                                                    const newFields = [...lineFields];
                                                    newFields[index] = { ...field, required: e.target.checked };
                                                    updateConfig({ lineFields: newFields });
                                                }}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={field.editable !== false}
                                                onChange={(e) => {
                                                    const newFields = [...lineFields];
                                                    newFields[index] = { ...field, editable: e.target.checked };
                                                    updateConfig({ lineFields: newFields });
                                                }}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Validation Rules */}
            <section className="pt-6 border-t dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    {t.validationRules || 'Validation Rules'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.lineConstraints?.requireBalancedLines ?? true}
                            onChange={(e) => updateLineConstraints({ requireBalancedLines: e.target.checked })}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {t.requireBalancedLines || 'Require Balanced Lines'}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Total Debits must equal Total Credits
                            </p>
                        </div>
                    </label>

                    <div className="flex items-center gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                                {t.minRows || 'Min Rows'}
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={config.lineConstraints?.minRows || 2}
                                onChange={(e) => updateLineConstraints({ minRows: parseInt(e.target.value) })}
                                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                                {t.maxRows || 'Max Rows'}
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={config.lineConstraints?.maxRows || 100}
                                onChange={(e) => updateLineConstraints({ maxRows: parseInt(e.target.value) })}
                                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Step4Journal;
