"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaExchangeRateRepository = void 0;
const ExchangeRate_1 = require("../../../domain/accounting/entities/ExchangeRate");
/**
 * Prisma implementation of IExchangeRateRepository.
 *
 * Supports:
 * - Company-scoped rates
 * - Multiple rates per (company, pair, date) - NO unique constraint
 * - Historical rate lookup
 * - Returns null when rate not found (NO silent defaults)
 */
class PrismaExchangeRateRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(rate) {
        await this.prisma.exchangeRate.create({
            data: {
                id: rate.id,
                companyId: rate.companyId,
                fromCurrency: rate.fromCurrency,
                toCurrency: rate.toCurrency,
                rate: rate.rate,
                date: rate.date,
                source: rate.source,
                createdAt: rate.createdAt,
                createdBy: rate.createdBy,
            },
        });
    }
    async getLatestRate(companyId, fromCurrency, toCurrency, date) {
        var _a;
        // Normalize date to start of day
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        const record = await this.prisma.exchangeRate.findFirst({
            where: {
                companyId,
                fromCurrency: fromCurrency.toUpperCase(),
                toCurrency: toCurrency.toUpperCase(),
                date: {
                    gte: dateStart,
                    lte: dateEnd,
                },
            },
            orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' },
            ],
        });
        if (!record)
            return null;
        return new ExchangeRate_1.ExchangeRate({
            id: record.id,
            companyId: record.companyId,
            fromCurrency: record.fromCurrency,
            toCurrency: record.toCurrency,
            rate: record.rate,
            date: record.date,
            source: record.source,
            createdAt: record.createdAt,
            createdBy: (_a = record.createdBy) !== null && _a !== void 0 ? _a : undefined,
        });
    }
    async getRatesForDate(companyId, fromCurrency, toCurrency, date) {
        // Normalize date to start of day
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        const records = await this.prisma.exchangeRate.findMany({
            where: {
                companyId,
                fromCurrency: fromCurrency.toUpperCase(),
                toCurrency: toCurrency.toUpperCase(),
                date: {
                    gte: dateStart,
                    lte: dateEnd,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return records.map((r) => {
            var _a;
            return new ExchangeRate_1.ExchangeRate({
                id: r.id,
                companyId: r.companyId,
                fromCurrency: r.fromCurrency,
                toCurrency: r.toCurrency,
                rate: r.rate,
                date: r.date,
                source: r.source,
                createdAt: r.createdAt,
                createdBy: (_a = r.createdBy) !== null && _a !== void 0 ? _a : undefined,
            });
        });
    }
    async getRecentRates(companyId, fromCurrency, toCurrency, limit = 10) {
        const where = { companyId };
        if (fromCurrency)
            where.fromCurrency = fromCurrency.toUpperCase();
        if (toCurrency)
            where.toCurrency = toCurrency.toUpperCase();
        const records = await this.prisma.exchangeRate.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return records.map((r) => {
            var _a;
            return new ExchangeRate_1.ExchangeRate({
                id: r.id,
                companyId: r.companyId,
                fromCurrency: r.fromCurrency,
                toCurrency: r.toCurrency,
                rate: r.rate,
                date: r.date,
                source: r.source,
                createdAt: r.createdAt,
                createdBy: (_a = r.createdBy) !== null && _a !== void 0 ? _a : undefined,
            });
        });
    }
    async getMostRecentRate(companyId, fromCurrency, toCurrency) {
        var _a;
        const record = await this.prisma.exchangeRate.findFirst({
            where: {
                companyId,
                fromCurrency: fromCurrency.toUpperCase(),
                toCurrency: toCurrency.toUpperCase(),
            },
            orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' },
            ],
        });
        if (!record)
            return null;
        return new ExchangeRate_1.ExchangeRate({
            id: record.id,
            companyId: record.companyId,
            fromCurrency: record.fromCurrency,
            toCurrency: record.toCurrency,
            rate: record.rate,
            date: record.date,
            source: record.source,
            createdAt: record.createdAt,
            createdBy: (_a = record.createdBy) !== null && _a !== void 0 ? _a : undefined,
        });
    }
    async getMostRecentRateBeforeDate(companyId, fromCurrency, toCurrency, date) {
        var _a;
        // We want the most recent rate where record.date <= date
        // Normalize date ceiling to end of day to be safe, though record.date is usually start of day
        const dateCeiling = new Date(date);
        dateCeiling.setHours(23, 59, 59, 999);
        const record = await this.prisma.exchangeRate.findFirst({
            where: {
                companyId,
                fromCurrency: fromCurrency.toUpperCase(),
                toCurrency: toCurrency.toUpperCase(),
                date: {
                    lte: dateCeiling,
                },
            },
            orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' },
            ],
        });
        if (!record)
            return null;
        return new ExchangeRate_1.ExchangeRate({
            id: record.id,
            companyId: record.companyId,
            fromCurrency: record.fromCurrency,
            toCurrency: record.toCurrency,
            rate: record.rate,
            date: record.date,
            source: record.source,
            createdAt: record.createdAt,
            createdBy: (_a = record.createdBy) !== null && _a !== void 0 ? _a : undefined,
        });
    }
    // ============================================
    // Legacy compatibility - deprecated
    // ============================================
    /** @deprecated Use save() instead */
    async setRate(rate) {
        return this.save(rate);
    }
    /** @deprecated Use getLatestRate() instead */
    async getRate(fromCurrency, toCurrency, date) {
        var _a;
        // Legacy method doesn't have companyId, so we can't use it properly
        // This is a best-effort fallback that searches across all companies
        const record = await this.prisma.exchangeRate.findFirst({
            where: {
                fromCurrency: fromCurrency.toUpperCase(),
                toCurrency: toCurrency.toUpperCase(),
                date: {
                    gte: new Date(date.setHours(0, 0, 0, 0)),
                    lte: new Date(date.setHours(23, 59, 59, 999)),
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!record)
            return null;
        return new ExchangeRate_1.ExchangeRate({
            id: record.id,
            companyId: record.companyId,
            fromCurrency: record.fromCurrency,
            toCurrency: record.toCurrency,
            rate: record.rate,
            date: record.date,
            source: record.source,
            createdAt: record.createdAt,
            createdBy: (_a = record.createdBy) !== null && _a !== void 0 ? _a : undefined,
        });
    }
}
exports.PrismaExchangeRateRepository = PrismaExchangeRateRepository;
//# sourceMappingURL=PrismaExchangeRateRepository.js.map