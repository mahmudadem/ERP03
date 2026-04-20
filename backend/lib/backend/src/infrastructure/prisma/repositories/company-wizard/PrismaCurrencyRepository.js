"use strict";
/**
 * PrismaCurrencyRepository
 * Prisma (SQL) implementation of ICurrencyRepository for company-wizard module
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCurrencyRepository = void 0;
class PrismaCurrencyRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listCurrencies(companyId) {
        if (companyId) {
            // List enabled currencies for a company
            const companyCurrencies = await this.prisma.companyCurrency.findMany({
                where: { companyId, isEnabled: true },
                include: { currency: true }
            });
            return companyCurrencies.map(cc => ({
                id: cc.currencyCode,
                name: cc.currency.name
            }));
        }
        else {
            // List all active global currencies
            const currencies = await this.prisma.currency.findMany({
                where: { isActive: true },
                orderBy: { code: 'asc' }
            });
            return currencies.map(c => ({
                id: c.code,
                name: c.name
            }));
        }
    }
    async seedCurrencies(companyId, currencies, baseCurrency) {
        // Enable the provided currencies for the company
        const companyCurrencies = currencies.map((c) => ({
            companyId,
            currencyCode: c.id || c.code,
            isEnabled: true,
            enabledAt: new Date()
        }));
        // Use upsert to avoid duplicates
        await this.prisma.$transaction(companyCurrencies.map((cc) => this.prisma.companyCurrency.upsert({
            where: {
                companyId_currencyCode: {
                    companyId: cc.companyId,
                    currencyCode: cc.currencyCode
                }
            },
            create: cc,
            update: {
                isEnabled: true,
                disabledAt: null
            }
        })));
        // Set base currency in company settings if provided
        if (baseCurrency) {
            await this.prisma.company.update({
                where: { id: companyId },
                data: { baseCurrency }
            });
        }
    }
}
exports.PrismaCurrencyRepository = PrismaCurrencyRepository;
//# sourceMappingURL=PrismaCurrencyRepository.js.map