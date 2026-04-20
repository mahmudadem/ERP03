"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanySettingsRepository = void 0;
const CompanySettings_1 = require("../../../../domain/core/entities/CompanySettings");
class PrismaCompanySettingsRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return new CompanySettings_1.CompanySettings(data.companyId, data.strictApprovalMode, data.uiMode || 'windows', data.timezone || 'UTC', data.dateFormat || 'YYYY-MM-DD', data.language || 'en', data.baseCurrency || undefined, data.fiscalYearStart ? String(data.fiscalYearStart).padStart(2, '0') + '-01' : undefined, data.fiscalYearEnd ? String(data.fiscalYearEnd).padStart(2, '0') + '-28' : undefined, data.exchangeGainLossAccountId || undefined, data.disabledNotificationCategories || []);
    }
    async getSettings(companyId) {
        let data = await this.prisma.companySettings.findUnique({
            where: { companyId },
        });
        if (!data) {
            const defaults = CompanySettings_1.CompanySettings.default(companyId);
            await this.prisma.companySettings.create({
                data: {
                    companyId,
                    strictApprovalMode: defaults.strictApprovalMode,
                    uiMode: defaults.uiMode || 'windows',
                    timezone: defaults.timezone || 'UTC',
                    dateFormat: defaults.dateFormat || 'YYYY-MM-DD',
                    language: defaults.language,
                    baseCurrency: defaults.baseCurrency || 'USD',
                    fiscalYearStart: 1,
                    fiscalYearEnd: 12,
                    disabledNotificationCategories: defaults.disabledNotificationCategories,
                },
            });
            data = await this.prisma.companySettings.findUnique({
                where: { companyId },
            });
        }
        return this.toDomain(data);
    }
    async updateSettings(companyId, settings) {
        const updateData = {};
        if (settings.strictApprovalMode !== undefined)
            updateData.strictApprovalMode = settings.strictApprovalMode;
        if (settings.uiMode !== undefined)
            updateData.uiMode = settings.uiMode;
        if (settings.timezone !== undefined)
            updateData.timezone = settings.timezone;
        if (settings.dateFormat !== undefined)
            updateData.dateFormat = settings.dateFormat;
        if (settings.language !== undefined)
            updateData.language = settings.language;
        if (settings.baseCurrency !== undefined)
            updateData.baseCurrency = settings.baseCurrency;
        if (settings.fiscalYearStart !== undefined) {
            const month = parseInt(settings.fiscalYearStart.split('-')[0], 10);
            updateData.fiscalYearStart = month;
        }
        if (settings.fiscalYearEnd !== undefined) {
            const month = parseInt(settings.fiscalYearEnd.split('-')[0], 10);
            updateData.fiscalYearEnd = month;
        }
        if (settings.exchangeGainLossAccountId !== undefined)
            updateData.exchangeGainLossAccountId = settings.exchangeGainLossAccountId;
        if (settings.disabledNotificationCategories !== undefined)
            updateData.disabledNotificationCategories = settings.disabledNotificationCategories;
        await this.prisma.companySettings.upsert({
            where: { companyId },
            create: Object.assign({ companyId }, updateData),
            update: updateData,
        });
    }
}
exports.PrismaCompanySettingsRepository = PrismaCompanySettingsRepository;
//# sourceMappingURL=PrismaCompanySettingsRepository.js.map