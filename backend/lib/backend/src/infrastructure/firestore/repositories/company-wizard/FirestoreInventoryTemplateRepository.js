"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreInventoryTemplateRepository = void 0;
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreInventoryTemplateRepository {
    constructor(db) {
        this.db = db;
        this.collectionName = 'inventory_templates';
    }
    async listInventoryTemplates() {
        try {
            const snapshot = await this.db.collection(this.collectionName).get();
            return snapshot.docs.map((doc) => {
                const data = doc.data();
                return { id: data.id || doc.id, name: data.name || data.title || 'Inventory Template' };
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list inventory templates', error);
        }
    }
}
exports.FirestoreInventoryTemplateRepository = FirestoreInventoryTemplateRepository;
//# sourceMappingURL=FirestoreInventoryTemplateRepository.js.map