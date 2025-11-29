import { ModuleSettingsDefinition } from '../../domain/system/ModuleSettingsDefinition';
import { ModulePermissionsDefinition } from '../../domain/system/ModulePermissionsDefinition';

export const accountingModuleSettingsDefinition: ModuleSettingsDefinition = {
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

export const accountingModulePermissionsDefinition: ModulePermissionsDefinition = {
  moduleId: 'accounting',
  permissionsDefined: true,
  permissions: [
    { id: 'voucher.create', label: 'Create Vouchers', enabled: true },
    { id: 'voucher.update', label: 'Update Vouchers', enabled: true },
    { id: 'voucher.view', label: 'View Vouchers', enabled: true },
    { id: 'voucher.approve', label: 'Approve Vouchers', enabled: true },
    { id: 'voucher.lock', label: 'Lock Vouchers', enabled: true },
    { id: 'voucher.cancel', label: 'Cancel Vouchers', enabled: true },
    { id: 'coa.view', label: 'View Chart of Accounts', enabled: true },
    { id: 'coa.edit', label: 'Edit Chart of Accounts', enabled: true },
    { id: 'report.trialBalance', label: 'View Trial Balance', enabled: true },
    { id: 'report.generalLedger', label: 'View General Ledger', enabled: true },
    { id: 'report.journal', label: 'View Journal', enabled: true },
    { id: 'accounting.settings', label: 'Manage Accounting Settings', enabled: true },
  ],
  autoAttachToRoles: ['owner', 'admin', 'accountant'],
  createdAt: new Date(),
  updatedAt: new Date(),
};
