"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetUnsettledCostReportUseCase = exports.GetLowStockAlertsUseCase = exports.GetInventoryDashboardUseCase = void 0;
class GetInventoryDashboardUseCase {
    constructor(stockLevelRepo, itemRepo, movementRepo) {
        this.stockLevelRepo = stockLevelRepo;
        this.itemRepo = itemRepo;
        this.movementRepo = movementRepo;
    }
    async execute(companyId) {
        const [levels, items, unsettledMovements, allMovements] = await Promise.all([
            this.stockLevelRepo.getAllLevels(companyId),
            this.itemRepo.getCompanyItems(companyId),
            this.movementRepo.getUnsettledMovements(companyId),
            this.movementRepo.getMovementsByDateRange(companyId, '1900-01-01', '2999-12-31', { limit: 200 }),
        ]);
        const itemMap = new Map(items.map((item) => [item.id, item]));
        const lowStockAlerts = levels.filter((level) => {
            const item = itemMap.get(level.itemId);
            if (!item || !item.trackInventory)
                return false;
            if (level.qtyOnHand < 0)
                return true;
            if (item.minStockLevel === undefined)
                return false;
            return level.qtyOnHand < item.minStockLevel;
        }).length;
        const recentMovements = [...allMovements]
            .sort((a, b) => {
            if (b.postingSeq !== a.postingSeq)
                return b.postingSeq - a.postingSeq;
            return b.createdAt.getTime() - a.createdAt.getTime();
        })
            .slice(0, 10);
        return {
            totalInventoryValueBase: levels.reduce((sum, level) => sum + (level.qtyOnHand * level.avgCostBase), 0),
            totalTrackedItems: items.filter((item) => item.trackInventory).length,
            totalStockLevels: levels.length,
            lowStockAlerts,
            negativeStockCount: levels.filter((level) => level.qtyOnHand < 0).length,
            unsettledMovementsCount: unsettledMovements.length,
            recentMovements,
        };
    }
}
exports.GetInventoryDashboardUseCase = GetInventoryDashboardUseCase;
class GetLowStockAlertsUseCase {
    constructor(stockLevelRepo, itemRepo) {
        this.stockLevelRepo = stockLevelRepo;
        this.itemRepo = itemRepo;
    }
    async execute(companyId) {
        const [levels, items] = await Promise.all([
            this.stockLevelRepo.getAllLevels(companyId),
            this.itemRepo.getCompanyItems(companyId),
        ]);
        const itemMap = new Map(items.map((item) => [item.id, item]));
        return levels
            .map((level) => {
            var _a, _b;
            const item = itemMap.get(level.itemId);
            if (!item || !item.trackInventory)
                return null;
            const threshold = (_a = item.minStockLevel) !== null && _a !== void 0 ? _a : 0;
            const isNegative = level.qtyOnHand < 0;
            const isLow = item.minStockLevel !== undefined && level.qtyOnHand < item.minStockLevel;
            if (!isNegative && !isLow)
                return null;
            const deficit = isNegative
                ? threshold - level.qtyOnHand
                : Math.max(((_b = item.minStockLevel) !== null && _b !== void 0 ? _b : 0) - level.qtyOnHand, 0);
            return {
                itemId: level.itemId,
                itemName: item.name,
                warehouseId: level.warehouseId,
                qtyOnHand: level.qtyOnHand,
                minStockLevel: threshold,
                deficit,
            };
        })
            .filter((row) => row !== null)
            .sort((a, b) => b.deficit - a.deficit);
    }
}
exports.GetLowStockAlertsUseCase = GetLowStockAlertsUseCase;
class GetUnsettledCostReportUseCase {
    constructor(movementRepo) {
        this.movementRepo = movementRepo;
    }
    async execute(companyId, input = {}) {
        var _a, _b;
        const unsettled = await this.movementRepo.getUnsettledMovements(companyId);
        const filtered = (input.itemId
            ? unsettled.filter((movement) => movement.itemId === input.itemId)
            : unsettled).sort((a, b) => {
            if (b.postingSeq !== a.postingSeq)
                return b.postingSeq - a.postingSeq;
            return b.createdAt.getTime() - a.createdAt.getTime();
        });
        const offset = (_a = input.offset) !== null && _a !== void 0 ? _a : 0;
        const limit = (_b = input.limit) !== null && _b !== void 0 ? _b : 50;
        const rows = filtered.slice(offset, offset + limit).map((movement) => {
            var _a;
            return ({
                id: movement.id,
                date: movement.date,
                itemId: movement.itemId,
                warehouseId: movement.warehouseId,
                movementType: movement.movementType,
                qty: movement.qty,
                unsettledQty: (_a = movement.unsettledQty) !== null && _a !== void 0 ? _a : 0,
                unsettledCostBasis: movement.unsettledCostBasis,
                unitCostBase: movement.unitCostBase,
                totalCostBase: movement.totalCostBase,
                referenceType: movement.referenceType,
                referenceId: movement.referenceId,
                createdAt: movement.createdAt,
            });
        });
        return {
            total: filtered.length,
            rows,
        };
    }
}
exports.GetUnsettledCostReportUseCase = GetUnsettledCostReportUseCase;
//# sourceMappingURL=DashboardUseCases.js.map