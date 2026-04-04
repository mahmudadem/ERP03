"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreGoodsReceiptRepository = void 0;
const PurchaseMappers_1 = require("../../mappers/PurchaseMappers");
const PurchaseFirestorePaths_1 = require("./PurchaseFirestorePaths");
class FirestoreGoodsReceiptRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, PurchaseFirestorePaths_1.getPurchasesCollection)(this.db, companyId, 'goods_receipts');
    }
    asTransaction(transaction) {
        if (!transaction)
            return undefined;
        return transaction;
    }
    async resolveRefById(companyId, id) {
        const doc = await this.collection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return doc.ref;
    }
    async create(grn, transaction) {
        const ref = this.collection(grn.companyId).doc(grn.id);
        const data = PurchaseMappers_1.GoodsReceiptMapper.toPersistence(grn);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async update(grn, transaction) {
        const ref = this.collection(grn.companyId).doc(grn.id);
        const data = PurchaseMappers_1.GoodsReceiptMapper.toPersistence(grn);
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
        return PurchaseMappers_1.GoodsReceiptMapper.toDomain(doc.data());
    }
    async list(companyId, opts) {
        let query = this.collection(companyId);
        if (opts === null || opts === void 0 ? void 0 : opts.purchaseOrderId)
            query = query.where('purchaseOrderId', '==', opts.purchaseOrderId);
        if (opts === null || opts === void 0 ? void 0 : opts.status)
            query = query.where('status', '==', opts.status);
        query = query.orderBy('receiptDate', 'desc');
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            query = query.limit(opts.limit);
        const snap = await query.get();
        return snap.docs.map((doc) => PurchaseMappers_1.GoodsReceiptMapper.toDomain(doc.data()));
    }
}
exports.FirestoreGoodsReceiptRepository = FirestoreGoodsReceiptRepository;
//# sourceMappingURL=FirestoreGoodsReceiptRepository.js.map