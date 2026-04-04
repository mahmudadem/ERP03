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
    async saveSettings(settings) {
        await (0, SalesFirestorePaths_1.getSalesSettingsRef)(this.db, settings.companyId).set(SalesMappers_1.SalesSettingsMapper.toPersistence(settings), { merge: true });
    }
}
exports.FirestoreSalesSettingsRepository = FirestoreSalesSettingsRepository;
//# sourceMappingURL=FirestoreSalesSettingsRepository.js.map