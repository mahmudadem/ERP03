"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCurrentCostUseCase = void 0;
class GetCurrentCostUseCase {
    constructor(itemRepo, stockLevelRepo) {
        this.itemRepo = itemRepo;
        this.stockLevelRepo = stockLevelRepo;
    }
    async execute(companyId, itemId, warehouseId) {
        var _a, _b, _c, _d, _e;
        if (!(itemId === null || itemId === void 0 ? void 0 : itemId.trim()))
            throw new Error('itemId is required');
        if (!(warehouseId === null || warehouseId === void 0 ? void 0 : warehouseId.trim()))
            throw new Error('warehouseId is required');
        const item = await this.itemRepo.getItem(itemId);
        if (!item || item.companyId !== companyId) {
            throw new Error(`Item not found: ${itemId}`);
        }
        const level = await this.stockLevelRepo.getLevel(companyId, itemId, warehouseId);
        const qtyOnHand = (_a = level === null || level === void 0 ? void 0 : level.qtyOnHand) !== null && _a !== void 0 ? _a : 0;
        const avgCostBase = (_b = level === null || level === void 0 ? void 0 : level.avgCostBase) !== null && _b !== void 0 ? _b : 0;
        const avgCostCCY = (_c = level === null || level === void 0 ? void 0 : level.avgCostCCY) !== null && _c !== void 0 ? _c : 0;
        const lastCostBase = (_d = level === null || level === void 0 ? void 0 : level.lastCostBase) !== null && _d !== void 0 ? _d : 0;
        const lastCostCCY = (_e = level === null || level === void 0 ? void 0 : level.lastCostCCY) !== null && _e !== void 0 ? _e : 0;
        let costBasis = 'MISSING';
        if (qtyOnHand > 0) {
            costBasis = 'AVG';
        }
        else if (lastCostBase > 0) {
            costBasis = 'LAST_KNOWN';
        }
        return {
            qtyOnHand,
            avgCostBase,
            avgCostCCY,
            lastCostBase,
            lastCostCCY,
            costBasis,
        };
    }
}
exports.GetCurrentCostUseCase = GetCurrentCostUseCase;
//# sourceMappingURL=CostQueryUseCases.js.map