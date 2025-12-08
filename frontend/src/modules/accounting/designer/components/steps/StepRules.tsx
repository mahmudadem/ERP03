import React, { useEffect } from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
}

const ROLES = [
    { value: 'User', label: 'User' },
    { value: 'Accountant', label: 'Accountant' },
    { value: 'Manager', label: 'Manager' },
    { value: 'Admin', label: 'Admin' },
    { value: 'Owner', label: 'Owner' },
    { value: 'SuperAdmin', label: 'Super Admin' }
];

export const StepRules: React.FC<Props> = ({ definition, updateDefinition }) => {
  const workflow = definition.workflow || {};
  const metadata = definition.metadata || {};

  // Initialize rules if missing
  useEffect(() => {
    if (!definition.workflow) {
        updateDefinition({
            workflow: {
                approvalRequired: false,
                approvalLevels: 1,
                approvers: [],
                permissions: {
                    create: ['Accountant', 'Manager', 'Admin', 'Owner'],
                    edit: ['Accountant', 'Manager', 'Admin', 'Owner'],
                    approve: ['Manager', 'Admin', 'Owner'],
                    delete: ['Admin', 'Owner']
                }
            },
            metadata: {
                ...metadata,
                autoNumbering: true,
                numberingFormat: `${definition.code || 'JE'}-YYYY-####`,
                enforcePeriodLock: true,
                allowBackdating: false
            }
        });
    }
  }, [definition.workflow]);

  const updateWorkflow = (updates: any) => {
    updateDefinition({ workflow: { ...workflow, ...updates } });
  };

  const updateMetadata = (updates: any) => {
    updateDefinition({ metadata: { ...metadata, ...updates } });
  };

  const handleRoleToggle = (
    action: 'create' | 'edit' | 'approve' | 'delete',
    role: string
  ) => {
    const currentRoles = workflow.permissions?.[action] || [];
    const newRoles = currentRoles.includes(role)
        ? currentRoles.filter(r => r !== role)
        : [...currentRoles, role];
    
    updateWorkflow({
        permissions: {
            ...workflow.permissions,
            [action]: newRoles
        }
    });
  };

  return (
    <div className="space-y-8 p-4">
        <div className="border-b pb-4 border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
                Rules & Approval
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                Configure business rules, numbering, and permissions.
            </p>
        </div>

        {/* Numbering */}
        <section className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 border-gray-200">
                Numbering
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={metadata.autoNumbering}
                        onChange={(e) => updateMetadata({ autoNumbering: e.target.checked })}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                        Auto Numbering
                    </span>
                </label>

                {metadata.autoNumbering && (
                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                            Numbering Format
                        </label>
                        <input
                            type="text"
                            value={metadata.numberingFormat}
                            onChange={(e) => updateMetadata({ numberingFormat: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
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
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 border-gray-200">
                Approval Workflow
            </h3>
            
            <label className="flex items-center gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={workflow.approvalRequired}
                    onChange={(e) => updateWorkflow({ approvalRequired: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-900">
                    Requires Approval
                </span>
            </label>

            {workflow.approvalRequired && (
                <div className="pl-8 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                            Approval Levels
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={workflow.approvalLevels || 1}
                            onChange={(e) => updateWorkflow({ approvalLevels: parseInt(e.target.value) || 1 })}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                        />
                    </div>
                </div>
            )}
        </section>

        {/* Period Control */}
        <section className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 border-gray-200">
                Period Control
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={metadata.enforcePeriodLock}
                        onChange={(e) => updateMetadata({ enforcePeriodLock: e.target.checked })}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                        Enforce Period Lock
                    </span>
                </label>

                <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={metadata.allowBackdating}
                            onChange={(e) => updateMetadata({ allowBackdating: e.target.checked })}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-900">
                            Allow Backdating
                        </span>
                    </label>
                    
                    {metadata.allowBackdating && (
                        <div className="pl-8">
                            <label className="block text-sm font-medium mb-1 text-gray-700">
                                Max Days
                            </label>
                            <input
                                type="number"
                                value={metadata.backdateMaxDays || 0}
                                onChange={(e) => updateMetadata({ backdateMaxDays: parseInt(e.target.value) })}
                                className="w-24 px-3 py-1 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                            />
                        </div>
                    )}
                </div>
            </div>
        </section>

        {/* Permissions */}
        <section className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 border-gray-200">
                Permissions
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3 text-center">Create</th>
                            <th className="px-4 py-3 text-center">Edit</th>
                            <th className="px-4 py-3 text-center">Approve</th>
                            <th className="px-4 py-3 text-center">Delete</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ROLES.map((role) => (
                            <tr key={role.value} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">
                                    {role.label}
                                </td>
                                {(['create', 'edit', 'approve', 'delete'] as const).map(action => (
                                    <td key={action} className="px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={workflow.permissions?.[action]?.includes(role.value) || false}
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
