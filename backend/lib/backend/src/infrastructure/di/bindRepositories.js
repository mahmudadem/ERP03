"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.diContainer = void 0;
const firebaseAdmin_1 = __importDefault(require("../../firebaseAdmin"));
const CompanyRolePermissionResolver_1 = require("../../application/rbac/CompanyRolePermissionResolver");
// Import All Firestore Implementations
const FirestoreCompanyRepository_1 = require("../firestore/repositories/core/FirestoreCompanyRepository");
const FirestoreUserRepository_1 = require("../firestore/repositories/core/FirestoreUserRepository");
const FirestoreCompanyUserRepository_1 = require("../firestore/repositories/core/FirestoreCompanyUserRepository");
const FirestoreCompanySettingsRepository_1 = require("../firestore/repositories/core/FirestoreCompanySettingsRepository");
const FirestoreUserPreferencesRepository_1 = require("../firestore/repositories/core/FirestoreUserPreferencesRepository");
const FirestoreSystemRepositories_1 = require("../firestore/repositories/system/FirestoreSystemRepositories");
const FirestoreVoucherRepositoryV2_1 = require("../firestore/repositories/accounting/FirestoreVoucherRepositoryV2");
const FirestoreVoucherSequenceRepository_1 = require("../firestore/repositories/accounting/FirestoreVoucherSequenceRepository");
const FirestoreAccountingRepositories_1 = require("../firestore/repositories/accounting/FirestoreAccountingRepositories");
const FirestoreCurrencyRepositories_1 = require("../firestore/repositories/accounting/FirestoreCurrencyRepositories");
const FirestoreLedgerRepository_1 = require("../firestore/repositories/accounting/FirestoreLedgerRepository");
const FirestoreFiscalYearRepository_1 = require("../firestore/repositories/accounting/FirestoreFiscalYearRepository");
const FirestoreBankStatementRepository_1 = require("../firestore/repositories/accounting/FirestoreBankStatementRepository");
const FirestoreReconciliationRepository_1 = require("../firestore/repositories/accounting/FirestoreReconciliationRepository");
const FirestoreBudgetRepository_1 = require("../firestore/repositories/accounting/FirestoreBudgetRepository");
const FirestoreCompanyGroupRepository_1 = require("../firestore/repositories/accounting/FirestoreCompanyGroupRepository");
const FirestoreRecurringVoucherTemplateRepository_1 = require("../firestore/repositories/accounting/FirestoreRecurringVoucherTemplateRepository");
const AccountRepositoryFirestore_1 = require("../firestore/accounting/AccountRepositoryFirestore");
const FirestoreItemRepository_1 = require("../firestore/repositories/inventory/FirestoreItemRepository");
const FirestoreWarehouseRepository_1 = require("../firestore/repositories/inventory/FirestoreWarehouseRepository");
const FirestoreStockMovementRepository_1 = require("../firestore/repositories/inventory/FirestoreStockMovementRepository");
const FirestoreStockLevelRepository_1 = require("../firestore/repositories/inventory/FirestoreStockLevelRepository");
const FirestoreItemCategoryRepository_1 = require("../firestore/repositories/inventory/FirestoreItemCategoryRepository");
const FirestoreUomConversionRepository_1 = require("../firestore/repositories/inventory/FirestoreUomConversionRepository");
const FirestoreInventorySettingsRepository_1 = require("../firestore/repositories/inventory/FirestoreInventorySettingsRepository");
const FirestoreOpeningStockDocumentRepository_1 = require("../firestore/repositories/inventory/FirestoreOpeningStockDocumentRepository");
const FirestoreStockAdjustmentRepository_1 = require("../firestore/repositories/inventory/FirestoreStockAdjustmentRepository");
const FirestoreStockTransferRepository_1 = require("../firestore/repositories/inventory/FirestoreStockTransferRepository");
const FirestoreInventoryPeriodSnapshotRepository_1 = require("../firestore/repositories/inventory/FirestoreInventoryPeriodSnapshotRepository");
const FirestorePurchaseSettingsRepository_1 = require("../firestore/repositories/purchases/FirestorePurchaseSettingsRepository");
const FirestorePurchaseOrderRepository_1 = require("../firestore/repositories/purchases/FirestorePurchaseOrderRepository");
const FirestoreGoodsReceiptRepository_1 = require("../firestore/repositories/purchases/FirestoreGoodsReceiptRepository");
const FirestorePurchaseInvoiceRepository_1 = require("../firestore/repositories/purchases/FirestorePurchaseInvoiceRepository");
const FirestorePurchaseReturnRepository_1 = require("../firestore/repositories/purchases/FirestorePurchaseReturnRepository");
const FirestoreSalesSettingsRepository_1 = require("../firestore/repositories/sales/FirestoreSalesSettingsRepository");
const FirestoreSalesOrderRepository_1 = require("../firestore/repositories/sales/FirestoreSalesOrderRepository");
const FirestoreDeliveryNoteRepository_1 = require("../firestore/repositories/sales/FirestoreDeliveryNoteRepository");
const FirestoreSalesInvoiceRepository_1 = require("../firestore/repositories/sales/FirestoreSalesInvoiceRepository");
const FirestoreSalesReturnRepository_1 = require("../firestore/repositories/sales/FirestoreSalesReturnRepository");
const FirestoreHRRepositories_1 = require("../firestore/repositories/hr/FirestoreHRRepositories");
const FirestorePOSRepositories_1 = require("../firestore/repositories/pos/FirestorePOSRepositories");
const FirestoreDesignerRepositories_1 = require("../firestore/repositories/designer/FirestoreDesignerRepositories");
const FirestoreVoucherFormRepository_1 = require("../firestore/repositories/designer/FirestoreVoucherFormRepository");
const FirestorePermissionRepository_1 = require("../firestore/repositories/rbac/FirestorePermissionRepository");
const FirestoreSystemRoleTemplateRepository_1 = require("../firestore/repositories/rbac/FirestoreSystemRoleTemplateRepository");
const FirestoreCompanyRoleRepository_1 = require("../firestore/repositories/rbac/FirestoreCompanyRoleRepository");
const FirestoreCompanyUserRepository_2 = require("../firestore/repositories/rbac/FirestoreCompanyUserRepository");
const FirestoreImpersonationRepository_1 = require("../firestore/repositories/impersonation/FirestoreImpersonationRepository");
const FirestoreCompanyWizardTemplateRepository_1 = require("../firestore/repositories/company-wizard/FirestoreCompanyWizardTemplateRepository");
const FirestoreCompanyCreationSessionRepository_1 = require("../firestore/repositories/company-wizard/FirestoreCompanyCreationSessionRepository");
const FirestoreChartOfAccountsTemplateRepository_1 = require("../firestore/repositories/company-wizard/FirestoreChartOfAccountsTemplateRepository");
const FirestoreCurrencyRepository_1 = require("../firestore/repositories/company-wizard/FirestoreCurrencyRepository");
const FirestoreInventoryTemplateRepository_1 = require("../firestore/repositories/company-wizard/FirestoreInventoryTemplateRepository");
const FirestoreModuleSettingsDefinitionRepository_1 = require("../firestore/repositories/system/FirestoreModuleSettingsDefinitionRepository");
const FirestoreCompanyModuleSettingsRepository_1 = require("../firestore/repositories/system/FirestoreCompanyModuleSettingsRepository");
const FirestoreModulePermissionsDefinitionRepository_1 = require("../firestore/repositories/system/FirestoreModulePermissionsDefinitionRepository");
const FirestoreCompanyAdminRepository_1 = require("../firestore/company-admin/FirestoreCompanyAdminRepository");
const PrismaCompanyAdminRepository_1 = require("../prisma/company-admin/PrismaCompanyAdminRepository");
const FirestoreCompanyModuleRepository_1 = require("../firestore/repositories/company/FirestoreCompanyModuleRepository");
const SettingsResolver_1 = require("../../application/common/services/SettingsResolver");
const ModuleActivationService_1 = require("../../application/system/services/ModuleActivationService");
const FirestoreBusinessDomainRepository_1 = require("../firestore/repositories/super-admin/FirestoreBusinessDomainRepository");
const FirestorePermissionRegistryRepository_1 = require("../firestore/repositories/super-admin/FirestorePermissionRegistryRepository");
const FirestoreModuleRegistryRepository_1 = require("../firestore/repositories/super-admin/FirestoreModuleRegistryRepository");
const FirestoreBundleRegistryRepository_1 = require("../firestore/repositories/super-admin/FirestoreBundleRegistryRepository");
const FirestorePlanRegistryRepository_1 = require("../firestore/repositories/super-admin/FirestorePlanRegistryRepository");
const FirestoreRoleTemplateRegistryRepository_1 = require("../firestore/repositories/super-admin/FirestoreRoleTemplateRegistryRepository");
// SYSTEM METADATA
const FirestoreSystemMetadataRepository_1 = require("../repositories/FirestoreSystemMetadataRepository");
// Import Prisma Implementations
const PrismaCompanyRepository_1 = require("../prisma/repositories/PrismaCompanyRepository");
const prismaClient_1 = require("../prisma/prismaClient");
const FirestoreTransactionManager_1 = require("../firestore/transaction/FirestoreTransactionManager");
const FirestorePartyRepository_1 = require("../firestore/repositories/shared/FirestorePartyRepository");
const FirestoreTaxCodeRepository_1 = require("../firestore/repositories/shared/FirestoreTaxCodeRepository");
const FirebaseTokenVerifier_1 = require("../auth/FirebaseTokenVerifier");
// Helper to get Firestore instance
const getDb = () => firebaseAdmin_1.default.firestore();
// Database type configuration
const DB_TYPE = process.env.DB_TYPE || 'FIRESTORE'; // 'FIRESTORE' or 'SQL'
// Shared Services
const settingsResolver = new SettingsResolver_1.SettingsResolver(getDb());
const moduleActivationService = new ModuleActivationService_1.ModuleActivationService(new FirestoreCompanyModuleRepository_1.FirestoreCompanyModuleRepository(getDb()));
exports.diContainer = {
    // CORE
    get companyRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyRepository_1.PrismaCompanyRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyRepository_1.FirestoreCompanyRepository(getDb());
    },
    get userRepository() { return new FirestoreUserRepository_1.FirestoreUserRepository(getDb()); },
    get companyUserRepository() { return new FirestoreCompanyUserRepository_1.FirestoreCompanyUserRepository(getDb()); },
    get companySettingsRepository() { return new FirestoreCompanySettingsRepository_1.FirestoreCompanySettingsRepository(settingsResolver); },
    get userPreferencesRepository() { return new FirestoreUserPreferencesRepository_1.FirestoreUserPreferencesRepository(getDb()); },
    get companyModuleRepository() { return new FirestoreCompanyModuleRepository_1.FirestoreCompanyModuleRepository(getDb()); },
    get moduleActivationService() { return moduleActivationService; },
    // SYSTEM
    get moduleRepository() { return new FirestoreSystemRepositories_1.FirestoreModuleRepository(getDb()); },
    get roleRepository() { return new FirestoreSystemRepositories_1.FirestoreRoleRepository(getDb()); },
    get permissionRepository() { return new FirestoreSystemRepositories_1.FirestorePermissionRepository(getDb()); },
    get notificationRepository() { return new FirestoreSystemRepositories_1.FirestoreNotificationRepository(getDb()); },
    get auditLogRepository() { return new FirestoreSystemRepositories_1.FirestoreAuditLogRepository(getDb()); },
    // ACCOUNTING
    get accountRepository() { return new AccountRepositoryFirestore_1.AccountRepositoryFirestore(getDb()); },
    get voucherRepository() {
        // V2 Repository is the only implementation (legacy removed)
        // TODO: Implement PrismaVoucherRepositoryV2 when SQL support needed
        return new FirestoreVoucherRepositoryV2_1.FirestoreVoucherRepositoryV2(getDb(), settingsResolver);
    },
    get voucherSequenceRepository() { return new FirestoreVoucherSequenceRepository_1.FirestoreVoucherSequenceRepository(getDb()); },
    get costCenterRepository() { return new FirestoreAccountingRepositories_1.FirestoreCostCenterRepository(settingsResolver); },
    get exchangeRateRepository() { return new FirestoreAccountingRepositories_1.FirestoreExchangeRateRepository(settingsResolver); },
    get ledgerRepository() { return new FirestoreLedgerRepository_1.FirestoreLedgerRepository(getDb()); },
    get fiscalYearRepository() { return new FirestoreFiscalYearRepository_1.FirestoreFiscalYearRepository(getDb()); },
    get accountingCurrencyRepository() { return new FirestoreCurrencyRepositories_1.FirestoreAccountingCurrencyRepository(settingsResolver); },
    get companyCurrencyRepository() { return new FirestoreCurrencyRepositories_1.FirestoreCompanyCurrencyRepository(settingsResolver); },
    get bankStatementRepository() { return new FirestoreBankStatementRepository_1.FirestoreBankStatementRepository(getDb()); },
    get reconciliationRepository() { return new FirestoreReconciliationRepository_1.FirestoreReconciliationRepository(getDb()); },
    get budgetRepository() { return new FirestoreBudgetRepository_1.FirestoreBudgetRepository(getDb()); },
    get companyGroupRepository() { return new FirestoreCompanyGroupRepository_1.FirestoreCompanyGroupRepository(getDb()); },
    get recurringVoucherTemplateRepository() { return new FirestoreRecurringVoucherTemplateRepository_1.FirestoreRecurringVoucherTemplateRepository(getDb()); },
    // INVENTORY
    get itemRepository() { return new FirestoreItemRepository_1.FirestoreItemRepository(getDb()); },
    get warehouseRepository() { return new FirestoreWarehouseRepository_1.FirestoreWarehouseRepository(getDb()); },
    get stockMovementRepository() { return new FirestoreStockMovementRepository_1.FirestoreStockMovementRepository(getDb()); },
    get stockLevelRepository() { return new FirestoreStockLevelRepository_1.FirestoreStockLevelRepository(getDb()); },
    get itemCategoryRepository() { return new FirestoreItemCategoryRepository_1.FirestoreItemCategoryRepository(getDb()); },
    get uomConversionRepository() { return new FirestoreUomConversionRepository_1.FirestoreUomConversionRepository(getDb()); },
    get inventorySettingsRepository() { return new FirestoreInventorySettingsRepository_1.FirestoreInventorySettingsRepository(getDb()); },
    get openingStockDocumentRepository() { return new FirestoreOpeningStockDocumentRepository_1.FirestoreOpeningStockDocumentRepository(getDb()); },
    get stockAdjustmentRepository() { return new FirestoreStockAdjustmentRepository_1.FirestoreStockAdjustmentRepository(getDb()); },
    get stockTransferRepository() { return new FirestoreStockTransferRepository_1.FirestoreStockTransferRepository(getDb()); },
    get inventoryPeriodSnapshotRepository() { return new FirestoreInventoryPeriodSnapshotRepository_1.FirestoreInventoryPeriodSnapshotRepository(getDb()); },
    // PURCHASES
    get purchaseSettingsRepository() { return new FirestorePurchaseSettingsRepository_1.FirestorePurchaseSettingsRepository(getDb()); },
    get purchaseOrderRepository() { return new FirestorePurchaseOrderRepository_1.FirestorePurchaseOrderRepository(getDb()); },
    get goodsReceiptRepository() { return new FirestoreGoodsReceiptRepository_1.FirestoreGoodsReceiptRepository(getDb()); },
    get purchaseInvoiceRepository() { return new FirestorePurchaseInvoiceRepository_1.FirestorePurchaseInvoiceRepository(getDb()); },
    get purchaseReturnRepository() { return new FirestorePurchaseReturnRepository_1.FirestorePurchaseReturnRepository(getDb()); },
    // SALES
    get salesSettingsRepository() { return new FirestoreSalesSettingsRepository_1.FirestoreSalesSettingsRepository(getDb()); },
    get salesOrderRepository() { return new FirestoreSalesOrderRepository_1.FirestoreSalesOrderRepository(getDb()); },
    get deliveryNoteRepository() { return new FirestoreDeliveryNoteRepository_1.FirestoreDeliveryNoteRepository(getDb()); },
    get salesInvoiceRepository() { return new FirestoreSalesInvoiceRepository_1.FirestoreSalesInvoiceRepository(getDb()); },
    get salesReturnRepository() { return new FirestoreSalesReturnRepository_1.FirestoreSalesReturnRepository(getDb()); },
    // HR
    get employeeRepository() { return new FirestoreHRRepositories_1.FirestoreEmployeeRepository(getDb()); },
    get attendanceRepository() { return new FirestoreHRRepositories_1.FirestoreAttendanceRepository(getDb()); },
    // POS
    get posShiftRepository() { return new FirestorePOSRepositories_1.FirestorePosShiftRepository(getDb()); },
    get posOrderRepository() { return new FirestorePOSRepositories_1.FirestorePosOrderRepository(getDb()); },
    // DESIGNER
    get formDefinitionRepository() { return new FirestoreDesignerRepositories_1.FirestoreFormDefinitionRepository(getDb()); },
    get voucherTypeDefinitionRepository() { return new FirestoreDesignerRepositories_1.FirestoreVoucherTypeDefinitionRepository(getDb()); },
    get voucherFormRepository() { return new FirestoreVoucherFormRepository_1.FirestoreVoucherFormRepository(getDb()); },
    // RBAC
    get rbacPermissionRepository() { return new FirestorePermissionRepository_1.FirestorePermissionRepository(getDb()); },
    get systemRoleTemplateRepository() { return new FirestoreSystemRoleTemplateRepository_1.FirestoreSystemRoleTemplateRepository(getDb()); },
    get companyRoleRepository() { return new FirestoreCompanyRoleRepository_1.FirestoreCompanyRoleRepository(getDb()); },
    get rbacCompanyUserRepository() { return new FirestoreCompanyUserRepository_2.FirestoreCompanyUserRepository(getDb()); },
    get companyRolePermissionResolver() {
        return new CompanyRolePermissionResolver_1.CompanyRolePermissionResolver(this.modulePermissionsDefinitionRepository, this.companyRoleRepository);
    },
    // IMPERSONATION
    get impersonationRepository() { return new FirestoreImpersonationRepository_1.FirestoreImpersonationRepository(getDb()); },
    // COMPANY WIZARD
    get companyWizardTemplateRepository() { return new FirestoreCompanyWizardTemplateRepository_1.FirestoreCompanyWizardTemplateRepository(getDb()); },
    get companyCreationSessionRepository() { return new FirestoreCompanyCreationSessionRepository_1.FirestoreCompanyCreationSessionRepository(getDb()); },
    get chartOfAccountsTemplateRepository() { return new FirestoreChartOfAccountsTemplateRepository_1.FirestoreChartOfAccountsTemplateRepository(getDb()); },
    get currencyRepository() { return new FirestoreCurrencyRepository_1.FirestoreCurrencyRepository(settingsResolver); },
    get inventoryTemplateRepository() { return new FirestoreInventoryTemplateRepository_1.FirestoreInventoryTemplateRepository(getDb()); },
    // MODULE SETTINGS
    get moduleSettingsDefinitionRepository() { return new FirestoreModuleSettingsDefinitionRepository_1.FirestoreModuleSettingsDefinitionRepository(getDb()); },
    get companyModuleSettingsRepository() { return new FirestoreCompanyModuleSettingsRepository_1.FirestoreCompanyModuleSettingsRepository(getDb()); },
    // MODULE PERMISSIONS
    get modulePermissionsDefinitionRepository() { return new FirestoreModulePermissionsDefinitionRepository_1.FirestoreModulePermissionsDefinitionRepository(getDb()); },
    // COMPANY ADMIN
    get companyAdminRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyAdminRepository_1.PrismaCompanyAdminRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyAdminRepository_1.FirestoreCompanyAdminRepository(getDb());
    },
    // SUPER ADMIN
    get businessDomainRepository() { return new FirestoreBusinessDomainRepository_1.FirestoreBusinessDomainRepository(getDb()); },
    get permissionRegistryRepository() { return new FirestorePermissionRegistryRepository_1.FirestorePermissionRegistryRepository(getDb()); },
    get moduleRegistryRepository() { return new FirestoreModuleRegistryRepository_1.FirestoreModuleRegistryRepository(getDb()); },
    get bundleRegistryRepository() { return new FirestoreBundleRegistryRepository_1.FirestoreBundleRegistryRepository(getDb()); },
    get planRegistryRepository() { return new FirestorePlanRegistryRepository_1.FirestorePlanRegistryRepository(getDb()); },
    get roleTemplateRegistryRepository() { return new FirestoreRoleTemplateRegistryRepository_1.FirestoreRoleTemplateRegistryRepository(getDb()); },
    // SHARED
    get partyRepository() { return new FirestorePartyRepository_1.FirestorePartyRepository(getDb()); },
    get taxCodeRepository() { return new FirestoreTaxCodeRepository_1.FirestoreTaxCodeRepository(getDb()); },
    get transactionManager() { return new FirestoreTransactionManager_1.FirestoreTransactionManager(getDb()); },
    // POLICY SYSTEM
    get policyRegistry() {
        const { AccountingPolicyRegistry } = require('../../application/accounting/policies/AccountingPolicyRegistry');
        const { FirestoreAccountingPolicyConfigProvider } = require('../accounting/config/FirestoreAccountingPolicyConfigProvider');
        const { FirestoreUserAccessScopeProvider } = require('../accounting/access/FirestoreUserAccessScopeProvider');
        const { FirestoreAccountLookupService } = require('../accounting/services/FirestoreAccountLookupService');
        const db = getDb();
        const configProvider = new FirestoreAccountingPolicyConfigProvider(settingsResolver);
        const userScopeProvider = new FirestoreUserAccessScopeProvider(db);
        const accountLookup = new FirestoreAccountLookupService(db);
        const { FirestoreFiscalYearRepository } = require('../firestore/repositories/accounting/FirestoreFiscalYearRepository');
        const fiscalYearRepo = new FirestoreFiscalYearRepository(db);
        return new AccountingPolicyRegistry(configProvider, userScopeProvider, accountLookup, fiscalYearRepo);
    },
    // ACCOUNTING POLICY CONFIG (for use cases that need approval settings)
    get accountingPolicyConfigProvider() {
        const { FirestoreAccountingPolicyConfigProvider } = require('../accounting/config/FirestoreAccountingPolicyConfigProvider');
        return new FirestoreAccountingPolicyConfigProvider(settingsResolver);
    },
    // AUTH
    get tokenVerifier() { return new FirebaseTokenVerifier_1.FirebaseTokenVerifier(); },
    // SYSTEM METADATA
    get systemMetadataRepository() { return new FirestoreSystemMetadataRepository_1.FirestoreSystemMetadataRepository(getDb()); },
    // REAL-TIME DISPATCHER
    get realtimeDispatcher() {
        const { FirebaseRealtimeDispatcher } = require('../realtime/FirebaseRealtimeDispatcher');
        return new FirebaseRealtimeDispatcher();
    },
    // NOTIFICATION SERVICE
    get notificationService() {
        const { NotificationService } = require('../../application/system/services/NotificationService');
        return new NotificationService(this.notificationRepository, this.realtimeDispatcher, this.userPreferencesRepository, this.companySettingsRepository);
    }
};
//# sourceMappingURL=bindRepositories.js.map