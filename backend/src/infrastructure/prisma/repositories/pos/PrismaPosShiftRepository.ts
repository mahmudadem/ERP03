import { PrismaClient } from '@prisma/client';
import { IPosShiftRepository } from '../../../../repository/interfaces/pos/IPosShiftRepository';
import { POSShift } from '../../../../domain/pos/entities/POSShift';

export class PrismaPosShiftRepository implements IPosShiftRepository {
  constructor(private prisma: PrismaClient) {}

  async openShift(shift: POSShift): Promise<void> {
    await this.prisma.posShift.create({
      data: {
        id: shift.id,
        companyId: shift.companyId,
        userId: shift.userId,
        openedAt: shift.openedAt,
        openingBalance: shift.openingBalance,
      },
    });
  }

  async closeShift(id: string, closedAt: Date, closingBalance: number): Promise<void> {
    await this.prisma.posShift.update({
      where: { id },
      data: {
        closedAt,
        closingBalance,
      },
    });
  }

  async getShift(id: string): Promise<POSShift | null> {
    const record = await this.prisma.posShift.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyShifts(companyId: string): Promise<POSShift[]> {
    const records = await this.prisma.posShift.findMany({
      where: { companyId },
      orderBy: { openedAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): POSShift {
    return new POSShift(
      record.id,
      record.companyId,
      record.userId,
      record.openedAt,
      record.openingBalance,
      record.closedAt ?? undefined,
      record.closingBalance ?? undefined
    );
  }
}
