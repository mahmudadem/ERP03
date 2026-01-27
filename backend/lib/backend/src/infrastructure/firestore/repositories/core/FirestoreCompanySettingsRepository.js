"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanySettingsRepository = void 0;
const CompanySettings_1 = require("../../../../domain/core/entities/CompanySettings");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreCompanySettingsRepository {
    constructor(settingsResolver) {
        this.settingsResolver = settingsResolver;
    }
    getSettingsRef(companyId) {
        return this.settingsResolver.getCompanySettingsRef(companyId);
    }
    toDomain(data) {
        var _a;
        return new CompanySettings_1.CompanySettings(data.companyId, (_a = data.strictApprovalMode) !== null && _a !== void 0 ? _a : false, data.uiMode, data.timezone, data.dateFormat, data.language || 'en', data.baseCurrency, data.fiscalYearStart, data.fiscalYearEnd);
    }
    toPersistence(entity) {
        return {
            companyId: entity.companyId,
            strictApprovalMode: entity.strictApprovalMode,
            uiMode: entity.uiMode,
            timezone: entity.timezone,
            dateFormat: entity.dateFormat,
            language: entity.language,
            baseCurrency: entity.baseCurrency,
            fiscalYearStart: entity.fiscalYearStart,
            fiscalYearEnd: entity.fiscalYearEnd
        };
    }
    async getSettings(companyId) {
        try {
            const doc = await this.getSettingsRef(companyId).get();
            if (!doc.exists) {
                // Return default settings without a hardcoded currency if possible, or handle it in the domain
                return CompanySettings_1.CompanySettings.default(companyId);
            }
            return this.toDomain(doc.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get company settings', error);
        }
    }
    async updateSettings(companyId, settings) {
        try {
            const updateData = Object.entries(settings).reduce((acc, [key, value]) => {
                if (value !== undefined)
                    acc[key] = value;
                return acc;
            }, {});
            if (Object.keys(updateData).length === 0)
                return;
            // Save strictly to modular location
            await this.getSettingsRef(companyId).set(updateData, { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update company settings', error);
        }
    }
}
exports.FirestoreCompanySettingsRepository = FirestoreCompanySettingsRepository;
//# sourceMappingURL=FirestoreCompanySettingsRepository.js.map