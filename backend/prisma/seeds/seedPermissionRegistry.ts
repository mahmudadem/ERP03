/**
 * seedPermissionRegistry.ts — SQL seeder for permission_registries table [275a]
 *
 * Source data derived from MODULE_DEFINITIONS in seedOnboardingData.ts.
 * Idempotent: upserts by stable `code` key.
 *
 * AI Assistant permissions are excluded for v1 because the AI module is out of
 * the Epic 275 SQL launch scope. Add them back only when AI is ported and seeded.
 */

import { PrismaClient } from '@prisma/client';

interface PermissionEntry {
  code: string;
  name: string;
  module: string;
}

const PERMISSION_DATA: PermissionEntry[] = [
  // accounting
  { code: 'accounting.accounts.view',                module: 'accounting', name: 'View Chart of Accounts' },
  { code: 'accounting.accounts.create',              module: 'accounting', name: 'Create Accounts' },
  { code: 'accounting.accounts.edit',                module: 'accounting', name: 'Edit Accounts' },
  { code: 'accounting.accounts.delete',              module: 'accounting', name: 'Delete Accounts' },
  { code: 'accounting.vouchers.view',                module: 'accounting', name: 'View Vouchers' },
  { code: 'accounting.vouchers.create',              module: 'accounting', name: 'Create Vouchers' },
  { code: 'accounting.vouchers.edit',                module: 'accounting', name: 'Edit Vouchers' },
  { code: 'accounting.vouchers.delete',              module: 'accounting', name: 'Delete Vouchers' },
  { code: 'accounting.vouchers.approve',             module: 'accounting', name: 'Approve Vouchers' },
  { code: 'accounting.vouchers.post',                module: 'accounting', name: 'Post Vouchers' },
  { code: 'accounting.vouchers.lock',                module: 'accounting', name: 'Lock Vouchers' },
  { code: 'accounting.vouchers.cancel',              module: 'accounting', name: 'Cancel Vouchers' },
  { code: 'accounting.vouchers.correct',             module: 'accounting', name: 'Correct Vouchers' },
  { code: 'accounting.reports.profitAndLoss.view',   module: 'accounting', name: 'View Profit & Loss' },
  { code: 'accounting.reports.trialBalance.view',    module: 'accounting', name: 'View Trial Balance' },
  { code: 'accounting.reports.generalLedger.view',   module: 'accounting', name: 'View General Ledger' },
  { code: 'accounting.designer.view',                module: 'accounting', name: 'View Designer' },
  { code: 'accounting.designer.create',              module: 'accounting', name: 'Create Voucher Types' },
  { code: 'accounting.designer.modify',              module: 'accounting', name: 'Modify Voucher Types' },
  { code: 'accounting.settings',                     module: 'accounting', name: 'Manage Accounting Settings' },
  { code: 'accounting.settings.view',                module: 'accounting', name: 'View Settings' },
  { code: 'accounting.settings.read',                module: 'accounting', name: 'Read Settings' },
  { code: 'accounting.settings.write',               module: 'accounting', name: 'Write Settings' },
  { code: 'accounting.settings.manage',              module: 'accounting', name: 'Full Settings Access' },
  // inventory
  { code: 'inventory.items.view',                    module: 'inventory', name: 'View Items' },
  { code: 'inventory.items.create',                  module: 'inventory', name: 'Create Items' },
  { code: 'inventory.items.manage',                  module: 'inventory', name: 'Manage Items' },
  { code: 'inventory.warehouses.view',               module: 'inventory', name: 'View Warehouses' },
  { code: 'inventory.warehouses.create',             module: 'inventory', name: 'Create Warehouses' },
  { code: 'inventory.stock.view',                    module: 'inventory', name: 'View Stock' },
  { code: 'inventory.settings',                      module: 'inventory', name: 'Inventory Settings' },
  { code: 'item.list',                               module: 'inventory', name: 'List Items (Legacy)' },
  { code: 'warehouse.list',                          module: 'inventory', name: 'List Warehouses (Legacy)' },
  { code: 'stockMovement.list',                      module: 'inventory', name: 'List Stock Movements (Legacy)' },
  // hr
  { code: 'employee.list',                           module: 'hr', name: 'View Employees' },
  { code: 'attendance.list',                         module: 'hr', name: 'View Attendance' },
  { code: 'payroll.list',                            module: 'hr', name: 'View Payroll' },
  // crm
  { code: 'crm.leads.view',                          module: 'crm', name: 'View Leads' },
  { code: 'crm.customers.view',                      module: 'crm', name: 'View Customers' },
  // pos
  { code: 'pos.terminal.access',                     module: 'pos', name: 'Access POS Terminal' },
  { code: 'pos.sessions.view',                       module: 'pos', name: 'View POS Sessions' },
  // manufacturing
  { code: 'manufacturing.workOrders.view',           module: 'manufacturing', name: 'View Work Orders' },
  { code: 'manufacturing.bom.view',                  module: 'manufacturing', name: 'View BoM' },
  // projects
  { code: 'projects.view',                           module: 'projects', name: 'View Projects' },
  { code: 'projects.tasks.view',                     module: 'projects', name: 'View Tasks' },
  // purchase
  { code: 'vendor.list',                             module: 'purchase', name: 'View Vendors' },
  // companyAdmin
  { code: 'manage_settings',                         module: 'companyAdmin', name: 'Manage Settings' },
  { code: 'view_audit_logs',                         module: 'companyAdmin', name: 'View Audit Logs' },
  { code: 'manage_users',                            module: 'companyAdmin', name: 'Manage Users' },
  { code: 'manage_roles',                            module: 'companyAdmin', name: 'Manage Roles' },
  // system
  { code: 'system.roles.manage',                     module: 'system', name: 'Manage Roles' },
  { code: 'system.company.settings.manage',          module: 'system', name: 'Manage Company Settings' },
  { code: 'system.users.manage',                     module: 'system', name: 'Manage Users' },
  { code: 'system.audit.view',                       module: 'system', name: 'View Audit Logs' },
];

export async function seedPermissionRegistry(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding permission_registries...');
  await prisma.permissionRegistry.deleteMany({
    where: { OR: [{ module: 'ai-assistant' }, { code: { startsWith: 'ai-assistant.' } }] },
  });
  for (const perm of PERMISSION_DATA) {
    await prisma.permissionRegistry.upsert({
      where: { code: perm.code },
      create: {
        code: perm.code,
        name: perm.name,
        module: perm.module,
      },
      update: {
        name: perm.name,
        module: perm.module,
      },
    });
  }
  console.log(`  ✓ ${PERMISSION_DATA.length} permission registry entries upserted`);
}
