"use strict";
/**
 * PermissionCatalog.ts
 *
 * The Single Source of Truth for all system permissions.
 * This file is version-controlled and immutable at runtime.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPermissions = exports.PERMISSION_CATALOG = void 0;
exports.PERMISSION_CATALOG = [
    {
        moduleId: 'accounting',
        permissions: [
            // General
            { id: 'accounting.view', label: 'View Accounting Dashboard' },
            // Charts of Accounts
            { id: 'accounting.accounts.view', label: 'View Chart of Accounts' },
            { id: 'accounting.accounts.manage', label: 'Manage Chart of Accounts' },
            // Vouchers (General)
            { id: 'accounting.vouchers.view', label: 'View Vouchers' },
            { id: 'accounting.vouchers.create', label: 'Create Vouchers' },
            { id: 'accounting.vouchers.edit', label: 'Edit Draft Vouchers' },
            { id: 'accounting.vouchers.delete', label: 'Delete Draft Vouchers' },
            { id: 'accounting.vouchers.post', label: 'Post Vouchers' },
            // Approval Workflow
            { id: 'accounting.approve.finance', label: 'Financial Approval' },
            // Custody Workflow
            { id: 'accounting.custodian.view', label: 'View Custody Requests' },
            { id: 'accounting.custodian.verify', label: 'Confirm Custody' },
            // Design & Configuration
            { id: 'accounting.designer.view', label: 'View Voucher Designs' },
            { id: 'accounting.designer.create', label: 'Create Voucher Designs' },
            { id: 'accounting.designer.modify', label: 'Modify Voucher Designs' },
            { id: 'accounting.designer.delete', label: 'Delete Voucher Designs' },
            // Reporting
            { id: 'accounting.reports.view', label: 'View Financial Reports' },
        ]
    },
    {
        moduleId: 'inventory',
        permissions: [
            { id: 'inventory.view', label: 'View Inventory Dashboard' },
            { id: 'inventory.items.view', label: 'View Items' },
            { id: 'inventory.items.manage', label: 'Manage Items' },
            { id: 'inventory.stock.adjust', label: 'Adjust Stock' },
        ]
    },
    {
        moduleId: 'hr',
        permissions: [
            { id: 'hr.view', label: 'View HR Dashboard' },
            { id: 'hr.employees.view', label: 'View Employees' },
            { id: 'hr.employees.manage', label: 'Manage Employees' },
        ]
    },
    {
        moduleId: 'system',
        permissions: [
            { id: 'system.users.manage', label: 'Manage Users' },
            { id: 'system.roles.manage', label: 'Manage Roles' },
            { id: 'system.settings.manage', label: 'Manage Company Settings' },
        ]
    }
];
const getAllPermissions = () => {
    return exports.PERMISSION_CATALOG.flatMap(m => m.permissions.map(p => p.id));
};
exports.getAllPermissions = getAllPermissions;
//# sourceMappingURL=PermissionCatalog.js.map