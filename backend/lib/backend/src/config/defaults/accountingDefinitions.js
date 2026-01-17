"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingModulePermissionsDefinition = exports.accountingModuleSettingsDefinition = void 0;
exports.accountingModuleSettingsDefinition = {
    moduleId: 'accounting',
    createdBy: 'system',
    updatedAt: new Date(),
    permissionsDefined: true,
    autoAttachToRoles: [],
    fields: [
        { id: 'baseCurrency', type: 'select', label: 'Base Currency', required: true, optionsSource: 'currencies' },
        { id: 'fiscalYearStart', type: 'date', label: 'Fiscal Year Start', required: true },
        { id: 'autoNumbering', type: 'boolean', label: 'Enable Auto Numbering', default: true },
        { id: 'strictApprovalMode', type: 'boolean', label: 'Strict Approval Mode', default: true },
        { id: 'defaultCashAccount', type: 'select', label: 'Default Cash Account', optionsSource: 'accounts' },
        { id: 'defaultBankAccount', type: 'select', label: 'Default Bank Account', optionsSource: 'accounts' },
        { id: 'defaultTaxAccount', type: 'select', label: 'Default Tax Account', optionsSource: 'accounts' },
    ],
};
exports.accountingModulePermissionsDefinition = {
    moduleId: 'accounting',
    permissionsDefined: true,
    permissions: [
        // Voucher permissions (matching routes)
        { id: 'accounting.vouchers.create', label: 'Create Vouchers', enabled: true },
        { id: 'accounting.vouchers.edit', label: 'Edit Vouchers', enabled: true },
        { id: 'accounting.vouchers.view', label: 'View Vouchers', enabled: true },
        { id: 'accounting.vouchers.delete', label: 'Delete Vouchers', enabled: true },
        { id: 'accounting.vouchers.approve', label: 'Approve Vouchers', enabled: true },
        { id: 'accounting.vouchers.post', label: 'Post Vouchers', enabled: true },
        { id: 'accounting.vouchers.lock', label: 'Lock Vouchers', enabled: true },
        { id: 'accounting.vouchers.cancel', label: 'Cancel Vouchers', enabled: true },
        { id: 'accounting.vouchers.correct', label: 'Correct Vouchers', enabled: true },
        // Accounts permissions
        { id: 'accounting.accounts.view', label: 'View Chart of Accounts', enabled: true },
        { id: 'accounting.accounts.create', label: 'Create Accounts', enabled: true },
        { id: 'accounting.accounts.edit', label: 'Edit Accounts', enabled: true },
        { id: 'accounting.accounts.delete', label: 'Delete Accounts', enabled: true },
        // Reports permissions
        { id: 'accounting.reports.trialBalance.view', label: 'View Trial Balance', enabled: true },
        { id: 'accounting.reports.profitAndLoss.view', label: 'View Profit & Loss', enabled: true },
        { id: 'accounting.reports.generalLedger.view', label: 'View General Ledger', enabled: true },
        // Designer permissions
        { id: 'accounting.designer.view', label: 'View Designer', enabled: true },
        { id: 'accounting.designer.create', label: 'Create Voucher Types', enabled: true },
        { id: 'accounting.designer.modify', label: 'Modify Voucher Types', enabled: true },
        // Settings permissions
        { id: 'accounting.settings', label: 'Manage Accounting Settings', enabled: true },
        { id: 'accounting.settings.view', label: 'View Accounting Settings', enabled: true },
        { id: 'accounting.settings.read', label: 'Read Accounting Settings', enabled: true },
        { id: 'accounting.settings.write', label: 'Write Accounting Settings', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin', 'accountant'],
    createdAt: new Date(),
    updatedAt: new Date(),
};
//# sourceMappingURL=accountingDefinitions.js.map