"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreSalesOrderRepository = void 0;
const SalesMappers_1 = require("../../mappers/SalesMappers");
const SalesFirestorePaths_1 = require("./SalesFirestorePaths");
class FirestoreSalesOrderRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, SalesFirestorePaths_1.getSalesCollection)(this.db, companyId, 'sales_orders');
    }
    async resolveRefById(companyId, id) {
        const doc = await this.collection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return doc.ref;
    }
    applyListOptions(query, opts) {
        let ref = query;
        if (opts === null || opts === void 0 ? void 0 : opts.offset)
            ref = ref.offset(opts.offset);
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            ref = ref.limit(opts.limit);
        return ref;
    }
    asTransaction(transaction) {
        if (!transaction)
            return undefined;
        return transaction;
    }
    async create(so, transaction) {
        const ref = this.collection(so.companyId).doc(so.id);
        const data = SalesMappers_1.SalesOrderMapper.toPersistence(so);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async update(so, transaction) {
        const ref = this.collection(so.companyId).doc(so.id);
        const data = SalesMappers_1.SalesOrderMapper.toPersistence(so);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data, { merge: true });
            return;
        }
        await ref.set(data, { merge: true });
    }
    async getById(companyId, id) {
        const ref = await this.resolveRefById(companyId, id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return SalesMappers_1.SalesOrderMapper.toDomain(doc.data());
    }
    async getByNumber(companyId, orderNumber) {
        const snap = await this.collection(companyId).where('orderNumber', '==', orderNumber).limit(1).get();
        if (snap.empty)
            return null;
        return SalesMappers_1.SalesOrderMapper.toDomain(snap.docs[0].data());
    }
    async list(companyId, opts) {
        let query = this.collection(companyId);
        if (opts === null || opts === void 0 ? void 0 : opts.status)
            query = query.where('status', '==', opts.status);
        if (opts === null || opts === void 0 ? void 0 : opts.customerId)
            query = query.where('customerId', '==', opts.customerId);
        query = query.orderBy('orderDate', 'desc');
        query = this.applyListOptions(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => SalesMappers_1.SalesOrderMapper.toDomain(doc.data()));
    }
    async delete(companyId, id) {
        const ref = await this.resolveRefById(companyId, id);
        if (!ref)
            return;
        await ref.delete();
    }
}
exports.FirestoreSalesOrderRepository = FirestoreSalesOrderRepository;
//# sourceMappingURL=FirestoreSalesOrderRepository.js.map