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
import * as SalRepo from '../../repository/interfaces/sales';
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
import { FirestoreUomRepository } from '../firestore/repositories/inventory/FirestoreUomRepository';
import { FirestoreUomConversionRepository } from '../firestore/repositories/inventory/FirestoreUomConversionRepository';
import { FirestoreInventorySettingsRepository } from '../firestore/repositories/inventory/FirestoreInventorySettingsRepository';
import { FirestoreOpeningStockDocumentRepository } from '../firestore/repositories/inventory/FirestoreOpeningStockDocumentRepository';
import { FirestoreStockAdjustmentRepository } from '../firestore/repositories/inventory/FirestoreStockAdjustmentRepository';
import { FirestoreStockTransferRepository } from '../firestore/repositories/inventory/FirestoreStockTransferRepository';
import { FirestoreInventoryPeriodSnapshotRepository } from '../firestore/repositories/inventory/FirestoreInventoryPeriodSnapshotRepository';
import { FirestorePurchaseSettingsRepository } from '../firestore/repositories/purchases/FirestorePurchaseSettingsRepository';
import { FirestorePurchaseOrderRepository } from '../firestore/repositories/purchases/FirestorePurchaseOrderRepository';
import { FirestoreGoodsReceiptRepository } from '../firestore/repositories/purchases/FirestoreGoodsReceiptRepository';
import { FirestorePurchaseInvoiceRepository } from '../firestore/repositories/purchases/FirestorePurchaseInvoiceRepository';
import { FirestorePurchaseReturnRepository } from '../firestore/repositories/purchases/FirestorePurchaseReturnRepository';
import { FirestoreSalesSettingsRepository } from '../firestore/repositories/sales/FirestoreSalesSettingsRepository';
import { FirestoreSalesOrderRepository } from '../firestore/repositories/sales/FirestoreSalesOrderRepository';
import { FirestoreDeliveryNoteRepository } from '../firestore/repositories/sales/FirestoreDeliveryNoteRepository';
import { FirestoreSalesInvoiceRepository } from '../firestore/repositories/sales/FirestoreSalesInvoiceRepository';
import { FirestoreSalesReturnRepository } from '../firestore/repositories/sales/FirestoreSalesReturnRepository';
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
import { PrismaCompanyCurrencyRepository } from '../prisma/repositories/PrismaCompanyCurrencyRepository';
import { PrismaCurrencyRepository as PrismaWizardCurrencyRepository } from '../prisma/repositories/company-wizard/PrismaCurrencyRepository';
import { PrismaExchangeRateRepository as PrismaTopExchangeRateRepository } from '../prisma/repositories/PrismaExchangeRateRepository';
import { getPrismaClient } from '../prisma/prismaClient';
import { PrismaTransactionManager } from '../prisma/PrismaTransactionManager';
import { SettingsResolverSQL } from '../prisma/SettingsResolverSQL';

import { PrismaUserRepository } from '../prisma/repositories/core/PrismaUserRepository';
import { PrismaCompanyUserRepository } from '../prisma/repositories/core/PrismaCompanyUserRepository';
import { PrismaCompanySettingsRepository } from '../prisma/repositories/core/PrismaCompanySettingsRepository';
import { PrismaUserPreferencesRepository } from '../prisma/repositories/core/PrismaUserPreferencesRepository';

import { PrismaModuleRepository } from '../prisma/repositories/system/PrismaModuleRepository';
import { PrismaRoleRepository } from '../prisma/repositories/system/PrismaRoleRepository';
import { PrismaPermissionRepository as PrismaSystemPermissionRepository } from '../prisma/repositories/system/PrismaPermissionRepository';
import { PrismaNotificationRepository } from '../prisma/repositories/system/PrismaNotificationRepository';
import { PrismaAuditLogRepository } from '../prisma/repositories/system/PrismaAuditLogRepository';
import { PrismaCompanyModuleSettingsRepository } from '../prisma/repositories/system/PrismaCompanyModuleSettingsRepository';
import { PrismaSystemMetadataRepository } from '../prisma/repositories/system/PrismaSystemMetadataRepository';

import { PrismaAccountRepository } from '../prisma/repositories/accounting/PrismaAccountRepository';
import { PrismaBankStatementRepository } from '../prisma/repositories/accounting/PrismaBankStatementRepository';
import { PrismaBudgetRepository } from '../prisma/repositories/accounting/PrismaBudgetRepository';
import { PrismaCompanyGroupRepository } from '../prisma/repositories/accounting/PrismaCompanyGroupRepository';
import { PrismaCostCenterRepository } from '../prisma/repositories/accounting/PrismaCostCenterRepository';
import { PrismaCurrencyRepository as PrismaAccountingCurrencyRepository } from '../prisma/repositories/accounting/PrismaCurrencyRepository';
import { PrismaExchangeRateRepository as PrismaAccountingExchangeRateRepository } from '../prisma/repositories/accounting/PrismaExchangeRateRepository';
import { PrismaFiscalYearRepository } from '../prisma/repositories/accounting/PrismaFiscalYearRepository';
import { PrismaLedgerRepository } from '../prisma/repositories/accounting/PrismaLedgerRepository';
import { PrismaReconciliationRepository } from '../prisma/repositories/accounting/PrismaReconciliationRepository';
import { PrismaRecurringVoucherTemplateRepository } from '../prisma/repositories/accounting/PrismaRecurringVoucherTemplateRepository';
import { PrismaVoucherSequenceRepository } from '../prisma/repositories/accounting/PrismaVoucherSequenceRepository';

import { PrismaCompanyModuleRepository } from '../prisma/repositories/company/PrismaCompanyModuleRepository';

import { PrismaChartOfAccountsTemplateRepository } from '../prisma/repositories/company-wizard/PrismaChartOfAccountsTemplateRepository';
import { PrismaCompanyCreationSessionRepository } from '../prisma/repositories/company-wizard/PrismaCompanyCreationSessionRepository';
import { PrismaCompanyWizardTemplateRepository } from '../prisma/repositories/company-wizard/PrismaCompanyWizardTemplateRepository';
import { PrismaInventoryTemplateRepository } from '../prisma/repositories/company-wizard/PrismaInventoryTemplateRepository';

import { PrismaFormDefinitionRepository } from '../prisma/repositories/designer/PrismaFormDefinitionRepository';
import { PrismaVoucherFormRepository } from '../prisma/repositories/designer/PrismaVoucherFormRepository';
import { PrismaVoucherTypeDefinitionRepository } from '../prisma/repositories/designer/PrismaVoucherTypeDefinitionRepository';

import { PrismaAttendanceRepository } from '../prisma/repositories/hr/PrismaAttendanceRepository';
import { PrismaEmployeeRepository } from '../prisma/repositories/hr/PrismaEmployeeRepository';

import { PrismaImpersonationRepository } from '../prisma/repositories/impersonation/PrismaImpersonationRepository';

import { PrismaInventoryPeriodSnapshotRepository } from '../prisma/repositories/inventory/PrismaInventoryPeriodSnapshotRepository';
import { PrismaInventorySettingsRepository } from '../prisma/repositories/inventory/PrismaInventorySettingsRepository';
import { PrismaItemCategoryRepository } from '../prisma/repositories/inventory/PrismaItemCategoryRepository';
import { PrismaItemRepository } from '../prisma/repositories/inventory/PrismaItemRepository';
import { PrismaOpeningStockDocumentRepository } from '../prisma/repositories/inventory/PrismaOpeningStockDocumentRepository';
import { PrismaStockAdjustmentRepository } from '../prisma/repositories/inventory/PrismaStockAdjustmentRepository';
import { PrismaStockLevelRepository } from '../prisma/repositories/inventory/PrismaStockLevelRepository';
import { PrismaStockMovementRepository } from '../prisma/repositories/inventory/PrismaStockMovementRepository';
import { PrismaStockTransferRepository } from '../prisma/repositories/inventory/PrismaStockTransferRepository';
import { PrismaUomConversionRepository } from '../prisma/repositories/inventory/PrismaUomConversionRepository';
import { PrismaUomRepository } from '../prisma/repositories/inventory/PrismaUomRepository';
import { PrismaWarehouseRepository } from '../prisma/repositories/inventory/PrismaWarehouseRepository';

import { PrismaPosOrderRepository } from '../prisma/repositories/pos/PrismaPosOrderRepository';
import { PrismaPosShiftRepository } from '../prisma/repositories/pos/PrismaPosShiftRepository';

import { PrismaGoodsReceiptRepository } from '../prisma/repositories/purchases/PrismaGoodsReceiptRepository';
import { PrismaPurchaseInvoiceRepository } from '../prisma/repositories/purchases/PrismaPurchaseInvoiceRepository';
import { PrismaPurchaseOrderRepository } from '../prisma/repositories/purchases/PrismaPurchaseOrderRepository';
import { PrismaPurchaseReturnRepository } from '../prisma/repositories/purchases/PrismaPurchaseReturnRepository';
import { PrismaPurchaseSettingsRepository } from '../prisma/repositories/purchases/PrismaPurchaseSettingsRepository';

import { PrismaCompanyRoleRepository } from '../prisma/repositories/rbac/PrismaCompanyRoleRepository';
import { PrismaPermissionRepository as PrismaRbacPermissionRepository } from '../prisma/repositories/rbac/PrismaPermissionRepository';
import { PrismaSystemRoleTemplateRepository } from '../prisma/repositories/rbac/PrismaSystemRoleTemplateRepository';

import { PrismaDeliveryNoteRepository } from '../prisma/repositories/sales/PrismaDeliveryNoteRepository';
import { PrismaSalesInvoiceRepository } from '../prisma/repositories/sales/PrismaSalesInvoiceRepository';
import { PrismaSalesOrderRepository } from '../prisma/repositories/sales/PrismaSalesOrderRepository';
import { PrismaSalesReturnRepository } from '../prisma/repositories/sales/PrismaSalesReturnRepository';
import { PrismaSalesSettingsRepository } from '../prisma/repositories/sales/PrismaSalesSettingsRepository';

import { PrismaPartyRepository } from '../prisma/repositories/shared/PrismaPartyRepository';
import { PrismaTaxCodeRepository } from '../prisma/repositories/shared/PrismaTaxCodeRepository';

import { PrismaBundleRegistryRepository } from '../prisma/repositories/super-admin/PrismaBundleRegistryRepository';
import { PrismaBusinessDomainRepository } from '../prisma/repositories/super-admin/PrismaBusinessDomainRepository';
import { PrismaModuleRegistryRepository } from '../prisma/repositories/super-admin/PrismaModuleRegistryRepository';
import { PrismaPermissionRegistryRepository } from '../prisma/repositories/super-admin/PrismaPermissionRegistryRepository';
import { PrismaPlanRegistryRepository } from '../prisma/repositories/super-admin/PrismaPlanRegistryRepository';
import { PrismaRoleTemplateRegistryRepository } from '../prisma/repositories/super-admin/PrismaRoleTemplateRegistryRepository';

import { PrismaRbacCompanyUserRepository } from '../prisma/repositories/rbac/PrismaRbacCompanyUserRepository';
import { PrismaModuleSettingsDefinitionRepository } from '../prisma/repositories/system/PrismaModuleSettingsDefinitionRepository';
import { PrismaModulePermissionsDefinitionRepository } from '../prisma/repositories/system/PrismaModulePermissionsDefinitionRepository';

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
const settingsResolverSQL = new SettingsResolverSQL();
const moduleActivationService = DB_TYPE === 'SQL'
  ? new ModuleActivationService(new PrismaCompanyModuleRepository(getPrismaClient()))
  : new ModuleActivationService(new FirestoreCompanyModuleRepository(getDb()));

export const diContainer = {
  // CORE
  get companyRepository(): ICompanyRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyRepository(getPrismaClient())
      : new FirestoreCompanyRepository(getDb());
  },
  get userRepository(): IUserRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaUserRepository(getPrismaClient())
      : new FirestoreUserRepository(getDb());
  },
  get companyUserRepository(): ICompanyUserRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyUserRepository(getPrismaClient())
      : new FirestoreCompanyUserRepository(getDb());
  },
  get companySettingsRepository(): ICompanySettingsRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanySettingsRepository(getPrismaClient())
      : new FirestoreCompanySettingsRepository(settingsResolver);
  },
  get userPreferencesRepository(): IUserPreferencesRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaUserPreferencesRepository(getPrismaClient())
      : new FirestoreUserPreferencesRepository(getDb());
  },
  get companyModuleRepository(): ICompanyModuleRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyModuleRepository(getPrismaClient())
      : new FirestoreCompanyModuleRepository(getDb());
  },
  get moduleActivationService(): ModuleActivationService { return moduleActivationService; },

  // SYSTEM
  get moduleRepository(): SysRepo.IModuleRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaModuleRepository(getPrismaClient())
      : new FirestoreModuleRepository(getDb());
  },
  get roleRepository(): SysRepo.IRoleRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaRoleRepository(getPrismaClient())
      : new FirestoreRoleRepository(getDb());
  },
  get permissionRepository(): SysRepo.IPermissionRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaSystemPermissionRepository(getPrismaClient())
      : new FirestorePermissionRepository(getDb());
  },
  get notificationRepository(): SysRepo.INotificationRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaNotificationRepository(getPrismaClient())
      : new FirestoreNotificationRepository(getDb());
  },
  get auditLogRepository(): SysRepo.IAuditLogRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaAuditLogRepository(getPrismaClient())
      : new FirestoreAuditLogRepository(getDb());
  },

  // ACCOUNTING
  get accountRepository(): AccRepo.IAccountRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaAccountRepository(getPrismaClient())
      : new AccountRepositoryFirestore(getDb());
  },
  get voucherRepository(): IVoucherRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaVoucherRepository(getPrismaClient())
      : new FirestoreVoucherRepositoryV2(getDb(), settingsResolver);
  },
  get voucherSequenceRepository(): AccRepo.IVoucherSequenceRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaVoucherSequenceRepository(getPrismaClient())
      : new FirestoreVoucherSequenceRepository(getDb());
  },
  get costCenterRepository(): AccRepo.ICostCenterRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCostCenterRepository(getPrismaClient())
      : new FirestoreCostCenterRepository(settingsResolver);
  },
  get exchangeRateRepository(): AccRepo.IExchangeRateRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaAccountingExchangeRateRepository(getPrismaClient())
      : new FirestoreExchangeRateRepository(settingsResolver);
  },
  get ledgerRepository(): AccRepo.ILedgerRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaLedgerRepository(getPrismaClient())
      : new FirestoreLedgerRepository(getDb());
  },
  get fiscalYearRepository(): AccRepo.IFiscalYearRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaFiscalYearRepository(getPrismaClient())
      : new FirestoreFiscalYearRepository(getDb());
  },
  get accountingCurrencyRepository(): AccRepo.ICurrencyRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaAccountingCurrencyRepository(getPrismaClient())
      : new FirestoreAccountingCurrencyRepository(settingsResolver);
  },
  get companyCurrencyRepository(): AccRepo.ICompanyCurrencyRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyCurrencyRepository(getPrismaClient())
      : new FirestoreCompanyCurrencyRepository(settingsResolver);
  },
  get bankStatementRepository(): AccRepo.IBankStatementRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaBankStatementRepository(getPrismaClient())
      : new FirestoreBankStatementRepository(getDb());
  },
  get reconciliationRepository(): AccRepo.IReconciliationRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaReconciliationRepository(getPrismaClient())
      : new FirestoreReconciliationRepository(getDb());
  },
  get budgetRepository(): AccRepo.IBudgetRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaBudgetRepository(getPrismaClient())
      : new FirestoreBudgetRepository(getDb());
  },
  get companyGroupRepository(): AccRepo.ICompanyGroupRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyGroupRepository(getPrismaClient())
      : new FirestoreCompanyGroupRepository(getDb());
  },
  get recurringVoucherTemplateRepository(): AccRepo.IRecurringVoucherTemplateRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaRecurringVoucherTemplateRepository(getPrismaClient())
      : new FirestoreRecurringVoucherTemplateRepository(getDb());
  },

  // INVENTORY
  get itemRepository(): InvRepo.IItemRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaItemRepository(getPrismaClient())
      : new FirestoreItemRepository(getDb());
  },
  get warehouseRepository(): InvRepo.IWarehouseRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaWarehouseRepository(getPrismaClient())
      : new FirestoreWarehouseRepository(getDb());
  },
  get stockMovementRepository(): InvRepo.IStockMovementRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaStockMovementRepository(getPrismaClient())
      : new FirestoreStockMovementRepository(getDb());
  },
  get stockLevelRepository(): InvRepo.IStockLevelRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaStockLevelRepository(getPrismaClient())
      : new FirestoreStockLevelRepository(getDb());
  },
  get itemCategoryRepository(): InvRepo.IItemCategoryRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaItemCategoryRepository(getPrismaClient())
      : new FirestoreItemCategoryRepository(getDb());
  },
  get uomRepository(): InvRepo.IUomRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaUomRepository(getPrismaClient())
      : new FirestoreUomRepository(getDb());
  },
  get uomConversionRepository(): InvRepo.IUomConversionRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaUomConversionRepository(getPrismaClient())
      : new FirestoreUomConversionRepository(getDb());
  },
  get inventorySettingsRepository(): InvRepo.IInventorySettingsRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaInventorySettingsRepository(getPrismaClient())
      : new FirestoreInventorySettingsRepository(getDb());
  },
  get openingStockDocumentRepository(): InvRepo.IOpeningStockDocumentRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaOpeningStockDocumentRepository(getPrismaClient())
      : new FirestoreOpeningStockDocumentRepository(getDb());
  },
  get stockAdjustmentRepository(): InvRepo.IStockAdjustmentRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaStockAdjustmentRepository(getPrismaClient())
      : new FirestoreStockAdjustmentRepository(getDb());
  },
  get stockTransferRepository(): InvRepo.IStockTransferRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaStockTransferRepository(getPrismaClient())
      : new FirestoreStockTransferRepository(getDb());
  },
  get inventoryPeriodSnapshotRepository(): InvRepo.IInventoryPeriodSnapshotRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaInventoryPeriodSnapshotRepository(getPrismaClient())
      : new FirestoreInventoryPeriodSnapshotRepository(getDb());
  },

  // PURCHASES
  get purchaseSettingsRepository(): PurRepo.IPurchaseSettingsRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaPurchaseSettingsRepository(getPrismaClient())
      : new FirestorePurchaseSettingsRepository(getDb());
  },
  get purchaseOrderRepository(): PurRepo.IPurchaseOrderRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaPurchaseOrderRepository(getPrismaClient())
      : new FirestorePurchaseOrderRepository(getDb());
  },
  get goodsReceiptRepository(): PurRepo.IGoodsReceiptRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaGoodsReceiptRepository(getPrismaClient())
      : new FirestoreGoodsReceiptRepository(getDb());
  },
  get purchaseInvoiceRepository(): PurRepo.IPurchaseInvoiceRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaPurchaseInvoiceRepository(getPrismaClient())
      : new FirestorePurchaseInvoiceRepository(getDb());
  },
  get purchaseReturnRepository(): PurRepo.IPurchaseReturnRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaPurchaseReturnRepository(getPrismaClient())
      : new FirestorePurchaseReturnRepository(getDb());
  },

  // SALES
  get salesSettingsRepository(): SalRepo.ISalesSettingsRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaSalesSettingsRepository(getPrismaClient())
      : new FirestoreSalesSettingsRepository(getDb());
  },
  get salesOrderRepository(): SalRepo.ISalesOrderRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaSalesOrderRepository(getPrismaClient())
      : new FirestoreSalesOrderRepository(getDb());
  },
  get deliveryNoteRepository(): SalRepo.IDeliveryNoteRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaDeliveryNoteRepository(getPrismaClient())
      : new FirestoreDeliveryNoteRepository(getDb());
  },
  get salesInvoiceRepository(): SalRepo.ISalesInvoiceRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaSalesInvoiceRepository(getPrismaClient())
      : new FirestoreSalesInvoiceRepository(getDb());
  },
  get salesReturnRepository(): SalRepo.ISalesReturnRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaSalesReturnRepository(getPrismaClient())
      : new FirestoreSalesReturnRepository(getDb());
  },

  // HR
  get employeeRepository(): HrRepo.IEmployeeRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaEmployeeRepository(getPrismaClient())
      : new FirestoreEmployeeRepository(getDb());
  },
  get attendanceRepository(): HrRepo.IAttendanceRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaAttendanceRepository(getPrismaClient())
      : new FirestoreAttendanceRepository(getDb());
  },

  // POS
  get posShiftRepository(): PosRepo.IPosShiftRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaPosShiftRepository(getPrismaClient())
      : new FirestorePosShiftRepository(getDb());
  },
  get posOrderRepository(): PosRepo.IPosOrderRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaPosOrderRepository(getPrismaClient())
      : new FirestorePosOrderRepository(getDb());
  },


  // DESIGNER
  get formDefinitionRepository(): DesRepo.IFormDefinitionRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaFormDefinitionRepository(getPrismaClient())
      : new FirestoreFormDefinitionRepository(getDb());
  },
  get voucherTypeDefinitionRepository(): DesRepo.IVoucherTypeDefinitionRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaVoucherTypeDefinitionRepository(getPrismaClient())
      : new FirestoreVoucherTypeDefinitionRepository(getDb());
  },
  get voucherFormRepository(): DesRepo.IVoucherFormRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaVoucherFormRepository(getPrismaClient())
      : new FirestoreVoucherFormRepository(getDb());
  },

  // RBAC
  get rbacPermissionRepository(): IRbacPermissionRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaRbacPermissionRepository(getPrismaClient())
      : new FirestoreRbacPermissionRepository(getDb());
  },
  get systemRoleTemplateRepository(): ISystemRoleTemplateRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaSystemRoleTemplateRepository(getPrismaClient())
      : new FirestoreSystemRoleTemplateRepository(getDb());
  },
  get companyRoleRepository(): ICompanyRoleRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyRoleRepository(getPrismaClient())
      : new FirestoreCompanyRoleRepository(getDb());
  },
  get rbacCompanyUserRepository(): IRbacCompanyUserRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaRbacCompanyUserRepository(getPrismaClient())
      : new FirestoreRbacCompanyUserRepository(getDb());
  },
  get companyRolePermissionResolver(): CompanyRolePermissionResolver {
    return new CompanyRolePermissionResolver(
      this.modulePermissionsDefinitionRepository,
      this.companyRoleRepository
    );
  },

  // IMPERSONATION
  get impersonationRepository(): IImpersonationRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaImpersonationRepository(getPrismaClient())
      : new FirestoreImpersonationRepository(getDb());
  },

  // COMPANY WIZARD
  get companyWizardTemplateRepository(): ICompanyWizardTemplateRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyWizardTemplateRepository(getPrismaClient())
      : new FirestoreCompanyWizardTemplateRepository(getDb());
  },
  get companyCreationSessionRepository(): ICompanyCreationSessionRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyCreationSessionRepository(getPrismaClient())
      : new FirestoreCompanyCreationSessionRepository(getDb());
  },
  get chartOfAccountsTemplateRepository(): IChartOfAccountsTemplateRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaChartOfAccountsTemplateRepository(getPrismaClient())
      : new FirestoreChartOfAccountsTemplateRepository(getDb());
  },
  get currencyRepository(): ICurrencyRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaWizardCurrencyRepository(getPrismaClient())
      : new FirestoreCurrencyRepository(settingsResolver);
  },
  get inventoryTemplateRepository(): IInventoryTemplateRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaInventoryTemplateRepository(getPrismaClient())
      : new FirestoreInventoryTemplateRepository(getDb());
  },

  // MODULE SETTINGS
  get moduleSettingsDefinitionRepository(): IModuleSettingsDefinitionRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaModuleSettingsDefinitionRepository(getPrismaClient())
      : new FirestoreModuleSettingsDefinitionRepository(getDb());
  },
  get companyModuleSettingsRepository(): ICompanyModuleSettingsRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyModuleSettingsRepository(getPrismaClient())
      : new FirestoreCompanyModuleSettingsRepository(getDb());
  },

  // MODULE PERMISSIONS
  get modulePermissionsDefinitionRepository(): IModulePermissionsDefinitionRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaModulePermissionsDefinitionRepository(getPrismaClient())
      : new FirestoreModulePermissionsDefinitionRepository(getDb());
  },

  // COMPANY ADMIN
  get companyAdminRepository(): ICompanyAdminRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyAdminRepository(getPrismaClient())
      : new FirestoreCompanyAdminRepository(getDb());
  },

  // SUPER ADMIN
  get businessDomainRepository(): IBusinessDomainRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaBusinessDomainRepository(getPrismaClient())
      : new FirestoreBusinessDomainRepository(getDb());
  },
  get permissionRegistryRepository(): IPermissionRegistryRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaPermissionRegistryRepository(getPrismaClient())
      : new FirestorePermissionRegistryRepository(getDb());
  },
  get moduleRegistryRepository(): IModuleRegistryRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaModuleRegistryRepository(getPrismaClient())
      : new FirestoreModuleRegistryRepository(getDb());
  },
  get bundleRegistryRepository(): IBundleRegistryRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaBundleRegistryRepository(getPrismaClient())
      : new FirestoreBundleRegistryRepository(getDb());
  },
  get planRegistryRepository(): IPlanRegistryRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaPlanRegistryRepository(getPrismaClient())
      : new FirestorePlanRegistryRepository(getDb());
  },
  get roleTemplateRegistryRepository(): IRoleTemplateRegistryRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaRoleTemplateRegistryRepository(getPrismaClient())
      : new FirestoreRoleTemplateRegistryRepository(getDb());
  },

  // SHARED
  get partyRepository(): IPartyRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaPartyRepository(getPrismaClient())
      : new FirestorePartyRepository(getDb());
  },
  get taxCodeRepository(): ITaxCodeRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaTaxCodeRepository(getPrismaClient())
      : new FirestoreTaxCodeRepository(getDb());
  },
  get transactionManager(): ITransactionManager {
    return DB_TYPE === 'SQL'
      ? new PrismaTransactionManager(getPrismaClient())
      : new FirestoreTransactionManager(getDb());
  },

  // POLICY SYSTEM
  get policyRegistry() {
    const { AccountingPolicyRegistry } = require('../../application/accounting/policies/AccountingPolicyRegistry');
    
    if (DB_TYPE === 'SQL') {
      const { PrismaAccountingPolicyConfigProvider } = require('../prisma/providers/PrismaAccountingPolicyConfigProvider');
      const { PrismaUserAccessScopeProvider } = require('../prisma/providers/PrismaUserAccessScopeProvider');
      const { PrismaAccountLookupService } = require('../prisma/providers/PrismaAccountLookupService');
      
      const configProvider = new PrismaAccountingPolicyConfigProvider(getPrismaClient());
      const userScopeProvider = new PrismaUserAccessScopeProvider(getPrismaClient());
      const accountLookup = new PrismaAccountLookupService(getPrismaClient());
      
      const fiscalYearRepo = DB_TYPE === 'SQL'
        ? new PrismaFiscalYearRepository(getPrismaClient())
        : new FirestoreFiscalYearRepository(getDb());
      return new AccountingPolicyRegistry(configProvider, userScopeProvider, accountLookup, fiscalYearRepo);
    } else {
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
      return new PrismaAccountingPolicyConfigProvider(getPrismaClient());
    } else {
      const { FirestoreAccountingPolicyConfigProvider } = require('../accounting/config/FirestoreAccountingPolicyConfigProvider');
      return new FirestoreAccountingPolicyConfigProvider(settingsResolver);
    }
  },

  // AUTH
  get tokenVerifier(): ITokenVerifier { return new FirebaseTokenVerifier(); },

  // SYSTEM METADATA
  get systemMetadataRepository(): ISystemMetadataRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaSystemMetadataRepository(getPrismaClient())
      : new FirestoreSystemMetadataRepository(getDb());
  },

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
