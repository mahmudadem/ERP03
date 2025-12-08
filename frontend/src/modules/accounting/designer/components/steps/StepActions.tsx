import React, { useEffect } from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
}

export const StepActions: React.FC<Props> = ({ definition, updateDefinition }) => {
  const actions = definition.actions || {};

  useEffect(() => {
    if (!definition.actions) {
        updateDefinition({
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
            } as any // Cast to any for now as types might differ slightly
        });
    }
  }, [definition.actions]);

  const updateActions = (updates: any) => {
    updateDefinition({ actions: { ...actions, ...updates } });
  };

  const toggleAction = (key: string, enabled: boolean) => {
    const actionConfig = (actions as any)[key] || {};
    updateActions({
        [key]: { ...actionConfig, enabled }
    });
  };

  if (!definition.actions) return null;

  return (
    <div className="space-y-8 p-4">
        <div className="border-b pb-4 border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
                Action Components
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                Configure which actions are available for this voucher type.
            </p>
        </div>

        {/* Standard Actions */}
        <section className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 border-gray-200">
                Standard Actions
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Submit */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center justify-between cursor-pointer mb-2">
                        <span className="font-medium text-gray-900">Submit/Save</span>
                        <input
                            type="checkbox"
                            checked={actions.submit?.enabled}
                            onChange={(e) => toggleAction('submit', e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                    </label>
                    {actions.submit?.enabled && (
                        <select
                            value={actions.submit.behavior}
                            onChange={(e) => updateActions({ submit: { ...actions.submit, behavior: e.target.value } })}
                            className="w-full text-sm border-gray-300 rounded-lg bg-white"
                        >
                            <option value="save">Save Only</option>
                            <option value="saveAndClose">Save & Close</option>
                            <option value="saveAndApprove">Save & Approve</option>
                        </select>
                    )}
                </div>

                {/* Cancel */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="font-medium text-gray-900">Cancel</span>
                        <input
                            type="checkbox"
                            checked={actions.cancel?.enabled}
                            onChange={(e) => toggleAction('cancel', e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                    </label>
                </div>
            </div>
        </section>

        {/* Approval Actions */}
        <section className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 border-gray-200">
                Approval Actions
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Approve */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center justify-between cursor-pointer mb-2">
                        <span className="font-medium text-gray-900">Approve</span>
                        <input
                            type="checkbox"
                            checked={actions.approve?.enabled}
                            onChange={(e) => toggleAction('approve', e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                    </label>
                    {actions.approve?.enabled && (
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={actions.approve.requiresComment}
                                    onChange={(e) => updateActions({ approve: { ...actions.approve, requiresComment: e.target.checked } })}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                Requires Comment
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={actions.approve.notifyCreator}
                                    onChange={(e) => updateActions({ approve: { ...actions.approve, notifyCreator: e.target.checked } })}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                Notify Creator
                            </label>
                        </div>
                    )}
                </div>

                {/* Reject */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center justify-between cursor-pointer mb-2">
                        <span className="font-medium text-gray-900">Reject</span>
                        <input
                            type="checkbox"
                            checked={actions.reject?.enabled}
                            onChange={(e) => toggleAction('reject', e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                    </label>
                    {actions.reject?.enabled && (
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={actions.reject.requiresComment}
                                    onChange={(e) => updateActions({ reject: { ...actions.reject, requiresComment: e.target.checked } })}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                Requires Comment
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={actions.reject.notifyCreator}
                                    onChange={(e) => updateActions({ reject: { ...actions.reject, notifyCreator: e.target.checked } })}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                Notify Creator
                            </label>
                        </div>
                    )}
                </div>
            </div>
        </section>

        {/* Output Actions */}
        <section className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 border-gray-200">
                Output Actions
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Print */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center justify-between cursor-pointer mb-2">
                        <span className="font-medium text-gray-900">Print</span>
                        <input
                            type="checkbox"
                            checked={actions.print?.enabled}
                            onChange={(e) => toggleAction('print', e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                    </label>
                    {actions.print?.enabled && (
                        <select
                            value={actions.print.orientation}
                            onChange={(e) => updateActions({ print: { ...actions.print, orientation: e.target.value } })}
                            className="w-full text-sm border-gray-300 rounded-lg bg-white"
                        >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                        </select>
                    )}
                </div>

                {/* Email */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center justify-between cursor-pointer mb-2">
                        <span className="font-medium text-gray-900">Email</span>
                        <input
                            type="checkbox"
                            checked={actions.email?.enabled}
                            onChange={(e) => toggleAction('email', e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                    </label>
                </div>

                {/* Download */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center justify-between cursor-pointer mb-2">
                        <span className="font-medium text-gray-900">Download</span>
                        <input
                            type="checkbox"
                            checked={actions.download?.enabled}
                            onChange={(e) => toggleAction('download', e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                    </label>
                    {actions.download?.enabled && (
                        <select
                            value={actions.download.format}
                            onChange={(e) => updateActions({ download: { ...actions.download, format: e.target.value } })}
                            className="w-full text-sm border-gray-300 rounded-lg bg-white"
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
