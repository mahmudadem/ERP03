"use strict";
/**
 * PrismaVoucherRepository.ts
 *
 * SQL implementation of IVoucherRepository using Prisma
 * Handles the normalized structure (Voucher + VoucherLines as separate tables)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaVoucherRepository = void 0;
const Voucher_1 = require("../../../domain/accounting/entities/Voucher");
const VoucherLine_1 = require("../../../domain/accounting/entities/VoucherLine");
class PrismaVoucherRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createVoucher(voucher) {
        await this.prisma.voucher.create({
            data: {
                id: voucher.id,
                companyId: voucher.companyId,
                type: voucher.type,
                voucherNo: voucher.voucherNo || null,
                date: new Date(voucher.date),
                currency: voucher.currency,
                baseCurrency: voucher.baseCurrency || voucher.currency,
                exchangeRate: voucher.exchangeRate,
                status: voucher.status,
                totalDebit: voucher.totalDebit,
                totalCredit: voucher.totalCredit,
                totalDebitBase: voucher.totalDebitBase || voucher.totalDebit,
                totalCreditBase: voucher.totalCreditBase || voucher.totalCredit,
                createdBy: voucher.createdBy,
                approvedBy: voucher.approvedBy || null,
                lockedBy: voucher.lockedBy || null,
                reference: voucher.reference || null,
                description: voucher.description || null,
                createdAt: voucher.createdAt ? new Date(voucher.createdAt) : new Date(),
                updatedAt: voucher.updatedAt ? new Date(voucher.updatedAt) : new Date(),
                lines: {
                    create: voucher.lines.map((line) => ({
                        id: line.id,
                        accountId: line.accountId,
                        description: line.description || null,
                        debitFx: line.debitFx || 0,
                        creditFx: line.creditFx || 0,
                        debitBase: line.debitBase || 0,
                        creditBase: line.creditBase || 0,
                        lineCurrency: line.lineCurrency || voucher.currency,
                        exchangeRate: line.exchangeRate || 1,
                        costCenterId: line.costCenterId || null,
                    })),
                },
            },
        });
    }
    async updateVoucher(companyId, id, data) {
        await this.prisma.voucher.update({
            where: { id, companyId },
            data: {
                status: data.status,
                approvedBy: data.approvedBy,
                lockedBy: data.lockedBy,
                updatedAt: new Date(),
            },
        });
    }
    async deleteVoucher(companyId, id) {
        await this.prisma.voucher.delete({
            where: { id, companyId }, // Ensure company match
        });
    }
    async getVoucher(companyId, id) {
        const data = await this.prisma.voucher.findFirst({
            where: { id, companyId },
            include: { lines: true },
        });
        if (!data)
            return null;
        return this.mapToDomain(data);
    }
    async getVouchers(companyId, filters) {
        const vouchers = await this.prisma.voucher.findMany({
            where: { companyId },
            include: { lines: true },
            orderBy: { date: 'desc' },
        });
        return vouchers.map((v) => this.mapToDomain(v));
    }
    async getVouchersByDateRange(companyId, fromDate, toDate) {
        const vouchers = await this.prisma.voucher.findMany({
            where: {
                companyId,
                date: {
                    gte: fromDate,
                    lte: toDate
                }
            },
            include: { lines: true },
            orderBy: { date: 'asc' },
        });
        return vouchers.map((v) => this.mapToDomain(v));
    }
    mapToDomain(data) {
        const lines = (data.lines || []).map((l) => new VoucherLine_1.VoucherLine(l.id, l.voucherId, l.accountId, l.description, l.debitFx || l.debitBase, l.debitBase, l.exchangeRate, l.costCenterId));
        lines.forEach((line, index) => {
            const lineData = data.lines[index];
            line.debitFx = lineData.debitFx;
            line.creditFx = lineData.creditFx;
            line.debitBase = lineData.debitBase;
            line.creditBase = lineData.creditBase;
            line.lineCurrency = lineData.lineCurrency;
            line.exchangeRate = lineData.exchangeRate;
        });
        const voucher = new Voucher_1.Voucher(data.id, data.companyId, data.type, data.date, data.currency, data.exchangeRate, data.status, data.totalDebit, data.totalCredit, data.createdBy, data.reference, lines);
        voucher.voucherNo = data.voucherNo;
        voucher.baseCurrency = data.baseCurrency;
        voucher.totalDebitBase = data.totalDebitBase;
        voucher.totalCreditBase = data.totalCreditBase;
        voucher.createdAt = data.createdAt;
        voucher.updatedAt = data.updatedAt;
        voucher.approvedBy = data.approvedBy;
        voucher.lockedBy = data.lockedBy;
        voucher.description = data.description;
        return voucher;
    }
}
exports.PrismaVoucherRepository = PrismaVoucherRepository;
//# sourceMappingURL=PrismaVoucherRepository.js.map