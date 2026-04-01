"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreInventorySettingsRepository = void 0;
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreInventorySettingsRepository {
    constructor(db) {
        this.db = db;
    }
    async getSettings(companyId) {
        const doc = await (0, InventoryFirestorePaths_1.getInventorySettingsRef)(this.db, companyId).get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.InventorySettingsMapper.toDomain(doc.data());
    }
    async saveSettings(settings) {
        await (0, InventoryFirestorePaths_1.getInventorySettingsRef)(this.db, settings.companyId).set(InventoryMappers_1.InventorySettingsMapper.toPersistence(settings), { merge: true });
    }
}
exports.FirestoreInventorySettingsRepository = FirestoreInventorySettingsRepository;
//# sourceMappingURL=FirestoreInventorySettingsRepository.js.map