import { PrismaClient, Prisma } from '@prisma/client';
import { PosShift } from '../../../../domain/pos/entities/PosShift';
import { IPosShiftRepository } from '../../../../repository/interfaces/pos/IPosShiftRepository';

export class PrismaPosShiftRepository implements IPosShiftRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(shift: PosShift, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posShift.create({
      data: {
        id: shift.id,
        companyId: shift.companyId,
        registerId: shift.registerId,
        cashierUserId: shift.cashierUserId,
        status: shift.status,
        openedAt: shift.openedAt,
        openingFloat: shift.openingFloat,
        closedAt: shift.closedAt || null,
        expectedCash: shift.expectedCash ?? null,
        countedCash: shift.countedCash ?? null,
        expectedPaymentTotals: shift.expectedPaymentTotals as any,
        countedPaymentTotals: shift.countedPaymentTotals as any,
        overShortPaymentTotals: shift.overShortPaymentTotals as any,
        overShortAmount: shift.overShortAmount ?? null,
        overShortVoucherId: shift.overShortVoucherId || null,
        reconciledAt: shift.reconciledAt || null,
        reconciledBy: shift.reconciledBy || null,
        createdAt: shift.createdAt,
        updatedAt: shift.updatedAt,
      },
    });
  }

  async update(shift: PosShift, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posShift.update({
      where: { id: shift.id },
      data: {
        status: shift.status,
        closedAt: shift.closedAt || null,
        expectedCash: shift.expectedCash ?? null,
        countedCash: shift.countedCash ?? null,
        expectedPaymentTotals: shift.expectedPaymentTotals as any,
        countedPaymentTotals: shift.countedPaymentTotals as any,
        overShortPaymentTotals: shift.overShortPaymentTotals as any,
        overShortAmount: shift.overShortAmount ?? null,
        overShortVoucherId: shift.overShortVoucherId || null,
        reconciledAt: shift.reconciledAt || null,
        reconciledBy: shift.reconciledBy || null,
        updatedAt: new Date(),
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PosShift | null> {
    const record = await this.prisma.posShift.findFirst({ where: { id, companyId } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getOpenShiftForRegister(companyId: string, registerId: string): Promise<PosShift | null> {
    const record = await this.prisma.posShift.findFirst({
      where: { companyId, registerId, status: 'OPEN' },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getOpenShiftForCashier(companyId: string, cashierUserId: string): Promise<PosShift | null> {
    const record = await this.prisma.posShift.findFirst({
      where: { companyId, cashierUserId, status: 'OPEN' },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, filters?: { registerId?: string; status?: string; limit?: number }): Promise<PosShift[]> {
    const records = await this.prisma.posShift.findMany({
      where: {
        companyId,
        ...(filters?.registerId ? { registerId: filters.registerId } : {}),
        ...(filters?.status ? { status: filters.status as any } : {}),
      },
      orderBy: { openedAt: 'desc' },
      take: filters?.limit || undefined,
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): PosShift {
    return PosShift.fromJSON({
      id: record.id,
      companyId: record.companyId,
      registerId: record.registerId,
      cashierUserId: record.cashierUserId,
      status: record.status,
      openedAt: record.openedAt,
      openingFloat: record.openingFloat,
      closedAt: record.closedAt || undefined,
      expectedCash: record.expectedCash !== null ? Number(record.expectedCash) : undefined,
      countedCash: record.countedCash !== null ? Number(record.countedCash) : undefined,
      expectedPaymentTotals: record.expectedPaymentTotals || undefined,
      countedPaymentTotals: record.countedPaymentTotals || undefined,
      overShortPaymentTotals: record.overShortPaymentTotals || undefined,
      overShortAmount: record.overShortAmount !== null ? Number(record.overShortAmount) : undefined,
      overShortVoucherId: record.overShortVoucherId || undefined,
      reconciledAt: record.reconciledAt || undefined,
      reconciledBy: record.reconciledBy || undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
