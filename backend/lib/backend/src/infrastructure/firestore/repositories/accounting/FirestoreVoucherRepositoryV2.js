"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreVoucherRepositoryV2 = void 0;
const VoucherEntity_1 = require("../../../../domain/accounting/entities/VoucherEntity");
const VoucherTypes_1 = require("../../../../domain/accounting/types/VoucherTypes");
/**
 * Firestore Voucher Repository Implementation (ADR-005 Compliant)
 *
 * Simple, explicit persistence layer.
 * Storage: companies/{companyId}/accounting/Data/vouchers (Via SettingsResolver)
 */
class FirestoreVoucherRepositoryV2 {
    // private readonly COLLECTION_NAME = 'vouchers'; // Delegated to SettingsResolver
    constructor(db, settingsResolver) {
        this.db = db;
        this.settingsResolver = settingsResolver;
    }
    getCollection(companyId) {
        return this.settingsResolver.getVouchersCollection(companyId);
    }
    async save(voucher) {
        const data = voucher.toJSON();
        // Maintain a search index for all currencies used in this voucher (header + lines)
        const currencies = new Set();
        currencies.add(voucher.currency.toUpperCase());
        voucher.lines.forEach(line => currencies.add(line.currency.toUpperCase()));
        data._allCurrencies = Array.from(currencies);
        // Save to modular location only
        await this.getCollection(voucher.companyId).doc(voucher.id).set(data, { merge: true });
        return voucher;
    }
    async findById(companyId, voucherId) {
        const snapshot = await this.getCollection(companyId).doc(voucherId).get();
        if (!snapshot.exists) {
            return null;
        }
        const data = snapshot.data();
        if (!data)
            return null;
        return VoucherEntity_1.VoucherEntity.fromJSON(data);
    }
    async findByType(companyId, type, limit = 100) {
        const snapshot = await this.getCollection(companyId)
            .where('type', '==', type)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async findByStatus(companyId, status, limit = 100) {
        const snapshot = await this.getCollection(companyId)
            .where('status', '==', status)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async findByDateRange(companyId, startDate, endDate, limit = 100) {
        const snapshot = await this.getCollection(companyId)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async findByCompany(companyId, limit = 100) {
        const snapshot = await this.getCollection(companyId)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async delete(companyId, voucherId) {
        const docRef = this.getCollection(companyId).doc(voucherId);
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            return false;
        }
        await docRef.delete();
        return true;
    }
    async existsByNumber(companyId, voucherNo) {
        const snapshot = await this.getCollection(companyId)
            .where('voucherNo', '==', voucherNo)
            .limit(1)
            .get();
        return !snapshot.empty;
    }
    async countByFormId(companyId, formId) {
        try {
            const snapshot = await this.getCollection(companyId).where('metadata.formId', '==', formId).count().get();
            return snapshot.data().count || 0;
        }
        catch (err) {
            console.warn('Firestore count aggregation failed', err);
            return 0;
        }
    }
    async findByReversalOfVoucherId(companyId, originalVoucherId) {
        const snapshot = await this.getCollection(companyId).where('reversalOfVoucherId', '==', originalVoucherId).limit(1).get();
        if (snapshot.empty)
            return null;
        return VoucherEntity_1.VoucherEntity.fromJSON(snapshot.docs[0].data());
    }
    async countByCurrency(companyId, currencyCode) {
        const upperCode = currencyCode.toUpperCase();
        try {
            const snapshot = await this.getCollection(companyId).where('_allCurrencies', 'array-contains', upperCode).count().get();
            return snapshot.data().count || 0;
        }
        catch (err) {
            console.warn('Firestore count aggregation failed', err);
            return 0;
        }
    }
    async findPendingFinancialApprovals(companyId, limit = 100) {
        const snapshot = await this.getCollection(companyId)
            .where('status', '==', VoucherTypes_1.VoucherStatus.PENDING)
            .where('metadata.pendingFinancialApproval', '==', true)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async findPendingCustodyConfirmations(companyId, custodianUserId, limit = 100) {
        const snapshot = await this.getCollection(companyId)
            .where('status', '==', VoucherTypes_1.VoucherStatus.PENDING)
            .where('metadata.pendingCustodyConfirmations', 'array-contains', custodianUserId)
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
}
exports.FirestoreVoucherRepositoryV2 = FirestoreVoucherRepositoryV2;
//# sourceMappingURL=FirestoreVoucherRepositoryV2.js.map