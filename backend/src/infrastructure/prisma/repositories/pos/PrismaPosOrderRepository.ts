import { PrismaClient } from '@prisma/client';
import { IPosOrderRepository } from '../../../../repository/interfaces/pos/IPosOrderRepository';
import { POSOrder, POSOrderItem } from '../../../../domain/pos/entities/POSOrder';

export class PrismaPosOrderRepository implements IPosOrderRepository {
  constructor(private prisma: PrismaClient) {}

  async createOrder(order: POSOrder): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.posOrder.create({
        data: {
          id: order.id,
          companyId: order.companyId,
          shiftId: order.shiftId,
          orderNo: order.id,
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: order.createdAt,
          updatedAt: order.createdAt,
          items: {
            create: order.items.map((item, index) => ({
              id: `${order.id}-item-${index}`,
              itemId: item.itemId,
              name: item.name,
              qty: item.qty,
              price: item.price,
              discount: item.discount,
              total: item.total,
            })),
          },
        },
      });
    });
  }

  async getOrder(id: string): Promise<POSOrder | null> {
    const record = await this.prisma.posOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyOrders(companyId: string): Promise<POSOrder[]> {
    const records = await this.prisma.posOrder.findMany({
      where: { companyId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): POSOrder {
    const items = (record.items || []).map(
      (item: any) =>
        new POSOrderItem(
          item.itemId,
          item.name,
          item.qty,
          item.price,
          item.discount
        )
    );

    return new POSOrder(
      record.id,
      record.companyId,
      record.shiftId,
      items,
      record.totalAmount,
      record.createdAt,
      record.status as 'COMPLETED' | 'VOIDED' | 'PENDING'
    );
  }
}
