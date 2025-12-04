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
            { id: 'accounting.view', label: 'View Accounting Dashboard' },
            { id: 'accounting.accounts.view', label: 'View Chart of Accounts' },
            { id: 'accounting.accounts.manage', label: 'Manage Chart of Accounts' },
            { id: 'accounting.vouchers.view', label: 'View Vouchers' },
            { id: 'accounting.vouchers.create', label: 'Create Vouchers' },
            { id: 'accounting.vouchers.approve', label: 'Approve Vouchers' },
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