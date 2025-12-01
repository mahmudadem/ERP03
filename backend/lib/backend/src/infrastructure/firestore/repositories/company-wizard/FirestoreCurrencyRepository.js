"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCurrencyRepository = void 0;
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreCurrencyRepository {
    constructor(db) {
        this.db = db;
        this.collectionName = 'system_currencies';
    }
    async listCurrencies() {
        try {
            const snapshot = await this.db.collection(this.collectionName).get();
            return snapshot.docs.map((doc) => {
                const data = doc.data();
                const label = data.name || data.code || doc.id;
                return { id: data.id || doc.id, name: label };
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list currencies', error);
        }
    }
}
exports.FirestoreCurrencyRepository = FirestoreCurrencyRepository;
//# sourceMappingURL=FirestoreCurrencyRepository.js.map