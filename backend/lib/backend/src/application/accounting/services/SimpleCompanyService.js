"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleCompanyService = void 0;
/**
 * Simple Company Service
 *
 * Provides company information needed for voucher processing.
 * This is a simplified version - production should use CompanyRepository.
 */
class SimpleCompanyService {
    constructor() {
        // Default base currency (for testing/demo)
        this.DEFAULT_BASE_CURRENCY = '';
        // In-memory storage (for testing)
        this.companyCurrencies = new Map();
    }
    /**
     * Get company's base currency
     */
    async getBaseCurrency(companyId) {
        // Return stored currency or default
        return this.companyCurrencies.get(companyId) || this.DEFAULT_BASE_CURRENCY;
    }
    /**
     * Set company's base currency (for testing)
     */
    setBaseCurrency(companyId, currency) {
        this.companyCurrencies.set(companyId, currency);
    }
    /**
     * Reset (for testing)
     */
    reset() {
        this.companyCurrencies.clear();
    }
}
exports.SimpleCompanyService = SimpleCompanyService;
//# sourceMappingURL=SimpleCompanyService.js.map