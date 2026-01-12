"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAccountRepository = void 0;
/**
 * FirestoreAccountRepository.ts
 *
 * Layer: Infrastructure
 * Purpose: Implementation of IAccountRepository for the Chart of Accounts.
 */
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const Account_1 = require("../../../../domain/accounting/entities/Account");
const AccountingMappers_1 = require("../../mappers/AccountingMappers");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreAccountRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'accounts';
    }
    toDomain(data) {
        return AccountingMappers_1.AccountMapper.toDomain(data);
    }
    toPersistence(entity) {
        return AccountingMappers_1.AccountMapper.toPersistence(entity);
    }
    col(companyId) {
        return this.db.collection('companies').doc(companyId).collection(this.collectionName);
    }
    async create(companyId, data) {
        var _a, _b;
        try {
            // Use account CODE as the document ID (industry standard for accounting)
            const accountId = data.code; // Code IS the document ID
            // Generate UUID for system tracing/logging
            const uuid = this.db.collection('tmp').doc().id;
            const account = new Account_1.Account(companyId, accountId, // id = code
            data.code, data.name, data.type, data.currency || '', (_a = data.isProtected) !== null && _a !== void 0 ? _a : false, (_b = data.isActive) !== null && _b !== void 0 ? _b : true, uuid, // System UUID for tracing
            data.parentId || undefined, new Date(), new Date());
            await this.col(companyId).doc(account.id).set(this.toPersistence(Object.assign(Object.assign({}, account), { companyId })));
            return account;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error creating account', error);
        }
    }
    async update(companyId, accountId, data) {
        try {
            await this.col(companyId).doc(accountId).update(data);
            const doc = await this.col(companyId).doc(accountId).get();
            return this.toDomain(doc.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating account', error);
        }
    }
    async deactivate(companyId, accountId) {
        try {
            const children = await this.col(companyId).where('parentId', '==', accountId).get();
            if (!children.empty)
                throw new Error('Cannot deactivate account with children');
            await this.col(companyId).doc(accountId).update({ active: false });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error deactivating account', error);
        }
    }
    async getById(companyId, accountId, transaction) {
        let doc;
        if (transaction) {
            doc = await transaction.get(this.col(companyId).doc(accountId));
        }
        else {
            doc = await this.col(companyId).doc(accountId).get();
        }
        if (!doc.exists)
            return null;
        return this.toDomain(doc.data());
    }
    async list(companyId) {
        try {
            const snapshot = await this.col(companyId).get();
            return snapshot.docs.map(doc => this.toDomain(doc.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error fetching accounts', error);
        }
    }
    async getAccounts(companyId) {
        return this.list(companyId);
    }
    async hasChildren(companyId, accountId) {
        const snapshot = await this.col(companyId).where('parentId', '==', accountId).limit(1).get();
        return !snapshot.empty;
    }
    async getByCode(companyId, code) {
        try {
            const snap = await this.col(companyId).where('code', '==', code).limit(1).get();
            if (snap.empty)
                return null;
            return this.toDomain(snap.docs[0].data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting account by code', error);
        }
    }
    async countByCurrency(companyId, currencyCode) {
        try {
            const snapshot = await this.col(companyId).where('currency', '==', currencyCode.toUpperCase()).count().get();
            return snapshot.data().count;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error counting accounts by currency', error);
        }
    }
}
exports.FirestoreAccountRepository = FirestoreAccountRepository;
//# sourceMappingURL=FirestoreAccountRepository.js.map