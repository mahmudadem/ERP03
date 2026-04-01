"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetInventoryValuationUseCase = exports.GetStockLevelsUseCase = void 0;
class GetStockLevelsUseCase {
    constructor(stockLevelRepo) {
        this.stockLevelRepo = stockLevelRepo;
    }
    async execute(companyId, filters = {}) {
        if (filters.itemId) {
            return this.stockLevelRepo.getLevelsByItem(companyId, filters.itemId, {
                limit: filters.limit,
                offset: filters.offset,
            });
        }
        if (filters.warehouseId) {
            return this.stockLevelRepo.getLevelsByWarehouse(companyId, filters.warehouseId, {
                limit: filters.limit,
                offset: filters.offset,
            });
        }
        return this.stockLevelRepo.getAllLevels(companyId, {
            limit: filters.limit,
            offset: filters.offset,
        });
    }
}
exports.GetStockLevelsUseCase = GetStockLevelsUseCase;
class GetInventoryValuationUseCase {
    constructor(stockLevelRepo) {
        this.stockLevelRepo = stockLevelRepo;
    }
    async execute(companyId) {
        const levels = await this.stockLevelRepo.getAllLevels(companyId);
        const detailed = levels.map((level) => ({
            itemId: level.itemId,
            warehouseId: level.warehouseId,
            qtyOnHand: level.qtyOnHand,
            avgCostBase: level.avgCostBase,
            valueBase: level.qtyOnHand * level.avgCostBase,
        }));
        return {
            totalValueBase: detailed.reduce((sum, row) => sum + row.valueBase, 0),
            totalItems: detailed.length,
            levels: detailed,
        };
    }
}
exports.GetInventoryValuationUseCase = GetInventoryValuationUseCase;
//# sourceMappingURL=StockLevelUseCases.js.map