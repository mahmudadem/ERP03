"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPosOrderRepository = void 0;
const POSOrder_1 = require("../../../../domain/pos/entities/POSOrder");
class PrismaPosOrderRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createOrder(order) {
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
    async getOrder(id) {
        const record = await this.prisma.posOrder.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyOrders(companyId) {
        const records = await this.prisma.posOrder.findMany({
            where: { companyId },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        const items = (record.items || []).map((item) => new POSOrder_1.POSOrderItem(item.itemId, item.name, item.qty, item.price, item.discount));
        return new POSOrder_1.POSOrder(record.id, record.companyId, record.shiftId, items, record.totalAmount, record.createdAt, record.status);
    }
}
exports.PrismaPosOrderRepository = PrismaPosOrderRepository;
//# sourceMappingURL=PrismaPosOrderRepository.js.map