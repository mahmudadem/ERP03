"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAsOfValuationUseCase = exports.CreatePeriodSnapshotUseCase = void 0;
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const InventoryPeriodSnapshot_1 = require("../../../domain/inventory/entities/InventoryPeriodSnapshot");
const buildLevelKey = (itemId, warehouseId) => `${itemId}__${warehouseId}`;
const isValidPeriodKey = (value) => /^\d{4}-\d{2}$/.test(value);
const isValidIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const getPeriodEndDate = (periodKey) => {
    const [yearRaw, monthRaw] = periodKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${yearRaw}-${monthRaw}-${String(lastDay).padStart(2, '0')}`;
};
class CreatePeriodSnapshotUseCase {
    constructor(stockLevelRepo, snapshotRepo) {
        this.stockLevelRepo = stockLevelRepo;
        this.snapshotRepo = snapshotRepo;
    }
    async execute(input) {
        if (!isValidPeriodKey(input.periodKey)) {
            throw new Error('periodKey must be in YYYY-MM format');
        }
        const periodEndDate = getPeriodEndDate(input.periodKey);
        const levels = await this.stockLevelRepo.getAllLevels(input.companyId);
        const snapshotData = levels.map((level) => ({
            itemId: level.itemId,
            warehouseId: level.warehouseId,
            qtyOnHand: level.qtyOnHand,
            avgCostBase: level.avgCostBase,
            avgCostCCY: level.avgCostCCY,
            lastCostBase: level.lastCostBase,
            lastCostCCY: level.lastCostCCY,
            valueBase: (0, VoucherLineEntity_1.roundMoney)(level.qtyOnHand * level.avgCostBase),
        }));
        const totalValueBase = (0, VoucherLineEntity_1.roundMoney)(snapshotData.reduce((sum, line) => sum + line.valueBase, 0));
        const snapshot = new InventoryPeriodSnapshot_1.InventoryPeriodSnapshot({
            id: `${input.companyId}_${input.periodKey}`,
            companyId: input.companyId,
            periodKey: input.periodKey,
            periodEndDate,
            snapshotData,
            totalValueBase,
            totalItems: snapshotData.length,
            createdAt: new Date(),
        });
        await this.snapshotRepo.saveSnapshot(snapshot);
        return snapshot;
    }
}
exports.CreatePeriodSnapshotUseCase = CreatePeriodSnapshotUseCase;
class GetAsOfValuationUseCase {
    constructor(snapshotRepo, movementRepo) {
        this.snapshotRepo = snapshotRepo;
        this.movementRepo = movementRepo;
    }
    async execute(input) {
        if (!isValidIsoDate(input.asOfDate)) {
            throw new Error('asOfDate must be in YYYY-MM-DD format');
        }
        const snapshot = await this.snapshotRepo.findNearestSnapshotForDate(input.companyId, input.asOfDate);
        const state = new Map();
        if (snapshot) {
            snapshot.snapshotData.forEach((line) => {
                const key = buildLevelKey(line.itemId, line.warehouseId);
                state.set(key, {
                    itemId: line.itemId,
                    warehouseId: line.warehouseId,
                    qtyOnHand: line.qtyOnHand,
                    avgCostBase: line.avgCostBase,
                    avgCostCCY: line.avgCostCCY,
                    lastCostBase: line.lastCostBase,
                    lastCostCCY: line.lastCostCCY,
                });
            });
        }
        let movements = await this.movementRepo.getMovementsByDateRange(input.companyId, '1900-01-01', input.asOfDate);
        if (snapshot) {
            movements = movements.filter((movement) => movement.postedAt > snapshot.createdAt);
        }
        movements.sort((a, b) => {
            const keyA = buildLevelKey(a.itemId, a.warehouseId);
            const keyB = buildLevelKey(b.itemId, b.warehouseId);
            if (keyA !== keyB)
                return keyA.localeCompare(keyB);
            return a.postingSeq - b.postingSeq;
        });
        for (const movement of movements) {
            if (movement.date > input.asOfDate)
                continue;
            const key = buildLevelKey(movement.itemId, movement.warehouseId);
            const current = state.get(key) || {
                itemId: movement.itemId,
                warehouseId: movement.warehouseId,
                qtyOnHand: 0,
                avgCostBase: 0,
                avgCostCCY: 0,
                lastCostBase: 0,
                lastCostCCY: 0,
            };
            if (movement.direction === 'IN') {
                const qtyBefore = current.qtyOnHand;
                if (qtyBefore <= 0) {
                    current.avgCostBase = movement.unitCostBase;
                    current.avgCostCCY = movement.unitCostCCY;
                }
                else {
                    const newQty = qtyBefore + movement.qty;
                    if (newQty !== 0) {
                        current.avgCostBase = (0, VoucherLineEntity_1.roundMoney)(((current.avgCostBase * qtyBefore) + (movement.unitCostBase * movement.qty)) / newQty);
                        current.avgCostCCY = (0, VoucherLineEntity_1.roundMoney)(((current.avgCostCCY * qtyBefore) + (movement.unitCostCCY * movement.qty)) / newQty);
                    }
                }
                current.qtyOnHand += movement.qty;
                current.lastCostBase = movement.unitCostBase;
                current.lastCostCCY = movement.unitCostCCY;
            }
            else {
                current.qtyOnHand -= movement.qty;
            }
            state.set(key, current);
        }
        const items = Array.from(state.values())
            .map((line) => (Object.assign(Object.assign({}, line), { valueBase: (0, VoucherLineEntity_1.roundMoney)(line.qtyOnHand * line.avgCostBase) })))
            .sort((a, b) => {
            if (a.itemId !== b.itemId)
                return a.itemId.localeCompare(b.itemId);
            return a.warehouseId.localeCompare(b.warehouseId);
        });
        const totalValueBase = (0, VoucherLineEntity_1.roundMoney)(items.reduce((sum, line) => sum + line.valueBase, 0));
        return {
            asOfDate: input.asOfDate,
            snapshotPeriodKey: snapshot === null || snapshot === void 0 ? void 0 : snapshot.periodKey,
            totalValueBase,
            totalItems: items.length,
            items,
        };
    }
}
exports.GetAsOfValuationUseCase = GetAsOfValuationUseCase;
//# sourceMappingURL=PeriodSnapshotUseCases.js.map