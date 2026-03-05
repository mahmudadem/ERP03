"use strict";
/**
 * SQL MIGRATION STATUS: NOT IMPLEMENTED
 *
 * This repository is a placeholder for future SQL/PostgreSQL migration.
 * Current production uses Firestore via the corresponding Firestore repository.
 *
 * To activate: Set DB_TYPE=sql in .env and implement all methods with Prisma queries.
 * See: backend/src/infrastructure/di/bindRepositories.ts for the toggling mechanism.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaVoucherRepository = void 0;
class PrismaVoucherRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(voucher, transaction) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async findById(companyId, voucherId) {
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
    async findByCompany(companyId, limit, filters, offset) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async delete(companyId, voucherId) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async existsByNumber(companyId, voucherNo) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async countByFormId(companyId, formId) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async findByReversalOfVoucherId(companyId, originalVoucherId) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async countByCurrency(companyId, currencyCode) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async findPendingFinancialApprovals(companyId, limit) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async findPendingCustodyConfirmations(companyId, custodianUserId, limit) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async getRecent(companyId, limit) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
    async getCounts(companyId, monthStart, monthEnd) {
        throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
    }
}
exports.PrismaVoucherRepository = PrismaVoucherRepository;
//# sourceMappingURL=PrismaVoucherRepository.js.map