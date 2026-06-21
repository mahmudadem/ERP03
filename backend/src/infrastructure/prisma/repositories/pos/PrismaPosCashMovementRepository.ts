import { PrismaClient, Prisma } from '@prisma/client';
import { PosCashMovement } from '../../../../domain/pos/entities/PosCashMovement';
import {
  EMPTY_CASH_MOVEMENT_TOTALS,
  IPosCashMovementRepository,
  PosCashMovementTotals,
} from '../../../../repository/interfaces/pos/IPosCashMovementRepository';

export class PrismaPosCashMovementRepository implements IPosCashMovementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(movement: PosCashMovement, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posCashMovement.create({
      data: {
        id: movement.id,
        companyId: movement.companyId,
        shiftId: movement.shiftId,
        registerId: movement.registerId,
        type: movement.type,
        amount: movement.amount,
        reason: movement.reason || null,
        createdBy: movement.createdBy,
        createdAt: movement.createdAt,
      },
    });
  }

  async listByShift(companyId: string, shiftId: string): Promise<PosCashMovement[]> {
    const records = await this.prisma.posCashMovement.findMany({
      where: { companyId, shiftId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async sumByShift(companyId: string, shiftId: string): Promise<PosCashMovementTotals> {
    const totals: PosCashMovementTotals = { ...EMPTY_CASH_MOVEMENT_TOTALS };
    const records = await this.prisma.posCashMovement.findMany({ where: { companyId, shiftId } });
    for (const r of records) {
      const type = r.type as keyof PosCashMovementTotals;
      const next = (totals[type] as number) + Number(r.amount);
      (totals as any)[type] = round2(next);
    }
    totals.expectedCash = round2(
      totals.OPENING_FLOAT + totals.SALE_CASH - totals.REFUND_CASH + totals.PAYIN - totals.PAYOUT - totals.DROP
    );
    return totals;
  }

  private toDomain(record: any): PosCashMovement {
    return PosCashMovement.fromJSON({
      id: record.id,
      companyId: record.companyId,
      shiftId: record.shiftId,
      registerId: record.registerId,
      type: record.type,
      amount: Number(record.amount),
      reason: record.reason || undefined,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
    });
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
