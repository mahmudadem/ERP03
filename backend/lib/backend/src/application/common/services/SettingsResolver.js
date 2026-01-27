"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsResolver = void 0;
/**
 * SettingsResolver
 *
 * Provides centralized path resolution for different tiers of settings.
 * This decouples feature code from the physical Firestore structure.
 */
class SettingsResolver {
    constructor(db) {
        this.db = db;
    }
    /**
     * Tier 1: Global Company Settings
     * Path: companies/{id}/Settings/company
     */
    getCompanySettingsRef(companyId) {
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
    getSharedModuleRef(companyId) {
        return this.db
            .collection('companies')
            .doc(companyId)
            .collection('shared');
    }
    getSharedSettingsRef(companyId) {
        return this.getSharedModuleRef(companyId).doc('Settings');
    }
    getSharedDataRef(companyId) {
        return this.getSharedModuleRef(companyId).doc('Data');
    }
    getSharedSettingsCollection(companyId, collectionName) {
        return this.getSharedSettingsRef(companyId).collection(collectionName);
    }
    getSharedDataCollection(companyId, collectionName) {
        return this.getSharedDataRef(companyId).collection(collectionName);
    }
    /**
     * Tier 3: Module-Specific Settings
     * Path: companies/{id}/{moduleId}/Settings
     */
    getModuleSettingsRef(companyId, moduleId) {
        return this.db
            .collection('companies')
            .doc(companyId)
            .collection(moduleId)
            .doc('Settings');
    }
    getModuleSubCollectionRef(companyId, moduleId, collectionName) {
        return this.getModuleSettingsRef(companyId, moduleId).collection(collectionName);
    }
    getModuleDataRef(companyId, moduleId) {
        return this.db
            .collection('companies')
            .doc(companyId)
            .collection(moduleId)
            .doc('Data');
    }
    getModuleDataCollection(companyId, moduleId, collectionName) {
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
    getCurrenciesCollection(companyId) {
        return this.getSharedSettingsCollection(companyId, 'currencies');
    }
    /**
     * Resolves the correct path for Exchange Rates.
     * Path: companies/{id}/accounting/Data/exchange_rates
     */
    getExchangeRatesCollection(companyId) {
        return this.getModuleDataCollection(companyId, 'accounting', 'exchange_rates');
    }
    /**
     * Resolves the correct path for Vouchers.
     * Path: companies/{id}/accounting/Data/vouchers
     */
    getVouchersCollection(companyId) {
        return this.getModuleDataCollection(companyId, 'accounting', 'vouchers');
    }
    /**
     * Resolves the correct path for Accounting Module Settings.
     * Path: companies/{id}/accounting/Settings
     */
    getAccountingSettingsRef(companyId) {
        return this.getModuleSettingsRef(companyId, 'accounting');
    }
    /**
     * Example of a setting that MIGHT be promoted later.
     * For now it's local to accounting.
     */
    getTaxCategoriesCollection(companyId) {
        // Current: Local to accounting
        // Post-Promotion: Return this.getSharedCollectionRef(companyId, 'taxCategories')
        return this.getModuleSubCollectionRef(companyId, 'accounting', 'taxCategories');
    }
    /**
     * Resolves the correct path for Cost Centers.
     * Currently local to accounting module.
     */
    getCostCentersCollection(companyId) {
        return this.getModuleSubCollectionRef(companyId, 'accounting', 'cost_centers');
    }
}
exports.SettingsResolver = SettingsResolver;
//# sourceMappingURL=SettingsResolver.js.map