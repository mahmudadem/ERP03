/**
 * seedOnboardingData.ts
 * 
 * Purpose: Seeds plans, bundles, permissions, and roles to the database.
 * Run this script to populate initial data and sync roles to companies.
 */

// Force Emulator usage
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'erp-03';

import admin from '../firebaseAdmin';

const db = admin.firestore();

// Plans
const PLANS = [
  { id: 'free', name: 'Free Trial', price: 0, status: 'active', limits: { maxCompanies: 1, maxUsersPerCompany: 1, maxModulesAllowed: 999, maxStorageMB: 100, maxTransactionsPerMonth: 100 } },
  { id: 'starter', name: 'Starter', price: 9, status: 'active', limits: { maxCompanies: 1, maxUsersPerCompany: 1, maxModulesAllowed: 2, maxStorageMB: 500, maxTransactionsPerMonth: 500 } },
  { id: 'advanced', name: 'Advanced', price: 39, status: 'active', limits: { maxCompanies: 3, maxUsersPerCompany: 5, maxModulesAllowed: 5, maxStorageMB: 2000, maxTransactionsPerMonth: 2000 } },
  { id: 'business', name: 'Business', price: 99, status: 'active', limits: { maxCompanies: 10, maxUsersPerCompany: 20, maxModulesAllowed: 999, maxStorageMB: 10000, maxTransactionsPerMonth: 10000 } },
  { id: 'enterprise', name: 'Enterprise', price: 999, status: 'active', limits: { maxCompanies: 999, maxUsersPerCompany: 999, maxModulesAllowed: 999, maxStorageMB: 100000, maxTransactionsPerMonth: 100000 } },
];

// Bundles
const BUNDLES = [
  { id: 'trading-basic', name: 'General Trading', description: 'Suitable for normal trading companies.', businessDomains: ['trading'], modulesIncluded: ['accounting', 'inventory'] },
  { id: 'trading-plus', name: 'General Trading +', description: 'Trading company with HR support.', businessDomains: ['trading'], modulesIncluded: ['accounting', 'inventory', 'hr'] },
  { id: 'retail-pos', name: 'Retail / POS', description: 'For retail shops and supermarkets.', businessDomains: ['retail'], modulesIncluded: ['pos', 'inventory', 'accounting'] },
  { id: 'wholesale', name: 'Wholesale Trading', description: 'For wholesalers and distribution companies.', businessDomains: ['trading', 'distribution'], modulesIncluded: ['inventory', 'crm', 'accounting', 'purchase'] },
  { id: 'services', name: 'Services Company', description: 'For IT, consulting, maintenance, etc.', businessDomains: ['services'], modulesIncluded: ['crm', 'hr', 'accounting'] },
  { id: 'restaurant', name: 'Restaurant', description: 'POS + Inventory + HR for restaurants.', businessDomains: ['hospitality'], modulesIncluded: ['pos', 'inventory', 'hr', 'accounting'] },
  { id: 'bakery', name: 'Bakery / Food Production', description: 'Suitable for bakeries and food factories.', businessDomains: ['manufacturing', 'hospitality'], modulesIncluded: ['pos', 'inventory', 'manufacturing', 'accounting'] },
  { id: 'maintenance', name: 'Maintenance Workshop', description: 'Workshops handling repairs and service orders.', businessDomains: ['services'], modulesIncluded: ['crm', 'inventory', 'accounting'] },
  { id: 'manufacturing-basic', name: 'Manufacturing – Basic', description: 'For small manufacturers.', businessDomains: ['manufacturing'], modulesIncluded: ['inventory', 'manufacturing', 'accounting'] },
  { id: 'manufacturing-advanced', name: 'Manufacturing – Advanced', description: 'For medium and large factories.', businessDomains: ['manufacturing'], modulesIncluded: ['inventory', 'manufacturing', 'accounting', 'hr', 'purchase'] },
  { id: 'construction', name: 'Construction / Contracting', description: 'Contractors, builders, and project companies.', businessDomains: ['construction'], modulesIncluded: ['projects', 'accounting', 'hr', 'inventory'] },
  { id: 'real-estate', name: 'Real Estate Agency', description: 'Real estate brokers and agencies.', businessDomains: ['real-estate'], modulesIncluded: ['crm', 'accounting'] },
  { id: 'education', name: 'Education / Training Center', description: 'Training institutes and educational centers.', businessDomains: ['education'], modulesIncluded: ['crm', 'hr', 'accounting'] },
  { id: 'clinic', name: 'Clinic / Medical Office', description: 'Small medical practices.', businessDomains: ['healthcare'], modulesIncluded: ['crm', 'inventory', 'hr', 'accounting'] },
  { id: 'logistics', name: 'Logistics & Transportation', description: 'Transport, delivery, and logistics services.', businessDomains: ['logistics'], modulesIncluded: ['accounting', 'hr', 'crm'] },
  { id: 'ecommerce', name: 'E-Commerce Seller', description: 'Online sellers and marketplace merchants.', businessDomains: ['retail', 'ecommerce'], modulesIncluded: ['inventory', 'crm', 'accounting'] },
  { id: 'freelancer', name: 'Freelancer / Solo Entrepreneur', description: 'For individual freelancers.', businessDomains: ['services'], modulesIncluded: ['accounting', 'crm'] },
  { id: 'nonprofit', name: 'Non-Profit Organization', description: 'For NGOs and non-profit entities.', businessDomains: ['nonprofit'], modulesIncluded: ['accounting', 'crm', 'hr'] },
  { id: 'salon', name: 'Beauty Salon & Spa', description: 'For salons, spas, and beauty centers.', businessDomains: ['services', 'retail'], modulesIncluded: ['pos', 'inventory', 'hr'] },
  { id: 'empty-company', name: 'Empty Company', description: 'Start with no modules and configure manually.', businessDomains: [], modulesIncluded: [] },
];

// Module Definitions for Permissions
const MODULE_DEFINITIONS = [
  {
    moduleId: 'accounting',
    permissions: [
      { id: 'accounting.accounts.view', label: 'View Chart of Accounts', enabled: true },
      { id: 'accounting.accounts.create', label: 'Create Accounts', enabled: true },
      { id: 'accounting.accounts.edit', label: 'Edit Accounts', enabled: true },
      { id: 'accounting.accounts.delete', label: 'Delete Accounts', enabled: true },
      { id: 'accounting.vouchers.view', label: 'View Vouchers', enabled: true },
      { id: 'accounting.vouchers.create', label: 'Create Vouchers', enabled: true },
      { id: 'accounting.vouchers.edit', label: 'Edit Vouchers', enabled: true },
      { id: 'accounting.vouchers.delete', label: 'Delete Vouchers', enabled: true },
      { id: 'accounting.vouchers.approve', label: 'Approve Vouchers', enabled: true },
      { id: 'accounting.vouchers.post', label: 'Post Vouchers', enabled: true },
      { id: 'accounting.vouchers.lock', label: 'Lock Vouchers', enabled: true },
      { id: 'accounting.vouchers.cancel', label: 'Cancel Vouchers', enabled: true },
      { id: 'accounting.vouchers.correct', label: 'Correct Vouchers', enabled: true },
      { id: 'accounting.reports.profitAndLoss.view', label: 'View Profit & Loss', enabled: true },
      { id: 'accounting.reports.trialBalance.view', label: 'View Trial Balance', enabled: true },
      { id: 'accounting.reports.generalLedger.view', label: 'View General Ledger', enabled: true },
      { id: 'accounting.designer.view', label: 'View Designer', enabled: true },
      { id: 'accounting.designer.create', label: 'Create Voucher Types', enabled: true },
      { id: 'accounting.designer.modify', label: 'Modify Voucher Types', enabled: true },
      { id: 'accounting.settings', label: 'Manage Accounting Settings', enabled: true },
      { id: 'accounting.settings.view', label: 'View Settings', enabled: true },
      { id: 'accounting.settings.read', label: 'Read Settings', enabled: true },
      { id: 'accounting.settings.write', label: 'Write Settings', enabled: true },
      { id: 'accounting.settings.manage', label: 'Full Settings Access', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  },
  {
    moduleId: 'inventory',
    permissions: [
      { id: 'inventory.items.view', label: 'View Items', enabled: true },
      { id: 'inventory.items.create', label: 'Create Items', enabled: true },
      { id: 'inventory.items.manage', label: 'Manage Items', enabled: true },
      { id: 'inventory.warehouses.view', label: 'View Warehouses', enabled: true },
      { id: 'inventory.warehouses.create', label: 'Create Warehouses', enabled: true },
      { id: 'inventory.stock.view', label: 'View Stock', enabled: true },
      { id: 'inventory.settings', label: 'Inventory Settings', enabled: true },
      { id: 'item.list', label: 'List Items (Legacy)', enabled: true },
      { id: 'warehouse.list', label: 'List Warehouses (Legacy)', enabled: true },
      { id: 'stockMovement.list', label: 'List Stock Movements (Legacy)', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  },
  {
    moduleId: 'hr',
    permissions: [
      { id: 'employee.list', label: 'View Employees', enabled: true },
      { id: 'attendance.list', label: 'View Attendance', enabled: true },
      { id: 'payroll.list', label: 'View Payroll', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  },
  {
    moduleId: 'crm',
    permissions: [
      { id: 'crm.leads.view', label: 'View Leads', enabled: true },
      { id: 'crm.customers.view', label: 'View Customers', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  },
  {
    moduleId: 'pos',
    permissions: [
      { id: 'pos.terminal.access', label: 'Access POS Terminal', enabled: true },
      { id: 'pos.sessions.view', label: 'View POS Sessions', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  },
  {
    moduleId: 'manufacturing',
    permissions: [
      { id: 'mfg.workOrder.view', label: 'View Work Orders', enabled: true },
      { id: 'mfg.bom.view', label: 'View BoM', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  },
  {
    moduleId: 'projects',
    permissions: [
      { id: 'project.view', label: 'View Projects', enabled: true },
      { id: 'task.view', label: 'View Tasks', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  },
  {
    moduleId: 'purchase',
    permissions: [
      { id: 'vendor.list', label: 'View Vendors', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  },
  {
    moduleId: 'companyAdmin',
    permissions: [
      { id: 'manage_settings', label: 'Manage Settings', enabled: true },
      { id: 'view_audit_logs', label: 'View Audit Logs', enabled: true },
      { id: 'manage_users', label: 'Manage Users', enabled: true },
      { id: 'manage_roles', label: 'Manage Roles', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  },
  {
    moduleId: 'system',
    permissions: [
      { id: 'system.roles.manage', label: 'Manage Roles', enabled: true },
      { id: 'system.company.settings.manage', label: 'Manage Company Settings', enabled: true },
      { id: 'system.users.manage', label: 'Manage Users', enabled: true },
      { id: 'system.audit.view', label: 'View Audit Logs', enabled: true },
    ],
    autoAttachToRoles: ['owner', 'admin']
  }
];

// Role Templates
const ROLE_TEMPLATES = [
  {
    id: 'template_owner',
    name: 'Owner',
    description: 'Company owner with full system access',
    permissions: MODULE_DEFINITIONS.flatMap(d => d.permissions.map(p => p.id)),
  },
  {
    id: 'template_admin',
    name: 'Administrator',
    description: 'Full access to all features',
    permissions: MODULE_DEFINITIONS.flatMap(d => d.permissions.map(p => p.id)),
  },
  {
    id: 'template_financial_manager',
    name: 'Financial Manager',
    description: 'Full access to Accounting module and reports',
    permissions: [
      ...MODULE_DEFINITIONS.find(d => d.moduleId === 'accounting')?.permissions.map(p => p.id) || [],
      'system.company.settings.manage'
    ],
  },
  {
    id: 'template_accountant',
    name: 'Accountant',
    description: 'General accounting access',
    permissions: [
      'accounting.vouchers.view',
      'accounting.vouchers.create',
      'accounting.vouchers.edit',
      'accounting.accounts.view',
      'accounting.reports.trialBalance.view',
      'accounting.reports.profitAndLoss.view',
      'accounting.reports.generalLedger.view'
    ],
  },
  {
    id: 'template_inventory_manager',
    name: 'Inventory Manager',
    description: 'Manage inventory and stock',
    permissions: MODULE_DEFINITIONS.find(d => d.moduleId === 'inventory')?.permissions.map(p => p.id) || [],
  },
  {
    id: 'template_member',
    name: 'Member',
    description: 'Basic access',
    permissions: [
      'accounting.vouchers.view',
      'inventory.items.view'
    ],
  },
];

async function seedPlans() {
  console.log('📦 Seeding Plans...');
  const collection = db.collection('system_metadata').doc('plans').collection('items');
  for (const plan of PLANS) {
    await collection.doc(plan.id).set({ ...plan, createdAt: new Date(), updatedAt: new Date() });
    console.log(`  ✓ Plan: ${plan.name}`);
  }
}

async function seedBundles() {
  console.log('📦 Seeding Bundles...');
  const collection = db.collection('system_metadata').doc('bundles').collection('items');
  for (const bundle of BUNDLES) {
    await collection.doc(bundle.id).set({ ...bundle, createdAt: new Date(), updatedAt: new Date() });
    console.log(`  ✓ Bundle: ${bundle.name}`);
  }
}

async function seedModuleDefinitions() {
  console.log('📦 Seeding Module Permissions...');
  const collection = db.collection('system_metadata').doc('module_permissions').collection('items');
  for (const def of MODULE_DEFINITIONS) {
    await collection.doc(def.moduleId).set({ ...def, createdAt: new Date(), updatedAt: new Date(), permissionsDefined: true });
    console.log(`  ✓ Module: ${def.moduleId}`);
  }
}

async function seedModulesRegistry() {
  console.log('📦 Seeding Modules Registry...');
  const collection = db.collection('system_metadata').doc('modules').collection('items');
  for (const def of MODULE_DEFINITIONS) {
    const moduleName = def.moduleId.charAt(0).toUpperCase() + def.moduleId.slice(1);
    await collection.doc(def.moduleId).set({ id: def.moduleId, name: moduleName, description: `Core ${moduleName} module`, createdAt: new Date(), updatedAt: new Date() });
    console.log(`  ✓ Registry: ${def.moduleId}`);
  }
}

async function seedPermissions() {
  console.log('📦 Seeding Flat Permissions List...');
  const collection = db.collection('system_metadata').doc('permissions').collection('items');
  for (const def of MODULE_DEFINITIONS) {
    for (const perm of def.permissions) {
      await collection.doc(perm.id).set({ id: perm.id, category: def.moduleId, labelEn: perm.label, descriptionEn: perm.label, createdAt: new Date(), updatedAt: new Date() });
    }
    console.log(`  ✓ Permissions for: ${def.moduleId}`);
  }
}

async function seedRoleTemplates() {
  console.log('📦 Seeding System Role Templates...');
  const collection = db.collection('system_metadata').doc('role_templates').collection('items');
  for (const template of ROLE_TEMPLATES) {
    await collection.doc(template.id).set({ ...template, isCore: true, createdAt: new Date(), updatedAt: new Date() });
    console.log(`  ✓ Template: ${template.name}`);
  }
}

async function seedCompanyRoles() {
  console.log('📦 Syncing Roles to All Companies...');
  const companiesSnapshot = await db.collection('companies').get();
  for (const companyDoc of companiesSnapshot.docs) {
    const rolesCollection = db.collection('companies').doc(companyDoc.id).collection('roles');
    for (const template of ROLE_TEMPLATES) {
      const roleId = template.id.replace('template_', '');
      await rolesCollection.doc(roleId).set({ 
        id: roleId, 
        companyId: companyDoc.id, 
        name: template.name, 
        description: template.description, 
        permissions: template.permissions, 
        isSystem: roleId === 'admin' || roleId === 'owner', 
        createdAt: new Date(), 
        updatedAt: new Date() 
      });
    }
    console.log(`  ✓ Synced for company: ${companyDoc.id}`);
  }
}

async function main() {
  console.log('\n🌱 Seeding Onboarding Data...\n');
  try {
    await seedPlans();
    await seedBundles();
    await seedModuleDefinitions();
    await seedModulesRegistry();
    await seedPermissions();
    await seedRoleTemplates();
    await seedCompanyRoles();
    console.log('\n🎉 Seeding complete!\n');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

main();
