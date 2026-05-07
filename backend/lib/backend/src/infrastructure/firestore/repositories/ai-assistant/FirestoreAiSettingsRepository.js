"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAiSettingsRepository = void 0;
const AiProviderConfig_1 = require("../../../../domain/ai-assistant/entities/AiProviderConfig");
/**
 * FirestoreAiSettingsRepository
 *
 * Stores AI provider config under:
 *   companies/{companyId}/ai-assistant/Settings/provider_config
 */
class FirestoreAiSettingsRepository {
    constructor(db) {
        this.db = db;
    }
    getSettingsRef(companyId) {
        return this.db
            .collection('companies').doc(companyId)
            .collection('ai-assistant').doc('Settings');
    }
    async getConfig(companyId) {
        const doc = await this.getSettingsRef(companyId).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        if (!(data === null || data === void 0 ? void 0 : data.providerConfig))
            return null;
        return AiProviderConfig_1.AiProviderConfig.fromJSON(data.providerConfig);
    }
    async saveConfig(config) {
        const ref = this.getSettingsRef(config.companyId);
        await ref.set({
            providerConfig: config.toPersistenceJSON(),
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    }
}
exports.FirestoreAiSettingsRepository = FirestoreAiSettingsRepository;
//# sourceMappingURL=FirestoreAiSettingsRepository.js.map