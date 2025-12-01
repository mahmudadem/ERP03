"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreChartOfAccountsTemplateRepository = void 0;
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreChartOfAccountsTemplateRepository {
    constructor(db) {
        this.db = db;
        this.collectionName = 'chart_of_accounts_templates';
    }
    async listChartOfAccountsTemplates() {
        try {
            const snapshot = await this.db.collection(this.collectionName).get();
            return snapshot.docs.map((doc) => {
                const data = doc.data();
                return { id: data.id || doc.id, name: data.name || data.title || 'Template' };
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list chart of accounts templates', error);
        }
    }
}
exports.FirestoreChartOfAccountsTemplateRepository = FirestoreChartOfAccountsTemplateRepository;
//# sourceMappingURL=FirestoreChartOfAccountsTemplateRepository.js.map