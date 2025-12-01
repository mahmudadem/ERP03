"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyUserRepository = void 0;
/**
 * FirestoreCompanyUserRepository.ts
 *
 * Layer: Infrastructure
 * Purpose: Manages many-to-many relationship between Users and Companies.
 */
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const CompanyUser_1 = require("../../../../domain/core/entities/CompanyUser");
const CoreMappers_1 = require("../../mappers/CoreMappers");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreCompanyUserRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'company_users';
    }
    toDomain(data) {
        return CoreMappers_1.CompanyUserMapper.toDomain(data);
    }
    toPersistence(entity) {
        return CoreMappers_1.CompanyUserMapper.toPersistence(entity);
    }
    async assignUserToCompany(userId, companyId, role) {
        try {
            const id = `${companyId}_${userId}`;
            const membership = new CompanyUser_1.CompanyUser(id, userId, companyId, role, []);
            await this.save(membership);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error assigning user to company', error);
        }
    }
    async getCompanyUsers(companyId) {
        try {
            const snapshot = await this.db.collection(this.collectionName)
                .where('companyId', '==', companyId)
                .get();
            return snapshot.docs.map(doc => this.toDomain(doc.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error fetching company users', error);
        }
    }
    async getUserMembership(userId, companyId) {
        try {
            // Assuming ID structure is composite or querying by fields
            const snapshot = await this.db.collection(this.collectionName)
                .where('companyId', '==', companyId)
                .where('userId', '==', userId)
                .limit(1)
                .get();
            if (snapshot.empty)
                return null;
            return this.toDomain(snapshot.docs[0].data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error fetching user membership', error);
        }
    }
}
exports.FirestoreCompanyUserRepository = FirestoreCompanyUserRepository;
//# sourceMappingURL=FirestoreCompanyUserRepository.js.map