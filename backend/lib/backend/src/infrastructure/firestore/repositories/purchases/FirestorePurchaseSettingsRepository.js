"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePurchaseSettingsRepository = void 0;
const PurchaseMappers_1 = require("../../mappers/PurchaseMappers");
const PurchaseFirestorePaths_1 = require("./PurchaseFirestorePaths");
class FirestorePurchaseSettingsRepository {
    constructor(db) {
        this.db = db;
    }
    async getSettings(companyId) {
        const doc = await (0, PurchaseFirestorePaths_1.getPurchasesSettingsRef)(this.db, companyId).get();
        if (!doc.exists)
            return null;
        return PurchaseMappers_1.PurchaseSettingsMapper.toDomain(doc.data());
    }
    async saveSettings(settings) {
        await (0, PurchaseFirestorePaths_1.getPurchasesSettingsRef)(this.db, settings.companyId).set(PurchaseMappers_1.PurchaseSettingsMapper.toPersistence(settings), { merge: true });
    }
}
exports.FirestorePurchaseSettingsRepository = FirestorePurchaseSettingsRepository;
//# sourceMappingURL=FirestorePurchaseSettingsRepository.js.map