import { Prisma, PrismaClient } from '@prisma/client';
import { PosHeldCart, PosHeldCartStatus } from '../../../../domain/pos/entities/PosHeldCart';
import { IPosHeldCartRepository } from '../../../../repository/interfaces/pos/IPosHeldCartRepository';

export class PrismaPosHeldCartRepository implements IPosHeldCartRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(cart: PosHeldCart, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posHeldCart.create({ data: this.toPersistence(cart) });
  }

  async update(cart: PosHeldCart, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posHeldCart.update({
      where: { id: cart.id },
      data: this.toPersistence(cart),
    });
  }

  async getById(companyId: string, id: string): Promise<PosHeldCart | null> {
    const record = await this.prisma.posHeldCart.findFirst({ where: { companyId, id } });
    return record ? this.toDomain(record) : null;
  }

  async list(
    companyId: string,
    filters?: { registerId?: string; shiftId?: string; cashierUserId?: string; status?: PosHeldCartStatus; limit?: number }
  ): Promise<PosHeldCart[]> {
    const records = await this.prisma.posHeldCart.findMany({
      where: {
        companyId,
        ...(filters?.registerId ? { registerId: filters.registerId } : {}),
        ...(filters?.shiftId ? { shiftId: filters.shiftId } : {}),
        ...(filters?.cashierUserId ? { cashierUserId: filters.cashierUserId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: filters?.limit || undefined,
    });
    return records.map((record) => this.toDomain(record));
  }

  private toPersistence(cart: PosHeldCart): any {
    return {
      id: cart.id,
      companyId: cart.companyId,
      registerId: cart.registerId,
      shiftId: cart.shiftId,
      cashierUserId: cart.cashierUserId,
      customerId: cart.customerId || null,
      note: cart.note || null,
      status: cart.status,
      lines: cart.lines,
      subtotal: cart.subtotal,
      discountTotal: cart.discountTotal,
      taxTotal: cart.taxTotal,
      grandTotal: cart.grandTotal,
      createdBy: cart.createdBy,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      recalledAt: cart.recalledAt || null,
      recalledBy: cart.recalledBy || null,
      cancelledAt: cart.cancelledAt || null,
      cancelledBy: cart.cancelledBy || null,
      cancelReason: cart.cancelReason || null,
    };
  }

  private toDomain(record: any): PosHeldCart {
    return PosHeldCart.fromJSON({
      id: record.id,
      companyId: record.companyId,
      registerId: record.registerId,
      shiftId: record.shiftId,
      cashierUserId: record.cashierUserId,
      customerId: record.customerId || undefined,
      note: record.note || undefined,
      status: record.status,
      lines: record.lines || [],
      subtotal: record.subtotal,
      discountTotal: record.discountTotal,
      taxTotal: record.taxTotal,
      grandTotal: record.grandTotal,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      recalledAt: record.recalledAt || undefined,
      recalledBy: record.recalledBy || undefined,
      cancelledAt: record.cancelledAt || undefined,
      cancelledBy: record.cancelledBy || undefined,
      cancelReason: record.cancelReason || undefined,
    });
  }
}
