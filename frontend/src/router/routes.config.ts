
import { lazy, ComponentType } from 'react';

// Core
const DashboardPage = lazy(() => import('../modules/core/pages/DashboardPage'));
const CompaniesPage = lazy(() => import('../modules/core/pages/CompaniesPage'));
const NotificationInboxPage = lazy(() => import('../modules/core/pages/NotificationInboxPage'));

// Accounting
const AccountingDashboard = lazy(() => import('../modules/accounting/AccountingDashboard'));
const ApprovalsPage = lazy(() => import('../modules/accounting/pages/ApprovalsPage'));
const AccountsListPage = lazy(() => import('../modules/accounting/pages/AccountsListPage'));
const SubgroupTaggingPage = lazy(() => import('../modules/accounting/pages/SubgroupTaggingPage'));
const VouchersListPage = lazy(() => import('../modules/accounting/pages/VouchersListPage'));
const VoucherEditorPage = lazy(() => import('../modules/accounting/pages/VoucherEditorPage'));
const VoucherViewPage = lazy(() => import('../modules/accounting/pages/VoucherViewPage'));
const BalanceSheetPage = lazy(() => import('../modules/accounting/pages/BalanceSheetPage'));
const TrialBalancePage = lazy(() => import('../modules/accounting/pages/TrialBalancePage'));
const ProfitAndLossPage = lazy(() => import('../modules/accounting/pages/ProfitAndLossPage'));
const TradingAccountPage = lazy(() => import('../modules/accounting/pages/TradingAccountPage'));
const AccountStatementPage = lazy(() => import('../modules/accounting/pages/AccountStatementPage'));
const CostCentersPage = lazy(() => import('../modules/accounting/pages/CostCentersPage'));
const CashFlowPage = lazy(() => import('../modules/accounting/pages/CashFlowPage'));
const JournalPage = lazy(() => import('../modules/accounting/pages/JournalPage'));
const BudgetPage = lazy(() => import('../modules/accounting/pages/BudgetPage'));
const BudgetVsActualPage = lazy(() => import('../modules/accounting/pages/BudgetVsActualPage'));
const AgingReportPage = lazy(() => import('../modules/accounting/pages/AgingReportPage'));
const ConsolidatedTrialBalancePage = lazy(() => import('../modules/accounting/pages/ConsolidatedTrialBalancePage'));
const RecurringVouchersPage = lazy(() => import('../modules/accounting/pages/RecurringVouchersPage'));
const BankReconciliationPage = lazy(() => import('../modules/accounting/pages/BankReconciliationPage'));
const LedgerReportPage = lazy(() => import('../modules/accounting/pages/LedgerReportPage'));
const CostCenterSummaryPage = lazy(() => import('../modules/accounting/pages/CostCenterSummaryPage'));

// Initialization Wizards
const AccountingInitializationWizard = lazy(() => import('../modules/accounting/wizards/AccountingInitializationWizard'));
const CompanyAdminInitializationWizard = lazy(() => import('../modules/company-admin/wizards/CompanyAdminInitializationWizard'));

// Inventory
const InventoryHomePage = lazy(() => import('../modules/inventory/pages/InventoryHomePage'));
const ItemsListPage = lazy(() => import('../modules/inventory/pages/ItemsListPage'));
const ItemDetailPage = lazy(() => import('../modules/inventory/pages/ItemDetailPage'));
const CategoriesPage = lazy(() => import('../modules/inventory/pages/CategoriesPage'));
const WarehousesPage = lazy(() => import('../modules/inventory/pages/WarehousesPage'));
const StockLevelsPage = lazy(() => import('../modules/inventory/pages/StockLevelsPage'));
const StockMovementsPage = lazy(() => import('../modules/inventory/pages/StockMovementsPage'));
const StockAdjustmentPage = lazy(() => import('../modules/inventory/pages/StockAdjustmentPage'));
const OpeningStockPage = lazy(() => import('../modules/inventory/pages/OpeningStockPage'));
const StockTransfersPage = lazy(() => import('../modules/inventory/pages/StockTransfersPage'));
const LowStockAlertsPage = lazy(() => import('../modules/inventory/pages/LowStockAlertsPage'));
const UnsettledCostsPage = lazy(() => import('../modules/inventory/pages/UnsettledCostsPage'));

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
const NotificationSettingsPage = lazy(() => import('../modules/settings/pages/NotificationSettingsPage'));
const TaxCodesPage = lazy(() => import('../modules/settings/pages/TaxCodesPage'));

// Designer


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
const PurchaseHomePage = lazy(() => import('../modules/purchase/pages/PurchaseHomePage'));
const PurchaseOrdersListPage = lazy(() => import('../modules/purchases/pages/PurchaseOrdersListPage'));
const PurchaseOrderDetailPage = lazy(() => import('../modules/purchases/pages/PurchaseOrderDetailPage'));
const PurchaseSettingsPage = lazy(() => import('../modules/purchases/pages/PurchaseSettingsPage'));
const VendorsListPage = lazy(() => import('../modules/purchases/pages/VendorsListPage'));
const VendorDetailPage = lazy(() => import('../modules/purchases/pages/VendorDetailPage'));
const GoodsReceiptsListPage = lazy(() => import('../modules/purchases/pages/GoodsReceiptsListPage'));
const GoodsReceiptDetailPage = lazy(() => import('../modules/purchases/pages/GoodsReceiptDetailPage'));
const PurchaseInvoicesListPage = lazy(() => import('../modules/purchases/pages/PurchaseInvoicesListPage'));
const PurchaseInvoiceDetailPage = lazy(() => import('../modules/purchases/pages/PurchaseInvoiceDetailPage'));
const PurchaseReturnsListPage = lazy(() => import('../modules/purchases/pages/PurchaseReturnsListPage'));
const PurchaseReturnDetailPage = lazy(() => import('../modules/purchases/pages/PurchaseReturnDetailPage'));
const SalesHomePage = lazy(() => import('../modules/sales/pages/SalesHomePage'));
const CustomersListPage = lazy(() => import('../modules/sales/pages/CustomersListPage'));
const CustomerDetailPage = lazy(() => import('../modules/sales/pages/CustomerDetailPage'));
const SalesOrdersListPage = lazy(() => import('../modules/sales/pages/SalesOrdersListPage'));
const SalesOrderDetailPage = lazy(() => import('../modules/sales/pages/SalesOrderDetailPage'));
const SalesSettingsPage = lazy(() => import('../modules/sales/pages/SalesSettingsPage'));
const DeliveryNotesListPage = lazy(() => import('../modules/sales/pages/DeliveryNotesListPage'));
const DeliveryNoteDetailPage = lazy(() => import('../modules/sales/pages/DeliveryNoteDetailPage'));
const SalesInvoicesListPage = lazy(() => import('../modules/sales/pages/SalesInvoicesListPage'));
const SalesInvoiceDetailPage = lazy(() => import('../modules/sales/pages/SalesInvoiceDetailPage'));
const SalesReturnsListPage = lazy(() => import('../modules/sales/pages/SalesReturnsListPage'));
const SalesReturnDetailPage = lazy(() => import('../modules/sales/pages/SalesReturnDetailPage'));

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
  { path: '/notifications', label: 'Notifications', component: NotificationInboxPage, section: 'CORE', hideInMenu: true },

  // MODULE INITIALIZATION WIZARDS (No module/permission requirements)
  { path: '/accounting/setup', label: 'Accounting Setup', component: AccountingInitializationWizard, section: 'SETUP', hideInMenu: true },
  { path: '/companyAdmin/setup', label: 'Company Admin Setup', component: CompanyAdminInitializationWizard, section: 'SETUP', hideInMenu: true },

  // ACCOUNTING
  { path: '/accounting', label: 'Overview', component: AccountingDashboard, section: 'ACCOUNTING', requiredModule: 'accounting' },
  { path: '/accounting/approvals', label: 'Approval Center', component: ApprovalsPage, section: 'ACCOUNTING', requiredPermission: 'accounting.vouchers.view', requiredModule: 'accounting' },
  { path: '/accounting/accounts', label: 'Chart of Accounts', component: AccountsListPage, section: 'ACCOUNTING', requiredPermission: 'accounting.accounts.view', requiredModule: 'accounting' },
  { path: '/accounting/settings/subgroup-tagging', label: 'Subgroup Tagging', component: SubgroupTaggingPage, section: 'ACCOUNTING', requiredPermission: 'accounting.accounts.edit', requiredModule: 'accounting' },
  { path: '/accounting/vouchers', label: 'Vouchers', component: VouchersListPage, section: 'ACCOUNTING', requiredPermission: 'accounting.vouchers.view', requiredModule: 'accounting' },
  { path: '/accounting/vouchers/:id/view', label: 'View Voucher', component: VoucherViewPage, section: 'ACCOUNTING', hideInMenu: true, requiredPermission: 'accounting.vouchers.view', requiredModule: 'accounting' },
  { path: '/accounting/vouchers/:id', label: 'Edit Voucher', component: VoucherEditorPage, section: 'ACCOUNTING', hideInMenu: true, requiredPermission: 'accounting.vouchers.edit', requiredModule: 'accounting' },
  { path: '/accounting/reports/trial-balance', label: 'Trial Balance', component: TrialBalancePage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.trialBalance.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/account-statement', label: 'Account Statement', component: AccountStatementPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.generalLedger.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/balance-sheet', label: 'Balance Sheet', component: BalanceSheetPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.balanceSheet.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/journal', label: 'Journal', component: JournalPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.generalLedger.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/bank-reconciliation', label: 'Bank Reconciliation', component: BankReconciliationPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.generalLedger.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/ledger', label: 'Ledger Report', component: LedgerReportPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.generalLedger.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/profit-loss', label: 'Profit & Loss', component: ProfitAndLossPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.profitAndLoss.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/trading-account', label: 'Trading Account', component: TradingAccountPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.tradingAccount.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/cash-flow', label: 'Cash Flow', component: CashFlowPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.cashFlow.view', requiredModule: 'accounting' },
  { path: '/accounting/budgets', label: 'Budgets', component: BudgetPage, section: 'ACCOUNTING', requiredPermission: 'accounting.settings.read', requiredModule: 'accounting' },
  { path: '/accounting/reports/budget-vs-actual', label: 'Budget vs Actual', component: BudgetVsActualPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.trialBalance.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/aging', label: 'Aging', component: AgingReportPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.generalLedger.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/consolidated-trial-balance', label: 'Consolidated TB', component: ConsolidatedTrialBalancePage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.trialBalance.view', requiredModule: 'accounting' },
  { path: '/accounting/reports/cost-center-summary', label: 'Cost Center Summary', component: CostCenterSummaryPage, section: 'ACCOUNTING', requiredPermission: 'accounting.reports.generalLedger.view', requiredModule: 'accounting' },
  { path: '/accounting/recurring-vouchers', label: 'Recurring Vouchers', component: RecurringVouchersPage, section: 'ACCOUNTING', requiredPermission: 'accounting.vouchers.view', requiredModule: 'accounting' },
  { path: '/accounting/cost-centers', label: 'Cost Centers', component: CostCentersPage, section: 'ACCOUNTING', hideInMenu: true, requiredPermission: 'accounting.accounts.view', requiredModule: 'accounting' },
  { path: '/accounting/forms-designer', label: 'Forms Designer', component: lazy(() => import('../modules/accounting/pages/FormsDesignerPage')), section: 'ACCOUNTING', requiredPermission: 'accounting.designer.view', requiredModule: 'accounting' },
  { path: '/accounting/settings', label: 'Settings', component: lazy(() => import('../modules/accounting/pages/AccountingSettingsPage').then(m => ({ default: m.AccountingSettingsPage }))), section: 'ACCOUNTING', requiredPermission: 'accounting.settings.view', requiredModule: 'accounting' },
  { path: '/accounting/window-config-test', label: '🎨 Window Config Test', component: lazy(() => import('../modules/accounting/pages/WindowConfigTestPage').then(m => ({ default: m.WindowConfigTestPage }))), section: 'ACCOUNTING', requiredModule: 'accounting' },
  { path: '/accounting/wizard-test', label: '🧪 Wizard Test', component: lazy(() => import('../modules/accounting/pages/VoucherWizardTestPage')), section: 'ACCOUNTING', requiredModule: 'accounting' },
  { path: '/accounting/vouchers/demo', label: '🆕 New Forms Demo', component: lazy(() => import('../modules/accounting/pages/NewVoucherFormsDemo')), section: 'ACCOUNTING', requiredModule: 'accounting' },
  { path: '/error-test', label: '🧪 Error Handling Test', component: lazy(() => import('../pages/ErrorTestPage').then(m => ({ default: m.ErrorTestPage }))), section: 'SETTINGS', hideInMenu: false },
  { path: '/test-notification', label: '🔔 Test Notification', component: lazy(() => import('../pages/TestNotificationPage').then(m => ({ default: m.TestNotificationPage }))), section: 'SETTINGS', hideInMenu: false },

  // INVENTORY
  { path: '/inventory', label: 'Overview', component: InventoryHomePage, section: 'INVENTORY', requiredModule: 'inventory' },
  { path: '/inventory/items', label: 'Items', component: ItemsListPage, section: 'INVENTORY', requiredPermission: 'inventory.items.manage', requiredModule: 'inventory' },
  { path: '/inventory/items/:id', label: 'Item Detail', component: ItemDetailPage, section: 'INVENTORY', hideInMenu: true, requiredPermission: 'inventory.items.manage', requiredModule: 'inventory' },
  { path: '/inventory/categories', label: 'Categories', component: CategoriesPage, section: 'INVENTORY', requiredPermission: 'inventory.categories.view', requiredModule: 'inventory' },
  { path: '/inventory/warehouses', label: 'Warehouses', component: WarehousesPage, section: 'INVENTORY', requiredPermission: 'inventory.warehouses.view', requiredModule: 'inventory' },
  { path: '/inventory/stock-levels', label: 'Stock Levels', component: StockLevelsPage, section: 'INVENTORY', requiredPermission: 'inventory.stock.view', requiredModule: 'inventory' },
  { path: '/inventory/movements', label: 'Movements', component: StockMovementsPage, section: 'INVENTORY', requiredPermission: 'inventory.movements.view', requiredModule: 'inventory' },
  { path: '/inventory/adjustments', label: 'Adjustments', component: StockAdjustmentPage, section: 'INVENTORY', requiredPermission: 'inventory.stock.adjust', requiredModule: 'inventory' },
  { path: '/inventory/transfers', label: 'Transfers', component: StockTransfersPage, section: 'INVENTORY', requiredPermission: 'inventory.stock.adjust', requiredModule: 'inventory' },
  { path: '/inventory/alerts/low-stock', label: 'Low Stock Alerts', component: LowStockAlertsPage, section: 'INVENTORY', requiredPermission: 'inventory.stock.view', requiredModule: 'inventory' },
  { path: '/inventory/reports/unsettled-costs', label: 'Unsettled Costs', component: UnsettledCostsPage, section: 'INVENTORY', requiredPermission: 'inventory.movements.view', requiredModule: 'inventory' },
  { path: '/inventory/opening-stock', label: 'Opening Stock', component: OpeningStockPage, section: 'INVENTORY', requiredPermission: 'inventory.movements.record', requiredModule: 'inventory' },

  // HR
  { path: '/hr', label: 'Overview', component: HrHomePage, section: 'HR', requiredModule: 'hr' },
  { path: '/hr/employees', label: 'Employees', component: EmployeesListPage, section: 'HR', requiredModule: 'hr' },

  // POS
  { path: '/pos', label: 'Terminal', component: PosHomePage, section: 'POS', requiredModule: 'pos' },

  // SETTINGS
  { path: '/settings', label: 'General', component: SettingsHomePage, section: 'SETTINGS' },
  { path: '/settings/appearance', label: 'Appearance', component: AppearanceSettingsPage, section: 'SETTINGS', hideInMenu: true },
  { path: '/settings/sidebar', label: 'Menu Config', component: SidebarSettingsPage, section: 'SETTINGS', hideInMenu: true },
  { path: '/settings/notifications', label: 'Notifications', component: NotificationSettingsPage, section: 'SETTINGS', hideInMenu: true },
  { path: '/settings/approval', label: 'Approval Workflow', component: ApprovalSettingsPage, section: 'SETTINGS', requiredPermission: 'system.company.settings.manage' },
  { path: '/settings/tax-codes', label: 'Tax Codes', component: TaxCodesPage, section: 'SETTINGS' },

  // RBAC
  { path: '/settings/rbac/roles', label: 'Roles', component: RolesListPage, section: 'SETTINGS', requiredPermission: 'system.roles.manage' },
  { path: '/settings/rbac/roles/:roleId', label: 'Edit Role', component: EditRolePage, section: 'SETTINGS', hideInMenu: true, requiredPermission: 'system.roles.manage' },
  { path: '/settings/rbac/users', label: 'Assign Users', component: AssignUsersRolesPage, section: 'SETTINGS', requiredPermission: 'system.roles.manage' },

  // DESIGNER


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

  // Sales
  { path: '/sales', label: 'Sales Overview', component: SalesHomePage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/customers', label: 'Customers', component: CustomersListPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/customers/:id', label: 'Customer Detail', component: CustomerDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/orders', label: 'Sales Orders', component: SalesOrdersListPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/orders/:id', label: 'Sales Order Detail', component: SalesOrderDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/delivery-notes', label: 'Delivery Notes', component: DeliveryNotesListPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/delivery-notes/new', label: 'New Delivery Note', component: DeliveryNoteDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/delivery-notes/:id', label: 'Delivery Note Detail', component: DeliveryNoteDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/invoices', label: 'Sales Invoices', component: SalesInvoicesListPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/invoices/new', label: 'New Sales Invoice', component: SalesInvoiceDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/invoices/:id', label: 'Sales Invoice Detail', component: SalesInvoiceDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/returns', label: 'Sales Returns', component: SalesReturnsListPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/returns/new', label: 'New Sales Return', component: SalesReturnDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/returns/:id', label: 'Sales Return Detail', component: SalesReturnDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/settings', label: 'Sales Settings', component: SalesSettingsPage, section: 'INVENTORY', requiredModule: 'sales' },

  // Purchase
  { path: '/purchases', label: 'Purchase Overview', component: PurchaseHomePage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/orders', label: 'Purchase Orders', component: PurchaseOrdersListPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/orders/:id', label: 'Purchase Order Detail', component: PurchaseOrderDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/goods-receipts', label: 'Goods Receipts', component: GoodsReceiptsListPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/goods-receipts/new', label: 'New Goods Receipt', component: GoodsReceiptDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/goods-receipts/:id', label: 'Goods Receipt Detail', component: GoodsReceiptDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/invoices', label: 'Purchase Invoices', component: PurchaseInvoicesListPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/invoices/new', label: 'New Purchase Invoice', component: PurchaseInvoiceDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/invoices/:id', label: 'Purchase Invoice Detail', component: PurchaseInvoiceDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/returns', label: 'Purchase Returns', component: PurchaseReturnsListPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/returns/new', label: 'New Purchase Return', component: PurchaseReturnDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/returns/:id', label: 'Purchase Return Detail', component: PurchaseReturnDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/settings', label: 'Purchase Settings', component: PurchaseSettingsPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/vendors', label: 'Vendors', component: VendorsListPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/vendors/:id', label: 'Vendor Detail', component: VendorDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  
  // USER PROFILE
  { path: '/profile', label: 'My Profile', component: lazy(() => import('../modules/core/pages/ProfilePage')), section: 'CORE', hideInMenu: true },
];
