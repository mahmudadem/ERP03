import { lazy, ComponentType } from 'react';
const CompanyCurrencySettings = lazy(() => import('../modules/shared/pages/settings/CompanyCurrencySettings').then(m => ({ default: m.CompanyCurrencySettings })));

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
const VoucherLedgerImpactPage = lazy(() => import('../modules/accounting/pages/VoucherLedgerImpactPage'));
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
const InventoryFinancialIntegrationWizard = lazy(() => import('../modules/inventory/wizards/InventoryFinancialIntegrationWizard').then(m => ({ default: m.InventoryFinancialIntegrationWizard })));
const PurchaseFinancialIntegrationWizard = lazy(() => import('../modules/purchases/wizards/PurchaseFinancialIntegrationWizard').then(m => ({ default: m.PurchaseFinancialIntegrationWizard })));
const SalesFinancialIntegrationWizard = lazy(() => import('../modules/sales/wizards/SalesFinancialIntegrationWizard').then(m => ({ default: m.SalesFinancialIntegrationWizard })));

// Inventory
const InventoryHomePage = lazy(() => import('../modules/inventory/pages/InventoryHomePage'));
const ItemsListPage = lazy(() => import('../modules/inventory/pages/ItemsListPage'));
const ItemDetailPage = lazy(() => import('../modules/inventory/pages/ItemDetailPage'));
const CategoriesPage = lazy(() => import('../modules/inventory/pages/CategoriesPage'));
const WarehousesPage = lazy(() => import('../modules/inventory/pages/WarehousesPage'));
const StockLevelsPage = lazy(() => import('../modules/inventory/pages/StockLevelsPage'));
const StockMovementsPage = lazy(() => import('../modules/inventory/pages/StockMovementsPage'));
const StockAdjustmentPage = lazy(() => import('../modules/inventory/pages/StockAdjustmentPage'));
const InventoryRevaluationPage = lazy(() => import('../modules/inventory/pages/InventoryRevaluationPage'));
const OpeningStockPage = lazy(() => import('../modules/inventory/pages/OpeningStockPage'));
const StockTransfersPage = lazy(() => import('../modules/inventory/pages/StockTransfersPage'));
const LowStockAlertsPage = lazy(() => import('../modules/inventory/pages/LowStockAlertsPage'));
const UnsettledCostsPage = lazy(() => import('../modules/inventory/pages/UnsettledCostsPage'));
const InventoryValuationPage = lazy(() => import('../modules/inventory/pages/InventoryValuationPage'));
const InventoryGLReconciliationPage = lazy(() => import('../modules/inventory/pages/InventoryGLReconciliationPage'));
const InventorySettingsPage = lazy(() => import('../modules/inventory/pages/InventorySettingsPage'));
const UomsPage = lazy(() => import('../modules/inventory/pages/UomsPage'));

// HR
const HrHomePage = lazy(() => import('../modules/hr/pages/HrHomePage'));
const EmployeesListPage = lazy(() => import('../modules/hr/pages/EmployeesListPage'));

// POS
const PosHomePage = lazy(() => import('../modules/pos/pages/PosHomePage'));
const PosSetupPage = lazy(() => import('../modules/pos/pages/PosSetupPage'));
const PosSettingsPage = lazy(() => import('../modules/pos/pages/PosSettingsPage'));
const PosRegistersPage = lazy(() => import('../modules/pos/pages/PosRegistersPage'));
const PosShiftPage = lazy(() => import('../modules/pos/pages/PosShiftPage'));
const PosReturnPage = lazy(() => import('../modules/pos/pages/PosReturnPage'));
const PosZReportPage = lazy(() => import('../modules/pos/pages/PosZReportPage'));
const PosDailySummaryReportPage = lazy(() => import('../modules/pos/pages/PosDailySummaryReportPage'));
const PosPaymentMethodReportPage = lazy(() => import('../modules/pos/pages/PosPaymentMethodReportPage'));
const PosCashierSalesReportPage = lazy(() => import('../modules/pos/pages/PosCashierSalesReportPage'));
const PosCashOverShortReportPage = lazy(() => import('../modules/pos/pages/PosCashOverShortReportPage'));
const PosReceiptHistoryReportPage = lazy(() => import('../modules/pos/pages/PosReceiptHistoryReportPage'));
const PosCancelledReceiptsReportPage = lazy(() => import('../modules/pos/pages/PosCancelledReceiptsReportPage'));
const PosOverrideAuditReportPage = lazy(() => import('../modules/pos/pages/PosOverrideAuditReportPage'));
const PosTopSellingItemsReportPage = lazy(() => import('../modules/pos/pages/PosTopSellingItemsReportPage'));
const PosReprintAuditReportPage = lazy(() => import('../modules/pos/pages/PosReprintAuditReportPage'));

// Settings
const SettingsHomePage = lazy(() => import('../modules/settings/pages/SettingsHomePage'));
const CommunicationsSettingsPage = lazy(() => import('../modules/settings/pages/CommunicationsSettingsPage'));
const AppearanceSettingsPage = lazy(() => import('../modules/settings/pages/AppearanceSettingsPage'));
const SidebarSettingsPage = lazy(() => import('../modules/settings/pages/SidebarSettingsPage'));
const ApprovalSettingsPage = lazy(() => import('../modules/settings/pages/ApprovalSettingsPage'));
const NotificationSettingsPage = lazy(() => import('../modules/settings/pages/NotificationSettingsPage'));
const TaxCodesPage = lazy(() => import('../modules/settings/pages/TaxCodesPage'));

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
const AiToolCatalogPage = lazy(() => import('../modules/super-admin/pages/AiToolCatalogPage').then(m => ({ default: m.AiToolCatalogPage })));
const AiToolDetailPage = lazy(() => import('../modules/super-admin/pages/AiToolDetailPage').then(m => ({ default: m.AiToolDetailPage })));
const AiManagementOverviewPage = lazy(() => import('../modules/super-admin/pages/AiManagementOverviewPage').then(m => ({ default: m.AiManagementOverviewPage })));
const AiModelProfilesPage = lazy(() => import('../modules/super-admin/pages/AiModelProfilesPage').then(m => ({ default: m.AiModelProfilesPage })));
const AiProvidersPage = lazy(() => import('../modules/super-admin/pages/AiProvidersPage').then(m => ({ default: m.AiProvidersPage })));
const AiRuntimeProfilesPage = lazy(() => import('../modules/super-admin/pages/AiRuntimeProfilesPage').then(m => ({ default: m.AiRuntimeProfilesPage })));
const AiSetupWizardPage = lazy(() => import('../modules/super-admin/pages/AiSetupWizardPage').then(m => ({ default: m.AiSetupWizardPage })));
const AiApiKeysPage = lazy(() => import('../modules/super-admin/pages/AiApiKeysPage').then(m => ({ default: m.AiApiKeysPage })));
const AiProposalPolicyPage = lazy(() => import('../modules/super-admin/pages/AiProposalPolicyPage').then(m => ({ default: m.AiProposalPolicyPage })));
const SuperAdminAppearancePage = lazy(() => import('../modules/super-admin/pages/SuperAdminAppearancePage'));
const SystemFormDesignerPage = lazy(() => import('../modules/super-admin/pages/SystemFormDesignerPage').then(m => ({ default: m.default })));

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
const SuperAdminFieldLibraryPage = lazy(() => import('../pages/super-admin/pages/SuperAdminFieldLibraryPage').then(module => ({ default: module.SuperAdminFieldLibraryPage })));

// Company Admin
const CompanyAdminOverviewPage = lazy(() => import('../pages/company-admin/pages/OverviewPage'));
const CompanyAdminUsersPage = lazy(() => import('../pages/company-admin/pages/UsersPage'));
const CompanyAdminRolesPage = lazy(() => import('../pages/company-admin/pages/RolesPage'));
const CompanyAdminModulesPage = lazy(() => import('../pages/company-admin/pages/ModulesPage'));
const CompanyAdminFeaturesPage = lazy(() => import('../pages/company-admin/pages/FeaturesPage'));
const CompanyAdminBundlesPage = lazy(() => import('../pages/company-admin/pages/BundlesPage'));
const CompanyAdminSettingsPage = lazy(() => import('../pages/company-admin/pages/SettingsPage'));
const PurchaseHomePage = lazy(() => import('../modules/purchases/pages/PurchaseHomePage'));
const PurchaseOrdersListPage = lazy(() => import('../modules/purchases/pages/PurchaseOrdersListPage'));
const PurchaseOrderDetailPage = lazy(() => import('../modules/purchases/pages/PurchaseOrderDetailPage'));
const PurchaseSettingsPage = lazy(() => import('../modules/purchases/pages/PurchaseSettingsPage'));
const VendorsListPage = lazy(() => import('../modules/purchases/pages/VendorsListPage'));
const VendorDetailPage = lazy(() => import('../modules/purchases/pages/VendorDetailPage'));
const VendorGroupsPage = lazy(() => import('../modules/purchases/pages/VendorGroupsPage'));
const PurchasePriceListsPage = lazy(() => import('../modules/purchases/pages/PurchasePriceListsPage'));
const GoodsReceiptsListPage = lazy(() => import('../modules/purchases/pages/GoodsReceiptsListPage'));
const GoodsReceiptDetailPage = lazy(() => import('../modules/purchases/pages/GoodsReceiptDetailPage'));
const PurchaseInvoicesListPage = lazy(() => import('../modules/purchases/pages/PurchaseInvoicesListPage'));
const PurchaseInvoiceDetailPage = lazy(() => import('../modules/purchases/pages/PurchaseInvoiceDetailPage'));
const PurchaseReturnsListPage = lazy(() => import('../modules/purchases/pages/PurchaseReturnsListPage'));
const PurchaseReturnDetailPage = lazy(() => import('../modules/purchases/pages/PurchaseReturnDetailPage'));
const VendorStatementPage = lazy(() => import('../modules/purchases/pages/VendorStatementPage'));
const ApAgingReportPage = lazy(() => import('../modules/purchases/pages/ApAgingReportPage'));
const PurchasesAnalyticsPage = lazy(() => import('../modules/purchases/pages/PurchasesAnalyticsPage'));
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
const PriceListsPage = lazy(() => import('../modules/sales/pages/PriceListsPage'));
const CustomerGroupsPage = lazy(() => import('../modules/sales/pages/CustomerGroupsPage'));
const SalespersonsPage = lazy(() => import('../modules/sales/pages/SalespersonsPage'));
const QuotationsPage = lazy(() => import('../modules/sales/pages/QuotationsPage'));
const QuotationDetailPage = lazy(() => import('../modules/sales/pages/QuotationDetailPage'));
const PromotionsPage = lazy(() => import('../modules/sales/pages/PromotionsPage'));
const AgedBacklogPage = lazy(() => import('../modules/sales/pages/AgedBacklogPage'));
const ArAgingReportPage = lazy(() => import('../modules/sales/pages/ArAgingReportPage'));
const CustomerStatementPage = lazy(() => import('../modules/sales/pages/CustomerStatementPage'));
const SalesAnalyticsPage = lazy(() => import('../modules/sales/pages/SalesAnalyticsPage'));
const SalesGrossProfitByDocumentPage = lazy(() => import('../modules/sales/pages/SalesGrossProfitByDocumentPage'));
const SalesGrossProfitByItemPage = lazy(() => import('../modules/sales/pages/SalesGrossProfitByItemPage'));
const RecurringInvoicesPage = lazy(() => import('../modules/sales/pages/RecurringInvoicesPage'));
const DynamicDocumentPage = lazy(() => import('../modules/tools/pages/DynamicDocumentPage'));
const CanvasDevPage = lazy(() => import('../pages/dev/CanvasDevPage').then(m => ({ default: m.CanvasDevPage })));
const TailwindPlayDemoPage = lazy(() => import('../pages/dev/TailwindPlayDemoPage').then(m => ({ default: m.TailwindPlayDemoPage })));
const UiLabDashboard = lazy(() => import('../pages/dev/UiLabDashboard').then(m => ({ default: m.UiLabDashboard })));
const SalesInvoiceV2LayoutPage = lazy(() => import('../pages/dev/SalesInvoiceV2LayoutPage'));
const CompactSalesInvoiceMockPage = lazy(() => import('../pages/dev/CompactSalesInvoiceMockPage'));
const ApexLedgerDashboard = lazy(() => import('../pages/dev/apex-ledger/ApexLedgerDashboard'));
const IconsComparisonPage = lazy(() => import('../pages/dev/IconsComparisonPage').then(m => ({ default: m.IconsComparisonPage })));
const SpinnerGalleryPage = lazy(() => import('../pages/dev/SpinnerGalleryPage').then(m => ({ default: m.SpinnerGalleryPage })));


export interface AppRoute {
  path: string;
  label: string;
  component: ComponentType<any>;
  section: 'CORE' | 'ACCOUNTING' | 'INVENTORY' | 'HR' | 'POS' | 'SETTINGS' | 'SUPER_ADMIN' | 'SETUP' | 'TOOLS';
  hideInMenu?: boolean;
  requiredPermission?: string;
  requiredGlobalRole?: 'SUPER_ADMIN';
  requiredModule?: string;
  requiredOperationalWorkflow?: 'sales' | 'purchase';
}

export const routesConfig: AppRoute[] = [
  // CORE
  { path: '/', label: 'Dashboard', component: DashboardPage, section: 'CORE' },
  { path: '/companies', label: 'Companies', component: CompaniesPage, section: 'CORE' },
  { path: '/notifications', label: 'Notifications', component: NotificationInboxPage, section: 'CORE', hideInMenu: true },

  // MODULE INITIALIZATION WIZARDS (No module/permission requirements)
  { path: '/accounting/setup', label: 'Accounting Setup', component: AccountingInitializationWizard, section: 'SETUP', hideInMenu: true },
  { path: '/companyAdmin/setup', label: 'Company Admin Setup', component: CompanyAdminInitializationWizard, section: 'SETUP', hideInMenu: true },
  { path: '/inventory/financial-integration', label: 'Inventory Financial Integration', component: InventoryFinancialIntegrationWizard, section: 'SETUP', hideInMenu: true },
  { path: '/purchases/financial-integration', label: 'Purchase Financial Integration', component: PurchaseFinancialIntegrationWizard, section: 'SETUP', hideInMenu: true },
  { path: '/sales/financial-integration', label: 'Sales Financial Integration', component: SalesFinancialIntegrationWizard, section: 'SETUP', hideInMenu: true },

  // ACCOUNTING
  { path: '/accounting', label: 'Overview', component: AccountingDashboard, section: 'ACCOUNTING', requiredModule: 'accounting' },
  { path: '/accounting/approvals', label: 'Approval Center', component: ApprovalsPage, section: 'ACCOUNTING', requiredPermission: 'accounting.vouchers.view', requiredModule: 'accounting' },
  { path: '/accounting/accounts', label: 'Chart of Accounts', component: AccountsListPage, section: 'ACCOUNTING', requiredPermission: 'accounting.accounts.view', requiredModule: 'accounting' },
  { path: '/accounting/settings/subgroup-tagging', label: 'Subgroup Tagging', component: SubgroupTaggingPage, section: 'ACCOUNTING', requiredPermission: 'accounting.accounts.edit', requiredModule: 'accounting' },
  { path: '/accounting/vouchers', label: 'Vouchers', component: VouchersListPage, section: 'ACCOUNTING', requiredPermission: 'accounting.vouchers.view', requiredModule: 'accounting' },
  { path: '/accounting/vouchers/:id/ledger', label: 'Voucher Ledger Impact', component: VoucherLedgerImpactPage, section: 'ACCOUNTING', hideInMenu: true, requiredPermission: 'accounting.reports.generalLedger.view', requiredModule: 'accounting' },
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
  { path: '/accounting/tools/voucher-designer', label: 'Voucher Designer', component: lazy(() => import('../modules/accounting/pages/AccountingVoucherDesignerPage')), section: 'ACCOUNTING', requiredPermission: 'accounting.settings.view', requiredModule: 'accounting', hideInMenu: true },
  // Legacy path from Phase 2 — superseded by the unified Voucher Designer.
  { path: '/accounting/settings/voucher-types', label: 'Voucher Designer', component: lazy(() => import('../modules/accounting/pages/AccountingVoucherDesignerPage')), section: 'ACCOUNTING', requiredPermission: 'accounting.settings.view', requiredModule: 'accounting', hideInMenu: true },
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
  { path: '/inventory/adjustments/new', label: 'New Adjustment', component: StockAdjustmentPage, section: 'INVENTORY', hideInMenu: true, requiredPermission: 'inventory.stock.adjust', requiredModule: 'inventory' },
  { path: '/inventory/adjustments/:id', label: 'Adjustment Detail', component: StockAdjustmentPage, section: 'INVENTORY', hideInMenu: true, requiredPermission: 'inventory.stock.adjust', requiredModule: 'inventory' },
  { path: '/inventory/adjustments', label: 'Adjustments', component: StockAdjustmentPage, section: 'INVENTORY', requiredPermission: 'inventory.stock.adjust', requiredModule: 'inventory' },

  { path: '/inventory/revaluations/new', label: 'New Inventory Revaluation', component: InventoryRevaluationPage, section: 'INVENTORY', hideInMenu: true, requiredPermission: 'inventory.stock.adjust', requiredModule: 'inventory' },
  { path: '/inventory/revaluations/:id', label: 'Inventory Revaluation Detail', component: InventoryRevaluationPage, section: 'INVENTORY', hideInMenu: true, requiredPermission: 'inventory.stock.adjust', requiredModule: 'inventory' },
  { path: '/inventory/revaluations', label: 'Revaluations', component: InventoryRevaluationPage, section: 'INVENTORY', requiredPermission: 'inventory.stock.adjust', requiredModule: 'inventory' },
  { path: '/inventory/transfers', label: 'Transfers', component: StockTransfersPage, section: 'INVENTORY', requiredPermission: 'inventory.stock.adjust', requiredModule: 'inventory' },
  { path: '/inventory/alerts/low-stock', label: 'Low Stock Alerts', component: LowStockAlertsPage, section: 'INVENTORY', requiredPermission: 'inventory.stock.view', requiredModule: 'inventory' },
  { path: '/inventory/reports/unsettled-costs', label: 'Unsettled Costs', component: UnsettledCostsPage, section: 'INVENTORY', requiredPermission: 'inventory.movements.view', requiredModule: 'inventory' },
  { path: '/inventory/reports/valuation', label: 'Inventory Valuation', component: InventoryValuationPage, section: 'INVENTORY', requiredPermission: 'inventory.valuation.view', requiredModule: 'inventory' },
  { path: '/inventory/reports/gl-reconciliation', label: 'Inventory ↔ GL Reconciliation', component: InventoryGLReconciliationPage, section: 'INVENTORY', requiredPermission: 'inventory.valuation.view', requiredModule: 'inventory' },
  { path: '/inventory/opening-stock/new', label: 'New Opening Stock Document', component: OpeningStockPage, section: 'INVENTORY', hideInMenu: true, requiredPermission: 'inventory.movements.record', requiredModule: 'inventory' },
  { path: '/inventory/opening-stock/:id', label: 'Opening Stock Document Detail', component: OpeningStockPage, section: 'INVENTORY', hideInMenu: true, requiredPermission: 'inventory.movements.record', requiredModule: 'inventory' },
  { path: '/inventory/opening-stock', label: 'Opening Stock Documents', component: OpeningStockPage, section: 'INVENTORY', requiredPermission: 'inventory.movements.record', requiredModule: 'inventory' },
  { path: '/inventory/uoms', label: 'UOM Master', component: UomsPage, section: 'INVENTORY', requiredPermission: 'inventory.uom.view', requiredModule: 'inventory' },
  { path: '/inventory/settings', label: 'Settings', component: InventorySettingsPage, section: 'INVENTORY', requiredPermission: 'inventory.settings.manage', requiredModule: 'inventory' },

  // HR
  { path: '/hr', label: 'Overview', component: HrHomePage, section: 'HR', requiredModule: 'hr' },
  { path: '/hr/employees', label: 'Employees', component: EmployeesListPage, section: 'HR', requiredPermission: 'hr.employees.view', requiredModule: 'hr' },

  // POS
  { path: '/pos/setup', label: 'POS Setup', component: PosSetupPage, section: 'SETUP', requiredModule: 'pos', requiredPermission: 'pos.settings.manage', hideInMenu: true },
  { path: '/pos', label: 'Terminal', component: PosHomePage, section: 'POS', requiredPermission: 'pos.terminal.access', requiredModule: 'pos' },
  { path: '/pos/settings', label: 'Settings', component: PosSettingsPage, section: 'POS', requiredPermission: 'pos.settings.manage', requiredModule: 'pos' },
  { path: '/pos/registers', label: 'Registers', component: PosRegistersPage, section: 'POS', requiredPermission: 'pos.registers.manage', requiredModule: 'pos' },
  { path: '/pos/shift', label: 'Shift', component: PosShiftPage, section: 'POS', requiredPermission: 'pos.shift.open', requiredModule: 'pos' },
  { path: '/pos/returns', label: 'Returns', component: PosReturnPage, section: 'POS', requiredPermission: 'pos.return.create', requiredModule: 'pos' },
  { path: '/pos/reports/z', label: 'Z Report', component: PosZReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },
  { path: '/pos/reports/daily', label: 'Daily Summary', component: PosDailySummaryReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },
  { path: '/pos/reports/payments', label: 'Payment Methods', component: PosPaymentMethodReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },
  { path: '/pos/reports/cashiers', label: 'Cashier Sales', component: PosCashierSalesReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },
  { path: '/pos/reports/over-short', label: 'Cash Over/Short', component: PosCashOverShortReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },
  { path: '/pos/reports/receipts', label: 'Receipt History', component: PosReceiptHistoryReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },
  { path: '/pos/reports/cancelled-receipts', label: 'Cancelled Receipts', component: PosCancelledReceiptsReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },
  { path: '/pos/reports/top-selling-items', label: 'Top Selling Items', component: PosTopSellingItemsReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },
  { path: '/pos/reports/override-audit', label: 'Override Audit', component: PosOverrideAuditReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },
  { path: '/pos/reports/reprint-audit', label: 'Reprint Audit', component: PosReprintAuditReportPage, section: 'POS', requiredPermission: 'pos.reports.view', requiredModule: 'pos' },


  // SETTINGS
  { path: '/settings', label: 'General', component: SettingsHomePage, section: 'SETTINGS' },
  { path: '/settings/appearance', label: 'Appearance', component: AppearanceSettingsPage, section: 'SETTINGS', hideInMenu: true },
  { path: '/settings/widgets', label: 'Topbar Widgets', component: lazy(() => import('../modules/settings/pages/TopbarWidgetDesignerPage')), section: 'SETTINGS', hideInMenu: true },
  { path: '/settings/sidebar', label: 'Menu Config', component: SidebarSettingsPage, section: 'SETTINGS', hideInMenu: true },
  { path: '/settings/notifications', label: 'Notifications', component: NotificationSettingsPage, section: 'SETTINGS', hideInMenu: true },
  { path: '/settings/communications', label: 'Communications', component: CommunicationsSettingsPage, section: 'SETTINGS' },
  { path: '/settings/approval', label: 'Approval Workflow', component: ApprovalSettingsPage, section: 'SETTINGS', requiredPermission: 'system.company.settings.manage' },
  { path: '/settings/tax-codes', label: 'Tax Codes', component: TaxCodesPage, section: 'SETTINGS' },
  { path: '/system/currencies', label: 'Currencies', component: CompanyCurrencySettings, section: 'SETTINGS', requiredPermission: 'system.company.settings.manage' },

  // RBAC
  { path: '/settings/rbac/roles', label: 'Roles', component: RolesListPage, section: 'SETTINGS', requiredPermission: 'system.roles.manage' },
  { path: '/settings/rbac/roles/:roleId', label: 'Edit Role', component: EditRolePage, section: 'SETTINGS', hideInMenu: true, requiredPermission: 'system.roles.manage' },
  { path: '/settings/rbac/users', label: 'Assign Users', component: AssignUsersRolesPage, section: 'SETTINGS', requiredPermission: 'system.roles.manage' },

  // RBAC
  { path: '/super-admin/overview', label: 'System Overview', component: SystemOverviewPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/users', label: 'Users Management', component: SuperAdminUsersManagementPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/companies', label: 'All Companies', component: CompaniesListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/companies/:companyId/entitlements', label: 'Company Modules', component: lazy(() => import('../modules/super-admin/pages/CompanyEntitlementsPage')), section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/business-domains', label: 'Business Domains', component: BusinessDomainsManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/bundles-manager', label: 'Bundles', component: BundlesManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/permissions-registry', label: 'Permissions Registry', component: PermissionsManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/modules-registry', label: 'Modules Registry', component: ModulesManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/ai-tools', label: 'AI Tools', component: AiToolCatalogPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/ai-tools/:toolName', label: 'AI Tool Detail', component: AiToolDetailPage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/ai-management', label: 'AI Overview', component: AiManagementOverviewPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/ai-setup', label: 'AI Setup Wizard', component: AiSetupWizardPage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/ai-api-keys', label: 'AI API Keys', component: AiApiKeysPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/ai-providers', label: 'AI Providers', component: AiProvidersPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/ai-runtime-profiles', label: 'Runtime Profiles', component: AiRuntimeProfilesPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/ai-models', label: 'AI Models', component: AiModelProfilesPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/ai-proposal-policies', label: 'AI Proposal Policies', component: AiProposalPolicyPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/plans', label: 'Plans', component: PlansManagerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/permissions', label: 'Module Permissions', component: ModulePermissionsListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/permissions/:moduleId', label: 'Edit Module Permissions', component: EditModulePermissionsPage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/roles', label: 'Roles', component: RolePermissionsListPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/roles/:roleId', label: 'Edit Role', component: SuperAdminEditRolePage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/templates', label: 'Templates', component: SuperAdminTemplatesPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/voucher-templates', label: 'Voucher Templates', component: SuperAdminVoucherTemplatesPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/voucher-templates/:id', label: 'Edit Voucher Template', component: VoucherTemplateEditorPage, section: 'SUPER_ADMIN', hideInMenu: true, requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/field-library', label: 'Field Library', component: SuperAdminFieldLibraryPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/appearance', label: 'Appearance Lab', component: SuperAdminAppearancePage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },
  { path: '/super-admin/system-forms', label: 'System Forms', component: SystemFormDesignerPage, section: 'SUPER_ADMIN', requiredGlobalRole: 'SUPER_ADMIN' },

  // Company Wizard (user accessible)
  { path: '/company-wizard', label: 'Company Wizard', component: SelectModelPage, section: 'CORE' },
  { path: '/company-wizard/run', label: 'Run Company Wizard', component: DynamicWizardPage, section: 'CORE', hideInMenu: true },
  { path: '/company-selector', label: 'Select Company', component: CompanySelectorPage, section: 'CORE', hideInMenu: true },

  // COMPANY ADMIN
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
  { path: '/crm/leads', label: 'CRM Overview', component: lazy(() => import('../modules/crm/pages/CrmHomePage')), section: 'SETTINGS', requiredPermission: 'crm.leads.view', requiredModule: 'crm' },
  { path: '/crm/customers', label: 'Customers', component: lazy(() => import('../modules/crm/pages/CrmHomePage')), section: 'SETTINGS', requiredPermission: 'crm.customers.view', requiredModule: 'crm' },

  // Manufacturing
  { path: '/manufacturing/work-orders', label: 'Manufacturing', component: lazy(() => import('../modules/manufacturing/pages/ManufacturingHomePage')), section: 'SETTINGS', requiredPermission: 'manufacturing.workOrders.view', requiredModule: 'manufacturing' },
  { path: '/manufacturing/bom', label: 'BoM', component: lazy(() => import('../modules/manufacturing/pages/ManufacturingHomePage')), section: 'SETTINGS', requiredPermission: 'manufacturing.bom.view', requiredModule: 'manufacturing' },

  // Projects
  { path: '/projects', label: 'Projects', component: lazy(() => import('../modules/projects/pages/ProjectsHomePage')), section: 'SETTINGS', requiredPermission: 'projects.view', requiredModule: 'projects' },
  { path: '/projects/tasks', label: 'Tasks', component: lazy(() => import('../modules/projects/pages/ProjectsHomePage')), section: 'SETTINGS', requiredPermission: 'projects.tasks.view', requiredModule: 'projects' },

  // Sales
  { path: '/sales', label: 'Sales Overview', component: SalesHomePage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/items', label: 'Products & Services', component: ItemsListPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/items/:id', label: 'Item Detail', component: ItemDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/customers', label: 'Customers', component: CustomersListPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/customers/:id', label: 'Customer Detail', component: CustomerDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/orders', label: 'Sales Orders', component: SalesOrdersListPage, section: 'INVENTORY', requiredModule: 'sales', requiredOperationalWorkflow: 'sales' },
  { path: '/sales/orders/:id', label: 'Sales Order Detail', component: SalesOrderDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales', requiredOperationalWorkflow: 'sales' },
  { path: '/sales/delivery-notes', label: 'Delivery Notes', component: DeliveryNotesListPage, section: 'INVENTORY', requiredModule: 'sales', requiredOperationalWorkflow: 'sales' },
  { path: '/sales/delivery-notes/new', label: 'New Delivery Note', component: DeliveryNoteDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales', requiredOperationalWorkflow: 'sales' },
  { path: '/sales/delivery-notes/:id', label: 'Delivery Note Detail', component: DeliveryNoteDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales', requiredOperationalWorkflow: 'sales' },
  { path: '/sales/invoices', label: 'Sales Invoices', component: SalesInvoicesListPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/invoices/new', label: 'New Sales Invoice', component: SalesInvoiceDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/invoices/:id', label: 'Sales Invoice Detail', component: SalesInvoiceDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/returns', label: 'Sales Returns', component: SalesReturnsListPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/returns/new', label: 'New Sales Return', component: SalesReturnDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/returns/:id', label: 'Sales Return Detail', component: SalesReturnDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/settings', label: 'Sales Settings', component: SalesSettingsPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/tools/voucher-designer', label: 'Voucher Designer', component: lazy(() => import('../modules/sales/pages/SalesVoucherDesignerPage')), section: 'INVENTORY', requiredModule: 'sales', hideInMenu: true },
  // Legacy path from Phase 2 — superseded by the unified Voucher Designer.
  { path: '/sales/settings/voucher-types', label: 'Voucher Designer', component: lazy(() => import('../modules/sales/pages/SalesVoucherDesignerPage')), section: 'INVENTORY', requiredModule: 'sales', hideInMenu: true },
  { path: '/sales/price-lists', label: 'Price Lists', component: PriceListsPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/customer-groups', label: 'Customer Groups', component: CustomerGroupsPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/salespersons', label: 'Salespersons', component: SalespersonsPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/quotes', label: 'Quotations', component: QuotationsPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/quotes/new', label: 'New Quotation', component: QuotationDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/quotes/:id', label: 'Quotation Detail', component: QuotationDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/promotions', label: 'Promotions', component: PromotionsPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/aged-backlog', label: 'Aged Backlog', component: AgedBacklogPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/reports/ar-aging', label: 'AR Aging', component: ArAgingReportPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/reports/customer-statement', label: 'Customer Statement', component: CustomerStatementPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/reports/sales-analytics', label: 'Sales Analytics', component: SalesAnalyticsPage, section: 'INVENTORY', requiredModule: 'sales' },
  { path: '/sales/reports/gross-profit/by-document', label: 'Gross Profit by Document', component: SalesGrossProfitByDocumentPage, section: 'INVENTORY', requiredPermission: 'accounting.reports.tradingAccount.view', requiredModule: 'sales' },
  { path: '/sales/reports/gross-profit/by-item', label: 'Gross Profit by Item', component: SalesGrossProfitByItemPage, section: 'INVENTORY', requiredPermission: 'accounting.reports.tradingAccount.view', requiredModule: 'sales' },
  { path: '/sales/recurring-invoices', label: 'Recurring Invoices', component: RecurringInvoicesPage, section: 'INVENTORY', requiredModule: 'sales' },

  // Dynamic Sales Documents (designed in Forms Designer)
  { path: '/sales/:formCode', label: 'Documents', component: DynamicDocumentPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/:formCode/new', label: 'New Document', component: DynamicDocumentPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },
  { path: '/sales/:formCode/:id', label: 'Document Detail', component: DynamicDocumentPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'sales' },

  // Purchase
  { path: '/purchases', label: 'Purchase Overview', component: PurchaseHomePage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/items', label: 'Products & Services', component: ItemsListPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/items/:id', label: 'Item Detail', component: ItemDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/vendor-groups', label: 'Vendor Groups', component: VendorGroupsPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/price-lists', label: 'Price Lists', component: PurchasePriceListsPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/orders', label: 'Purchase Orders', component: PurchaseOrdersListPage, section: 'INVENTORY', requiredModule: 'purchase', requiredOperationalWorkflow: 'purchase' },
  { path: '/purchases/orders/:id', label: 'Purchase Order Detail', component: PurchaseOrderDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase', requiredOperationalWorkflow: 'purchase' },
  { path: '/purchases/goods-receipts', label: 'Goods Receipts', component: GoodsReceiptsListPage, section: 'INVENTORY', requiredModule: 'purchase', requiredOperationalWorkflow: 'purchase' },
  { path: '/purchases/goods-receipts/new', label: 'New Goods Receipt', component: GoodsReceiptDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase', requiredOperationalWorkflow: 'purchase' },
  { path: '/purchases/goods-receipts/:id', label: 'Goods Receipt Detail', component: GoodsReceiptDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase', requiredOperationalWorkflow: 'purchase' },
  { path: '/purchases/invoices', label: 'Purchase Invoices', component: PurchaseInvoicesListPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/invoices/new', label: 'New Purchase Invoice', component: PurchaseInvoiceDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/invoices/:id', label: 'Purchase Invoice Detail', component: PurchaseInvoiceDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/returns', label: 'Purchase Returns', component: PurchaseReturnsListPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/returns/new', label: 'New Purchase Return', component: PurchaseReturnDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/returns/:id', label: 'Purchase Return Detail', component: PurchaseReturnDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/reports/vendor-statement', label: 'Vendor Statement', component: VendorStatementPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/reports/ap-aging', label: 'AP Aging', component: ApAgingReportPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/reports/purchases-analytics', label: 'Purchases Analytics', component: PurchasesAnalyticsPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/settings', label: 'Purchase Settings', component: PurchaseSettingsPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/tools/voucher-designer', label: 'Voucher Designer', component: lazy(() => import('../modules/purchases/pages/PurchaseVoucherDesignerPage')), section: 'INVENTORY', requiredModule: 'purchase', hideInMenu: true },
  // Legacy path from Phase 2 — superseded by the unified Voucher Designer.
  { path: '/purchases/settings/voucher-types', label: 'Voucher Designer', component: lazy(() => import('../modules/purchases/pages/PurchaseVoucherDesignerPage')), section: 'INVENTORY', requiredModule: 'purchase', hideInMenu: true },

  // Specific Purchase Master Routes — MUST come BEFORE dynamic :formCode routes
  { path: '/purchases/vendors', label: 'Vendors', component: VendorsListPage, section: 'INVENTORY', requiredModule: 'purchase' },
  { path: '/purchases/vendors/:id', label: 'Vendor Detail', component: VendorDetailPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },

  // Dynamic Purchase Documents (designed in Forms Designer)
  { path: '/purchases/:formCode', label: 'Documents', component: DynamicDocumentPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/:formCode/new', label: 'New Document', component: DynamicDocumentPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },
  { path: '/purchases/:formCode/:id', label: 'Document Detail', component: DynamicDocumentPage, section: 'INVENTORY', hideInMenu: true, requiredModule: 'purchase' },

  
  // TOOLS
  { path: '/tools/forms-designer', label: 'Forms Designer Builder', component: lazy(() => import('../modules/tools/pages/ToolsFormsDesignerPage')), section: 'TOOLS', hideInMenu: false },
  { path: '/canvas-dev', label: 'Canvas Dev', component: CanvasDevPage, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/data-table', label: 'DataTable Demo', component: lazy(() => import('../pages/dev/DataTableDemoPage').then(m => ({ default: m.default }))), section: 'TOOLS', hideInMenu: true },
  { path: '/dev/report-table-demo', label: 'Report Table Demo', component: lazy(() => import('../pages/dev/ReportTableDemoPage')), section: 'TOOLS', hideInMenu: false },
  { path: '/dev/voucher-list', label: 'Voucher List Demo', component: lazy(() => import('../pages/dev/VoucherListDemoPage').then(m => ({ default: m.default }))), section: 'TOOLS', hideInMenu: true },
  { path: '/dev/smart-vouchers', label: 'Smart Voucher List', component: lazy(() => import('../pages/dev/SmartVoucherListPage').then(m => ({ default: m.default }))), section: 'TOOLS', hideInMenu: true },
  { path: '/dev/tailwind-play-demo', label: 'Tailwind Play Demo', component: TailwindPlayDemoPage, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/ui-lab', label: 'UI Lab', component: UiLabDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/icons-comparison', label: 'Icons Comparison', component: IconsComparisonPage, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/spinners', label: 'Spinner Options', component: SpinnerGalleryPage, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/sales-invoice-v2', label: 'Sales Invoice V2', component: SalesInvoiceV2LayoutPage, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/sales-invoice-compact', label: 'Sales Invoice Compact Mock', component: CompactSalesInvoiceMockPage, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger', label: 'Apex Shell Candidate', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  // Accounting sub-routes
  { path: '/dev/apex-ledger/accounting', label: 'Apex Accounting Overview', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/coa', label: 'Apex Chart of Accounts', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/vouchers', label: 'Apex Vouchers List', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/approvals', label: 'Apex Approvals', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/settings', label: 'Apex Settings', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  // Reports hub + all 13 sub-reports
  { path: '/dev/apex-ledger/reports', label: 'Apex Reports', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/trial-balance', label: 'Apex Trial Balance', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/account-statement', label: 'Apex Account Statement', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/balance-sheet', label: 'Apex Balance Sheet', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/ledger', label: 'Apex General Ledger', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/profit-loss', label: 'Apex Profit & Loss', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/trading-account', label: 'Apex Trading Account', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/cash-flow', label: 'Apex Cash Flow', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/journal', label: 'Apex Journal', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/aging', label: 'Apex Aging', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/bank-reconciliation', label: 'Apex Bank Reconciliation', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/cost-center-summary', label: 'Apex Cost Center Summary', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/budget-vs-actual', label: 'Apex Budget vs Actual', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/reports/consolidated-tb', label: 'Apex Consolidated TB', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  // Tools hub + sub-tools
  { path: '/dev/apex-ledger/tools', label: 'Apex Tools', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/tools/forms', label: 'Apex Forms Management', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/tools/budgets', label: 'Apex Budgets', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/tools/subgroup-tagging', label: 'Apex Subgroup Tagging', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  // Module routes
  { path: '/dev/apex-ledger/sales', label: 'Apex Sales', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/purchases', label: 'Apex Purchases', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/inventory', label: 'Apex Inventory', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/ai', label: 'Apex AI Assistant', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/hr', label: 'Apex HR', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/crm', label: 'Apex CRM', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/pos', label: 'Apex POS', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/manufacturing', label: 'Apex Manufacturing', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/projects', label: 'Apex Projects', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/settings/appearance', label: 'Apex Appearance Settings', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/settings/accounting', label: 'Apex Accounting Settings Details', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/profile', label: 'Apex User Profile', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },
  { path: '/dev/apex-ledger/*', label: 'Apex Wildcard Catch-All', component: ApexLedgerDashboard, section: 'TOOLS', hideInMenu: true },



  // AI ASSISTANT
  { path: '/ai-assistant/setup', label: 'AI Setup', component: lazy(() => import('../modules/ai-assistant/pages/AiAssistantSetupPage').then(m => ({ default: m.AiAssistantSetupPage }))), section: 'SETTINGS', requiredModule: 'ai-assistant', requiredPermission: 'ai-assistant.settings.view', hideInMenu: true },
  { path: '/ai-assistant', label: 'AI Assistant', component: lazy(() => import('../modules/ai-assistant/pages/AiAssistantHomePage')), section: 'SETTINGS', requiredModule: 'ai-assistant', requiredPermission: 'ai-assistant.chat.use' },
  { path: '/ai-assistant/mock', label: 'AI Assistant (Widget Mode)', component: lazy(() => import('../modules/ai-assistant/pages/AiAssistantHomePage')), section: 'SETTINGS', requiredModule: 'ai-assistant', requiredPermission: 'ai-assistant.chat.use' },
  { path: '/ai-assistant/settings', label: 'AI Settings', component: lazy(() => import('../modules/ai-assistant/pages/AiAssistantSettingsPage').then(m => ({ default: m.AiAssistantSettingsPage }))), section: 'SETTINGS', requiredModule: 'ai-assistant', requiredPermission: 'ai-assistant.settings.view' },
  { path: '/ai-assistant/usage', label: 'AI Usage', component: lazy(() => import('../modules/ai-assistant/pages/AiUsageDashboardPage')), section: 'SETTINGS', requiredModule: 'ai-assistant', requiredPermission: 'ai-assistant.settings.view', hideInMenu: false },
  { path: '/ai-assistant/proposals', label: 'AI Proposals', component: lazy(() => import('../modules/ai-assistant/pages/AiProposalListPage').then(m => ({ default: m.AiProposalListPage }))), section: 'SETTINGS', requiredModule: 'ai-assistant', requiredPermission: 'ai-assistant.proposals.view', hideInMenu: false },
  { path: '/ai-assistant/proposals/:proposalId', label: 'Proposal Detail', component: lazy(() => import('../modules/ai-assistant/pages/AiProposalDetailPage').then(m => ({ default: m.AiProposalDetailPage }))), section: 'SETTINGS', requiredModule: 'ai-assistant', requiredPermission: 'ai-assistant.proposals.view', hideInMenu: true },

  // USER PROFILE
  { path: '/profile', label: 'My Profile', component: lazy(() => import('../modules/core/pages/ProfilePage')), section: 'CORE', hideInMenu: true },
];
