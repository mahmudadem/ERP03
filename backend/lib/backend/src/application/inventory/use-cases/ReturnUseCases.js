"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessReturnUseCase = void 0;
class ProcessReturnUseCase {
    constructor(movementRepo, itemRepo, stockLevelRepo, movementUseCase) {
        this.movementRepo = movementRepo;
        this.itemRepo = itemRepo;
        this.stockLevelRepo = stockLevelRepo;
        this.movementUseCase = movementUseCase;
    }
    async execute(input) {
        var _a, _b;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
            throw new Error('date must be in YYYY-MM-DD format');
        }
        if (input.qty <= 0 || Number.isNaN(input.qty)) {
            throw new Error('qty must be greater than 0');
        }
        const item = await this.itemRepo.getItem(input.itemId);
        if (!item || item.companyId !== input.companyId) {
            throw new Error(`Item not found: ${input.itemId}`);
        }
        if (!item.trackInventory) {
            throw new Error(`Item is not inventory-tracked: ${input.itemId}`);
        }
        const original = await this.movementRepo.getMovement(input.originalMovementId);
        if (original && original.companyId !== input.companyId) {
            throw new Error(`Original movement not found: ${input.originalMovementId}`);
        }
        if (original) {
            if (original.itemId !== input.itemId) {
                throw new Error('Return itemId must match original movement itemId');
            }
            if (original.warehouseId !== input.warehouseId) {
                throw new Error('Return warehouseId must match original movement warehouseId');
            }
        }
        let returnUnitCostBase = 0;
        let returnUnitCostCCY = 0;
        if (original) {
            returnUnitCostBase = original.unitCostBase;
            returnUnitCostCCY = original.unitCostCCY;
        }
        else {
            const level = await this.stockLevelRepo.getLevel(input.companyId, input.itemId, input.warehouseId);
            returnUnitCostBase = (_a = level === null || level === void 0 ? void 0 : level.avgCostBase) !== null && _a !== void 0 ? _a : 0;
            returnUnitCostCCY = (_b = level === null || level === void 0 ? void 0 : level.avgCostCCY) !== null && _b !== void 0 ? _b : 0;
            console.warn(`[Inventory][ProcessReturnUseCase] Original movement not found (${input.originalMovementId}); using current average cost fallback.`);
        }
        if (input.returnType === 'SALES_RETURN') {
            const fx = returnUnitCostCCY > 0 ? returnUnitCostBase / returnUnitCostCCY : 1;
            return this.movementUseCase.processIN({
                companyId: input.companyId,
                itemId: input.itemId,
                warehouseId: input.warehouseId,
                qty: input.qty,
                date: input.date,
                movementType: 'RETURN_IN',
                refs: {
                    type: 'MANUAL',
                    docId: input.originalMovementId,
                    reversesMovementId: input.originalMovementId,
                },
                currentUser: input.currentUser,
                unitCostInMoveCurrency: returnUnitCostCCY,
                moveCurrency: item.costCurrency,
                fxRateMovToBase: fx,
                fxRateCCYToBase: fx,
                notes: input.notes,
                metadata: {
                    source: 'return',
                    returnType: input.returnType,
                    originalMovementId: input.originalMovementId,
                },
            });
        }
        return this.movementUseCase.processOUT({
            companyId: input.companyId,
            itemId: input.itemId,
            warehouseId: input.warehouseId,
            qty: input.qty,
            date: input.date,
            movementType: 'RETURN_OUT',
            refs: {
                type: 'MANUAL',
                docId: input.originalMovementId,
                reversesMovementId: input.originalMovementId,
            },
            currentUser: input.currentUser,
            forcedUnitCostBase: returnUnitCostBase,
            forcedUnitCostCCY: returnUnitCostCCY,
            notes: input.notes,
            metadata: {
                source: 'return',
                returnType: input.returnType,
                originalMovementId: input.originalMovementId,
            },
        });
    }
}
exports.ProcessReturnUseCase = ProcessReturnUseCase;
//# sourceMappingURL=ReturnUseCases.js.map