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
            { id: 'accounting.accounts.create', label: 'Create Accounts' },
            { id: 'accounting.accounts.edit', label: 'Edit Accounts' },
            { id: 'accounting.accounts.delete', label: 'Delete Accounts' },
            { id: 'accounting.accounts.manage', label: 'Manage Chart of Accounts' },
            // Vouchers (General)
            { id: 'accounting.vouchers.view', label: 'View Vouchers' },
            { id: 'accounting.vouchers.create', label: 'Create Vouchers' },
            { id: 'accounting.vouchers.edit', label: 'Edit Draft Vouchers' },
            { id: 'accounting.vouchers.delete', label: 'Delete Draft Vouchers' },
            { id: 'accounting.vouchers.post', label: 'Post Vouchers' },
            { id: 'accounting.vouchers.approve', label: 'Approve/Reject Vouchers' },
            { id: 'accounting.vouchers.cancel', label: 'Cancel Vouchers' },
            { id: 'accounting.vouchers.correct', label: 'Correct/Reverse Vouchers' },
            { id: 'accounting.vouchers.lock', label: 'Lock Vouchers' },
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
            { id: 'accounting.reports.profitAndLoss.view', label: 'View Profit & Loss' },
            { id: 'accounting.reports.tradingAccount.view', label: 'View Trading Account' },
            { id: 'accounting.reports.trialBalance.view', label: 'View Trial Balance' },
            { id: 'accounting.reports.balanceSheet.view', label: 'View Balance Sheet' },
            { id: 'accounting.reports.cashFlow.view', label: 'View Cash Flow Statement' },
            { id: 'accounting.reports.generalLedger.view', label: 'View General Ledger' },
            // Settings
            { id: 'accounting.settings.read', label: 'View Accounting Settings' },
            { id: 'accounting.settings.write', label: 'Modify Accounting Settings' },
        ]
    },
    {
        moduleId: 'inventory',
        permissions: [
            { id: 'inventory.view', label: 'View Inventory Dashboard' },
            { id: 'inventory.settings.view', label: 'View Inventory Settings' },
            { id: 'inventory.settings.manage', label: 'Manage Inventory Settings' },
            { id: 'inventory.items.view', label: 'View Items' },
            { id: 'inventory.items.manage', label: 'Manage Items' },
            { id: 'inventory.categories.view', label: 'View Categories' },
            { id: 'inventory.categories.manage', label: 'Manage Categories' },
            { id: 'inventory.warehouses.view', label: 'View Warehouses' },
            { id: 'inventory.warehouses.manage', label: 'Manage Warehouses' },
            { id: 'inventory.uom.view', label: 'View UoM Conversions' },
            { id: 'inventory.uom.manage', label: 'Manage UoM Conversions' },
            { id: 'inventory.stock.view', label: 'View Stock Levels' },
            { id: 'inventory.stock.adjust', label: 'Adjust Stock' },
            { id: 'inventory.movements.view', label: 'View Stock Movements' },
            { id: 'inventory.movements.record', label: 'Record Stock Movements' },
            { id: 'inventory.valuation.view', label: 'View Inventory Valuation' },
            { id: 'inventory.reconcile.run', label: 'Run Inventory Reconciliation' },
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
            { id: 'system.company.manage', label: 'Manage Company' },
        ]
    }
];
const getAllPermissions = () => {
    return exports.PERMISSION_CATALOG.flatMap(m => m.permissions.map(p => p.id));
};
exports.getAllPermissions = getAllPermissions;
//# sourceMappingURL=PermissionCatalog.js.map