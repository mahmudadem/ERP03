"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreSalesInvoiceRepository = void 0;
const SalesMappers_1 = require("../../mappers/SalesMappers");
const SalesFirestorePaths_1 = require("./SalesFirestorePaths");
class FirestoreSalesInvoiceRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, SalesFirestorePaths_1.getSalesCollection)(this.db, companyId, 'sales_invoices');
    }
    asTransaction(transaction) {
        if (!transaction)
            return undefined;
        return transaction;
    }
    async create(si, transaction) {
        const ref = this.collection(si.companyId).doc(si.id);
        const data = SalesMappers_1.SalesInvoiceMapper.toPersistence(si);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async update(si, transaction) {
        const ref = this.collection(si.companyId).doc(si.id);
        const data = SalesMappers_1.SalesInvoiceMapper.toPersistence(si);
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
        return SalesMappers_1.SalesInvoiceMapper.toDomain(doc.data());
    }
    async getByNumber(companyId, number) {
        const snap = await this.collection(companyId).where('invoiceNumber', '==', number).limit(1).get();
        if (snap.empty)
            return null;
        return SalesMappers_1.SalesInvoiceMapper.toDomain(snap.docs[0].data());
    }
    async list(companyId, opts = {}) {
        let query = this.collection(companyId);
        if (opts.customerId)
            query = query.where('customerId', '==', opts.customerId);
        if (opts.salesOrderId)
            query = query.where('salesOrderId', '==', opts.salesOrderId);
        if (opts.status)
            query = query.where('status', '==', opts.status);
        if (opts.paymentStatus)
            query = query.where('paymentStatus', '==', opts.paymentStatus);
        query = query.orderBy('invoiceDate', 'desc');
        if (opts.limit)
            query = query.limit(opts.limit);
        const snap = await query.get();
        return snap.docs.map((doc) => SalesMappers_1.SalesInvoiceMapper.toDomain(doc.data()));
    }
}
exports.FirestoreSalesInvoiceRepository = FirestoreSalesInvoiceRepository;
//# sourceMappingURL=FirestoreSalesInvoiceRepository.js.map