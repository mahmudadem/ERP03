"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreUserRepository = void 0;
/**
 * FirestoreUserRepository.ts
 *
 * Layer: Infrastructure
 * Purpose: Implementation of IUserRepository using Firestore.
 */
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const CoreMappers_1 = require("../../mappers/CoreMappers");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreUserRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'users';
    }
    toDomain(data) {
        return CoreMappers_1.UserMapper.toDomain(data);
    }
    toPersistence(entity) {
        return CoreMappers_1.UserMapper.toPersistence(entity);
    }
    async getUserById(userId) {
        return this.findById(userId);
    }
    async createUser(user) {
        return this.save(user);
    }
    async updateUser(userId, data) {
        try {
            // Note: Partial updates typically require specific mapper handling or direct object updates.
            // For MVP, we can use Firestore's update feature directly.
            await this.db.collection(this.collectionName).doc(userId).update(data);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating user', error);
        }
    }
    async updateGlobalRole(userId, newRole) {
        try {
            await this.db.collection(this.collectionName).doc(userId).update({ globalRole: newRole });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating user global role', error);
        }
    }
    async updateActiveCompany(userId, companyId) {
        try {
            await this.db.collection(this.collectionName).doc(userId).update({ activeCompanyId: companyId });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating user active company', error);
        }
    }
    async getUserActiveCompany(userId) {
        const doc = await this.db.collection(this.collectionName).doc(userId).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        return (data === null || data === void 0 ? void 0 : data.activeCompanyId) || null;
    }
}
exports.FirestoreUserRepository = FirestoreUserRepository;
//# sourceMappingURL=FirestoreUserRepository.js.map