"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreOpeningStockDocumentRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreOpeningStockDocumentRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'opening_stock_documents');
    }
    async resolveRefById(id) {
        const snap = await this.db
            .collectionGroup('opening_stock_documents')
            .where('id', '==', id)
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return snap.docs[0].ref;
    }
    applyPaging(query, opts) {
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
    async createDocument(document, transaction) {
        const ref = this.collection(document.companyId).doc(document.id);
        const payload = InventoryMappers_1.OpeningStockDocumentMapper.toPersistence(document);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, payload);
            return;
        }
        await ref.set(payload);
    }
    async updateDocument(companyId, id, data, transaction) {
        const ref = this.collection(companyId).doc(id);
        const payload = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === undefined ? firestore_1.FieldValue.delete() : value]));
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.update(ref, payload);
            return;
        }
        await ref.update(payload);
    }
    async getDocument(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.OpeningStockDocumentMapper.toDomain(doc.data());
    }
    async getCompanyDocuments(companyId, opts) {
        let query = this.collection(companyId).orderBy('date', 'desc');
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.OpeningStockDocumentMapper.toDomain(doc.data()));
    }
    async getByStatus(companyId, status, opts) {
        let query = this.collection(companyId)
            .where('status', '==', status)
            .orderBy('date', 'desc');
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.OpeningStockDocumentMapper.toDomain(doc.data()));
    }
    async deleteDocument(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.delete();
    }
}
exports.FirestoreOpeningStockDocumentRepository = FirestoreOpeningStockDocumentRepository;
//# sourceMappingURL=FirestoreOpeningStockDocumentRepository.js.map