"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseFirestoreRepository = void 0;
const InfrastructureError_1 = require("../../errors/InfrastructureError");
class BaseFirestoreRepository {
    constructor(db) {
        this.db = db;
    }
    /**
     * Saves an entity (Create or Update).
     */
    async save(entity) {
        try {
            const data = this.toPersistence(entity);
            // specific logic relies on the entity having an 'id' field
            const id = entity.id;
            if (!id)
                throw new Error("Entity missing ID");
            await this.db.collection(this.collectionName).doc(id).set(data);
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error(`[INFRA] Failed to save to ${this.collectionName}`, error);
            const message = error && typeof error === 'object' && 'message' in error
                ? String(error.message)
                : `Failed to save to ${this.collectionName}`;
            throw new InfrastructureError_1.InfrastructureError(message, error);
        }
    }
    /**
     * Finds an entity by ID.
     */
    async findById(id) {
        try {
            const doc = await this.db.collection(this.collectionName).doc(id).get();
            if (!doc.exists)
                return null;
            return this.toDomain(doc.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError(`Failed to findById in ${this.collectionName}`, error);
        }
    }
    /**
     * Deletes an entity by ID.
     */
    async delete(id) {
        try {
            await this.db.collection(this.collectionName).doc(id).delete();
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError(`Failed to delete in ${this.collectionName}`, error);
        }
    }
}
exports.BaseFirestoreRepository = BaseFirestoreRepository;
//# sourceMappingURL=BaseFirestoreRepository.js.map