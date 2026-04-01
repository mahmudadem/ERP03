"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferStockBetweenWarehousesUseCase = exports.RecordStockMovementUseCase = void 0;
const StockMovement_1 = require("../../../domain/inventory/entities/StockMovement");
const mapReferenceType = (input) => {
    switch (input) {
        case 'ADJUSTMENT':
            return 'STOCK_ADJUSTMENT';
        case 'TRANSFER':
            return 'STOCK_TRANSFER';
        case 'VOUCHER':
        case 'POS_ORDER':
        default:
            return 'MANUAL';
    }
};
const mapMovementType = (direction, referenceType) => {
    if (referenceType === 'STOCK_TRANSFER') {
        return direction === 'IN' ? 'TRANSFER_IN' : 'TRANSFER_OUT';
    }
    return direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
};
const mapCostSource = (movementType) => {
    if (movementType === 'TRANSFER_IN' || movementType === 'TRANSFER_OUT')
        return 'TRANSFER';
    return 'ADJUSTMENT';
};
class RecordStockMovementUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(data) {
        const now = new Date();
        const referenceType = mapReferenceType(data.referenceType);
        const movementType = mapMovementType(data.direction, referenceType);
        const qtyAfter = data.direction === 'IN' ? data.qty : -data.qty;
        const movement = new StockMovement_1.StockMovement({
            id: `sm_${Date.now()}`,
            companyId: data.companyId,
            date: now.toISOString().slice(0, 10),
            postingSeq: 1,
            createdAt: now,
            createdBy: 'SYSTEM',
            postedAt: now,
            itemId: data.itemId,
            warehouseId: data.warehouseId,
            direction: data.direction,
            movementType,
            qty: data.qty,
            uom: 'pcs',
            referenceType,
            referenceId: data.referenceId,
            unitCostBase: 0,
            totalCostBase: 0,
            unitCostCCY: 0,
            totalCostCCY: 0,
            movementCurrency: 'USD',
            fxRateMovToBase: 1,
            fxRateCCYToBase: 1,
            fxRateKind: data.direction === 'IN' ? 'DOCUMENT' : 'EFFECTIVE',
            avgCostBaseAfter: 0,
            avgCostCCYAfter: 0,
            qtyBefore: 0,
            qtyAfter,
            settledQty: data.direction === 'OUT' ? 0 : undefined,
            unsettledQty: data.direction === 'OUT' ? data.qty : undefined,
            unsettledCostBasis: data.direction === 'OUT' ? 'MISSING' : undefined,
            settlesNegativeQty: data.direction === 'IN' ? 0 : undefined,
            newPositiveQty: data.direction === 'IN' ? data.qty : undefined,
            negativeQtyAtPosting: qtyAfter < 0,
            costSettled: data.direction === 'IN',
            isBackdated: false,
            costSource: mapCostSource(movementType),
        });
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
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        // Out from source
        await this.repo.recordMovement(new StockMovement_1.StockMovement({
            id: `sm_out_${Date.now()}`,
            companyId: data.companyId,
            date,
            postingSeq: 1,
            createdAt: now,
            createdBy: 'SYSTEM',
            postedAt: now,
            itemId: data.itemId,
            warehouseId: data.fromWarehouseId,
            direction: 'OUT',
            movementType: 'TRANSFER_OUT',
            qty: data.qty,
            uom: 'pcs',
            referenceType: 'STOCK_TRANSFER',
            referenceId: refId,
            transferPairId: refId,
            unitCostBase: 0,
            totalCostBase: 0,
            unitCostCCY: 0,
            totalCostCCY: 0,
            movementCurrency: 'USD',
            fxRateMovToBase: 1,
            fxRateCCYToBase: 1,
            fxRateKind: 'EFFECTIVE',
            avgCostBaseAfter: 0,
            avgCostCCYAfter: 0,
            qtyBefore: 0,
            qtyAfter: -data.qty,
            settledQty: 0,
            unsettledQty: data.qty,
            unsettledCostBasis: 'MISSING',
            negativeQtyAtPosting: true,
            costSettled: false,
            isBackdated: false,
            costSource: 'TRANSFER',
        }));
        // In to destination
        await this.repo.recordMovement(new StockMovement_1.StockMovement({
            id: `sm_in_${Date.now()}`,
            companyId: data.companyId,
            date,
            postingSeq: 1,
            createdAt: now,
            createdBy: 'SYSTEM',
            postedAt: now,
            itemId: data.itemId,
            warehouseId: data.toWarehouseId,
            direction: 'IN',
            movementType: 'TRANSFER_IN',
            qty: data.qty,
            uom: 'pcs',
            referenceType: 'STOCK_TRANSFER',
            referenceId: refId,
            transferPairId: refId,
            unitCostBase: 0,
            totalCostBase: 0,
            unitCostCCY: 0,
            totalCostCCY: 0,
            movementCurrency: 'USD',
            fxRateMovToBase: 1,
            fxRateCCYToBase: 1,
            fxRateKind: 'EFFECTIVE',
            avgCostBaseAfter: 0,
            avgCostCCYAfter: 0,
            qtyBefore: 0,
            qtyAfter: data.qty,
            settlesNegativeQty: 0,
            newPositiveQty: data.qty,
            negativeQtyAtPosting: false,
            costSettled: true,
            isBackdated: false,
            costSource: 'TRANSFER',
        }));
    }
}
exports.TransferStockBetweenWarehousesUseCase = TransferStockBetweenWarehousesUseCase;
//# sourceMappingURL=StockMovementUseCases.js.map