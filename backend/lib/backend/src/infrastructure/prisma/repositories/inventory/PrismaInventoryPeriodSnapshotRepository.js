"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaInventoryPeriodSnapshotRepository = void 0;
const InventoryPeriodSnapshot_1 = require("../../../../domain/inventory/entities/InventoryPeriodSnapshot");
class PrismaInventoryPeriodSnapshotRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async saveSnapshot(snapshot) {
        const snapshotData = snapshot.snapshotData.map((line) => ({
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            qtyOnHand: line.qtyOnHand,
            avgCostBase: line.avgCostBase,
            avgCostCCY: line.avgCostCCY,
            lastCostBase: line.lastCostBase,
            lastCostCCY: line.lastCostCCY,
            valueBase: line.valueBase,
        }));
        await this.prisma.inventoryPeriodSnapshot.upsert({
            where: { id: snapshot.id },
            create: {
                id: snapshot.id,
                companyId: snapshot.companyId,
                period: snapshot.periodKey,
                itemId: '_aggregate_',
                warehouseId: '_aggregate_',
                openingQty: 0,
                closingQty: 0,
                totalIn: 0,
                totalOut: 0,
                avgCostBase: 0,
                capturedAt: snapshot.createdAt,
                snapshotData: snapshotData,
                totalValueBase: snapshot.totalValueBase,
                totalItems: snapshot.totalItems,
            },
            update: {
                period: snapshot.periodKey,
                capturedAt: snapshot.createdAt,
                snapshotData: snapshotData,
                totalValueBase: snapshot.totalValueBase,
                totalItems: snapshot.totalItems,
            },
        });
    }
    async getSnapshot(companyId, id) {
        const record = await this.prisma.inventoryPeriodSnapshot.findFirst({
            where: { id, companyId },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getSnapshotByPeriodKey(companyId, periodKey) {
        const record = await this.prisma.inventoryPeriodSnapshot.findFirst({
            where: { companyId, period: periodKey },
            orderBy: { capturedAt: 'desc' },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async findNearestSnapshotForDate(companyId, asOfDate) {
        const asOfPeriod = asOfDate.substring(0, 7);
        const records = await this.prisma.inventoryPeriodSnapshot.findMany({
            where: {
                companyId,
                period: { lte: asOfPeriod },
            },
            orderBy: { period: 'desc' },
        });
        if (!records || records.length === 0)
            return null;
        return this.toDomain(records[0]);
    }
    async listSnapshots(companyId, opts) {
        const records = await this.prisma.inventoryPeriodSnapshot.findMany({
            where: { companyId },
            orderBy: { capturedAt: 'desc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        var _a, _b, _c, _d;
        const snapshotData = (_a = record.snapshotData) !== null && _a !== void 0 ? _a : [];
        const periodKey = record.period;
        const periodEndDate = (_b = record.periodEndDate) !== null && _b !== void 0 ? _b : (periodKey ? `${periodKey}-28` : '');
        return new InventoryPeriodSnapshot_1.InventoryPeriodSnapshot({
            id: record.id,
            companyId: record.companyId,
            periodKey: periodKey,
            periodEndDate: periodEndDate,
            snapshotData: Array.isArray(snapshotData) ? snapshotData : [],
            totalValueBase: (_c = record.totalValueBase) !== null && _c !== void 0 ? _c : 0,
            totalItems: (_d = record.totalItems) !== null && _d !== void 0 ? _d : 0,
            createdAt: record.capturedAt,
        });
    }
}
exports.PrismaInventoryPeriodSnapshotRepository = PrismaInventoryPeriodSnapshotRepository;
//# sourceMappingURL=PrismaInventoryPeriodSnapshotRepository.js.map