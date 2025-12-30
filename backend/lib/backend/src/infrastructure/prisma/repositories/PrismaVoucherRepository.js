"use strict";
/**
 * PrismaVoucherRepository.ts
 *
 * SQL implementation of IVoucherRepository using Prisma
 *
 * TODO: This repository needs to be updated to use VoucherEntity (V2)
 * Currently stubbed out as the DI uses FirestoreVoucherRepositoryV2 only.
 *
 * When SQL support is needed:
 * 1. Import VoucherEntity, VoucherLineEntity from domain
 * 2. Implement IVoucherRepository from domain/accounting/repositories
 * 3. Map between Prisma models and VoucherEntity
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaVoucherRepository = void 0;
class PrismaVoucherRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(voucher) {
        // TODO: Implement Prisma save using VoucherEntity.toJSON()
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async findById(companyId, voucherId) {
        // TODO: Implement Prisma query and return VoucherEntity.fromJSON()
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async findByType(companyId, type, limit) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async findByStatus(companyId, status, limit) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async findByDateRange(companyId, startDate, endDate, limit) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async findByCompany(companyId, limit) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async delete(companyId, voucherId) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async existsByNumber(companyId, voucherNo) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
}
exports.PrismaVoucherRepository = PrismaVoucherRepository;
//# sourceMappingURL=PrismaVoucherRepository.js.map