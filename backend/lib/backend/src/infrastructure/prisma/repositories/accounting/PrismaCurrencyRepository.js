"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCurrencyRepository = void 0;
const Currency_1 = require("../../../../domain/accounting/entities/Currency");
class PrismaCurrencyRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(companyId) {
        const records = await this.prisma.currency.findMany({
            orderBy: { code: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async findActive(companyId) {
        const records = await this.prisma.currency.findMany({
            where: { isActive: true },
            orderBy: { code: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async findByCode(code, companyId) {
        const record = await this.prisma.currency.findUnique({
            where: { code: code.toUpperCase() },
        });
        if (!record)
            return null;
        return this.toDomain(record);
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
            },
        })));
    }
    toDomain(record) {
        return new Currency_1.Currency({
            code: record.code,
            name: record.name,
            symbol: record.symbol,
            decimalPlaces: record.decimalPlaces,
            isActive: record.isActive,
        });
    }
}
exports.PrismaCurrencyRepository = PrismaCurrencyRepository;
//# sourceMappingURL=PrismaCurrencyRepository.js.map