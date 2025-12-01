"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyCreationSessionRepository = void 0;
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreCompanyCreationSessionRepository {
    constructor(db) {
        this.db = db;
        this.collectionName = 'company_creation_sessions';
    }
    mapDoc(doc) {
        const data = doc.data() || {};
        const normalizeDate = (value) => {
            if (value && typeof value.toDate === 'function')
                return value.toDate();
            return value ? new Date(value) : new Date();
        };
        const createdAt = normalizeDate(data.createdAt);
        const updatedAt = normalizeDate(data.updatedAt);
        return {
            id: data.id || doc.id,
            userId: data.userId,
            model: data.model,
            templateId: data.templateId,
            currentStepId: data.currentStepId,
            data: data.data || {},
            createdAt,
            updatedAt,
        };
    }
    toPersistence(session) {
        return Object.assign(Object.assign({}, session), { createdAt: session.createdAt, updatedAt: session.updatedAt });
    }
    async create(session) {
        try {
            await this.db.collection(this.collectionName).doc(session.id).set(this.toPersistence(session));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to create company creation session', error);
        }
    }
    async update(session) {
        try {
            await this.db.collection(this.collectionName).doc(session.id).set(this.toPersistence(session), { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update company creation session', error);
        }
    }
    async getById(id) {
        try {
            const doc = await this.db.collection(this.collectionName).doc(id).get();
            if (!doc.exists)
                return null;
            return this.mapDoc(doc);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get company creation session', error);
        }
    }
    async delete(id) {
        try {
            await this.db.collection(this.collectionName).doc(id).delete();
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to delete company creation session', error);
        }
    }
}
exports.FirestoreCompanyCreationSessionRepository = FirestoreCompanyCreationSessionRepository;
//# sourceMappingURL=FirestoreCompanyCreationSessionRepository.js.map