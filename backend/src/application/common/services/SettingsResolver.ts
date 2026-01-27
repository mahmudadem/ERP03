import { Firestore } from 'firebase-admin/firestore';

/**
 * SettingsResolver
 * 
 * Provides centralized path resolution for different tiers of settings.
 * This decouples feature code from the physical Firestore structure.
 */
export class SettingsResolver {
  constructor(public readonly db: Firestore) {}

  /**
   * Tier 1: Global Company Settings
   * Path: companies/{id}/Settings/company
   */
  getCompanySettingsRef(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('Settings')
      .doc('company');
  }

   /**
   * Tier 2: Shared Module (Core)
   * Path: companies/{id}/shared
   * 
   * Broken into:
   * - Settings: Configuration (e.g. Enabled Currencies)
   * - Data: Transactional Records (e.g. Exchange Rates)
   */
  getSharedModuleRef(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('shared');
  }

  getSharedSettingsRef(companyId: string) {
    return this.getSharedModuleRef(companyId).doc('Settings');
  }

  getSharedDataRef(companyId: string) {
    return this.getSharedModuleRef(companyId).doc('Data');
  }

  getSharedSettingsCollection(companyId: string, collectionName: string) {
    return this.getSharedSettingsRef(companyId).collection(collectionName);
  }

  getSharedDataCollection(companyId: string, collectionName: string) {
    return this.getSharedDataRef(companyId).collection(collectionName);
  }

  /**
   * Tier 3: Module-Specific Settings
   * Path: companies/{id}/{moduleId}/Settings
   */
  getModuleSettingsRef(companyId: string, moduleId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection(moduleId)
      .doc('Settings');
  }

  getModuleSubCollectionRef(companyId: string, moduleId: string, collectionName: string) {
    return this.getModuleSettingsRef(companyId, moduleId).collection(collectionName);
  }

  getModuleDataRef(companyId: string, moduleId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection(moduleId)
      .doc('Data');
  }

  getModuleDataCollection(companyId: string, moduleId: string, collectionName: string) {
    return this.getModuleDataRef(companyId, moduleId).collection(collectionName);
  }

  /**
   * RESOLUTION LOGIC (The Abstraction)
   * This is where the "Evolutionary" logic lives.
   */

  /**
   * Resolves the correct path for Currencies.
   * Path: companies/{id}/shared/Settings/currencies
   */
  getCurrenciesCollection(companyId: string) {
    return this.getSharedSettingsCollection(companyId, 'currencies');
  }

  /**
   * Resolves the correct path for Exchange Rates.
   * Path: companies/{id}/accounting/Data/exchange_rates
   */
  getExchangeRatesCollection(companyId: string) {
    return this.getModuleDataCollection(companyId, 'accounting', 'exchange_rates');
  }

  /**
   * Resolves the correct path for Vouchers.
   * Path: companies/{id}/accounting/Data/vouchers
   */
  getVouchersCollection(companyId: string) {
    return this.getModuleDataCollection(companyId, 'accounting', 'vouchers');
  }

  /**
   * Resolves the correct path for Accounting Module Settings.
   * Path: companies/{id}/accounting/Settings
   */
  getAccountingSettingsRef(companyId: string) {
    return this.getModuleSettingsRef(companyId, 'accounting');
  }

  /**
   * Example of a setting that MIGHT be promoted later.
   * For now it's local to accounting.
   */
  getTaxCategoriesCollection(companyId: string) {
    // Current: Local to accounting
    // Post-Promotion: Return this.getSharedCollectionRef(companyId, 'taxCategories')
    return this.getModuleSubCollectionRef(companyId, 'accounting', 'taxCategories');
  }

  /**
   * Resolves the correct path for Cost Centers.
   * Currently local to accounting module.
   */
  getCostCentersCollection(companyId: string) {
    return this.getModuleSubCollectionRef(companyId, 'accounting', 'cost_centers');
  }
}
