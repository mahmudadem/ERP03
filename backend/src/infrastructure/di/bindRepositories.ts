import admin from '../../firebaseAdmin';

// Import All Interfaces
import { ICompanyRepository } from '../../repository/interfaces/core/ICompanyRepository';
import { IUserRepository } from '../../repository/interfaces/core/IUserRepository';
import { ICompanyUserRepository } from '../../repository/interfaces/core/ICompanyUserRepository';
import { ICompanySettingsRepository } from '../../repository/interfaces/core/ICompanySettingsRepository';
import * as SysRepo from '../../repository/interfaces/system';
import * as AccRepo from '../../repository/interfaces/accounting';
import * as InvRepo from '../../repository/interfaces/inventory';
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
import { FirestoreModuleRepository, FirestoreRoleRepository, FirestorePermissionRepository, FirestoreNotificationRepository, FirestoreAuditLogRepository } from '../firestore/repositories/system/FirestoreSystemRepositories';
import { FirestoreVoucherRepository } from '../firestore/repositories/accounting/FirestoreVoucherRepository';
import { FirestoreCostCenterRepository, FirestoreExchangeRateRepository } from '../firestore/repositories/accounting/FirestoreAccountingRepositories';
import { FirestoreLedgerRepository } from '../firestore/repositories/accounting/FirestoreLedgerRepository';
import { AccountRepositoryFirestore } from '../firestore/accounting/AccountRepositoryFirestore';
import { FirestoreItemRepository, FirestoreWarehouseRepository, FirestoreStockMovementRepository } from '../firestore/repositories/inventory/FirestoreInventoryRepositories';
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
import { FirestoreTransactionManager } from '../firestore/transaction/FirestoreTransactionManager';

// AUTH
import { ITokenVerifier } from '../../application/auth/interfaces/ITokenVerifier';
import { FirebaseTokenVerifier } from '../auth/FirebaseTokenVerifier';


// Helper to get Firestore instance
const getDb = () => admin.firestore();

// Database type configuration
const DB_TYPE = process.env.DB_TYPE || 'FIRESTORE'; // 'FIRESTORE' or 'SQL'

export const diContainer = {
  // CORE
  get companyRepository(): ICompanyRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaCompanyRepository(getPrismaClient())
      : new FirestoreCompanyRepository(getDb());
  },
  get userRepository(): IUserRepository { return new FirestoreUserRepository(getDb()); },
  get companyUserRepository(): ICompanyUserRepository { return new FirestoreCompanyUserRepository(getDb()); },
  get companySettingsRepository(): ICompanySettingsRepository { return new FirestoreCompanySettingsRepository(getDb()); },
  get companyModuleRepository(): ICompanyModuleRepository { return new FirestoreCompanyModuleRepository(getDb()); },

  // SYSTEM
  get moduleRepository(): SysRepo.IModuleRepository { return new FirestoreModuleRepository(getDb()); },
  get roleRepository(): SysRepo.IRoleRepository { return new FirestoreRoleRepository(getDb()); },
  get permissionRepository(): SysRepo.IPermissionRepository { return new FirestorePermissionRepository(getDb()); },
  get notificationRepository(): SysRepo.INotificationRepository { return new FirestoreNotificationRepository(getDb()); },
  get auditLogRepository(): SysRepo.IAuditLogRepository { return new FirestoreAuditLogRepository(getDb()); },

  // ACCOUNTING
  get accountRepository(): AccRepo.IAccountRepository { return new AccountRepositoryFirestore(getDb()); },
  get voucherRepository(): AccRepo.IVoucherRepository {
    return DB_TYPE === 'SQL'
      ? new PrismaVoucherRepository(getPrismaClient())
      : new FirestoreVoucherRepository(getDb());
  },
  get costCenterRepository(): AccRepo.ICostCenterRepository { return new FirestoreCostCenterRepository(getDb()); },
  get exchangeRateRepository(): AccRepo.IExchangeRateRepository { return new FirestoreExchangeRateRepository(getDb()); },
  get ledgerRepository(): AccRepo.ILedgerRepository { return new FirestoreLedgerRepository(getDb()); },

  // INVENTORY
  get itemRepository(): InvRepo.IItemRepository { return new FirestoreItemRepository(getDb()); },
  get warehouseRepository(): InvRepo.IWarehouseRepository { return new FirestoreWarehouseRepository(getDb()); },
  get stockMovementRepository(): InvRepo.IStockMovementRepository { return new FirestoreStockMovementRepository(getDb()); },

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
  get currencyRepository(): ICurrencyRepository { return new FirestoreCurrencyRepository(getDb()); },
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
  get transactionManager(): ITransactionManager { return new FirestoreTransactionManager(getDb()); },

  // AUTH
  get tokenVerifier(): ITokenVerifier { return new FirebaseTokenVerifier(); },

  // SYSTEM METADATA
  get systemMetadataRepository(): ISystemMetadataRepository { return new FirestoreSystemMetadataRepository(getDb()); }
};
