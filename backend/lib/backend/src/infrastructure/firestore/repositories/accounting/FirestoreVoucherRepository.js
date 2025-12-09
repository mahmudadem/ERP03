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
            let query = this.getVouchersCollection(companyId);
            // Apply basic filters if needed
            if (filters === null || filters === void 0 ? void 0 : filters.status) {
                query = query.where('status', '==', filters.status);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.sourceModule) {
                query = query.where('sourceModule', '==', filters.sourceModule);
            }
            const snapshot = await query.get();
            return snapshot.docs.map(doc => this.toDomain(doc.data()));
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