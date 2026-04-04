"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreSalesReturnRepository = void 0;
const SalesMappers_1 = require("../../mappers/SalesMappers");
const SalesFirestorePaths_1 = require("./SalesFirestorePaths");
class FirestoreSalesReturnRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, SalesFirestorePaths_1.getSalesCollection)(this.db, companyId, 'sales_returns');
    }
    asTransaction(transaction) {
        if (!transaction)
            return undefined;
        return transaction;
    }
    async create(sr, transaction) {
        const ref = this.collection(sr.companyId).doc(sr.id);
        const data = SalesMappers_1.SalesReturnMapper.toPersistence(sr);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async update(sr, transaction) {
        const ref = this.collection(sr.companyId).doc(sr.id);
        const data = SalesMappers_1.SalesReturnMapper.toPersistence(sr);
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
        return SalesMappers_1.SalesReturnMapper.toDomain(doc.data());
    }
    async list(companyId, opts = {}) {
        let query = this.collection(companyId);
        if (opts.customerId)
            query = query.where('customerId', '==', opts.customerId);
        if (opts.salesInvoiceId)
            query = query.where('salesInvoiceId', '==', opts.salesInvoiceId);
        if (opts.deliveryNoteId)
            query = query.where('deliveryNoteId', '==', opts.deliveryNoteId);
        if (opts.status)
            query = query.where('status', '==', opts.status);
        query = query.orderBy('returnDate', 'desc');
        const snap = await query.get();
        return snap.docs.map((doc) => SalesMappers_1.SalesReturnMapper.toDomain(doc.data()));
    }
}
exports.FirestoreSalesReturnRepository = FirestoreSalesReturnRepository;
//# sourceMappingURL=FirestoreSalesReturnRepository.js.map