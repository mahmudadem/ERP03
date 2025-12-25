"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreVoucherRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const AccountingMappers_1 = require("../../mappers/AccountingMappers");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreVoucherRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'vouchers'; // Used within company subcollection
    }
    /**
     * Get the vouchers subcollection for a specific company
     */
    getVouchersCollection(companyId) {
        return this.db.collection('companies').doc(companyId).collection('vouchers');
    }
    toDomain(data) {
        return AccountingMappers_1.VoucherMapper.toDomain(data);
    }
    toPersistence(entity) {
        return AccountingMappers_1.VoucherMapper.toPersistence(entity);
    }
    async createVoucher(voucher, transaction) {
        try {
            const data = this.toPersistence(voucher);
            const voucherRef = this.getVouchersCollection(voucher.companyId).doc(voucher.id);
            if (transaction) {
                transaction.set(voucherRef, data);
            }
            else {
                await voucherRef.set(data);
            }
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error creating voucher', error);
        }
    }
    async updateVoucher(companyId, id, data, transaction) {
        try {
            const voucherRef = this.getVouchersCollection(companyId).doc(id);
            if (transaction) {
                transaction.update(voucherRef, data);
            }
            else {
                await voucherRef.update(data);
            }
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating voucher', error);
        }
    }
    async deleteVoucher(companyId, id, transaction) {
        try {
            const voucherRef = this.getVouchersCollection(companyId).doc(id);
            if (transaction) {
                transaction.delete(voucherRef);
            }
            else {
                await voucherRef.delete();
            }
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error deleting voucher', error);
        }
    }
    async getVoucher(companyId, id) {
        try {
            const doc = await this.getVouchersCollection(companyId).doc(id).get();
            if (!doc.exists)
                return null;
            return this.toDomain(doc.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error fetching voucher', error);
        }
    }
    async getVouchers(companyId, filters) {
        try {
            console.log('\n\n========== VOUCHER QUERY DEBUG START ==========');
            console.log('FILTERS:', JSON.stringify(filters, null, 2));
            // First, check total vouchers without filters for debugging
            const allVouchersSnapshot = await this.getVouchersCollection(companyId).get();
            console.log('TOTAL VOUCHERS IN DB:', allVouchersSnapshot.size);
            // Log first voucher's date for comparison if any exist
            if (allVouchersSnapshot.size > 0) {
                const firstDoc = allVouchersSnapshot.docs[0].data();
                console.log('FIRST VOUCHER DATE:', firstDoc.date);
                console.log('FIRST VOUCHER TYPE:', firstDoc.type);
                console.log('FIRST VOUCHER FORMID:', firstDoc.formId);
            }
            let query = this.getVouchersCollection(companyId);
            // Apply filters
            if (filters === null || filters === void 0 ? void 0 : filters.type) {
                console.log('FILTERING BY TYPE:', filters.type);
                query = query.where('type', '==', filters.type);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.formId) {
                console.log('FILTERING BY FORMID:', filters.formId);
                query = query.where('formId', '==', filters.formId);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.status) {
                console.log('FILTERING BY STATUS:', filters.status);
                query = query.where('status', '==', filters.status);
            }
            // Date range filtering using ISO strings (same format as existing vouchers)
            if (filters === null || filters === void 0 ? void 0 : filters.from) {
                const fromDate = new Date(filters.from);
                console.log('FILTERING FROM DATE:', fromDate.toISOString());
                query = query.where('date', '>=', fromDate.toISOString());
            }
            if ((filters === null || filters === void 0 ? void 0 : filters.to) && !(filters === null || filters === void 0 ? void 0 : filters.from)) {
                // Only apply 'to' if 'from' is not set (Firestore range limitation)
                const toDate = new Date(filters.to);
                console.log('FILTERING TO DATE:', toDate.toISOString());
                query = query.where('date', '<=', toDate.toISOString());
            }
            const snapshot = await query.get();
            console.log('QUERY RETURNED:', snapshot.size, 'vouchers');
            console.log('========== VOUCHER QUERY DEBUG END ==========\n\n');
            let vouchers = snapshot.docs.map(doc => this.toDomain(doc.data()));
            // Apply client-side filters that Firestore can't handle
            if ((filters === null || filters === void 0 ? void 0 : filters.to) && (filters === null || filters === void 0 ? void 0 : filters.from)) {
                // If both from and to are set, filter 'to' client-side
                const toDate = new Date(filters.to);
                vouchers = vouchers.filter(v => new Date(v.date) <= toDate);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.search) {
                const searchLower = filters.search.toLowerCase();
                vouchers = vouchers.filter(v => {
                    var _a, _b;
                    return ((_a = v.voucherNo) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchLower)) ||
                        ((_b = v.reference) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(searchLower));
                });
            }
            return vouchers;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error fetching vouchers', error);
        }
    }
    async getVouchersByDateRange(companyId, fromDate, toDate) {
        try {
            // Query the company-scoped subcollection
            const query = this.getVouchersCollection(companyId)
                .where('date', '>=', fromDate.toISOString())
                .where('date', '<=', toDate.toISOString())
                .orderBy('date', 'asc');
            const snapshot = await query.get();
            console.log(`📊 [Firestore] Fetched ${snapshot.size} vouchers for company ${companyId.substring(0, 20)}... (${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]})`);
            return snapshot.docs.map(doc => this.toDomain(doc.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error fetching vouchers by date range', error);
        }
    }
}
exports.FirestoreVoucherRepository = FirestoreVoucherRepository;
//# sourceMappingURL=FirestoreVoucherRepository.js.map