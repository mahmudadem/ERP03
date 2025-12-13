"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreSystemMetadataRepository = void 0;
class FirestoreSystemMetadataRepository {
    constructor(db) {
        this.db = db;
        this.collection = 'system_metadata';
    }
    async getMetadata(key) {
        const doc = await this.db.collection(this.collection).doc(key).get();
        if (!doc.exists) {
            return null;
        }
        return doc.data();
    }
    async setMetadata(key, value) {
        await this.db.collection(this.collection).doc(key).set({
            data: value,
            updatedAt: new Date().toISOString(),
        });
    }
}
exports.FirestoreSystemMetadataRepository = FirestoreSystemMetadataRepository;
//# sourceMappingURL=FirestoreSystemMetadataRepository.js.map