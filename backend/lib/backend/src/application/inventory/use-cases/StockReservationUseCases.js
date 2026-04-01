"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseReservedStockUseCase = exports.ReserveStockUseCase = void 0;
const StockLevel_1 = require("../../../domain/inventory/entities/StockLevel");
const validateReservationInput = (input) => {
    var _a, _b;
    if (!((_a = input.itemId) === null || _a === void 0 ? void 0 : _a.trim()))
        throw new Error('itemId is required');
    if (!((_b = input.warehouseId) === null || _b === void 0 ? void 0 : _b.trim()))
        throw new Error('warehouseId is required');
    if (input.qty <= 0 || Number.isNaN(input.qty)) {
        throw new Error('qty must be greater than 0');
    }
};
class ReserveStockUseCase {
    constructor(stockLevelRepo, transactionManager) {
        this.stockLevelRepo = stockLevelRepo;
        this.transactionManager = transactionManager;
    }
    async execute(input) {
        validateReservationInput(input);
        return this.transactionManager.runTransaction(async (txn) => {
            let level = await this.stockLevelRepo.getLevelInTransaction(txn, input.companyId, input.itemId, input.warehouseId);
            if (!level) {
                level = StockLevel_1.StockLevel.createNew(input.companyId, input.itemId, input.warehouseId);
            }
            level.reservedQty += input.qty;
            level.version += 1;
            level.updatedAt = new Date();
            await this.stockLevelRepo.upsertLevelInTransaction(txn, level);
            return level;
        });
    }
}
exports.ReserveStockUseCase = ReserveStockUseCase;
class ReleaseReservedStockUseCase {
    constructor(stockLevelRepo, transactionManager) {
        this.stockLevelRepo = stockLevelRepo;
        this.transactionManager = transactionManager;
    }
    async execute(input) {
        validateReservationInput(input);
        return this.transactionManager.runTransaction(async (txn) => {
            const level = await this.stockLevelRepo.getLevelInTransaction(txn, input.companyId, input.itemId, input.warehouseId);
            if (!level) {
                throw new Error(`Stock level not found for reservation release: ${input.itemId}_${input.warehouseId}`);
            }
            const nextReservedQty = level.reservedQty - input.qty;
            if (nextReservedQty < 0) {
                throw new Error('reservedQty cannot drop below 0');
            }
            level.reservedQty = nextReservedQty;
            level.version += 1;
            level.updatedAt = new Date();
            await this.stockLevelRepo.upsertLevelInTransaction(txn, level);
            return level;
        });
    }
}
exports.ReleaseReservedStockUseCase = ReleaseReservedStockUseCase;
//# sourceMappingURL=StockReservationUseCases.js.map