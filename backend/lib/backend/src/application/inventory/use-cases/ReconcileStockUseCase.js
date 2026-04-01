"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconcileStockUseCase = void 0;
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
class ReconcileStockUseCase {
    constructor(stockLevelRepo, movementRepo) {
        this.stockLevelRepo = stockLevelRepo;
        this.movementRepo = movementRepo;
    }
    async execute(companyId) {
        var _a, _b, _c;
        const [levels, movements] = await Promise.all([
            this.stockLevelRepo.getAllLevels(companyId),
            this.movementRepo.getMovementsByDateRange(companyId, '1900-01-01', '2999-12-31'),
        ]);
        const levelByKey = new Map();
        levels.forEach((level) => levelByKey.set(`${level.itemId}_${level.warehouseId}`, level));
        const movementByKey = new Map();
        for (const movement of movements) {
            const key = `${movement.itemId}_${movement.warehouseId}`;
            const list = movementByKey.get(key) || [];
            list.push(movement);
            movementByKey.set(key, list);
        }
        const allKeys = new Set([
            ...Array.from(levelByKey.keys()),
            ...Array.from(movementByKey.keys()),
        ]);
        const mismatches = [];
        const tolerance = 0.0001;
        for (const key of allKeys) {
            const level = levelByKey.get(key) || null;
            const keyMovements = (movementByKey.get(key) || []).slice().sort((a, b) => {
                if (a.postingSeq !== b.postingSeq)
                    return a.postingSeq - b.postingSeq;
                return a.createdAt.getTime() - b.createdAt.getTime();
            });
            const replayed = this.replayStockState(keyMovements);
            const levelQty = (_a = level === null || level === void 0 ? void 0 : level.qtyOnHand) !== null && _a !== void 0 ? _a : 0;
            const movementQty = replayed.qtyOnHand;
            const difference = levelQty - movementQty;
            const levelAvgCostBase = (_b = level === null || level === void 0 ? void 0 : level.avgCostBase) !== null && _b !== void 0 ? _b : 0;
            const replayAvgCostBase = replayed.avgCostBase;
            const avgCostBaseDifference = levelAvgCostBase - replayAvgCostBase;
            const levelAvgCostCCY = (_c = level === null || level === void 0 ? void 0 : level.avgCostCCY) !== null && _c !== void 0 ? _c : 0;
            const replayAvgCostCCY = replayed.avgCostCCY;
            const avgCostCCYDifference = levelAvgCostCCY - replayAvgCostCCY;
            const hasQtyMismatch = Math.abs(difference) > tolerance;
            const hasAvgMismatch = Math.abs(avgCostBaseDifference) > tolerance ||
                Math.abs(avgCostCCYDifference) > tolerance;
            if (!level || hasQtyMismatch || hasAvgMismatch) {
                const source = level || keyMovements[0];
                if (!source)
                    continue;
                let reason;
                if (!level)
                    reason = 'LEVEL_MISSING';
                else if (hasQtyMismatch && hasAvgMismatch)
                    reason = 'QTY_AND_AVG_MISMATCH';
                else if (hasQtyMismatch)
                    reason = 'QTY_MISMATCH';
                else
                    reason = 'AVG_MISMATCH';
                mismatches.push({
                    key,
                    itemId: source.itemId,
                    warehouseId: source.warehouseId,
                    levelQty,
                    movementQty,
                    difference,
                    levelAvgCostBase,
                    replayAvgCostBase,
                    avgCostBaseDifference,
                    levelAvgCostCCY,
                    replayAvgCostCCY,
                    avgCostCCYDifference,
                    reason,
                });
            }
        }
        return {
            matches: mismatches.length === 0,
            checkedLevels: allKeys.size,
            mismatchCount: mismatches.length,
            mismatches,
        };
    }
    replayStockState(movements) {
        let qtyOnHand = 0;
        let avgCostBase = 0;
        let avgCostCCY = 0;
        let lastCostBase = 0;
        let lastCostCCY = 0;
        for (const movement of movements) {
            if (movement.direction === 'IN') {
                const qtyBefore = qtyOnHand;
                if (qtyBefore <= 0) {
                    avgCostBase = movement.unitCostBase;
                    avgCostCCY = movement.unitCostCCY;
                }
                else {
                    const newQty = qtyBefore + movement.qty;
                    avgCostBase = (0, VoucherLineEntity_1.roundMoney)(((avgCostBase * qtyBefore) + (movement.unitCostBase * movement.qty)) / newQty);
                    avgCostCCY = (0, VoucherLineEntity_1.roundMoney)(((avgCostCCY * qtyBefore) + (movement.unitCostCCY * movement.qty)) / newQty);
                }
                qtyOnHand += movement.qty;
                lastCostBase = movement.unitCostBase;
                lastCostCCY = movement.unitCostCCY;
            }
            else {
                qtyOnHand -= movement.qty;
            }
        }
        return {
            qtyOnHand,
            avgCostBase,
            avgCostCCY,
            lastCostBase,
            lastCostCCY,
        };
    }
}
exports.ReconcileStockUseCase = ReconcileStockUseCase;
//# sourceMappingURL=ReconcileStockUseCase.js.map