"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCurrencyDecimalPlacesUseCase = exports.GetCurrencyUseCase = exports.ListCurrenciesUseCase = void 0;
/**
 * Get all active currencies available in the system.
 */
class ListCurrenciesUseCase {
    constructor(currencyRepo) {
        this.currencyRepo = currencyRepo;
    }
    async execute() {
        return this.currencyRepo.findActive();
    }
}
exports.ListCurrenciesUseCase = ListCurrenciesUseCase;
/**
 * Get a currency by its code.
 */
class GetCurrencyUseCase {
    constructor(currencyRepo) {
        this.currencyRepo = currencyRepo;
    }
    async execute(code) {
        return this.currencyRepo.findByCode(code);
    }
}
exports.GetCurrencyUseCase = GetCurrencyUseCase;
/**
 * Get decimal places for a currency code.
 * Returns 2 as fallback if currency not found.
 */
class GetCurrencyDecimalPlacesUseCase {
    constructor(currencyRepo) {
        this.currencyRepo = currencyRepo;
    }
    async execute(code) {
        var _a;
        const currency = await this.currencyRepo.findByCode(code);
        return (_a = currency === null || currency === void 0 ? void 0 : currency.decimalPlaces) !== null && _a !== void 0 ? _a : 2;
    }
}
exports.GetCurrencyDecimalPlacesUseCase = GetCurrencyDecimalPlacesUseCase;
//# sourceMappingURL=CurrencyUseCases.js.map