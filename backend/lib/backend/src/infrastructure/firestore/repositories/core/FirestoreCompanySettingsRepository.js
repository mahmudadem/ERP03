"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanySettingsRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const CompanySettings_1 = require("../../../../domain/core/entities/CompanySettings");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreCompanySettingsRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'company_settings';
    }
    toDomain(data) {
        var _a;
        return new CompanySettings_1.CompanySettings(data.companyId, (_a = data.strictApprovalMode) !== null && _a !== void 0 ? _a : true, data.uiMode, data.timezone, data.dateFormat);
    }
    toPersistence(entity) {
        return {
            companyId: entity.companyId,
            strictApprovalMode: entity.strictApprovalMode,
            uiMode: entity.uiMode,
            timezone: entity.timezone,
            dateFormat: entity.dateFormat
        };
    }
    async getSettings(companyId) {
        try {
            const doc = await this.db.collection(this.collectionName).doc(companyId).get();
            if (!doc.exists) {
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
            await this.db.collection(this.collectionName).doc(companyId).set(updateData, { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update company settings', error);
        }
    }
}
exports.FirestoreCompanySettingsRepository = FirestoreCompanySettingsRepository;
//# sourceMappingURL=FirestoreCompanySettingsRepository.js.map