"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.diContainer = void 0;
const admin = __importStar(require("firebase-admin"));
// Import All Firestore Implementations
const FirestoreCompanyRepository_1 = require("../firestore/repositories/core/FirestoreCompanyRepository");
const FirestoreUserRepository_1 = require("../firestore/repositories/core/FirestoreUserRepository");
const FirestoreCompanyUserRepository_1 = require("../firestore/repositories/core/FirestoreCompanyUserRepository");
const FirestoreCompanySettingsRepository_1 = require("../firestore/repositories/core/FirestoreCompanySettingsRepository");
const FirestoreSystemRepositories_1 = require("../firestore/repositories/system/FirestoreSystemRepositories");
const FirestoreVoucherRepository_1 = require("../firestore/repositories/accounting/FirestoreVoucherRepository");
const FirestoreAccountingRepositories_1 = require("../firestore/repositories/accounting/FirestoreAccountingRepositories");
const FirestoreLedgerRepository_1 = require("../firestore/repositories/accounting/FirestoreLedgerRepository");
const AccountRepositoryFirestore_1 = require("../firestore/accounting/AccountRepositoryFirestore");
const FirestoreInventoryRepositories_1 = require("../firestore/repositories/inventory/FirestoreInventoryRepositories");
const FirestoreHRRepositories_1 = require("../firestore/repositories/hr/FirestoreHRRepositories");
const FirestorePOSRepositories_1 = require("../firestore/repositories/pos/FirestorePOSRepositories");
const FirestoreDesignerRepositories_1 = require("../firestore/repositories/designer/FirestoreDesignerRepositories");
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
// Import Prisma Implementations
const PrismaCompanyRepository_1 = require("../prisma/repositories/PrismaCompanyRepository");
const PrismaVoucherRepository_1 = require("../prisma/repositories/PrismaVoucherRepository");
const prismaClient_1 = require("../prisma/prismaClient");
// Ensure Firestore settings are applied only once to avoid emulator runtime errors
let firestoreConfigured = false;
const getDb = () => {
    if (!admin.apps.length)
        admin.initializeApp();
    const db = admin.firestore();
    if (!firestoreConfigured) {
        db.settings({ ignoreUndefinedProperties: true });
        firestoreConfigured = true;
    }
    return db;
};
// Database type configuration
const DB_TYPE = process.env.DB_TYPE || 'FIRESTORE'; // 'FIRESTORE' or 'SQL'
exports.diContainer = {
    // CORE
    get companyRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaCompanyRepository_1.PrismaCompanyRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreCompanyRepository_1.FirestoreCompanyRepository(getDb());
    },
    get userRepository() { return new FirestoreUserRepository_1.FirestoreUserRepository(getDb()); },
    get companyUserRepository() { return new FirestoreCompanyUserRepository_1.FirestoreCompanyUserRepository(getDb()); },
    get companySettingsRepository() { return new FirestoreCompanySettingsRepository_1.FirestoreCompanySettingsRepository(getDb()); },
    // SYSTEM
    get moduleRepository() { return new FirestoreSystemRepositories_1.FirestoreModuleRepository(getDb()); },
    get roleRepository() { return new FirestoreSystemRepositories_1.FirestoreRoleRepository(getDb()); },
    get permissionRepository() { return new FirestoreSystemRepositories_1.FirestorePermissionRepository(getDb()); },
    get notificationRepository() { return new FirestoreSystemRepositories_1.FirestoreNotificationRepository(getDb()); },
    get auditLogRepository() { return new FirestoreSystemRepositories_1.FirestoreAuditLogRepository(getDb()); },
    // ACCOUNTING
    get accountRepository() { return new AccountRepositoryFirestore_1.AccountRepositoryFirestore(getDb()); },
    get voucherRepository() {
        return DB_TYPE === 'SQL'
            ? new PrismaVoucherRepository_1.PrismaVoucherRepository((0, prismaClient_1.getPrismaClient)())
            : new FirestoreVoucherRepository_1.FirestoreVoucherRepository(getDb());
    },
    get costCenterRepository() { return new FirestoreAccountingRepositories_1.FirestoreCostCenterRepository(getDb()); },
    get exchangeRateRepository() { return new FirestoreAccountingRepositories_1.FirestoreExchangeRateRepository(getDb()); },
    get ledgerRepository() { return new FirestoreLedgerRepository_1.FirestoreLedgerRepository(getDb()); },
    // INVENTORY
    get itemRepository() { return new FirestoreInventoryRepositories_1.FirestoreItemRepository(getDb()); },
    get warehouseRepository() { return new FirestoreInventoryRepositories_1.FirestoreWarehouseRepository(getDb()); },
    get stockMovementRepository() { return new FirestoreInventoryRepositories_1.FirestoreStockMovementRepository(getDb()); },
    // HR
    get employeeRepository() { return new FirestoreHRRepositories_1.FirestoreEmployeeRepository(getDb()); },
    get attendanceRepository() { return new FirestoreHRRepositories_1.FirestoreAttendanceRepository(getDb()); },
    // POS
    get posShiftRepository() { return new FirestorePOSRepositories_1.FirestorePosShiftRepository(getDb()); },
    get posOrderRepository() { return new FirestorePOSRepositories_1.FirestorePosOrderRepository(getDb()); },
    // DESIGNER
    get formDefinitionRepository() { return new FirestoreDesignerRepositories_1.FirestoreFormDefinitionRepository(getDb()); },
    get voucherTypeDefinitionRepository() { return new FirestoreDesignerRepositories_1.FirestoreVoucherTypeDefinitionRepository(getDb()); },
    // RBAC
    get rbacPermissionRepository() { return new FirestorePermissionRepository_1.FirestorePermissionRepository(getDb()); },
    get systemRoleTemplateRepository() { return new FirestoreSystemRoleTemplateRepository_1.FirestoreSystemRoleTemplateRepository(getDb()); },
    get companyRoleRepository() { return new FirestoreCompanyRoleRepository_1.FirestoreCompanyRoleRepository(getDb()); },
    get rbacCompanyUserRepository() { return new FirestoreCompanyUserRepository_2.FirestoreCompanyUserRepository(getDb()); },
    // IMPERSONATION
    get impersonationRepository() { return new FirestoreImpersonationRepository_1.FirestoreImpersonationRepository(getDb()); },
    // COMPANY WIZARD
    get companyWizardTemplateRepository() { return new FirestoreCompanyWizardTemplateRepository_1.FirestoreCompanyWizardTemplateRepository(getDb()); },
    get companyCreationSessionRepository() { return new FirestoreCompanyCreationSessionRepository_1.FirestoreCompanyCreationSessionRepository(getDb()); },
    get chartOfAccountsTemplateRepository() { return new FirestoreChartOfAccountsTemplateRepository_1.FirestoreChartOfAccountsTemplateRepository(getDb()); },
    get currencyRepository() { return new FirestoreCurrencyRepository_1.FirestoreCurrencyRepository(getDb()); },
    get inventoryTemplateRepository() { return new FirestoreInventoryTemplateRepository_1.FirestoreInventoryTemplateRepository(getDb()); },
    // MODULE SETTINGS
    get moduleSettingsDefinitionRepository() { return new FirestoreModuleSettingsDefinitionRepository_1.FirestoreModuleSettingsDefinitionRepository(getDb()); },
    get companyModuleSettingsRepository() { return new FirestoreCompanyModuleSettingsRepository_1.FirestoreCompanyModuleSettingsRepository(getDb()); },
    // MODULE PERMISSIONS
    get modulePermissionsDefinitionRepository() { return new FirestoreModulePermissionsDefinitionRepository_1.FirestoreModulePermissionsDefinitionRepository(getDb()); }
};
//# sourceMappingURL=bindRepositories.js.map