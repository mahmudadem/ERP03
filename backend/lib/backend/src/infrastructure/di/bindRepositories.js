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
const FirestoreUomRepository_1 = require("../firestore/repositories/inventory/FirestoreUomRepository");
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
const FirestoreCapabilityRegistryRepository_1 = require("../firestore/repositories/company/FirestoreCapabilityRegistryRepository");
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
const PrismaVoucherRepository_1 = require("../prisma/repositories/PrismaVoucherRepository");
const PrismaCompanyCurrencyRepository_1 = require("../prisma/repositories/PrismaCompanyCurrencyRepository");
const PrismaCurrencyRepository_1 = require("../prisma/repositories/company-wizard/PrismaCurrencyRepository");
const prismaClient_1 = require("../prisma/prismaClient");
const PrismaTransactionManager_1 = require("../prisma/PrismaTransactionManager");
const SettingsResolverSQL_1 = require("../prisma/SettingsResolverSQL");
const PrismaUserRepository_1 = require("../prisma/repositories/core/PrismaUserRepository");
const PrismaCompanyUserRepository_1 = require("../prisma/repositories/core/PrismaCompanyUserRepository");
const PrismaCompanySettingsRepository_1 = require("../prisma/repositories/core/PrismaCompanySettingsRepository");
const PrismaUserPreferencesRepository_1 = require("../prisma/repositories/core/PrismaUserPreferencesRepository");
const PrismaModuleRepository_1 = require("../prisma/repositories/system/PrismaModuleRepository");
const PrismaRoleRepository_1 = require("../prisma/repositories/system/PrismaRoleRepository");
const PrismaPermissionRepository_1 = require("../prisma/repositories/system/PrismaPermissionRepository");
const PrismaNotificationRepository_1 = require("../prisma/repositories/system/PrismaNotificationRepository");
const PrismaAuditLogRepository_1 = require("../prisma/repositories/system/PrismaAuditLogRepository");
const PrismaCompanyModuleSettingsRepository_1 = require("../prisma/repositories/system/PrismaCompanyModuleSettingsRepository");
const PrismaSystemMetadataRepository_1 = require("../prisma/repositories/system/PrismaSystemMetadataRepository");
const PrismaAccountRepository_1 = require("../prisma/repositories/accounting/PrismaAccountRepository");
const PrismaBankStatementRepository_1 = require("../prisma/repositories/accounting/PrismaBankStatementRepository");
const PrismaBudgetRepository_1 = require("../prisma/repositories/accounting/PrismaBudgetRepository");
const PrismaCompanyGroupRepository_1 = require("../prisma/repositories/accounting/PrismaCompanyGroupRepository");
const PrismaCostCenterRepository_1 = require("../prisma/repositories/accounting/PrismaCostCenterRepository");
const PrismaCurrencyRepository_2 = require("../prisma/repositories/accounting/PrismaCurrencyRepository");
const PrismaExchangeRateRepository_1 = require("../prisma/repositories/accounting/PrismaExchangeRateRepository");
const PrismaFiscalYearRepository_1 = require("../prisma/repositories/accounting/PrismaFiscalYearRepository");
const PrismaLedgerRepository_1 = require("../prisma/repositories/accounting/PrismaLedgerRepository");
const PrismaReconciliationRepository_1 = require("../prisma/repositories/accounting/PrismaReconciliationRepository");
const PrismaRecurringVoucherTemplateRepository_1 = require("../prisma/repositories/accounting/PrismaRecurringVoucherTemplateRepository");
const PrismaVoucherSequenceRepository_1 = require("../prisma/repositories/accounting/PrismaVoucherSequenceRepository");
const PrismaCompanyModuleRepository_1 = require("../prisma/repositories/company/PrismaCompanyModuleRepository");
const PrismaCapabilityRegistryRepository_1 = require("../prisma/repositories/company/PrismaCapabilityRegistryRepository");
const PrismaChartOfAccountsTemplateRepository_1 = require("../prisma/repositories/company-wizard/PrismaChartOfAccountsTemplateRepository");
const PrismaCompanyCreationSessionRepository_1 = require("../prisma/repositories/company-wizard/PrismaCompanyCreationSessionRepository");
const PrismaCompanyWizardTemplateRepository_1 = require("../prisma/repositories/company-wizard/PrismaCompanyWizardTemplateRepository");
const PrismaInventoryTemplateRepository_1 = require("../prisma/repositories/company-wizard/PrismaInventoryTemplateRepository");
const PrismaFormDefinitionRepository_1 = require("../prisma/repositories/designer/PrismaFormDefinitionRepository");
const PrismaVoucherFormRepository_1 = require("../prisma/repositories/designer/PrismaVoucherFormRepository");
const PrismaVoucherTypeDefinitionRepository_1 = require("../prisma/repositories/designer/PrismaVoucherTypeDefinitionRepository");
const PrismaAttendanceRepository_1 = require("../prisma/repositories/hr/PrismaAttendanceRepository");
const PrismaEmployeeRepository_1 = require("../prisma/repositories/hr/PrismaEmployeeRepository");
const PrismaImpersonationRepository_1 = require("../prisma/repositories/impersonation/PrismaImpersonationRepository");
const PrismaInventoryPeriodSnapshotRepository_1 = require("../prisma/repositories/inventory/PrismaInventoryPeriodSnapshotRepository");
const PrismaInventorySettingsRepository_1 = require("../prisma/repositories/inventory/PrismaInventorySettingsRepository");
const PrismaItemCategoryRepository_1 = require("../prisma/repositories/inventory/PrismaItemCategoryRepository");
const PrismaItemRepository_1 = require("../prisma/repositories/inventory/PrismaItemRepository");
const PrismaOpeningStockDocumentRepository_1 = require("../prisma/repositories/inventory/PrismaOpeningStockDocumentRepository");
const PrismaStockAdjustmentRepository_1 = require("../prisma/repositories/inventory/PrismaStockAdjustmentRepository");
const PrismaStockLevelRepository_1 = require("../prisma/repositories/inventory/PrismaStockLevelRepository");
const PrismaStockMovementRepository_1 = require("../prisma/repositories/inventory/PrismaStockMovementRepository");
const PrismaStockTransferRepository_1 = require("../prisma/repositories/inventory/PrismaStockTransferRepository");
const PrismaUomConversionRepository_1 = require("../prisma/repositories/inventory/PrismaUomConversionRepository");
const PrismaUomRepository_1 = require("../prisma/repositories/inventory/PrismaUomRepository");
const PrismaWarehouseRepository_1 = require("../prisma/repositories/inventory/PrismaWarehouseRepository");
const PrismaPosOrderRepository_1 = require("../prisma/repositories/pos/PrismaPosOrderRepository");
const PrismaPosShiftRepository_1 = require("../prisma/repositories/pos/PrismaPosShiftRepository");
const PrismaGoodsReceiptRepository_1 = require("../prisma/repositories/purchases/PrismaGoodsReceiptRepository");
const PrismaPurchaseInvoiceRepository_1 = require("../prisma/repositories/purchases/PrismaPurchaseInvoiceRepository");
const PrismaPurchaseOrderRepository_1 = require("../prisma/repositories/purchases/PrismaPurchaseOrderRepository");
const PrismaPurchaseReturnRepository_1 = require("../prisma/repositories/purchases/PrismaPurchaseReturnRepository");
const PrismaPurchaseSettingsRepository_1 = require("../prisma/repositories/purchases/PrismaPurchaseSettingsRepository");
const PrismaCompanyRoleRepository_1 = require("../prisma/repositories/rbac/PrismaCompanyRoleRepository");
const PrismaPermissionRepository_2 = require("../prisma/repositories/rbac/PrismaPermissionRepository");
const PrismaSystemRoleTemplateRepository_1 = require("../prisma/repositories/rbac/PrismaSystemRoleTemplateRepository");
const PrismaDeliveryNoteRepository_1 = require("../prisma/repositories/sales/PrismaDeliveryNoteRepository");
const PrismaSalesInvoiceRepository_1 = require("../prisma/repositories/sales/PrismaSalesInvoiceRepository");
const PrismaSalesOrderRepository_1 = require("../prisma/repositories/sales/PrismaSalesOrderRepository");
const PrismaSalesReturnRepository_1 = require("../prisma/repositories/sales/PrismaSalesReturnRepository");
const PrismaSalesSettingsRepository_1 = require("../prisma/repositories/sales/PrismaSalesSettingsRepository");
const PrismaPartyRepository_1 = require("../prisma/repositories/shared/PrismaPartyRepository");
const PrismaTaxCodeRepository_1 = require("../prisma/repositories/shared/PrismaTaxCodeRepository");
const PrismaBundleRegistryRepository_1 = require("../prisma/repositories/super-admin/PrismaBundleRegistryRepository");
const PrismaBusinessDomainRepository_1 = require("../prisma/repositories/super-admin/PrismaBusinessDomainRepository");
const PrismaModuleRegistryRepository_1 = require("../prisma/repositories/super-admin/PrismaModuleRegistryRepository");
const PrismaPermissionRegistryRepository_1 = require("../prisma/repositories/super-admin/PrismaPermissionRegistryRepository");
const PrismaPlanRegistryRepository_1 = require("../prisma/repositories/super-admin/PrismaPlanRegistryRepository");
const PrismaRoleTemplateRegistryRepository_1 = require("../prisma/repositories/super-admin/PrismaRoleTemplateRegistryRepository");
const PrismaCompanyEntitlementRepository_1 = require("../prisma/repositories/super-admin/PrismaCompanyEntitlementRepository");
const FirestoreCompanyEntitlementRepository_1 = require("../firestore/repositories/super-admin/FirestoreCompanyEntitlementRepository");
const EntitlementService_1 = require("../../application/platform/EntitlementService");
const PrismaRbacCompanyUserRepository_1 = require("../prisma/repositories/rbac/PrismaRbacCompanyUserRepository");
const PrismaModuleSettingsDefinitionRepository_1 = require("../prisma/repositories/system/PrismaModuleSettingsDefinitionRepository");
const PrismaModulePermissionsDefinitionRepository_1 = require("../prisma/repositories/system/PrismaModulePermissionsDefinitionRepository");
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
const settingsResolverSQL = new SettingsResolverSQL_1.SettingsResolverSQL();
const moduleActivationService = DB_TYPE === 'SQL'
    ? new ModuleActivationService_1.ModuleActivationService(new PrismaCompanyModuleRepository_1.PrismaCompanyModuleRepository((0, prismaClient_1.getPrismaClient)()))
    : new ModuleActivationService_1.ModuleActivationService(new FirestoreCompanyModuleRepository_1.FirestoreCompanyModuleRepository(getDb()));
exports.diContainer = {
    // CORE
    get companyRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyRepository_1.PrismaCompanyRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyRepository_1.FirestoreCompanyRepository(getDb());
    },
    get userRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaUserRepository_1.PrismaUserRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreUserRepository_1.FirestoreUserRepository(getDb());
    },
    get companyUserRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyUserRepository_1.PrismaCompanyUserRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyUserRepository_1.FirestoreCompanyUserRepository(getDb());
    },
    get companySettingsRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanySettingsRepository_1.PrismaCompanySettingsRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanySettingsRepository_1.FirestoreCompanySettingsRepository(settingsResolver);
    },
    get userPreferencesRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaUserPreferencesRepository_1.PrismaUserPreferencesRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreUserPreferencesRepository_1.FirestoreUserPreferencesRepository(getDb());
    },
    get companyModuleRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyModuleRepository_1.PrismaCompanyModuleRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyModuleRepository_1.FirestoreCompanyModuleRepository(getDb());
    },
    get capabilityRegistryRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCapabilityRegistryRepository_1.PrismaCapabilityRegistryRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCapabilityRegistryRepository_1.FirestoreCapabilityRegistryRepository(getDb());
    },
    get moduleActivationService() { return moduleActivationService; },
    // SYSTEM
    get moduleRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaModuleRepository_1.PrismaModuleRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSystemRepositories_1.FirestoreModuleRepository(getDb());
    },
    get roleRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaRoleRepository_1.PrismaRoleRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSystemRepositories_1.FirestoreRoleRepository(getDb());
    },
    get permissionRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPermissionRepository_1.PrismaPermissionRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSystemRepositories_1.FirestorePermissionRepository(getDb());
    },
    get notificationRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaNotificationRepository_1.PrismaNotificationRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSystemRepositories_1.FirestoreNotificationRepository(getDb());
    },
    get auditLogRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaAuditLogRepository_1.PrismaAuditLogRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSystemRepositories_1.FirestoreAuditLogRepository(getDb());
    },
    // ACCOUNTING
    get accountRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaAccountRepository_1.PrismaAccountRepository((0, prismaClient_1.getPrismaClient)())
            : new AccountRepositoryFirestore_1.AccountRepositoryFirestore(getDb());
    },
    get voucherRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaVoucherRepository_1.PrismaVoucherRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreVoucherRepositoryV2_1.FirestoreVoucherRepositoryV2(getDb(), settingsResolver);
    },
    get voucherSequenceRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaVoucherSequenceRepository_1.PrismaVoucherSequenceRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreVoucherSequenceRepository_1.FirestoreVoucherSequenceRepository(getDb());
    },
    get costCenterRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCostCenterRepository_1.PrismaCostCenterRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreAccountingRepositories_1.FirestoreCostCenterRepository(settingsResolver);
    },
    get exchangeRateRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaExchangeRateRepository_1.PrismaExchangeRateRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreAccountingRepositories_1.FirestoreExchangeRateRepository(settingsResolver);
    },
    get ledgerRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaLedgerRepository_1.PrismaLedgerRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreLedgerRepository_1.FirestoreLedgerRepository(getDb());
    },
    get fiscalYearRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaFiscalYearRepository_1.PrismaFiscalYearRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreFiscalYearRepository_1.FirestoreFiscalYearRepository(getDb());
    },
    get accountingCurrencyRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCurrencyRepository_2.PrismaCurrencyRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCurrencyRepositories_1.FirestoreAccountingCurrencyRepository(settingsResolver);
    },
    get companyCurrencyRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyCurrencyRepository_1.PrismaCompanyCurrencyRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCurrencyRepositories_1.FirestoreCompanyCurrencyRepository(settingsResolver);
    },
    get bankStatementRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaBankStatementRepository_1.PrismaBankStatementRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreBankStatementRepository_1.FirestoreBankStatementRepository(getDb());
    },
    get reconciliationRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaReconciliationRepository_1.PrismaReconciliationRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreReconciliationRepository_1.FirestoreReconciliationRepository(getDb());
    },
    get budgetRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaBudgetRepository_1.PrismaBudgetRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreBudgetRepository_1.FirestoreBudgetRepository(getDb());
    },
    get companyGroupRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyGroupRepository_1.PrismaCompanyGroupRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyGroupRepository_1.FirestoreCompanyGroupRepository(getDb());
    },
    get recurringVoucherTemplateRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaRecurringVoucherTemplateRepository_1.PrismaRecurringVoucherTemplateRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreRecurringVoucherTemplateRepository_1.FirestoreRecurringVoucherTemplateRepository(getDb());
    },
    // INVENTORY
    get itemRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaItemRepository_1.PrismaItemRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreItemRepository_1.FirestoreItemRepository(getDb());
    },
    get warehouseRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaWarehouseRepository_1.PrismaWarehouseRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreWarehouseRepository_1.FirestoreWarehouseRepository(getDb());
    },
    get stockMovementRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaStockMovementRepository_1.PrismaStockMovementRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreStockMovementRepository_1.FirestoreStockMovementRepository(getDb());
    },
    get stockLevelRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaStockLevelRepository_1.PrismaStockLevelRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreStockLevelRepository_1.FirestoreStockLevelRepository(getDb());
    },
    get itemCategoryRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaItemCategoryRepository_1.PrismaItemCategoryRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreItemCategoryRepository_1.FirestoreItemCategoryRepository(getDb());
    },
    get uomRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaUomRepository_1.PrismaUomRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreUomRepository_1.FirestoreUomRepository(getDb());
    },
    get uomConversionRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaUomConversionRepository_1.PrismaUomConversionRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreUomConversionRepository_1.FirestoreUomConversionRepository(getDb());
    },
    get inventorySettingsRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaInventorySettingsRepository_1.PrismaInventorySettingsRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreInventorySettingsRepository_1.FirestoreInventorySettingsRepository(getDb());
    },
    get openingStockDocumentRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaOpeningStockDocumentRepository_1.PrismaOpeningStockDocumentRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreOpeningStockDocumentRepository_1.FirestoreOpeningStockDocumentRepository(getDb());
    },
    get stockAdjustmentRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaStockAdjustmentRepository_1.PrismaStockAdjustmentRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreStockAdjustmentRepository_1.FirestoreStockAdjustmentRepository(getDb());
    },
    get stockTransferRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaStockTransferRepository_1.PrismaStockTransferRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreStockTransferRepository_1.FirestoreStockTransferRepository(getDb());
    },
    get inventoryPeriodSnapshotRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaInventoryPeriodSnapshotRepository_1.PrismaInventoryPeriodSnapshotRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreInventoryPeriodSnapshotRepository_1.FirestoreInventoryPeriodSnapshotRepository(getDb());
    },
    // PURCHASES
    get purchaseSettingsRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPurchaseSettingsRepository_1.PrismaPurchaseSettingsRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePurchaseSettingsRepository_1.FirestorePurchaseSettingsRepository(getDb());
    },
    get purchaseOrderRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPurchaseOrderRepository_1.PrismaPurchaseOrderRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePurchaseOrderRepository_1.FirestorePurchaseOrderRepository(getDb());
    },
    get goodsReceiptRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaGoodsReceiptRepository_1.PrismaGoodsReceiptRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreGoodsReceiptRepository_1.FirestoreGoodsReceiptRepository(getDb());
    },
    get purchaseInvoiceRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPurchaseInvoiceRepository_1.PrismaPurchaseInvoiceRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePurchaseInvoiceRepository_1.FirestorePurchaseInvoiceRepository(getDb());
    },
    get purchaseReturnRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPurchaseReturnRepository_1.PrismaPurchaseReturnRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePurchaseReturnRepository_1.FirestorePurchaseReturnRepository(getDb());
    },
    // SALES
    get salesSettingsRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaSalesSettingsRepository_1.PrismaSalesSettingsRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSalesSettingsRepository_1.FirestoreSalesSettingsRepository(getDb());
    },
    get salesOrderRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaSalesOrderRepository_1.PrismaSalesOrderRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSalesOrderRepository_1.FirestoreSalesOrderRepository(getDb());
    },
    get deliveryNoteRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaDeliveryNoteRepository_1.PrismaDeliveryNoteRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreDeliveryNoteRepository_1.FirestoreDeliveryNoteRepository(getDb());
    },
    get salesInvoiceRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaSalesInvoiceRepository_1.PrismaSalesInvoiceRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSalesInvoiceRepository_1.FirestoreSalesInvoiceRepository(getDb());
    },
    get salesReturnRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaSalesReturnRepository_1.PrismaSalesReturnRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSalesReturnRepository_1.FirestoreSalesReturnRepository(getDb());
    },
    // HR
    get employeeRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaEmployeeRepository_1.PrismaEmployeeRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreHRRepositories_1.FirestoreEmployeeRepository(getDb());
    },
    get attendanceRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaAttendanceRepository_1.PrismaAttendanceRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreHRRepositories_1.FirestoreAttendanceRepository(getDb());
    },
    // POS
    get posShiftRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPosShiftRepository_1.PrismaPosShiftRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePOSRepositories_1.FirestorePosShiftRepository(getDb());
    },
    get posOrderRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPosOrderRepository_1.PrismaPosOrderRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePOSRepositories_1.FirestorePosOrderRepository(getDb());
    },
    // DESIGNER
    get formDefinitionRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaFormDefinitionRepository_1.PrismaFormDefinitionRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreDesignerRepositories_1.FirestoreFormDefinitionRepository(getDb());
    },
    get voucherTypeDefinitionRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaVoucherTypeDefinitionRepository_1.PrismaVoucherTypeDefinitionRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreDesignerRepositories_1.FirestoreVoucherTypeDefinitionRepository(getDb());
    },
    get voucherFormRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaVoucherFormRepository_1.PrismaVoucherFormRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreVoucherFormRepository_1.FirestoreVoucherFormRepository(getDb());
    },
    // RBAC
    get rbacPermissionRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPermissionRepository_2.PrismaPermissionRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePermissionRepository_1.FirestorePermissionRepository(getDb());
    },
    get systemRoleTemplateRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaSystemRoleTemplateRepository_1.PrismaSystemRoleTemplateRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSystemRoleTemplateRepository_1.FirestoreSystemRoleTemplateRepository(getDb());
    },
    get companyRoleRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyRoleRepository_1.PrismaCompanyRoleRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyRoleRepository_1.FirestoreCompanyRoleRepository(getDb());
    },
    get rbacCompanyUserRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaRbacCompanyUserRepository_1.PrismaRbacCompanyUserRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyUserRepository_2.FirestoreCompanyUserRepository(getDb());
    },
    get companyRolePermissionResolver() {
        return new CompanyRolePermissionResolver_1.CompanyRolePermissionResolver(this.modulePermissionsDefinitionRepository, this.companyRoleRepository);
    },
    // IMPERSONATION
    get impersonationRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaImpersonationRepository_1.PrismaImpersonationRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreImpersonationRepository_1.FirestoreImpersonationRepository(getDb());
    },
    // COMPANY WIZARD
    get companyWizardTemplateRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyWizardTemplateRepository_1.PrismaCompanyWizardTemplateRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyWizardTemplateRepository_1.FirestoreCompanyWizardTemplateRepository(getDb());
    },
    get companyCreationSessionRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyCreationSessionRepository_1.PrismaCompanyCreationSessionRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyCreationSessionRepository_1.FirestoreCompanyCreationSessionRepository(getDb());
    },
    get chartOfAccountsTemplateRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaChartOfAccountsTemplateRepository_1.PrismaChartOfAccountsTemplateRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreChartOfAccountsTemplateRepository_1.FirestoreChartOfAccountsTemplateRepository(getDb());
    },
    get currencyRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCurrencyRepository_1.PrismaCurrencyRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCurrencyRepository_1.FirestoreCurrencyRepository(settingsResolver);
    },
    get inventoryTemplateRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaInventoryTemplateRepository_1.PrismaInventoryTemplateRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreInventoryTemplateRepository_1.FirestoreInventoryTemplateRepository(getDb());
    },
    // MODULE SETTINGS
    get moduleSettingsDefinitionRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaModuleSettingsDefinitionRepository_1.PrismaModuleSettingsDefinitionRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreModuleSettingsDefinitionRepository_1.FirestoreModuleSettingsDefinitionRepository(getDb());
    },
    get companyModuleSettingsRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyModuleSettingsRepository_1.PrismaCompanyModuleSettingsRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyModuleSettingsRepository_1.FirestoreCompanyModuleSettingsRepository(getDb());
    },
    // MODULE PERMISSIONS
    get modulePermissionsDefinitionRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaModulePermissionsDefinitionRepository_1.PrismaModulePermissionsDefinitionRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreModulePermissionsDefinitionRepository_1.FirestoreModulePermissionsDefinitionRepository(getDb());
    },
    // COMPANY ADMIN
    get companyAdminRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyAdminRepository_1.PrismaCompanyAdminRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyAdminRepository_1.FirestoreCompanyAdminRepository(getDb());
    },
    // SUPER ADMIN
    get businessDomainRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaBusinessDomainRepository_1.PrismaBusinessDomainRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreBusinessDomainRepository_1.FirestoreBusinessDomainRepository(getDb());
    },
    get permissionRegistryRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPermissionRegistryRepository_1.PrismaPermissionRegistryRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePermissionRegistryRepository_1.FirestorePermissionRegistryRepository(getDb());
    },
    get moduleRegistryRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaModuleRegistryRepository_1.PrismaModuleRegistryRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreModuleRegistryRepository_1.FirestoreModuleRegistryRepository(getDb());
    },
    get bundleRegistryRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaBundleRegistryRepository_1.PrismaBundleRegistryRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreBundleRegistryRepository_1.FirestoreBundleRegistryRepository(getDb());
    },
    get companyEntitlementRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyEntitlementRepository_1.PrismaCompanyEntitlementRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyEntitlementRepository_1.FirestoreCompanyEntitlementRepository(getDb());
    },
    get entitlementService() {
        return new EntitlementService_1.EntitlementService(this.companyEntitlementRepository);
    },
    get planRegistryRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPlanRegistryRepository_1.PrismaPlanRegistryRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePlanRegistryRepository_1.FirestorePlanRegistryRepository(getDb());
    },
    get roleTemplateRegistryRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaRoleTemplateRegistryRepository_1.PrismaRoleTemplateRegistryRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreRoleTemplateRegistryRepository_1.FirestoreRoleTemplateRegistryRepository(getDb());
    },
    // SHARED
    get partyRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaPartyRepository_1.PrismaPartyRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestorePartyRepository_1.FirestorePartyRepository(getDb());
    },
    get taxCodeRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaTaxCodeRepository_1.PrismaTaxCodeRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreTaxCodeRepository_1.FirestoreTaxCodeRepository(getDb());
    },
    get transactionManager() {
        return DB_TYPE === 'SQL'
            ? new PrismaTransactionManager_1.PrismaTransactionManager((0, prismaClient_1.getPrismaClient)())
            : new FirestoreTransactionManager_1.FirestoreTransactionManager(getDb());
    },
    // POLICY SYSTEM
    get policyRegistry() {
        const { AccountingPolicyRegistry } = require('../../application/accounting/policies/AccountingPolicyRegistry');
        if (DB_TYPE === 'SQL') {
            const { PrismaAccountingPolicyConfigProvider } = require('../prisma/providers/PrismaAccountingPolicyConfigProvider');
            const { PrismaUserAccessScopeProvider } = require('../prisma/providers/PrismaUserAccessScopeProvider');
            const { PrismaAccountLookupService } = require('../prisma/providers/PrismaAccountLookupService');
            const configProvider = new PrismaAccountingPolicyConfigProvider((0, prismaClient_1.getPrismaClient)());
            const userScopeProvider = new PrismaUserAccessScopeProvider((0, prismaClient_1.getPrismaClient)());
            const accountLookup = new PrismaAccountLookupService((0, prismaClient_1.getPrismaClient)());
            const fiscalYearRepo = DB_TYPE === 'SQL'
                ? new PrismaFiscalYearRepository_1.PrismaFiscalYearRepository((0, prismaClient_1.getPrismaClient)())
                : new FirestoreFiscalYearRepository_1.FirestoreFiscalYearRepository(getDb());
            return new AccountingPolicyRegistry(configProvider, userScopeProvider, accountLookup, fiscalYearRepo);
        }
        else {
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
        }
    },
    // ACCOUNTING POLICY CONFIG (for use cases that need approval settings)
    get accountingPolicyConfigProvider() {
        if (DB_TYPE === 'SQL') {
            const { PrismaAccountingPolicyConfigProvider } = require('../prisma/providers/PrismaAccountingPolicyConfigProvider');
            return new PrismaAccountingPolicyConfigProvider((0, prismaClient_1.getPrismaClient)());
        }
        else {
            const { FirestoreAccountingPolicyConfigProvider } = require('../accounting/config/FirestoreAccountingPolicyConfigProvider');
            return new FirestoreAccountingPolicyConfigProvider(settingsResolver);
        }
    },
    // AUTH
    get tokenVerifier() { return new FirebaseTokenVerifier_1.FirebaseTokenVerifier(); },
    // SYSTEM METADATA
    get systemMetadataRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaSystemMetadataRepository_1.PrismaSystemMetadataRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreSystemMetadataRepository_1.FirestoreSystemMetadataRepository(getDb());
    },
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