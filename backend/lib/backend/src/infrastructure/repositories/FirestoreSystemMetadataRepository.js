"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreSystemMetadataRepository = void 0;
class FirestoreSystemMetadataRepository {
    constructor(db) {
        this.db = db;
        this.collection = 'system_metadata';
    }
    async getMetadata(key) {
        const snapshot = await this.db.collection(this.collection).doc(key).collection('items').get();
        if (snapshot.empty) {
            return null;
        }
        return snapshot.docs.map(doc => doc.data());
    }
    async setMetadata(key, value) {
        const batch = this.db.batch();
        const collectionRef = this.db.collection(this.collection).doc(key).collection('items');
        // Delete existing items first (to ensure full replacement like the original set)
        // In a real prod scenario we might want a smarter merge, but for seeding/config this is cleaner.
        const existing = await collectionRef.get();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        // Add new items
        value.forEach((item) => {
            // Use 'id' or 'code' as document ID if present, otherwise auto-id
            const docId = item.id || item.code || this.db.collection('_').doc().id;
            const docRef = collectionRef.doc(docId);
            batch.set(docRef, Object.assign(Object.assign({}, item), { updatedAt: new Date().toISOString() }));
        });
        await batch.commit();
    }
}
exports.FirestoreSystemMetadataRepository = FirestoreSystemMetadataRepository;
//# sourceMappingURL=FirestoreSystemMetadataRepository.js.map