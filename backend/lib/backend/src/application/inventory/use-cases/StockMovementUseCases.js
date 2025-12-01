"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferStockBetweenWarehousesUseCase = exports.RecordStockMovementUseCase = void 0;
const StockMovement_1 = require("../../../domain/inventory/entities/StockMovement");
class RecordStockMovementUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(data) {
        const movement = new StockMovement_1.StockMovement(`sm_${Date.now()}`, data.companyId, data.itemId, data.warehouseId, data.qty, data.direction, data.referenceType, data.referenceId, new Date());
        await this.repo.recordMovement(movement);
    }
}
exports.RecordStockMovementUseCase = RecordStockMovementUseCase;
class TransferStockBetweenWarehousesUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(data) {
        const refId = `tx_${Date.now()}`;
        // Out from source
        await this.repo.recordMovement(new StockMovement_1.StockMovement(`sm_out_${Date.now()}`, data.companyId, data.itemId, data.fromWarehouseId, data.qty, 'OUT', 'TRANSFER', refId, new Date()));
        // In to destination
        await this.repo.recordMovement(new StockMovement_1.StockMovement(`sm_in_${Date.now()}`, data.companyId, data.itemId, data.toWarehouseId, data.qty, 'IN', 'TRANSFER', refId, new Date()));
    }
}
exports.TransferStockBetweenWarehousesUseCase = TransferStockBetweenWarehousesUseCase;
//# sourceMappingURL=StockMovementUseCases.js.map