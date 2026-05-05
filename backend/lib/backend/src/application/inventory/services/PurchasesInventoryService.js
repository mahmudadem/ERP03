"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchasesInventoryService = void 0;
class PurchasesInventoryService {
    constructor(movementUseCase) {
        this.movementUseCase = movementUseCase;
    }
    processIN(input) {
        return this.movementUseCase.processIN({
            companyId: input.companyId,
            itemId: input.itemId,
            warehouseId: input.warehouseId,
            qty: input.qty,
            date: input.date,
            movementType: input.movementType,
            refs: input.refs,
            currentUser: input.currentUser,
            unitCostInMoveCurrency: input.unitCostInMoveCurrency,
            moveCurrency: input.moveCurrency,
            fxRateMovToBase: input.fxRateMovToBase,
            fxRateCCYToBase: input.fxRateCCYToBase,
            notes: input.notes,
            metadata: input.metadata,
            transaction: input.transaction,
            preFetchedLevel: input.preFetchedStockLevel,
        });
    }
    processOUT(input) {
        return this.movementUseCase.processOUT({
            companyId: input.companyId,
            itemId: input.itemId,
            warehouseId: input.warehouseId,
            qty: input.qty,
            date: input.date,
            movementType: input.movementType,
            refs: input.refs,
            currentUser: input.currentUser,
            notes: input.notes,
            metadata: input.metadata,
            transaction: input.transaction,
            preFetchedLevel: input.preFetchedStockLevel,
            preFetchedItem: input.preFetchedItem,
            skipWarehouseValidation: input.skipWarehouseValidation,
        });
    }
    async deleteMovement(companyId, id, transaction) {
        return this.movementUseCase.deleteMovement(companyId, id, transaction);
    }
    preFetchStockLevel(companyId, itemId, warehouseId) {
        return this.movementUseCase.preFetchStockLevel(companyId, itemId, warehouseId);
    }
    writeStockMovement(movement, transaction) {
        return this.movementUseCase.writeStockMovement(movement, transaction);
    }
    writeStockLevel(level, transaction) {
        return this.movementUseCase.writeStockLevel(level, transaction);
    }
}
exports.PurchasesInventoryService = PurchasesInventoryService;
//# sourceMappingURL=PurchasesInventoryService.js.map