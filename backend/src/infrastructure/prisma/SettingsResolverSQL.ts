/**
 * SettingsResolverSQL.ts
 * 
 * SQL-compatible alternative to SettingsResolver.
 * In SQL mode, collection paths are not needed since table names are fixed in Prisma models.
 * This class satisfies the SettingsResolver interface but returns null/empty values.
 */

export class SettingsResolverSQL {
  getCompanySettingsRef(_companyId: string) { return null; }
  getSharedModuleRef(_companyId: string) { return null; }
  getSharedSettingsRef(_companyId: string) { return null; }
  getSharedDataRef(_companyId: string) { return null; }
  getSharedSettingsCollection(_companyId: string, _collectionName: string) { return null; }
  getSharedDataCollection(_companyId: string, _collectionName: string) { return null; }
  getModuleSettingsRef(_companyId: string, _moduleId: string) { return null; }
  getModuleSubCollectionRef(_companyId: string, _moduleId: string, _collectionName: string) { return null; }
  getModuleDataRef(_companyId: string, _moduleId: string) { return null; }
  getModuleDataCollection(_companyId: string, _moduleId: string, _collectionName: string) { return null; }
  getCurrenciesCollection(_companyId: string) { return null; }
  getExchangeRatesCollection(_companyId: string) { return null; }
  getVouchersCollection(_companyId: string) { return null; }
  getAccountingSettingsRef(_companyId: string) { return null; }
  getTaxCategoriesCollection(_companyId: string) { return null; }
  getCostCentersCollection(_companyId: string) { return null; }
}
