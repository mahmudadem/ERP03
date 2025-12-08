import React, { useEffect } from 'react';
import { VoucherTypeConfig, Translation, ActionComponentsConfig } from '../../../types';

interface Props {
    config: VoucherTypeConfig;
    updateConfig: (updates: Partial<VoucherTypeConfig>) => void;
    t: Translation;
}

const Step6Actions: React.FC<Props> = ({ config, updateConfig, t }) => {
    
    useEffect(() => {
        if (!config.actions) {
            updateConfig({
                actions: {
                    submit: { enabled: true, behavior: 'save' },
                    cancel: { enabled: true },
                    approve: { enabled: false, requiresComment: false, notifyCreator: true },
                    reject: { enabled: false, requiresComment: true, notifyCreator: true },
                    print: { enabled: true, template: 'default', orientation: 'portrait' },
                    email: { enabled: false, defaultRecipients: [], includeAttachments: true, templateId: 'default' },
                    download: { enabled: true, format: 'Both' },
                    import: { enabled: false, acceptedFormats: ['Excel', 'CSV'] },
                    export: { enabled: true, format: ['Excel', 'CSV'] },
                    custom: []
                }
            });
        }
    }, [config.actions]);

    if (!config.actions) return null;

    const actions = config.actions;
    const updateActions = (updates: Partial<ActionComponentsConfig>) => {
        updateConfig({ actions: { ...actions, ...updates } });
    };

    const toggleAction = (key: keyof ActionComponentsConfig, enabled: boolean) => {
        const actionConfig = actions[key] as any;
        updateActions({
            [key]: { ...actionConfig, enabled }
        });
    };

    return (
        <div className="space-y-8 p-4">
            <div className="border-b pb-4 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {t.actionComponents || 'Action Components'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t.actionComponentsDesc || 'Configure which actions are available for this voucher type.'}
                </p>
            </div>

            {/* Standard Actions */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">
                    {t.standardActions || 'Standard Actions'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Submit */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="flex items-center justify-between cursor-pointer mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">{t.submit || 'Submit/Save'}</span>
                            <input
                                type="checkbox"
                                checked={actions.submit.enabled}
                                onChange={(e) => toggleAction('submit', e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        {actions.submit.enabled && (
                            <select
                                value={actions.submit.behavior}
                                onChange={(e) => updateActions({ submit: { ...actions.submit, behavior: e.target.value } })}
                                className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            >
                                <option value="save">Save Only</option>
                                <option value="saveAndClose">Save & Close</option>
                                <option value="saveAndApprove">Save & Approve</option>
                            </select>
                        )}
                    </div>

                    {/* Cancel */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="font-medium text-gray-900 dark:text-white">{t.cancel || 'Cancel'}</span>
                            <input
                                type="checkbox"
                                checked={actions.cancel.enabled}
                                onChange={(e) => toggleAction('cancel', e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                    </div>
                </div>
            </section>

            {/* Approval Actions */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">
                    {t.approvalActions || 'Approval Actions'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Approve */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="flex items-center justify-between cursor-pointer mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">{t.approve || 'Approve'}</span>
                            <input
                                type="checkbox"
                                checked={actions.approve.enabled}
                                onChange={(e) => toggleAction('approve', e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        {actions.approve.enabled && (
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={actions.approve.requiresComment}
                                        onChange={(e) => updateActions({ approve: { ...actions.approve, requiresComment: e.target.checked } })}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    {t.requiresComment || 'Requires Comment'}
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={actions.approve.notifyCreator}
                                        onChange={(e) => updateActions({ approve: { ...actions.approve, notifyCreator: e.target.checked } })}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    {t.notifyCreator || 'Notify Creator'}
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Reject */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="flex items-center justify-between cursor-pointer mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">{t.reject || 'Reject'}</span>
                            <input
                                type="checkbox"
                                checked={actions.reject.enabled}
                                onChange={(e) => toggleAction('reject', e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        {actions.reject.enabled && (
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={actions.reject.requiresComment}
                                        onChange={(e) => updateActions({ reject: { ...actions.reject, requiresComment: e.target.checked } })}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    {t.requiresComment || 'Requires Comment'}
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={actions.reject.notifyCreator}
                                        onChange={(e) => updateActions({ reject: { ...actions.reject, notifyCreator: e.target.checked } })}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    {t.notifyCreator || 'Notify Creator'}
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Output Actions */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">
                    {t.outputActions || 'Output Actions'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Print */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="flex items-center justify-between cursor-pointer mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">{t.print || 'Print'}</span>
                            <input
                                type="checkbox"
                                checked={actions.print.enabled}
                                onChange={(e) => toggleAction('print', e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        {actions.print.enabled && (
                            <select
                                value={actions.print.orientation}
                                onChange={(e) => updateActions({ print: { ...actions.print, orientation: e.target.value as any } })}
                                className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            >
                                <option value="portrait">Portrait</option>
                                <option value="landscape">Landscape</option>
                            </select>
                        )}
                    </div>

                    {/* Email */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="flex items-center justify-between cursor-pointer mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">{t.email || 'Email'}</span>
                            <input
                                type="checkbox"
                                checked={actions.email.enabled}
                                onChange={(e) => toggleAction('email', e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                    </div>

                    {/* Download */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="flex items-center justify-between cursor-pointer mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">{t.download || 'Download'}</span>
                            <input
                                type="checkbox"
                                checked={actions.download.enabled}
                                onChange={(e) => toggleAction('download', e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        {actions.download.enabled && (
                            <select
                                value={actions.download.format}
                                onChange={(e) => updateActions({ download: { ...actions.download, format: e.target.value as any } })}
                                className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            >
                                <option value="PDF">PDF</option>
                                <option value="Excel">Excel</option>
                                <option value="Both">Both</option>
                            </select>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Step6Actions;
