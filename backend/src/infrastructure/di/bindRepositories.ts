import admin from '../../firebaseAdmin';

// Import All Interfaces
import { ICompanyRepository } from '../../repository/interfaces/core/ICompanyRepository';
import { IUserRepository } from '../../repository/interfaces/core/IUserRepository';
import { ICompanyUserRepository } from '../../repository/interfaces/core/ICompanyUserRepository';
import { ICompanySettingsRepository } from '../../repository/interfaces/core/ICompanySettingsRepository';
import { IUserPreferencesRepository } from '../../repository/interfaces/core/IUserPreferencesRepository';
import * as SysRepo from '../../repository/interfaces/system';
import * as AccRepo from '../../repository/interfaces/accounting';
import * as InvRepo from '../../repository/interfaces/inventory';
import * as PurRepo from '../../repository/interfaces/purchases';
import * as HrRepo from '../../repository/interfaces/hr';
import * as PosRepo from '../../repository/interfaces/pos';
import * as DesRepo from '../../repository/interfaces/designer';
import { IPermissionRepository as IRbacPermissionRepository } from '../../repository/interfaces/rbac/IPermissionRepository';
import { ISystemRoleTemplateRepository } from '../../repository/interfaces/rbac/ISystemRoleTemplateRepository';
import { ICompanyRoleRepository } from '../../repository/interfaces/rbac/ICompanyRoleRepository';
import { ICompanyUserRepository as IRbacCompanyUserRepository } from '../../repository/interfaces/rbac/ICompanyUserRepository';
import { CompanyRolePermissionResolver } from '../../application/rbac/CompanyRolePermissionResolver';

// Import All Firestore Implementations
import { FirestoreCompanyRepository } from '../firestore/repositories/core/FirestoreCompanyRepository';
import { FirestoreUserRepository } from '../firestore/repositories/core/FirestoreUserRepository';
import { FirestoreCompanyUserRepository } from '../firestore/repositories/core/FirestoreCompanyUserRepository';
import { FirestoreCompanySettingsRepository } from '../firestore/repositories/core/FirestoreCompanySettingsRepository';
import { FirestoreUserPreferencesRepository } from '../firestore/repositories/core/FirestoreUserPreferencesRepository';
import { FirestoreModuleRepository, FirestoreRoleRepository, FirestorePermissionRepository, FirestoreNotificationRepository, FirestoreAuditLogRepository } from '../firestore/repositories/system/FirestoreSystemRepositories';
import { FirestoreVoucherRepositoryV2 } from '../firestore/repositories/accounting/FirestoreVoucherRepositoryV2';
import { FirestoreVoucherSequenceRepository } from '../firestore/repositories/accounting/FirestoreVoucherSequenceRepository';
import { IVoucherRepository } from '../../domain/accounting/repositories/IVoucherRepository';
import { FirestoreCostCenterRepository, FirestoreExchangeRateRepository } from '../firestore/repositories/accounting/FirestoreAccountingRepositories';
import { FirestoreAccountingCurrencyRepository, FirestoreCompanyCurrencyRepository } from '../firestore/repositories/accounting/FirestoreCurrencyRepositories';
import { FirestoreLedgerRepository } from '../firestore/repositories/accounting/FirestoreLedgerRepository';
import { FirestoreFiscalYearRepository } from '../firestore/repositories/accounting/FirestoreFiscalYearRepository';
import { FirestoreBankStatementRepository } from '../firestore/repositories/accounting/FirestoreBankStatementRepository';
import { FirestoreReconciliationRepository } from '../firestore/repositories/accounting/FirestoreReconciliationRepository';
import { FirestoreBudgetRepository } from '../firestore/repositories/accounting/FirestoreBudgetRepository';
import { FirestoreCompanyGroupRepository } from '../firestore/repositories/accounting/FirestoreCompanyGroupRepository';
import { FirestoreRecurringVoucherTemplateRepository } from '../firestore/repositories/accounting/FirestoreRecurringVoucherTemplateRepository';
import { AccountRepositoryFirestore } from '../firestore/accounting/AccountRepositoryFirestore';
import { FirestoreItemRepository } from '../firestore/repositories/inventory/FirestoreItemRepository';
import { FirestoreWarehouseRepository } from '../firestore/repositories/inventory/FirestoreWarehouseRepository';
import { FirestoreStockMovementRepository } from '../firestore/repositories/inventory/FirestoreStockMovementRepository';
import { FirestoreStockLevelRepository } from '../firestore/repositories/inventory/FirestoreStockLevelRepository';
import { FirestoreItemCategoryRepository } from '../firestore/repositories/inventory/FirestoreItemCategoryRepository';
import { FirestoreUomConversionRepository } from '../firestore/repositories/inventory/FirestoreUomConversionRepository';
import { FirestoreInventorySettingsRepository } from '../firestore/repositories/inventory/FirestoreInventorySettingsRepository';
import { FirestoreStockAdjustmentRepository } from '../firestore/repositories/inventory/FirestoreStockAdjustmentRepository';
import { FirestoreStockTransferRepository } from '../firestore/repositories/inventory/FirestoreStockTransferRepository';
import { FirestoreInventoryPeriodSnapshotRepository } from '../firestore/repositories/inventory/FirestoreInventoryPeriodSnapshotRepository';
import { FirestorePurchaseSettingsRepository } from '../firestore/repositories/purchases/FirestorePurchaseSettingsRepository';
import { FirestorePurchaseOrderRepository } from '../firestore/repositories/purchases/FirestorePurchaseOrderRepository';
import { FirestoreGoodsReceiptRepository } from '../firestore/repositories/purchases/FirestoreGoodsReceiptRepository';
import { FirestorePurchaseInvoiceRepository } from '../firestore/repositories/purchases/FirestorePurchaseInvoiceRepository';
import { FirestorePurchaseReturnRepository } from '../firestore/repositories/purchases/FirestorePurchaseReturnRepository';
import { FirestoreEmployeeRepository, FirestoreAttendanceRepository } from '../firestore/repositories/hr/FirestoreHRRepositories';
import { FirestorePosShiftRepository, FirestorePosOrderRepository } from '../firestore/repositories/pos/FirestorePOSRepositories';
import { FirestoreFormDefinitionRepository, FirestoreVoucherTypeDefinitionRepository } from '../firestore/repositories/designer/FirestoreDesignerRepositories';
import { FirestoreVoucherFormRepository } from '../firestore/repositories/designer/FirestoreVoucherFormRepository';
import { FirestorePermissionRepository as FirestoreRbacPermissionRepository } from '../firestore/repositories/rbac/FirestorePermissionRepository';
import { FirestoreSystemRoleTemplateRepository } from '../firestore/repositories/rbac/FirestoreSystemRoleTemplateRepository';
import { FirestoreCompanyRoleRepository } from '../firestore/repositories/rbac/FirestoreCompanyRoleRepository';
import { FirestoreCompanyUserRepository as FirestoreRbacCompanyUserRepository } from '../firestore/repositories/rbac/FirestoreCompanyUserRepository';
import { IImpersonationRepository } from '../../repository/interfaces/impersonation/IImpersonationRepository';
import { FirestoreImpersonationRepository } from '../firestore/repositories/impersonation/FirestoreImpersonationRepository';
import { ICompanyWizardTemplateRepository } from '../../repository/interfaces/company-wizard/ICompanyWizardTemplateRepository';
import { ICompanyCreationSessionRepository } from '../../repository/interfaces/company-wizard/ICompanyCreationSessionRepository';
import { IChartOfAccountsTemplateRepository } from '../../repository/interfaces/company-wizard/IChartOfAccountsTemplateRepository';
import { ICurrencyRepository } from '../../repository/interfaces/company-wizard/ICurrencyRepository';
import { IInventoryTemplateRepository } from '../../repository/interfaces/company-wizard/IInventoryTemplateRepository';
import { FirestoreCompanyWizardTemplateRepository } from '../firestore/repositories/company-wizard/FirestoreCompanyWizardTemplateRepository';
import { FirestoreCompanyCreationSessionRepository } from '../firestore/repositories/company-wizard/FirestoreCompanyCreationSessionRepository';
import { FirestoreChartOfAccountsTemplateRepository } from '../firestore/repositories/company-wizard/FirestoreChartOfAccountsTemplateRepository';
import { FirestoreCurrencyRepository } from '../firestore/repositories/company-wizard/FirestoreCurrencyRepository';
import { FirestoreInventoryTemplateRepository } from '../firestore/repositories/company-wizard/FirestoreInventoryTemplateRepository';
import { IModuleSettingsDefinitionRepository } from '../../repository/interfaces/system/IModuleSettingsDefinitionRepository';
import { FirestoreModuleSettingsDefinitionRepository } from '../firestore/repositories/system/FirestoreModuleSettingsDefinitionRepository';
import { ICompanyModuleSettingsRepository } from '../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { FirestoreCompanyModuleSettingsRepository } from '../firestore/repositories/system/FirestoreCompanyModuleSettingsRepository';
import { IModulePermissionsDefinitionRepository } from '../../repository/interfaces/system/IModulePermissionsDefinitionRepository';
import { FirestoreModulePermissionsDefinitionRepository } from '../firestore/repositories/system/FirestoreModulePermissionsDefinitionRepository';
import { ICompanyAdminRepository } from '../../repository/interfaces/company-admin/ICompanyAdminRepository';
import { FirestoreCompanyAdminRepository } from '../firestore/company-admin/FirestoreCompanyAdminRepository';
import { PrismaCompanyAdminRepository } from '../prisma/company-admin/PrismaCompanyAdminRepository';
import { ICompanyModuleRepository } from '../../repository/interfaces/company/ICompanyModuleRepository';
import { FirestoreCompanyModuleRepository } from '../firestore/repositories/company/FirestoreCompanyModuleRepository';
import { SettingsResolver } from '../../application/common/services/SettingsResolver';
import { ModuleActivationService } from '../../application/system/services/ModuleActivationService';

// SUPER ADMIN
import { IBusinessDomainRepository } from '../../repository/interfaces/super-admin/IBusinessDomainRepository';
import { IPermissionRegistryRepository } from '../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { IModuleRegistryRepository } from '../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { IBundleRegistryRepository } from '../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { IPlanRegistryRepository } from '../../repository/interfaces/super-admin/IPlanRegistryRepository';
import { IRoleTemplateRegistryRepository } from '../../repository/interfaces/super-admin/IRoleTemplateRegistryRepository';
import { FirestoreBusinessDomainRepository } from '../firestore/repositories/super-admin/FirestoreBusinessDomainRepository';
import { FirestorePermissionRegistryRepository } from '../firestore/repositories/super-admin/FirestorePermissionRegistryRepository';
import { FirestoreModuleRegistryRepository } from '../firestore/repositories/super-admin/FirestoreModuleRegistryRepository';
import { FirestoreBundleRegistryRepository } from '../firestore/repositories/super-admin/FirestoreBundleRegistryRepository';
import { FirestorePlanRegistryRepository } from '../firestore/repositories/super-admin/FirestorePlanRegistryRepository';
import { FirestoreRoleTemplateRegistryRepository } from '../firestore/repositories/super-admin/FirestoreRoleTemplateRegistryRepository';

// SYSTEM METADATA
import { ISystemMetadataRepository, FirestoreSystemMetadataRepository } from '../repositories/FirestoreSystemMetadataRepository';


// Import Prisma Implementations
import { PrismaCompanyRepository } from '../prisma/repositories/PrismaCompanyRepository';
import { PrismaVoucherRepository } from '../prisma/repositories/PrismaVoucherRepository';
import { getPrismaClient } from '../prisma/prismaClient';

import { ITransactionManager } from '../../repository/interfaces/shared/ITransactionManager';
import { IPartyRepository } from '../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../repository/interfaces/shared/ITaxCodeRepository';
import { FirestoreTransactionManager } from '../firestore/transaction/FirestoreTransactionManager';
import { FirestorePartyRepository } from '../firestore/repositories/shared/FirestorePartyRepository';
import { FirestoreTaxCodeRepository } from '../firestore/repositories/shared/FirestoreTaxCodeRepository';

// AUTH
import { ITokenVerifier } from '../../application/auth/interfaces/ITokenVerifier';
import { FirebaseTokenVerifier } from '../auth/FirebaseTokenVerifier';


// Helper to get Firestore instance
const getDb = () => admin.firestore();

// Database type configuration
const DB_TYPE = process.env.DB_TYPE || 'FIRESTORE'; // 'FIRESTORE' or 'SQL'

// Shared Services
const settingsResolver = new SettingsResolver(getDb());
const moduleActivationService = new ModuleActivationService(new FirestoreCompanyModuleRepository(getDb()));

export const diContainer = {
  // CORE
  get companyRepository(): ICompanyRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyRepository(getPrismaClient())
      : new FirestoreCompanyRepository(getDb());
  },
  get userRepository(): IUserRepository { return new FirestoreUserRepository(getDb()); },
  get companyUserRepository(): ICompanyUserRepository { return new FirestoreCompanyUserRepository(getDb()); },
  get companySettingsRepository(): ICompanySettingsRepository { return new FirestoreCompanySettingsRepository(settingsResolver); },
  get userPreferencesRepository(): IUserPreferencesRepository { return new FirestoreUserPreferencesRepository(getDb()); },
  get companyModuleRepository(): ICompanyModuleRepository { return new FirestoreCompanyModuleRepository(getDb()); },
  get moduleActivationService(): ModuleActivationService { return moduleActivationService; },

  // SYSTEM
  get moduleRepository(): SysRepo.IModuleRepository { return new FirestoreModuleRepository(getDb()); },
  get roleRepository(): SysRepo.IRoleRepository { return new FirestoreRoleRepository(getDb()); },
  get permissionRepository(): SysRepo.IPermissionRepository { return new FirestorePermissionRepository(getDb()); },
  get notificationRepository(): SysRepo.INotificationRepository { return new FirestoreNotificationRepository(getDb()); },
  get auditLogRepository(): SysRepo.IAuditLogRepository { return new FirestoreAuditLogRepository(getDb()); },

  // ACCOUNTING
  get accountRepository(): AccRepo.IAccountRepository { return new AccountRepositoryFirestore(getDb()); },
  get voucherRepository(): IVoucherRepository {
    // V2 Repository is the only implementation (legacy removed)
    // TODO: Implement PrismaVoucherRepositoryV2 when SQL support needed
    return new FirestoreVoucherRepositoryV2(getDb(), settingsResolver);
  },
  get voucherSequenceRepository(): AccRepo.IVoucherSequenceRepository { return new FirestoreVoucherSequenceRepository(getDb()); },
  get costCenterRepository(): AccRepo.ICostCenterRepository { return new FirestoreCostCenterRepository(settingsResolver); },
  get exchangeRateRepository(): AccRepo.IExchangeRateRepository { return new FirestoreExchangeRateRepository(settingsResolver); },
  get ledgerRepository(): AccRepo.ILedgerRepository { return new FirestoreLedgerRepository(getDb()); },
  get fiscalYearRepository(): AccRepo.IFiscalYearRepository { return new FirestoreFiscalYearRepository(getDb()); },
  get accountingCurrencyRepository(): AccRepo.ICurrencyRepository { return new FirestoreAccountingCurrencyRepository(settingsResolver); },
  get companyCurrencyRepository(): AccRepo.ICompanyCurrencyRepository { return new FirestoreCompanyCurrencyRepository(settingsResolver); },
  get bankStatementRepository(): AccRepo.IBankStatementRepository { return new FirestoreBankStatementRepository(getDb()); },
  get reconciliationRepository(): AccRepo.IReconciliationRepository { return new FirestoreReconciliationRepository(getDb()); },
  get budgetRepository(): AccRepo.IBudgetRepository { return new FirestoreBudgetRepository(getDb()); },
  get companyGroupRepository(): AccRepo.ICompanyGroupRepository { return new FirestoreCompanyGroupRepository(getDb()); },
  get recurringVoucherTemplateRepository(): AccRepo.IRecurringVoucherTemplateRepository { return new FirestoreRecurringVoucherTemplateRepository(getDb()); },

  // INVENTORY
  get itemRepository(): InvRepo.IItemRepository { return new FirestoreItemRepository(getDb()); },
  get warehouseRepository(): InvRepo.IWarehouseRepository { return new FirestoreWarehouseRepository(getDb()); },
  get stockMovementRepository(): InvRepo.IStockMovementRepository { return new FirestoreStockMovementRepository(getDb()); },
  get stockLevelRepository(): InvRepo.IStockLevelRepository { return new FirestoreStockLevelRepository(getDb()); },
  get itemCategoryRepository(): InvRepo.IItemCategoryRepository { return new FirestoreItemCategoryRepository(getDb()); },
  get uomConversionRepository(): InvRepo.IUomConversionRepository { return new FirestoreUomConversionRepository(getDb()); },
  get inventorySettingsRepository(): InvRepo.IInventorySettingsRepository { return new FirestoreInventorySettingsRepository(getDb()); },
  get stockAdjustmentRepository(): InvRepo.IStockAdjustmentRepository { return new FirestoreStockAdjustmentRepository(getDb()); },
  get stockTransferRepository(): InvRepo.IStockTransferRepository { return new FirestoreStockTransferRepository(getDb()); },
  get inventoryPeriodSnapshotRepository(): InvRepo.IInventoryPeriodSnapshotRepository { return new FirestoreInventoryPeriodSnapshotRepository(getDb()); },

  // PURCHASES
  get purchaseSettingsRepository(): PurRepo.IPurchaseSettingsRepository { return new FirestorePurchaseSettingsRepository(getDb()); },
  get purchaseOrderRepository(): PurRepo.IPurchaseOrderRepository { return new FirestorePurchaseOrderRepository(getDb()); },
  get goodsReceiptRepository(): PurRepo.IGoodsReceiptRepository { return new FirestoreGoodsReceiptRepository(getDb()); },
  get purchaseInvoiceRepository(): PurRepo.IPurchaseInvoiceRepository { return new FirestorePurchaseInvoiceRepository(getDb()); },
  get purchaseReturnRepository(): PurRepo.IPurchaseReturnRepository { return new FirestorePurchaseReturnRepository(getDb()); },

  // HR
  get employeeRepository(): HrRepo.IEmployeeRepository { return new FirestoreEmployeeRepository(getDb()); },
  get attendanceRepository(): HrRepo.IAttendanceRepository { return new FirestoreAttendanceRepository(getDb()); },

  // POS
  get posShiftRepository(): PosRepo.IPosShiftRepository { return new FirestorePosShiftRepository(getDb()); },
  get posOrderRepository(): PosRepo.IPosOrderRepository { return new FirestorePosOrderRepository(getDb()); },


  // DESIGNER
  get formDefinitionRepository(): DesRepo.IFormDefinitionRepository { return new FirestoreFormDefinitionRepository(getDb()); },
  get voucherTypeDefinitionRepository(): DesRepo.IVoucherTypeDefinitionRepository { return new FirestoreVoucherTypeDefinitionRepository(getDb()); },
  get voucherFormRepository(): DesRepo.IVoucherFormRepository { return new FirestoreVoucherFormRepository(getDb()); },

  // RBAC
  get rbacPermissionRepository(): IRbacPermissionRepository { return new FirestoreRbacPermissionRepository(getDb()); },
  get systemRoleTemplateRepository(): ISystemRoleTemplateRepository { return new FirestoreSystemRoleTemplateRepository(getDb()); },
  get companyRoleRepository(): ICompanyRoleRepository { return new FirestoreCompanyRoleRepository(getDb()); },
  get rbacCompanyUserRepository(): IRbacCompanyUserRepository { return new FirestoreRbacCompanyUserRepository(getDb()); },
  get companyRolePermissionResolver(): CompanyRolePermissionResolver {
    return new CompanyRolePermissionResolver(
      this.modulePermissionsDefinitionRepository,
      this.companyRoleRepository
    );
  },

  // IMPERSONATION
  get impersonationRepository(): IImpersonationRepository { return new FirestoreImpersonationRepository(getDb()); },

  // COMPANY WIZARD
  get companyWizardTemplateRepository(): ICompanyWizardTemplateRepository { return new FirestoreCompanyWizardTemplateRepository(getDb()); },
  get companyCreationSessionRepository(): ICompanyCreationSessionRepository { return new FirestoreCompanyCreationSessionRepository(getDb()); },
  get chartOfAccountsTemplateRepository(): IChartOfAccountsTemplateRepository { return new FirestoreChartOfAccountsTemplateRepository(getDb()); },
  get currencyRepository(): ICurrencyRepository { return new FirestoreCurrencyRepository(settingsResolver); },
  get inventoryTemplateRepository(): IInventoryTemplateRepository { return new FirestoreInventoryTemplateRepository(getDb()); },

  // MODULE SETTINGS
  get moduleSettingsDefinitionRepository(): IModuleSettingsDefinitionRepository { return new FirestoreModuleSettingsDefinitionRepository(getDb()); },
  get companyModuleSettingsRepository(): ICompanyModuleSettingsRepository { return new FirestoreCompanyModuleSettingsRepository(getDb()); },

  // MODULE PERMISSIONS
  get modulePermissionsDefinitionRepository(): IModulePermissionsDefinitionRepository { return new FirestoreModulePermissionsDefinitionRepository(getDb()); },

  // COMPANY ADMIN
  get companyAdminRepository(): ICompanyAdminRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyAdminRepository(getPrismaClient())
      : new FirestoreCompanyAdminRepository(getDb());
  },

  // SUPER ADMIN
  get businessDomainRepository(): IBusinessDomainRepository { return new FirestoreBusinessDomainRepository(getDb()); },
  get permissionRegistryRepository(): IPermissionRegistryRepository { return new FirestorePermissionRegistryRepository(getDb()); },
  get moduleRegistryRepository(): IModuleRegistryRepository { return new FirestoreModuleRegistryRepository(getDb()); },
  get bundleRegistryRepository(): IBundleRegistryRepository { return new FirestoreBundleRegistryRepository(getDb()); },
  get planRegistryRepository(): IPlanRegistryRepository { return new FirestorePlanRegistryRepository(getDb()); },
  get roleTemplateRegistryRepository(): IRoleTemplateRegistryRepository { return new FirestoreRoleTemplateRegistryRepository(getDb()); },

  // SHARED
  get partyRepository(): IPartyRepository { return new FirestorePartyRepository(getDb()); },
  get taxCodeRepository(): ITaxCodeRepository { return new FirestoreTaxCodeRepository(getDb()); },
  get transactionManager(): ITransactionManager { return new FirestoreTransactionManager(getDb()); },

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
  get tokenVerifier(): ITokenVerifier { return new FirebaseTokenVerifier(); },

  // SYSTEM METADATA
  get systemMetadataRepository(): ISystemMetadataRepository { return new FirestoreSystemMetadataRepository(getDb()); },

  // REAL-TIME DISPATCHER
  get realtimeDispatcher() {
    const { FirebaseRealtimeDispatcher } = require('../realtime/FirebaseRealtimeDispatcher');
    return new FirebaseRealtimeDispatcher();
  },

  // NOTIFICATION SERVICE
  get notificationService() {
    const { NotificationService } = require('../../application/system/services/NotificationService');
    return new NotificationService(
      this.notificationRepository,
      this.realtimeDispatcher,
      this.userPreferencesRepository,
      this.companySettingsRepository
    );
  }
};

