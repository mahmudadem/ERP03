"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreVoucherRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const AccountingMappers_1 = require("../../mappers/AccountingMappers");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreVoucherRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'vouchers';
    }
    toDomain(data) {
        return AccountingMappers_1.VoucherMapper.toDomain(data);
    }
    toPersistence(entity) {
        return AccountingMappers_1.VoucherMapper.toPersistence(entity);
    }
    async createVoucher(voucher) {
        return this.save(voucher);
    }
    async updateVoucher(id, data) {
        try {
            await this.db.collection(this.collectionName).doc(id).update(data);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating voucher', error);
        }
    }
    async deleteVoucher(id) {
        return this.delete(id);
    }
    async getVoucher(id) {
        return this.findById(id);
    }
    async getVouchers(companyId, filters) {
        try {
            let query = this.db.collection(this.collectionName)
                .where('companyId', '==', companyId);
            // Apply basic filters if needed (omitted for MVP brevity)
            const snapshot = await query.get();
            return snapshot.docs.map(doc => this.toDomain(doc.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error fetching vouchers', error);
        }
    }
}
exports.FirestoreVoucherRepository = FirestoreVoucherRepository;
//# sourceMappingURL=FirestoreVoucherRepository.js.map