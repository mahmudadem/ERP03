"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePurchaseOrderRepository = void 0;
const PurchaseMappers_1 = require("../../mappers/PurchaseMappers");
const PurchaseFirestorePaths_1 = require("./PurchaseFirestorePaths");
class FirestorePurchaseOrderRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, PurchaseFirestorePaths_1.getPurchasesCollection)(this.db, companyId, 'purchase_orders');
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
    async create(po, transaction) {
        const ref = this.collection(po.companyId).doc(po.id);
        const data = PurchaseMappers_1.PurchaseOrderMapper.toPersistence(po);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async update(po, transaction) {
        const ref = this.collection(po.companyId).doc(po.id);
        const data = PurchaseMappers_1.PurchaseOrderMapper.toPersistence(po);
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
        return PurchaseMappers_1.PurchaseOrderMapper.toDomain(doc.data());
    }
    async getByNumber(companyId, orderNumber) {
        const snap = await this.collection(companyId).where('orderNumber', '==', orderNumber).limit(1).get();
        if (snap.empty)
            return null;
        return PurchaseMappers_1.PurchaseOrderMapper.toDomain(snap.docs[0].data());
    }
    async list(companyId, opts) {
        let query = this.collection(companyId);
        if (opts === null || opts === void 0 ? void 0 : opts.status)
            query = query.where('status', '==', opts.status);
        if (opts === null || opts === void 0 ? void 0 : opts.vendorId)
            query = query.where('vendorId', '==', opts.vendorId);
        query = query.orderBy('orderDate', 'desc');
        query = this.applyListOptions(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => PurchaseMappers_1.PurchaseOrderMapper.toDomain(doc.data()));
    }
    async delete(companyId, id) {
        const ref = await this.resolveRefById(companyId, id);
        if (!ref)
            return;
        await ref.delete();
    }
}
exports.FirestorePurchaseOrderRepository = FirestorePurchaseOrderRepository;
//# sourceMappingURL=FirestorePurchaseOrderRepository.js.map