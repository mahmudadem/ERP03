import React, { useEffect } from 'react';
import { VoucherTypeConfig, Translation, CompanyRole, ApprovalLevel } from '../../../types';

interface Props {
    config: VoucherTypeConfig;
    updateConfig: (updates: Partial<VoucherTypeConfig>) => void;
    t: Translation;
}

const ROLES: { value: CompanyRole; label: string }[] = [
    { value: 'User', label: 'User' },
    { value: 'Accountant', label: 'Accountant' },
    { value: 'Manager', label: 'Manager' },
    { value: 'Admin', label: 'Admin' },
    { value: 'Owner', label: 'Owner' },
    { value: 'SuperAdmin', label: 'Super Admin' }
];

const Step2Rules: React.FC<Props> = ({ config, updateConfig, t }) => {
    
    // Initialize rules if missing
    useEffect(() => {
        if (!config.rules) {
            updateConfig({
                rules: {
                    requiresApproval: false,
                    approvalLevels: 1,
                    approvers: [],
                    autoNumbering: true,
                    numberingFormat: `${config.abbreviation || 'JE'}-YYYY-####`,
                    enforcePeriodLock: true,
                    allowBackdating: false,
                    permissions: {
                        create: ['Accountant', 'Manager', 'Admin', 'Owner'],
                        edit: ['Accountant', 'Manager', 'Admin', 'Owner'],
                        approve: ['Manager', 'Admin', 'Owner'],
                        delete: ['Admin', 'Owner']
                    }
                }
            });
        }
    }, [config.rules]);

    if (!config.rules) return null;

    const rules = config.rules;

    const updateRules = (updates: Partial<typeof rules>) => {
        updateConfig({
            rules: { ...rules, ...updates }
        });
    };

    const handleRoleToggle = (
        action: 'create' | 'edit' | 'approve' | 'delete',
        role: CompanyRole
    ) => {
        const currentRoles = rules.permissions[action];
        const newRoles = currentRoles.includes(role)
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];
        
        updateRules({
            permissions: {
                ...rules.permissions,
                [action]: newRoles
            }
        });
    };

    return (
        <div className="space-y-8 p-4">
            <div className="border-b pb-4 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {t.rulesAndApproval || 'Rules & Approval'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t.rulesDesc || 'Configure business rules, numbering, and permissions.'}
                </p>
            </div>

            {/* Numbering */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">
                    {t.numbering || 'Numbering'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={rules.autoNumbering}
                            onChange={(e) => updateRules({ autoNumbering: e.target.checked })}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {t.autoNumbering || 'Auto Numbering'}
                        </span>
                    </label>

                    {rules.autoNumbering && (
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                {t.numberingFormat || 'Numbering Format'}
                            </label>
                            <input
                                type="text"
                                value={rules.numberingFormat}
                                onChange={(e) => updateRules({ numberingFormat: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="e.g. JE-YYYY-####"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Use 'YYYY' for year, '####' for sequence.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Approval Workflow */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">
                    {t.approvalWorkflow || 'Approval Workflow'}
                </h3>
                
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={rules.requiresApproval}
                        onChange={(e) => updateRules({ requiresApproval: e.target.checked })}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {t.requiresApproval || 'Requires Approval'}
                    </span>
                </label>

                {rules.requiresApproval && (
                    <div className="pl-8 space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                {t.approvalLevels || 'Approval Levels'}
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={5}
                                value={rules.approvalLevels}
                                onChange={(e) => updateRules({ approvalLevels: parseInt(e.target.value) || 1 })}
                                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                )}
            </section>

            {/* Period Control */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">
                    {t.periodControl || 'Period Control'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={rules.enforcePeriodLock}
                            onChange={(e) => updateRules({ enforcePeriodLock: e.target.checked })}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {t.enforcePeriodLock || 'Enforce Period Lock'}
                        </span>
                    </label>

                    <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={rules.allowBackdating}
                                onChange={(e) => updateRules({ allowBackdating: e.target.checked })}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {t.allowBackdating || 'Allow Backdating'}
                            </span>
                        </label>
                        
                        {rules.allowBackdating && (
                            <div className="pl-8">
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                                    {t.maxBackdateDays || 'Max Days'}
                                </label>
                                <input
                                    type="number"
                                    value={rules.backdateMaxDays || 0}
                                    onChange={(e) => updateRules({ backdateMaxDays: parseInt(e.target.value) })}
                                    className="w-24 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Permissions */}
            <section className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">
                    {t.permissions || 'Permissions'}
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3">{t.role || 'Role'}</th>
                                <th className="px-4 py-3 text-center">{t.create || 'Create'}</th>
                                <th className="px-4 py-3 text-center">{t.edit || 'Edit'}</th>
                                <th className="px-4 py-3 text-center">{t.approve || 'Approve'}</th>
                                <th className="px-4 py-3 text-center">{t.delete || 'Delete'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ROLES.map((role) => (
                                <tr key={role.value} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                        {role.label}
                                    </td>
                                    {(['create', 'edit', 'approve', 'delete'] as const).map(action => (
                                        <td key={action} className="px-4 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={rules.permissions[action].includes(role.value)}
                                                onChange={() => handleRoleToggle(action, role.value)}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default Step2Rules;
