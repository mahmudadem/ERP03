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
        // MODULAR TRANSITION: pull from both modular and legacy paths, then merge.
        const modularQuery = this.getCollection(companyId)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        const legacyQuery = this.db
            .collection('companies')
            .doc(companyId)
            .collection('vouchers')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        const [modularSnap, legacySnap] = await Promise.all([modularQuery, legacyQuery]);
        const voucherMap = new Map();
        legacySnap.docs.forEach((doc) => {
            const raw = doc.data();
            const voucher = VoucherEntity_1.VoucherEntity.fromJSON((raw === null || raw === void 0 ? void 0 : raw.id) ? raw : Object.assign(Object.assign({}, raw), { id: doc.id }));
            voucherMap.set(voucher.id, voucher);
        });
        modularSnap.docs.forEach((doc) => {
            const raw = doc.data();
            const voucher = VoucherEntity_1.VoucherEntity.fromJSON((raw === null || raw === void 0 ? void 0 : raw.id) ? raw : Object.assign(Object.assign({}, raw), { id: doc.id }));
            voucherMap.set(voucher.id, voucher);
        });
        return Array.from(voucherMap.values())
            .sort((a, b) => {
            const dateDiff = (b.date || '').localeCompare(a.date || '');
            if (dateDiff !== 0)
                return dateDiff;
            return b.id.localeCompare(a.id);
        })
            .slice(0, limit);
    }
    async findByCompany(companyId, limit = 100, filters, offset = 0) {
        // MODULAR TRANSITION: Try both paths and merge
        // 1. Build Modular Query
        let modularQuery = this.getCollection(companyId).orderBy('date', 'desc');
        if (filters === null || filters === void 0 ? void 0 : filters.from)
            modularQuery = modularQuery.where('date', '>=', filters.from);
        if (filters === null || filters === void 0 ? void 0 : filters.to)
            modularQuery = modularQuery.where('date', '<=', filters.to);
        if ((filters === null || filters === void 0 ? void 0 : filters.type) && filters.type !== 'ALL') {
            const t = filters.type.toLowerCase();
            if (t === 'journal_entry' || t === 'jv') {
                modularQuery = modularQuery.where('type', 'in', ['journal_entry', 'jv']);
            }
            else {
                modularQuery = modularQuery.where('type', '==', filters.type);
            }
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.status) && filters.status !== 'ALL')
            modularQuery = modularQuery.where('status', '==', filters.status);
        // Support filtering by formId (top-level as of modern toJSON, fallback to metadata for older records)
        if (filters === null || filters === void 0 ? void 0 : filters.formId) {
            modularQuery = modularQuery.where('formId', '==', filters.formId);
        }
        // Fetch OFFSET + LIMIT to support slicing in memory (due to merge logic)
        // This is inefficient for deep paging but necessary for merged collections
        const fetchLimit = offset + limit;
        const modularSnap = await modularQuery.limit(fetchLimit).get();
        // 2. Build Legacy Query
        let legacyQuery = this.db.collection('companies').doc(companyId).collection('vouchers').orderBy('date', 'desc');
        if (filters === null || filters === void 0 ? void 0 : filters.from)
            legacyQuery = legacyQuery.where('date', '>=', filters.from);
        if (filters === null || filters === void 0 ? void 0 : filters.to)
            legacyQuery = legacyQuery.where('date', '<=', filters.to);
        if ((filters === null || filters === void 0 ? void 0 : filters.type) && filters.type !== 'ALL') {
            const t = filters.type.toLowerCase();
            if (t === 'journal_entry' || t === 'jv') {
                legacyQuery = legacyQuery.where('type', 'in', ['journal_entry', 'jv']);
            }
            else {
                legacyQuery = legacyQuery.where('type', '==', filters.type);
            }
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.status) && filters.status !== 'ALL')
            legacyQuery = legacyQuery.where('status', '==', filters.status);
        if (filters === null || filters === void 0 ? void 0 : filters.formId)
            legacyQuery = legacyQuery.where('formId', '==', filters.formId);
        const legacySnap = await legacyQuery.limit(fetchLimit).get();
        // Map and merge
        const modularVouchers = modularSnap.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
        const legacyVouchers = legacySnap.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
        // Deduplicate by ID
        const voucherMap = new Map();
        legacyVouchers.forEach(v => voucherMap.set(v.id, v));
        modularVouchers.forEach(v => voucherMap.set(v.id, v));
        // Client-side search (if provided) - used for fields not easily queryable in Firestore 
        // like partial text matches across multiple fields without external index
        const allUnique = Array.from(voucherMap.values());
        let filtered = allUnique;
        if (filters === null || filters === void 0 ? void 0 : filters.search) {
            const s = filters.search.toLowerCase();
            filtered = allUnique.filter(v => {
                var _a, _b;
                return ((_a = v.voucherNo) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(s)) ||
                    ((_b = v.description) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(s)) ||
                    v.id.toLowerCase().includes(s);
            });
        }
        // Sort and Slice for Pagination
        return filtered
            .sort((a, b) => {
            const dateDiff = (b.date || '').localeCompare(a.date || '');
            if (dateDiff !== 0)
                return dateDiff;
            // Secondary sort by ID for stability (prevents duplicates across pages)
            return b.id.localeCompare(a.id);
        })
            .slice(offset, offset + limit);
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
            const snapshot = await this.getCollection(companyId).where('formId', '==', formId).count().get();
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
    async getRecent(companyId, limit) {
        const snapshot = await this.getCollection(companyId)
            .orderBy('postedAt', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => VoucherEntity_1.VoucherEntity.fromJSON(doc.data()));
    }
    async getCounts(companyId, monthStart, monthEnd) {
        const coll = this.getCollection(companyId);
        const allSnap = await coll.limit(1000).get();
        const vouchers = allSnap.docs.map((d) => VoucherEntity_1.VoucherEntity.fromJSON(d.data()));
        const total = vouchers.length;
        const draft = vouchers.filter((v) => v.status.toUpperCase() === VoucherTypes_1.VoucherStatus.DRAFT.toUpperCase()).length;
        const pending = vouchers.filter((v) => v.status.toUpperCase() === VoucherTypes_1.VoucherStatus.PENDING.toUpperCase()).length;
        const postedThisMonth = vouchers.filter((v) => v.postedAt && v.date >= monthStart && v.date <= monthEnd).length;
        // last month window
        const start = new Date(monthStart);
        const prevStart = new Date(start);
        prevStart.setMonth(prevStart.getMonth() - 1);
        const prevEnd = new Date(monthStart);
        prevEnd.setDate(0); // last day previous month
        const prevStartIso = prevStart.toISOString().split('T')[0];
        const prevEndIso = prevEnd.toISOString().split('T')[0];
        const lastMonthTotal = vouchers.filter((v) => v.date >= prevStartIso && v.date <= prevEndIso).length;
        const unbalancedDrafts = vouchers.filter((v) => v.status.toUpperCase() === VoucherTypes_1.VoucherStatus.DRAFT.toUpperCase() && Math.abs(v.totalDebit - v.totalCredit) > 0.01).length;
        return { total, draft, pending, postedThisMonth, lastMonthTotal, unbalancedDrafts };
    }
}
exports.FirestoreVoucherRepositoryV2 = FirestoreVoucherRepositoryV2;
//# sourceMappingURL=FirestoreVoucherRepositoryV2.js.map