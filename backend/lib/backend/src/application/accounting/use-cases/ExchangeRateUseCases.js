"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetExchangeRateUseCase = exports.SetExchangeRateUseCase = void 0;
const ExchangeRate_1 = require("../../../domain/accounting/entities/ExchangeRate");
class SetExchangeRateUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(from, to, rate, date) {
        const exRate = new ExchangeRate_1.ExchangeRate(`er_${Date.now()}`, from, to, rate, date);
        await this.repo.setRate(exRate);
    }
}
exports.SetExchangeRateUseCase = SetExchangeRateUseCase;
class GetExchangeRateUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(from, to, date) {
        const rateEntity = await this.repo.getRate(from, to, date);
        return rateEntity ? rateEntity.rate : 1.0;
    }
}
exports.GetExchangeRateUseCase = GetExchangeRateUseCase;
//# sourceMappingURL=ExchangeRateUseCases.js.map