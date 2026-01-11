"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCurrencyRepository = void 0;
const Currency_1 = require("../../../domain/accounting/entities/Currency");
/**
 * Prisma implementation of ICurrencyRepository.
 * Manages global currency definitions.
 */
class PrismaCurrencyRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        const records = await this.prisma.currency.findMany({
            orderBy: { code: 'asc' },
        });
        return records.map((r) => new Currency_1.Currency({
            code: r.code,
            name: r.name,
            symbol: r.symbol,
            decimalPlaces: r.decimalPlaces,
            isActive: r.isActive,
        }));
    }
    async findActive() {
        const records = await this.prisma.currency.findMany({
            where: { isActive: true },
            orderBy: { code: 'asc' },
        });
        return records.map((r) => new Currency_1.Currency({
            code: r.code,
            name: r.name,
            symbol: r.symbol,
            decimalPlaces: r.decimalPlaces,
            isActive: r.isActive,
        }));
    }
    async findByCode(code) {
        const record = await this.prisma.currency.findUnique({
            where: { code: code.toUpperCase() },
        });
        if (!record)
            return null;
        return new Currency_1.Currency({
            code: record.code,
            name: record.name,
            symbol: record.symbol,
            decimalPlaces: record.decimalPlaces,
            isActive: record.isActive,
        });
    }
    async save(currency) {
        await this.prisma.currency.upsert({
            where: { code: currency.code },
            create: {
                code: currency.code,
                name: currency.name,
                symbol: currency.symbol,
                decimalPlaces: currency.decimalPlaces,
                isActive: currency.isActive,
            },
            update: {
                name: currency.name,
                symbol: currency.symbol,
                decimalPlaces: currency.decimalPlaces,
                isActive: currency.isActive,
            },
        });
    }
    async seedCurrencies(currencies) {
        // Use transaction for atomicity
        await this.prisma.$transaction(currencies.map((currency) => this.prisma.currency.upsert({
            where: { code: currency.code },
            create: {
                code: currency.code,
                name: currency.name,
                symbol: currency.symbol,
                decimalPlaces: currency.decimalPlaces,
                isActive: currency.isActive,
            },
            update: {
                name: currency.name,
                symbol: currency.symbol,
                decimalPlaces: currency.decimalPlaces,
                // Don't overwrite isActive on existing records
            },
        })));
    }
}
exports.PrismaCurrencyRepository = PrismaCurrencyRepository;
//# sourceMappingURL=PrismaCurrencyRepository.js.map