
import { lazy, ComponentType } from 'react';

// Core
const DashboardPage = lazy(() => import('../modules/core/pages/DashboardPage'));
const CompaniesPage = lazy(() => import('../modules/core/pages/CompaniesPage'));

// Accounting
const AccountingHomePage = lazy(() => import('../modules/accounting/pages/AccountingHomePage'));
const AccountsListPage = lazy(() => import('../modules/accounting/pages/AccountsListPage'));
const VouchersListPage = lazy(() => import('../modules/accounting/pages/VouchersListPage'));
const VoucherEditorPage = lazy(() => import('../modules/accounting/pages/VoucherEditorPage'));
const TrialBalancePage = lazy(() => import('../modules/accounting/pages/TrialBalancePage'));
const ProfitAndLossPage = lazy(() => import('../modules/accounting/pages/ProfitAndLossPage'));

// Initialization Wizards
const AccountingInitializationWizard = lazy(() => import('../modules/accounting/wizards/AccountingInitializationWizard'));
const CompanyAdminInitializationWizard = lazy(() => import('../modules/company-admin/wizards/CompanyAdminInitializationWizard'));

// Inventory
const InventoryHomePage = lazy(() => import('../modules/inventory/pages/InventoryHomePage'));
const ItemsListPage = lazy(() => import('../modules/inventory/pages/ItemsListPage'));

// HR
const HrHomePage = lazy(() => import('../modules/hr/pages/HrHomePage'));
const EmployeesListPage = lazy(() => import('../modules/hr/pages/EmployeesListPage'));

// POS
const PosHomePage = lazy(() => import('../modules/pos/pages/PosHomePage'));

// Settings
const SettingsHomePage = lazy(() => import('../modules/settings/pages/SettingsHomePage'));
const AppearanceSettingsPage = lazy(() => import('../modules/settings/pages/AppearanceSettingsPage'));
const SidebarSettingsPage = lazy(() => import('../modules/settings/pages/SidebarSettingsPage'));
const ApprovalSettingsPage = lazy(() => import('../modules/settings/pages/ApprovalSettingsPage'));

// Designer
const DesignerEngine = lazy(() => import('../designer-engine/index'));

// RBAC
const RolesListPage = lazy(() => import('../modules/settings/rbac/RolesListPage'));
const EditRolePage = lazy(() => import('../modules/settings/rbac/EditRolePage'));
const AssignUsersRolesPage = lazy(() => import('../modules/settings/rbac/AssignUsersRolesPage'));

// Super Admin
const SystemOverviewPage = lazy(() => import('../modules/super-admin/pages/SystemOverviewPage'));
const UsersListPage = lazy(() => import('../modules/super-admin/pages/UsersListPage'));
const SuperAdminUsersManagementPage = lazy(() => import('../modules/super-admin/pages/SuperAdminUsersManagementPage'));
const CompaniesListPage = lazy(() => import('../modules/super-admin/pages/CompaniesListPage'));
const BusinessDomainsManagerPage = lazy(() => import('../modules/super-admin/pages/BusinessDomainsManagerPage').then(m => ({ default: m.BusinessDomainsManagerPage })));
const BundlesManagerPage = lazy(() => import('../modules/super-admin/pages/BundlesManagerPage').then(m => ({ default: m.BundlesManagerPage })));
const PermissionsManagerPage = lazy(() => import('../modules/super-admin/pages/PermissionsManagerPage').then(m => ({ default: m.PermissionsManagerPage })));
const ModulesManagerPage = lazy(() => import('../modules/super-admin/pages/ModulesManagerPage').then(m => ({ default: m.ModulesManagerPage })));
const PlansManagerPage = lazy(() => import('../modules/super-admin/pages/PlansManagerPage').then(m => ({ default: m.PlansManagerPage })));

// Company Wizard (user-level)
const SelectModelPage = lazy(() => import('../modules/company-wizard/pages/SelectModelPage'));
const DynamicWizardPage = lazy(() => import('../modules/company-wizard/pages/DynamicWizardPage'));
const CompanySelectorPage = lazy(() => import('../modules/company-selector/CompanySelectorPage'));
const ModulePermissionsListPage = lazy(() => import('../modules/super-admin/permissions-manager/ModulePermissionsListPage'));
const EditModulePermissionsPage = lazy(() => import('../modules/super-admin/permissions-manager/EditModulePermissionsPage'));
const RolePermissionsListPage = lazy(() => import('../modules/super-admin/permissions-manager/RolePermissionsListPage'));
const SuperAdminEditRolePage = lazy(() => import('../modules/super-admin/permissions-manager/EditRolePage'));
const SuperAdminTemplatesPage = lazy(() => import('../modules/super-admin/templates/TemplatesPage'));
const SuperAdminVoucherTemplatesPage = lazy(() => import('../pages/super-admin/pages/SuperAdminVoucherTemplatesPage').then(module => ({ default: module.SuperAdminVoucherTemplatesPage })));
const VoucherTemplateEditorPage = lazy(() => import('../pages/super-admin/pages/VoucherTemplateEditorPage').then(module => ({ default: module.VoucherTemplateEditorPage })));

// Company Admin
const CompanyAdminOverviewPage = lazy(() => import('../pages/company-admin/pages/OverviewPage'));
const CompanyAdminUsersPage = lazy(() => import('../pages/company-admin/pages/UsersPage'));
const CompanyAdminRolesPage = lazy(() => import('../pages/company-admin/pages/RolesPage'));
const CompanyAdminModulesPage = lazy(() => import('../pages/company-admin/pages/ModulesPage'));
const CompanyAdminFeaturesPage = lazy(() => import('../pages/company-admin/pages/FeaturesPage'));
const CompanyAdminBundlesPage = lazy(() => import('../pages/company-admin/pages/BundlesPage'));
const CompanyAdminSettingsPage = lazy(() => import('../pages/company-admin/pages/SettingsPage'));

export interface AppRoute {
  path: string;
  label: string;
  component: ComponentType<any>;
  section: 'CORE' | 'ACCOUNTING' | 'INVENTORY' | 'HR' | 'POS' | 'SETTINGS' | 'SUPER_ADMIN' | 'SETUP';
  hideInMenu?: boolean;
  requiredPermission?: string;
  requiredGlobalRole?: 'SUPER_ADMIN';
  requiredModule?: string;
}

export const routesConfig: AppRoute[] = [
  // CORE
  { path: '/', label: 'Dashboard', component: DashboardPage, section: 'CORE' },
  { path: '/companies', label: 'Companies', component: CompaniesPage, section: 'CORE' },

  // MODULE INITIALIZATION WIZARDS (No module/permission requirements)
  { path: '/accounting/setup', label: 'Accounting Setup', component: AccountingInitializationWizard, section: 'SETUP', hideInMenu: true },
  { path: '/companyAdmin/setup', label: 'Company Admin Setup', component: CompanyAdminInitializationWizard, section: 'SETUP', hideInMenu: true },

  // ACCOUNTING
  { path: '/accounting', label: 'Overview', component: AccountingHomePage, section: 'ACCOUNTING', requiredModule: 'accounting' },
  { path: '/accounting/accounts', label: 'Chart of Accounts', component: AccountsListPage, section: 'ACCOUNTING', requiredPermission: 'coa.view', requiredModule: 'accounting' },
  { path: '/accounting/vouchers', label: 'Vouchers', component: VouchersListPage, section: 'ACCOUNTING', requiredPermission: 'voucher.view', requiredModule: 'accounting' },
  { path: '/accounting/vouchers/:id', label: 'Edit Voucher', component: VoucherEditorPage, section: 'ACCOUNTING', hideInMenu: true, requiredPermission: 'voucher.update', requiredModule: 'accounting' },
  { path: '/accounting/reports/trial-balance', label: 'Trial Balance', component: TrialBalancePage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.trialBalance.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/profit-loss', label: 'Profit & Loss', component: ProfitAndLossPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.profitAndLoss.view', requiredModule: 'accounting' },
  { path: '/accounting/designer', label: 'Voucher Designer', component: lazy(() => import('../modules/accounting/designer/pages/VoucherTypeDesignerPage')), section: 'ACCOUNTING', requiredPermission: 'accounting.designer.view', requiredModule: 'accounting' },
  { path: '/accounting/designer-v2', label: 'Voucher Designer V2 (NEW)', component: lazy(() => import('../modules/accounting/designer-v2/pages/VoucherDesignerPage').then(m => ({ default: m.VoucherDesignerPage }))), section: 'ACCOUNTING', requiredModule: 'accounting' },

  // INVENTORY
  { path: '/inventory', label: 'Overview', component: InventoryHomePage, section: 'INVENTORY', requiredModule: 'inventory' },
  { path: '/inventory/items', label: 'Items', component: ItemsListPage, section: 'INVENTORY', requiredPermission: 'inventory.items.manage', requiredModule: 'inventory' },

  // HR
  { path: '/hr', label: 'Overview', component: HrHomePage, section: 'HR', requiredModule: 'hr' },
  { path: '/hr/employees', label: 'Employees', component: EmployeesListPage, section: 'HR', requiredModule: 'hr' },

  // POS
  { path: '/pos', label: 'Terminal', component: PosHomePage, section: 'POS', requiredModule: 'pos' },

  // SETTINGS
  { path: '/settings', label: 'General', component: SettingsHomePage, section: 'SETTINGS' },
  { path: '/settings/appearance', label: 'Appearance', component: AppearanceSettingsPage, section: 'SETTINGS', hideInMenu: true },
  { path: '/settings/sidebar', label: 'Menu Config', component: SidebarSettingsPage, section: 'SETTINGS', hideInMenu: true },
  { path: '/settings/approval', label: 'Approval Workflow', component: ApprovalSettingsPage, section: 'SETTINGS', requiredPermission: 'system.company.settings.manage' },

  // RBAC
  { path: '/settings/rbac/roles', label: 'Roles', component: RolesListPage, section: 'SETTINGS', requiredPermission: 'system.roles.manage' },
  { path: '/settings/rbac/roles/:roleId', label: 'Edit Role', component: EditRolePage, section: 'SETTINGS', hideInMenu: true, requiredPermission: 'system.roles.manage' },
  { path: '/settings/rbac/users', label: 'Assign Users', component: AssignUsersRolesPage, section: 'SETTINGS', requiredPermission: 'system.roles.manage' },

  // DESIGNER
  { path: '/designer', label: 'Form Designer', component: DesignerEngine, section: 'SETTINGS', requiredPermission: 'designer.vouchers.modify' },

  // SUPER ADMIN
  { path: '/super-admin/overview', label: 'System Overview', component: SystemOverviewPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/users', label: 'Users Management', component: SuperAdminUsersManagementPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/companies', label: 'All Companies', component: CompaniesListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  
  // Super Admin Registry
  { path: '/super-admin/business-domains', label: 'Business Domains', component: BusinessDomainsManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/bundles-manager', label: 'Bundles', component: BundlesManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/permissions-registry', label: 'Permissions Registry', component: PermissionsManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/modules-registry', label: 'Modules Registry', component: ModulesManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/plans', label: 'Plans', component: PlansManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  
  // Super Admin - Existing
  { path: '/super-admin/permissions', label: 'Module Permissions', component: ModulePermissionsListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/permissions/:moduleId', label: 'Edit Module Permissions', component: EditModulePermissionsPage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/roles', label: 'Roles', component: RolePermissionsListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/roles/:roleId', label: 'Edit Role', component: SuperAdminEditRolePage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/templates', label: 'Templates', component: SuperAdminTemplatesPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/voucher-templates', label: 'Voucher Templates', component: SuperAdminVoucherTemplatesPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/voucher-templates/:id', label: 'Edit Voucher Template', component: VoucherTemplateEditorPage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },

  // Company Wizard (user accessible)
  { path: '/company-wizard', label: 'Company Wizard', component: SelectModelPage, section: 'CORE' },
  { path: '/company-wizard/run', label: 'Run Company Wizard', component: DynamicWizardPage, section: 'CORE', hideInMenu: true },
  { path: '/company-selector', label: 'Select Company', component: CompanySelectorPage, section: 'CORE', hideInMenu: true },

  // COMPANY ADMIN (UI-open; backend still enforces owner/permission)
  { path: '/company-admin/overview', label: 'Company Admin Overview', component: CompanyAdminOverviewPage, section: 'SETTINGS' },
  { path: '/company-admin/users', label: 'Company Users', component: CompanyAdminUsersPage, section: 'SETTINGS' },
  { path: '/company-admin/roles', label: 'Company Roles', component: CompanyAdminRolesPage, section: 'SETTINGS' },
  { path: '/company-admin/roles/create', label: 'Create Role', component: lazy(() => import('../pages/company-admin/pages/CreateRolePage')), section: 'SETTINGS', hideInMenu: true },
  { path: '/company-admin/roles/:roleId', label: 'Edit Role', component: lazy(() => import('../pages/company-admin/pages/EditRolePage')), section: 'SETTINGS', hideInMenu: true },
  { path: '/company-admin/modules', label: 'Company Modules', component: CompanyAdminModulesPage, section: 'SETTINGS' },
  { path: '/company-admin/features', label: 'Company Features', component: CompanyAdminFeaturesPage, section: 'SETTINGS' },
  { path: '/company-admin/bundles', label: 'Company Bundles', component: CompanyAdminBundlesPage, section: 'SETTINGS' },
  { path: '/company-admin/settings', label: 'Company Settings', component: CompanyAdminSettingsPage, section: 'SETTINGS' },
  
  // CRM
  { path: '/crm/leads', label: 'CRM Overview', component: lazy(() => import('../modules/crm/pages/CrmHomePage')), section: 'SETTINGS', requiredModule: 'crm' },
  { path: '/crm/customers', label: 'Customers', component: lazy(() => import('../modules/crm/pages/CrmHomePage')), section: 'SETTINGS', requiredModule: 'crm' },

  // Manufacturing
  { path: '/manufacturing/work-orders', label: 'Manufacturing', component: lazy(() => import('../modules/manufacturing/pages/ManufacturingHomePage')), section: 'SETTINGS', requiredModule: 'manufacturing' },
  { path: '/manufacturing/bom', label: 'BoM', component: lazy(() => import('../modules/manufacturing/pages/ManufacturingHomePage')), section: 'SETTINGS', requiredModule: 'manufacturing' },

  // Projects
  { path: '/projects', label: 'Projects', component: lazy(() => import('../modules/projects/pages/ProjectsHomePage')), section: 'SETTINGS', requiredModule: 'projects' },
  { path: '/projects/tasks', label: 'Tasks', component: lazy(() => import('../modules/projects/pages/ProjectsHomePage')), section: 'SETTINGS', requiredModule: 'projects' },

  // Purchase
  { path: '/purchases/orders', label: 'Purchase Orders', component: lazy(() => import('../modules/purchase/pages/PurchaseHomePage')), section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/vendors', label: 'Vendors', component: lazy(() => import('../modules/purchase/pages/PurchaseHomePage')), section: 'INVENTORY', requiredModule: 'purchase' },
  
  // USER PROFILE
  { path: '/profile', label: 'My Profile', component: lazy(() => import('../modules/core/pages/ProfilePage')), section: 'CORE', hideInMenu: true },
];
