"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyCurrencyRepository = void 0;
/**
 * Prisma implementation of ICompanyCurrencyRepository.
 * Manages enabled currencies per company.
 * Rate storage is handled by IExchangeRateRepository.
 */
class PrismaCompanyCurrencyRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findEnabledByCompany(companyId) {
        // 1. Fetch enabled currencies
        const records = await this.prisma.companyCurrency.findMany({
            where: { companyId, isEnabled: true },
            orderBy: { currencyCode: 'asc' },
        });
        // 2. Fetch base currency from Company table to correctly flag isBase
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { baseCurrency: true }
        });
        const baseCurrency = company === null || company === void 0 ? void 0 : company.baseCurrency;
        // Auto-repair logic: If nothing found but base currency exists, enable it
        if (records.length === 0 && baseCurrency) {
            await this.enable(companyId, baseCurrency);
            return this.findEnabledByCompany(companyId);
        }
        return records.map((r) => ({
            id: r.id,
            companyId: r.companyId,
            currencyCode: r.currencyCode,
            isEnabled: r.isEnabled,
            isBase: r.currencyCode === baseCurrency,
            enabledAt: r.enabledAt,
            disabledAt: r.disabledAt,
        }));
    }
    async findAllByCompany(companyId) {
        const records = await this.prisma.companyCurrency.findMany({
            where: { companyId },
            orderBy: { currencyCode: 'asc' },
        });
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { baseCurrency: true }
        });
        const baseCurrency = company === null || company === void 0 ? void 0 : company.baseCurrency;
        return records.map((r) => ({
            id: r.id,
            companyId: r.companyId,
            currencyCode: r.currencyCode,
            isEnabled: r.isEnabled,
            isBase: r.currencyCode === baseCurrency,
            enabledAt: r.enabledAt,
            disabledAt: r.disabledAt,
        }));
    }
    async isEnabled(companyId, currencyCode) {
        var _a;
        const record = await this.prisma.companyCurrency.findUnique({
            where: {
                companyId_currencyCode: { companyId, currencyCode: currencyCode.toUpperCase() },
            },
        });
        return (_a = record === null || record === void 0 ? void 0 : record.isEnabled) !== null && _a !== void 0 ? _a : false;
    }
    async enable(companyId, currencyCode) {
        const code = currencyCode.toUpperCase();
        const now = new Date();
        const record = await this.prisma.companyCurrency.upsert({
            where: {
                companyId_currencyCode: { companyId, currencyCode: code },
            },
            create: {
                companyId,
                currencyCode: code,
                isEnabled: true,
                enabledAt: now,
            },
            update: {
                isEnabled: true,
                enabledAt: now,
                disabledAt: null,
            },
        });
        // Determine isBase
        const isBase = await this.isBaseCurrency(companyId, code);
        return {
            id: record.id,
            companyId: record.companyId,
            currencyCode: record.currencyCode,
            isEnabled: record.isEnabled,
            isBase,
            enabledAt: record.enabledAt,
            disabledAt: record.disabledAt,
        };
    }
    async disable(companyId, currencyCode) {
        await this.prisma.companyCurrency.updateMany({
            where: { companyId, currencyCode: currencyCode.toUpperCase() },
            data: {
                isEnabled: false,
                disabledAt: new Date(),
            },
        });
    }
    async setBaseCurrency(companyId, currencyCode) {
        const code = currencyCode.toUpperCase();
        // Transactional update:
        // 1. Update Company.baseCurrency
        // 2. Ensure currency is enabled in CompanyCurrency table
        await this.prisma.$transaction([
            this.prisma.company.update({
                where: { id: companyId },
                data: { baseCurrency: code }
            }),
            this.prisma.companyCurrency.upsert({
                where: {
                    companyId_currencyCode: { companyId, currencyCode: code },
                },
                create: {
                    companyId,
                    currencyCode: code,
                    isEnabled: true,
                    enabledAt: new Date(),
                },
                update: {
                    isEnabled: true,
                    disabledAt: null,
                }
            })
        ]);
    }
    async getBaseCurrency(companyId) {
        // Correct source of truth: The Company table
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { baseCurrency: true }
        });
        if (company === null || company === void 0 ? void 0 : company.baseCurrency) {
            // Ensure it is reflected in the CompanyCurrency table (auto-healing)
            // This is a side-effect, but ensures consistency
            const exists = await this.prisma.companyCurrency.findUnique({
                where: { companyId_currencyCode: { companyId, currencyCode: company.baseCurrency } }
            });
            if (!exists || !exists.isEnabled) {
                await this.enable(companyId, company.baseCurrency);
            }
            return company.baseCurrency;
        }
        return null;
    }
    // Helper to check base status safely
    async isBaseCurrency(companyId, currencyCode) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { baseCurrency: true }
        });
        return (company === null || company === void 0 ? void 0 : company.baseCurrency) === currencyCode;
    }
}
exports.PrismaCompanyCurrencyRepository = PrismaCompanyCurrencyRepository;
//# sourceMappingURL=PrismaCompanyCurrencyRepository.js.map