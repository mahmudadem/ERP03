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
        });
    }
}
exports.PurchasesInventoryService = PurchasesInventoryService;
//# sourceMappingURL=PurchasesInventoryService.js.map