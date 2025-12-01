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
        return new CompanySettings_1.CompanySettings(data.companyId, (_a = data.strictApprovalMode) !== null && _a !== void 0 ? _a : true);
    }
    toPersistence(entity) {
        return {
            companyId: entity.companyId,
            strictApprovalMode: entity.strictApprovalMode
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
            await this.db.collection(this.collectionName).doc(companyId).set(settings, { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update company settings', error);
        }
    }
}
exports.FirestoreCompanySettingsRepository = FirestoreCompanySettingsRepository;
//# sourceMappingURL=FirestoreCompanySettingsRepository.js.map