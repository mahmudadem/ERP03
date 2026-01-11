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
        const records = await this.prisma.companyCurrency.findMany({
            where: { companyId, isEnabled: true },
            orderBy: { currencyCode: 'asc' },
        });
        return records.map((r) => ({
            id: r.id,
            companyId: r.companyId,
            currencyCode: r.currencyCode,
            isEnabled: r.isEnabled,
            enabledAt: r.enabledAt,
            disabledAt: r.disabledAt,
        }));
    }
    async findAllByCompany(companyId) {
        const records = await this.prisma.companyCurrency.findMany({
            where: { companyId },
            orderBy: { currencyCode: 'asc' },
        });
        return records.map((r) => ({
            id: r.id,
            companyId: r.companyId,
            currencyCode: r.currencyCode,
            isEnabled: r.isEnabled,
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
        return {
            id: record.id,
            companyId: record.companyId,
            currencyCode: record.currencyCode,
            isEnabled: record.isEnabled,
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
}
exports.PrismaCompanyCurrencyRepository = PrismaCompanyCurrencyRepository;
//# sourceMappingURL=PrismaCompanyCurrencyRepository.js.map