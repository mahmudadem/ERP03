"use strict";
/**
 * SettingsResolverSQL.ts
 *
 * SQL-compatible alternative to SettingsResolver.
 * In SQL mode, collection paths are not needed since table names are fixed in Prisma models.
 * This class satisfies the SettingsResolver interface but returns null/empty values.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsResolverSQL = void 0;
class SettingsResolverSQL {
    getCompanySettingsRef(_companyId) { return null; }
    getSharedModuleRef(_companyId) { return null; }
    getSharedSettingsRef(_companyId) { return null; }
    getSharedDataRef(_companyId) { return null; }
    getSharedSettingsCollection(_companyId, _collectionName) { return null; }
    getSharedDataCollection(_companyId, _collectionName) { return null; }
    getModuleSettingsRef(_companyId, _moduleId) { return null; }
    getModuleSubCollectionRef(_companyId, _moduleId, _collectionName) { return null; }
    getModuleDataRef(_companyId, _moduleId) { return null; }
    getModuleDataCollection(_companyId, _moduleId, _collectionName) { return null; }
    getCurrenciesCollection(_companyId) { return null; }
    getExchangeRatesCollection(_companyId) { return null; }
    getVouchersCollection(_companyId) { return null; }
    getAccountingSettingsRef(_companyId) { return null; }
    getTaxCategoriesCollection(_companyId) { return null; }
    getCostCentersCollection(_companyId) { return null; }
}
exports.SettingsResolverSQL = SettingsResolverSQL;
//# sourceMappingURL=SettingsResolverSQL.js.map