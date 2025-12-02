
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
const CompaniesListPage = lazy(() => import('../modules/super-admin/pages/CompaniesListPage'));

// Company Wizard (user-level)
const SelectModelPage = lazy(() => import('../modules/company-wizard/pages/SelectModelPage'));
const DynamicWizardPage = lazy(() => import('../modules/company-wizard/pages/DynamicWizardPage'));
const CompanySelectorPage = lazy(() => import('../modules/company-selector/CompanySelectorPage'));
const ModulePermissionsListPage = lazy(() => import('../modules/super-admin/permissions-manager/ModulePermissionsListPage'));
const EditModulePermissionsPage = lazy(() => import('../modules/super-admin/permissions-manager/EditModulePermissionsPage'));
const RolePermissionsListPage = lazy(() => import('../modules/super-admin/permissions-manager/RolePermissionsListPage'));
const SuperAdminEditRolePage = lazy(() => import('../modules/super-admin/permissions-manager/EditRolePage'));
const SuperAdminTemplatesPage = lazy(() => import('../modules/super-admin/templates/TemplatesPage'));

export interface AppRoute {
  path: string;
  label: string;
  component: ComponentType<any>;
  section: 'CORE' | 'ACCOUNTING' | 'INVENTORY' | 'HR' | 'POS' | 'SETTINGS' | 'SUPER_ADMIN';
  hideInMenu?: boolean;
  requiredPermission?: string;
  requiredGlobalRole?: 'SUPER_ADMIN';
  requiredModule?: string;
}

export const routesConfig: AppRoute[] = [
  // CORE
  { path: '/', label: 'Dashboard', component: DashboardPage, section: 'CORE' },
  { path: '/companies', label: 'Companies', component: CompaniesPage, section: 'CORE' },

  // ACCOUNTING
  { path: '/accounting', label: 'Overview', component: AccountingHomePage, section: 'ACCOUNTING', requiredModule: 'accounting' },
  { path: '/accounting/accounts', label: 'Chart of Accounts', component: AccountsListPage, section: 'ACCOUNTING', requiredPermission: 'coa.view', requiredModule: 'accounting' },
  { path: '/accounting/vouchers', label: 'Vouchers', component: VouchersListPage, section: 'ACCOUNTING', requiredPermission: 'voucher.view', requiredModule: 'accounting' },
  { path: '/accounting/vouchers/:id', label: 'Edit Voucher', component: VoucherEditorPage, section: 'ACCOUNTING', hideInMenu: true, requiredPermission: 'voucher.update', requiredModule: 'accounting' },
  { path: '/accounting/reports/trial-balance', label: 'Trial Balance', component: TrialBalancePage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.trialBalance.view', requiredModule: 'accounting' },

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
  { path: '/super-admin/users', label: 'All Users', component: UsersListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/companies', label: 'All Companies', component: CompaniesListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/permissions', label: 'Module Permissions', component: ModulePermissionsListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/permissions/:moduleId', label: 'Edit Module Permissions', component: EditModulePermissionsPage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/roles', label: 'Roles', component: RolePermissionsListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/roles/:roleId', label: 'Edit Role', component: SuperAdminEditRolePage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/templates', label: 'Templates', component: SuperAdminTemplatesPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },

  // Company Wizard (user accessible)
  { path: '/company-wizard', label: 'Company Wizard', component: SelectModelPage, section: 'CORE' },
  { path: '/company-wizard/run', label: 'Run Company Wizard', component: DynamicWizardPage, section: 'CORE', hideInMenu: true },
  { path: '/company-selector', label: 'Select Company', component: CompanySelectorPage, section: 'CORE', hideInMenu: true },
];

