/**
 * PermissionCatalog.ts
 * 
 * The Single Source of Truth for all system permissions.
 * This file is version-controlled and immutable at runtime.
 */

export interface PermissionDefinition {
    id: string;
    label: string;
    description?: string;
}

export interface ModulePermissionCatalog {
    moduleId: string;
    permissions: PermissionDefinition[];
}

export const PERMISSION_CATALOG: ModulePermissionCatalog[] = [
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

export const getAllPermissions = (): string[] => {
    return PERMISSION_CATALOG.flatMap(m => m.permissions.map(p => p.id));
};
