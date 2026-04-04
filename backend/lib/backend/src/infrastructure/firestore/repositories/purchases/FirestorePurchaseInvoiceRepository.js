"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePurchaseInvoiceRepository = void 0;
const PurchaseMappers_1 = require("../../mappers/PurchaseMappers");
const PurchaseFirestorePaths_1 = require("./PurchaseFirestorePaths");
class FirestorePurchaseInvoiceRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, PurchaseFirestorePaths_1.getPurchasesCollection)(this.db, companyId, 'purchase_invoices');
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
    async create(invoice, transaction) {
        const ref = this.collection(invoice.companyId).doc(invoice.id);
        const data = PurchaseMappers_1.PurchaseInvoiceMapper.toPersistence(invoice);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async update(invoice, transaction) {
        const ref = this.collection(invoice.companyId).doc(invoice.id);
        const data = PurchaseMappers_1.PurchaseInvoiceMapper.toPersistence(invoice);
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
        return PurchaseMappers_1.PurchaseInvoiceMapper.toDomain(doc.data());
    }
    async getByNumber(companyId, invoiceNumber) {
        const snap = await this.collection(companyId).where('invoiceNumber', '==', invoiceNumber).limit(1).get();
        if (snap.empty)
            return null;
        return PurchaseMappers_1.PurchaseInvoiceMapper.toDomain(snap.docs[0].data());
    }
    async list(companyId, opts) {
        let query = this.collection(companyId);
        if (opts === null || opts === void 0 ? void 0 : opts.vendorId)
            query = query.where('vendorId', '==', opts.vendorId);
        if (opts === null || opts === void 0 ? void 0 : opts.purchaseOrderId)
            query = query.where('purchaseOrderId', '==', opts.purchaseOrderId);
        if (opts === null || opts === void 0 ? void 0 : opts.status)
            query = query.where('status', '==', opts.status);
        if (opts === null || opts === void 0 ? void 0 : opts.paymentStatus)
            query = query.where('paymentStatus', '==', opts.paymentStatus);
        query = query.orderBy('invoiceDate', 'desc');
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            query = query.limit(opts.limit);
        const snap = await query.get();
        return snap.docs.map((doc) => PurchaseMappers_1.PurchaseInvoiceMapper.toDomain(doc.data()));
    }
}
exports.FirestorePurchaseInvoiceRepository = FirestorePurchaseInvoiceRepository;
//# sourceMappingURL=FirestorePurchaseInvoiceRepository.js.map