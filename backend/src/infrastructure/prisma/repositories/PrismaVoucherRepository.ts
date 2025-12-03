/**
 * PrismaVoucherRepository.ts
 * 
 * SQL implementation of IVoucherRepository using Prisma
 * Handles the normalized structure (Voucher + VoucherLines as separate tables)
 */

import { PrismaClient } from '@prisma/client';
import { IVoucherRepository } from '../../../repository/interfaces/accounting';
import { Voucher } from '../../../domain/accounting/entities/Voucher';
import { VoucherLine } from '../../../domain/accounting/entities/VoucherLine';

export class PrismaVoucherRepository implements IVoucherRepository {
    constructor(private prisma: PrismaClient) { }

    async createVoucher(voucher: Voucher): Promise<void> {
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

    async updateVoucher(id: string, data: Partial<Voucher>): Promise<void> {
        await this.prisma.voucher.update({
            where: { id },
            data: {
                status: data.status,
                approvedBy: data.approvedBy,
                lockedBy: data.lockedBy,
                updatedAt: new Date(),
            },
        });
    }

    async deleteVoucher(id: string): Promise<void> {
        await this.prisma.voucher.delete({
            where: { id },
        });
    }

    async getVoucher(id: string): Promise<Voucher | null> {
        const data = await this.prisma.voucher.findUnique({
            where: { id },
            include: { lines: true },
        });

        if (!data) return null;

        return this.mapToDomain(data);
    }

    async getVouchers(companyId: string, filters?: any): Promise<Voucher[]> {
        const vouchers = await this.prisma.voucher.findMany({
            where: { companyId },
            include: { lines: true },
            orderBy: { date: 'desc' },
        });

        return vouchers.map((v) => this.mapToDomain(v));
    }

    private mapToDomain(data: any): Voucher {
        const lines = (data.lines || []).map(
            (l: any) =>
                new VoucherLine(
                    l.id,
                    l.voucherId,
                    l.accountId,
                    l.description,
                    l.debitFx || l.debitBase,
                    l.debitBase,
                    l.exchangeRate,
                    l.costCenterId
                )
        );

        lines.forEach((line: any, index: number) => {
            const lineData = data.lines[index];
            line.debitFx = lineData.debitFx;
            line.creditFx = lineData.creditFx;
            line.debitBase = lineData.debitBase;
            line.creditBase = lineData.creditBase;
            line.lineCurrency = lineData.lineCurrency;
            line.exchangeRate = lineData.exchangeRate;
        });

        const voucher = new Voucher(
            data.id,
            data.companyId,
            data.type,
            data.date,
            data.currency,
            data.exchangeRate,
            data.status,
            data.totalDebit,
            data.totalCredit,
            data.createdBy,
            data.reference,
            lines
        );

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
