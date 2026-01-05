"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreVoucherRepositoryV2 = void 0;
const VoucherEntity_1 = require("../../../../domain/accounting/entities/VoucherEntity");
/**
 * Firestore Voucher Repository Implementation (ADR-005 Compliant)
 *
 * Simple, explicit persistence layer.
 * Storage: companies/{companyId}/vouchers/{voucherId}
 */
class FirestoreVoucherRepositoryV2 {
    constructor(db) {
        this.db = db;
        this.COLLECTION_NAME = 'vouchers';
    }
    getCollection(companyId) {
        return this.db
            .collection('companies')
            .doc(companyId)
            .collection(this.COLLECTION_NAME);
    }
    async save(voucher) {
        const collection = this.getCollection(voucher.companyId);
        const docRef = collection.doc(voucher.id);
        const data = voucher.toJSON();
        await docRef.set(data, { merge: true });
        return voucher;
    }
    async findById(companyId, voucherId) {
        const collection = this.getCollection(companyId);
        const docRef = collection.doc(voucherId);
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            return null;
        }
        const data = snapshot.data();
        if (!data) {
            return null;
        }
        return VoucherEntity_1.VoucherEntity.fromJSON(data);
    }
    async findByType(companyId, type, limit = 100) {
        const collection = this.getCollection(companyId);
        const query = collection
            .where('type', '==', type)
            .orderBy('date', 'desc')
            .limit(limit);
        const snapshot = await query.get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async findByStatus(companyId, status, limit = 100) {
        const collection = this.getCollection(companyId);
        const query = collection
            .where('status', '==', status)
            .orderBy('date', 'desc')
            .limit(limit);
        const snapshot = await query.get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async findByDateRange(companyId, startDate, endDate, limit = 100) {
        const collection = this.getCollection(companyId);
        const query = collection
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc')
            .limit(limit);
        const snapshot = await query.get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async findByCompany(companyId, limit = 100) {
        const collection = this.getCollection(companyId);
        const query = collection
            .orderBy('date', 'desc')
            .limit(limit);
        const snapshot = await query.get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async delete(companyId, voucherId) {
        const collection = this.getCollection(companyId);
        const docRef = collection.doc(voucherId);
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            return false;
        }
        await docRef.delete();
        return true;
    }
    async existsByNumber(companyId, voucherNo) {
        const collection = this.getCollection(companyId);
        const query = collection
            .where('voucherNo', '==', voucherNo)
            .limit(1);
        const snapshot = await query.get();
        return !snapshot.empty;
    }
    async countByFormId(companyId, formId) {
        const collection = this.getCollection(companyId);
        // Check both potential locations for formId:
        // 1. In metadata (metadata.formId) - New Standard
        // 2. Or if we decide to promote it to top-level property later
        // Using metadata.formId as established in the design
        const query = collection.where('metadata.formId', '==', formId);
        try {
            // Use efficient server-side count
            const snapshot = await query.count().get();
            return snapshot.data().count;
        }
        catch (err) {
            console.warn('Firestore count aggregation failed, falling back to empty check', err);
            // Fallback for emulators or versions that might not support count (though unlikely in admin sdk)
            const fallbackQuery = query.select().limit(1); // Select only ID
            const fallbackSnap = await fallbackQuery.get();
            return fallbackSnap.empty ? 0 : 1; // Return at least 1 if found
        }
    }
    async findByReversalOfVoucherId(companyId, originalVoucherId) {
        const collection = this.getCollection(companyId);
        const query = collection.where('reversalOfVoucherId', '==', originalVoucherId).limit(1);
        const snapshot = await query.get();
        if (snapshot.empty) {
            return null;
        }
        return VoucherEntity_1.VoucherEntity.fromJSON(snapshot.docs[0].data());
    }
}
exports.FirestoreVoucherRepositoryV2 = FirestoreVoucherRepositoryV2;
//# sourceMappingURL=FirestoreVoucherRepositoryV2.js.map