"use strict";
/**
 * PrismaVoucherSequenceRepository
 *
 * SQL implementation of IVoucherSequenceRepository using Prisma.
 * Handles voucher sequence number generation with atomic increments.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaVoucherSequenceRepository = void 0;
class PrismaVoucherSequenceRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // =========================================================================
    // MAPPING HELPERS
    // =========================================================================
    toDomain(record) {
        var _a;
        return {
            id: record.id,
            companyId: record.companyId,
            prefix: record.prefix,
            year: record.fiscalYearId ? new Date(record.fiscalYearId).getFullYear() : undefined,
            lastNumber: (_a = record.currentNumber) !== null && _a !== void 0 ? _a : 0,
            format: this.buildFormat(record.prefix, record.fiscalYearId),
            updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt),
        };
    }
    buildFormat(prefix, fiscalYearId) {
        if (fiscalYearId) {
            return `${prefix}-{YYYY}-{COUNTER:4}`;
        }
        return `${prefix}-{COUNTER:4}`;
    }
    // =========================================================================
    // IMPLEMENTATION
    // =========================================================================
    async getNextNumber(companyId, prefix, year, format) {
        const fiscalYearId = year ? await this.getFiscalYearIdForYear(companyId, year) : null;
        const sequence = await this.prisma.voucherSequence.findFirst({
            where: {
                companyId,
                prefix,
                fiscalYearId,
            },
        });
        if (!sequence) {
            // Create a new sequence starting at 1
            const newSequence = await this.prisma.voucherSequence.create({
                data: {
                    id: `${prefix}-${year || 'ALL'}`,
                    company: { connect: { id: companyId } },
                    voucherType: prefix,
                    prefix,
                    currentNumber: 1,
                    fiscalYearId,
                },
            });
            const counter = 1;
            const paddedCounter = String(counter).padStart(4, '0');
            if (year) {
                return `${prefix}-${year}-${paddedCounter}`;
            }
            return `${prefix}-${paddedCounter}`;
        }
        // Atomically increment and get the next number
        const updated = await this.prisma.voucherSequence.update({
            where: { id: sequence.id },
            data: {
                currentNumber: { increment: 1 },
            },
        });
        const counter = updated.currentNumber;
        const paddedCounter = String(counter).padStart(4, '0');
        if (year) {
            return `${prefix}-${year}-${paddedCounter}`;
        }
        return `${prefix}-${paddedCounter}`;
    }
    async getCurrentSequence(companyId, prefix, year) {
        const fiscalYearId = year ? await this.getFiscalYearIdForYear(companyId, year) : null;
        const record = await this.prisma.voucherSequence.findFirst({
            where: {
                companyId,
                prefix,
                fiscalYearId,
            },
        });
        return record ? this.toDomain(record) : null;
    }
    async setNextNumber(companyId, prefix, nextNumber, year, format) {
        const fiscalYearId = year ? await this.getFiscalYearIdForYear(companyId, year) : null;
        const sequence = await this.prisma.voucherSequence.findFirst({
            where: {
                companyId,
                prefix,
                fiscalYearId,
            },
        });
        if (sequence) {
            await this.prisma.voucherSequence.update({
                where: { id: sequence.id },
                data: {
                    currentNumber: nextNumber - 1, // Set to nextNumber - 1 so getNextNumber returns nextNumber
                },
            });
        }
        else {
            await this.prisma.voucherSequence.create({
                data: {
                    id: `${prefix}-${year || 'ALL'}`,
                    company: { connect: { id: companyId } },
                    voucherType: prefix,
                    prefix,
                    currentNumber: nextNumber - 1,
                    fiscalYearId,
                },
            });
        }
    }
    async listSequences(companyId) {
        const records = await this.prisma.voucherSequence.findMany({
            where: { companyId },
            orderBy: [{ prefix: 'asc' }, { fiscalYearId: 'desc' }],
        });
        return records.map((r) => this.toDomain(r));
    }
    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================
    async getFiscalYearIdForYear(companyId, year) {
        var _a;
        const fiscalYear = await this.prisma.fiscalYear.findFirst({
            where: {
                companyId,
                startDate: {
                    gte: new Date(`${year}-01-01`),
                    lte: new Date(`${year}-12-31`),
                },
            },
        });
        return (_a = fiscalYear === null || fiscalYear === void 0 ? void 0 : fiscalYear.id) !== null && _a !== void 0 ? _a : null;
    }
}
exports.PrismaVoucherSequenceRepository = PrismaVoucherSequenceRepository;
//# sourceMappingURL=PrismaVoucherSequenceRepository.js.map