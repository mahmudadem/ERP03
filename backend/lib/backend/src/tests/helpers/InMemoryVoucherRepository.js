"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryVoucherRepository = void 0;
/**
 * In-Memory Voucher Repository
 *
 * For testing purposes only.
 * Stores vouchers in memory instead of database.
 */
class InMemoryVoucherRepository {
    constructor() {
        this.vouchers = new Map();
    }
    async save(voucher) {
        const key = `${voucher.companyId}:${voucher.id}`;
        this.vouchers.set(key, voucher);
        return voucher;
    }
    async findById(companyId, voucherId) {
        const key = `${companyId}:${voucherId}`;
        return this.vouchers.get(key) || null;
    }
    async findByType(companyId, type, limit = 100) {
        return Array.from(this.vouchers.values())
            .filter(v => v.companyId === companyId && v.type === type)
            .slice(0, limit);
    }
    async findByStatus(companyId, status, limit = 100) {
        return Array.from(this.vouchers.values())
            .filter(v => v.companyId === companyId && v.status === status)
            .slice(0, limit);
    }
    async findByDateRange(companyId, startDate, endDate, limit = 100) {
        return Array.from(this.vouchers.values())
            .filter(v => v.companyId === companyId &&
            v.date >= startDate &&
            v.date <= endDate)
            .slice(0, limit);
    }
    async findByCompany(companyId, limit = 100) {
        return Array.from(this.vouchers.values())
            .filter(v => v.companyId === companyId)
            .slice(0, limit);
    }
    async delete(companyId, voucherId) {
        const key = `${companyId}:${voucherId}`;
        return this.vouchers.delete(key);
    }
    async existsByNumber(companyId, voucherNo) {
        return Array.from(this.vouchers.values())
            .some(v => v.companyId === companyId && v.voucherNo === voucherNo);
    }
    // Test helpers
    clear() {
        this.vouchers.clear();
    }
    count() {
        return this.vouchers.size;
    }
}
exports.InMemoryVoucherRepository = InMemoryVoucherRepository;
//# sourceMappingURL=InMemoryVoucherRepository.js.map