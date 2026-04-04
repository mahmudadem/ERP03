"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreDeliveryNoteRepository = void 0;
const SalesMappers_1 = require("../../mappers/SalesMappers");
const SalesFirestorePaths_1 = require("./SalesFirestorePaths");
class FirestoreDeliveryNoteRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, SalesFirestorePaths_1.getSalesCollection)(this.db, companyId, 'delivery_notes');
    }
    asTransaction(transaction) {
        if (!transaction)
            return undefined;
        return transaction;
    }
    async create(dn, transaction) {
        const ref = this.collection(dn.companyId).doc(dn.id);
        const data = SalesMappers_1.DeliveryNoteMapper.toPersistence(dn);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async update(dn, transaction) {
        const ref = this.collection(dn.companyId).doc(dn.id);
        const data = SalesMappers_1.DeliveryNoteMapper.toPersistence(dn);
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
        return SalesMappers_1.DeliveryNoteMapper.toDomain(doc.data());
    }
    async list(companyId, opts = {}) {
        let query = this.collection(companyId);
        if (opts.salesOrderId)
            query = query.where('salesOrderId', '==', opts.salesOrderId);
        if (opts.status)
            query = query.where('status', '==', opts.status);
        query = query.orderBy('deliveryDate', 'desc');
        if (opts.limit)
            query = query.limit(opts.limit);
        const snap = await query.get();
        return snap.docs.map((doc) => SalesMappers_1.DeliveryNoteMapper.toDomain(doc.data()));
    }
}
exports.FirestoreDeliveryNoteRepository = FirestoreDeliveryNoteRepository;
//# sourceMappingURL=FirestoreDeliveryNoteRepository.js.map