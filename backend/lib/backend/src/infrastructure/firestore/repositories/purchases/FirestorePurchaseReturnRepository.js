"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePurchaseReturnRepository = void 0;
const PurchaseMappers_1 = require("../../mappers/PurchaseMappers");
const PurchaseFirestorePaths_1 = require("./PurchaseFirestorePaths");
class FirestorePurchaseReturnRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, PurchaseFirestorePaths_1.getPurchasesCollection)(this.db, companyId, 'purchase_returns');
    }
    asTransaction(transaction) {
        if (!transaction)
            return undefined;
        return transaction;
    }
    async create(purchaseReturn, transaction) {
        const ref = this.collection(purchaseReturn.companyId).doc(purchaseReturn.id);
        const data = PurchaseMappers_1.PurchaseReturnMapper.toPersistence(purchaseReturn);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async update(purchaseReturn, transaction) {
        const ref = this.collection(purchaseReturn.companyId).doc(purchaseReturn.id);
        const data = PurchaseMappers_1.PurchaseReturnMapper.toPersistence(purchaseReturn);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data, { merge: true });
            return;
        }
        await ref.set(data, { merge: true });
    }
    async getById(companyId, id) {
        const doc = await this.collection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return PurchaseMappers_1.PurchaseReturnMapper.toDomain(doc.data());
    }
    async list(companyId, opts) {
        let query = this.collection(companyId);
        if (opts === null || opts === void 0 ? void 0 : opts.vendorId)
            query = query.where('vendorId', '==', opts.vendorId);
        if (opts === null || opts === void 0 ? void 0 : opts.purchaseInvoiceId)
            query = query.where('purchaseInvoiceId', '==', opts.purchaseInvoiceId);
        if (opts === null || opts === void 0 ? void 0 : opts.goodsReceiptId)
            query = query.where('goodsReceiptId', '==', opts.goodsReceiptId);
        if (opts === null || opts === void 0 ? void 0 : opts.status)
            query = query.where('status', '==', opts.status);
        query = query.orderBy('returnDate', 'desc');
        const snap = await query.get();
        return snap.docs.map((doc) => PurchaseMappers_1.PurchaseReturnMapper.toDomain(doc.data()));
    }
}
exports.FirestorePurchaseReturnRepository = FirestorePurchaseReturnRepository;
//# sourceMappingURL=FirestorePurchaseReturnRepository.js.map