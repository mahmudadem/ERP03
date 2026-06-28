/**
 * seedRoleTemplates.ts — SQL seeder for system_role_templates table [275a]
 *
 * Source data derived from ROLE_TEMPLATES in seedOnboardingData.ts.
 * Idempotent: upserts by stable `code` key.
 *
 * Note: these are SYSTEM templates. Per-company roles (CompanyRole) are created
 * at company-creation time by the wizard, not seeded here.
 */

import { PrismaClient } from '@prisma/client';

// Flat list of all permission codes (mirrors PERMISSION_DATA in seedPermissionRegistry.ts)
const ALL_PERMISSIONS = [
  'accounting.accounts.view', 'accounting.accounts.create', 'accounting.accounts.edit', 'accounting.accounts.delete',
  'accounting.vouchers.view', 'accounting.vouchers.create', 'accounting.vouchers.edit', 'accounting.vouchers.delete',
  'accounting.vouchers.approve', 'accounting.vouchers.post', 'accounting.vouchers.lock', 'accounting.vouchers.cancel',
  'accounting.vouchers.correct', 'accounting.reports.profitAndLoss.view', 'accounting.reports.trialBalance.view',
  'accounting.reports.generalLedger.view', 'accounting.designer.view', 'accounting.designer.create',
  'accounting.designer.modify', 'accounting.settings', 'accounting.settings.view', 'accounting.settings.read',
  'accounting.settings.write', 'accounting.settings.manage',
  'inventory.items.view', 'inventory.items.create', 'inventory.items.manage', 'inventory.warehouses.view',
  'inventory.warehouses.create', 'inventory.stock.view', 'inventory.settings',
  'item.list', 'warehouse.list', 'stockMovement.list',
  'employee.list', 'attendance.list', 'payroll.list',
  'crm.leads.view', 'crm.customers.view',
  'pos.terminal.access', 'pos.sessions.view',
  'manufacturing.workOrders.view', 'manufacturing.bom.view',
  'projects.view', 'projects.tasks.view',
  'vendor.list',
  'manage_settings', 'view_audit_logs', 'manage_users', 'manage_roles',
  'system.roles.manage', 'system.company.settings.manage', 'system.users.manage', 'system.audit.view',
  'ai-assistant.chat.use', 'ai-assistant.chat.view', 'ai-assistant.settings.view', 'ai-assistant.settings.manage',
  'ai-assistant.settings.health', 'ai-assistant.tools.view', 'ai-assistant.tools.manage', 'ai-assistant.usage.view',
  'ai-assistant.health.test', 'ai-assistant.model-policy.view', 'ai-assistant.model-policy.manage',
  'ai-assistant.tools.accounting.trial-balance', 'ai-assistant.proposals.view', 'ai-assistant.proposals.create',
  'ai-assistant.proposals.review', 'ai-assistant.proposals.manage', 'ai-assistant.proposals.archive',
];

const ACCOUNTING_PERMISSIONS = [
  'accounting.accounts.view', 'accounting.accounts.create', 'accounting.accounts.edit', 'accounting.accounts.delete',
  'accounting.vouchers.view', 'accounting.vouchers.create', 'accounting.vouchers.edit', 'accounting.vouchers.delete',
  'accounting.vouchers.approve', 'accounting.vouchers.post', 'accounting.vouchers.lock', 'accounting.vouchers.cancel',
  'accounting.vouchers.correct', 'accounting.reports.profitAndLoss.view', 'accounting.reports.trialBalance.view',
  'accounting.reports.generalLedger.view', 'accounting.designer.view', 'accounting.designer.create',
  'accounting.designer.modify', 'accounting.settings', 'accounting.settings.view', 'accounting.settings.read',
  'accounting.settings.write', 'accounting.settings.manage',
];

const INVENTORY_PERMISSIONS = [
  'inventory.items.view', 'inventory.items.create', 'inventory.items.manage', 'inventory.warehouses.view',
  'inventory.warehouses.create', 'inventory.stock.view', 'inventory.settings',
  'item.list', 'warehouse.list', 'stockMovement.list',
];

const ROLE_TEMPLATE_DATA = [
  {
    code: 'owner',
    name: 'Owner',
    description: 'Company owner with full system access',
    permissions: ALL_PERMISSIONS,
  },
  {
    code: 'admin',
    name: 'Administrator',
    description: 'Full access to all features',
    permissions: ALL_PERMISSIONS,
  },
  {
    code: 'financial_manager',
    name: 'Financial Manager',
    description: 'Full access to Accounting module and reports',
    permissions: [...ACCOUNTING_PERMISSIONS, 'system.company.settings.manage'],
  },
  {
    code: 'accountant',
    name: 'Accountant',
    description: 'General accounting access',
    permissions: [
      'accounting.vouchers.view', 'accounting.vouchers.create', 'accounting.vouchers.edit',
      'accounting.accounts.view', 'accounting.reports.trialBalance.view',
      'accounting.reports.profitAndLoss.view', 'accounting.reports.generalLedger.view',
    ],
  },
  {
    code: 'inventory_manager',
    name: 'Inventory Manager',
    description: 'Manage inventory and stock',
    permissions: INVENTORY_PERMISSIONS,
  },
  {
    code: 'member',
    name: 'Member',
    description: 'Basic access',
    permissions: ['accounting.vouchers.view', 'inventory.items.view'],
  },
];

export async function seedRoleTemplates(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding system_role_templates...');
  for (const template of ROLE_TEMPLATE_DATA) {
    await prisma.systemRoleTemplate.upsert({
      where: { code: template.code },
      create: {
        code: template.code,
        name: template.name,
        description: template.description,
        permissions: template.permissions,
      },
      update: {
        name: template.name,
        description: template.description,
        permissions: template.permissions,
      },
    });
  }
  console.log(`  ✓ ${ROLE_TEMPLATE_DATA.length} system role templates upserted`);
}
