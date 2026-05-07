"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAiToolCatalogRepository = void 0;
const AiToolDefinition_1 = require("../../../../domain/ai-assistant/entities/AiToolDefinition");
/**
 * FirestoreAiToolCatalogRepository
 *
 * Stores tool definitions under:
 *   system_metadata/ai_tools/{toolId}
 *
 * Tool definitions are platform-level — they are NOT company-scoped.
 * Super Admin manages which tools are available system-wide.
 */
class FirestoreAiToolCatalogRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection() {
        return this.db.collection('system_metadata').doc('ai_tools').collection('catalog');
    }
    async getById(toolId) {
        const doc = await this.getCollection().doc(toolId).get();
        if (!doc.exists)
            return null;
        return AiToolDefinition_1.AiToolDefinition.fromJSON(doc.data());
    }
    async list() {
        const snapshot = await this.getCollection().get();
        return snapshot.docs.map(doc => AiToolDefinition_1.AiToolDefinition.fromJSON(doc.data()));
    }
    async listByModule(moduleId) {
        const snapshot = await this.getCollection().where('moduleId', '==', moduleId).get();
        return snapshot.docs.map(doc => AiToolDefinition_1.AiToolDefinition.fromJSON(doc.data()));
    }
    async listByCategory(category) {
        const snapshot = await this.getCollection().where('category', '==', category).get();
        return snapshot.docs.map(doc => AiToolDefinition_1.AiToolDefinition.fromJSON(doc.data()));
    }
    async listByStatus(status) {
        const snapshot = await this.getCollection().where('status', '==', status).get();
        return snapshot.docs.map(doc => AiToolDefinition_1.AiToolDefinition.fromJSON(doc.data()));
    }
    async save(definition) {
        const data = definition.toJSON();
        const clean = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                clean[key] = value;
            }
        }
        await this.getCollection().doc(definition.id).set(clean);
    }
    async delete(toolId) {
        await this.getCollection().doc(toolId).delete();
    }
}
exports.FirestoreAiToolCatalogRepository = FirestoreAiToolCatalogRepository;
//# sourceMappingURL=FirestoreAiToolCatalogRepository.js.map