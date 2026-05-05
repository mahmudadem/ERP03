"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreSalesSettingsRepository = void 0;
const SalesMappers_1 = require("../../mappers/SalesMappers");
const SalesFirestorePaths_1 = require("./SalesFirestorePaths");
class FirestoreSalesSettingsRepository {
    constructor(db) {
        this.db = db;
    }
    async getSettings(companyId) {
        const doc = await (0, SalesFirestorePaths_1.getSalesSettingsRef)(this.db, companyId).get();
        if (!doc.exists)
            return null;
        return SalesMappers_1.SalesSettingsMapper.toDomain(doc.data());
    }
    async saveSettings(settings, transaction) {
        const ref = (0, SalesFirestorePaths_1.getSalesSettingsRef)(this.db, settings.companyId);
        const data = SalesMappers_1.SalesSettingsMapper.toPersistence(settings);
        if (transaction) {
            transaction.set(ref, data, { merge: true });
            return;
        }
        await ref.set(data, { merge: true });
    }
}
exports.FirestoreSalesSettingsRepository = FirestoreSalesSettingsRepository;
//# sourceMappingURL=FirestoreSalesSettingsRepository.js.map