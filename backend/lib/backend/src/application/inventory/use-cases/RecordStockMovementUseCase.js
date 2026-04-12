"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordStockMovementUseCase = void 0;
const crypto_1 = require("crypto");
const CurrencyPrecisionHelpers_1 = require("../../../domain/accounting/entities/CurrencyPrecisionHelpers");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const StockMovement_1 = require("../../../domain/inventory/entities/StockMovement");
const StockLevel_1 = require("../../../domain/inventory/entities/StockLevel");
class RecordStockMovementUseCase {
    constructor(deps) {
        this.deps = deps;
    }
    async processIN(input) {
        this.validateDate(input.date);
        this.validateQty(input.qty);
        const { item, baseCurrency } = await this.loadItemContext(input.companyId, input.itemId);
        await this.ensureWarehouseExists(input.warehouseId);
        const converted = this.convertCosts(input.unitCostInMoveCurrency, input.moveCurrency, baseCurrency, item.costCurrency, input.fxRateMovToBase, input.fxRateCCYToBase);
        const execute = async (txn) => {
            const level = await this.getOrCreateStockLevel(txn, input.companyId, item.id, input.warehouseId);
            const qtyBefore = level.qtyOnHand;
            const oldMaxBusinessDate = level.maxBusinessDate;
            const settlesNegativeQty = Math.min(input.qty, Math.max(-qtyBefore, 0));
            const newPositiveQty = input.qty - settlesNegativeQty;
            let newAvgBase = converted.unitCostBase;
            let newAvgCCY = converted.unitCostCCY;
            if (qtyBefore > 0) {
                const newQty = qtyBefore + input.qty;
                newAvgBase = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(((level.avgCostBase * qtyBefore) + (converted.unitCostBase * input.qty)) / newQty, baseCurrency);
                newAvgCCY = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(((level.avgCostCCY * qtyBefore) + (converted.unitCostCCY * input.qty)) / newQty, item.costCurrency);
            }
            level.qtyOnHand += input.qty;
            level.avgCostBase = newAvgBase;
            level.avgCostCCY = newAvgCCY;
            level.lastCostBase = converted.unitCostBase;
            level.lastCostCCY = converted.unitCostCCY;
            level.postingSeq += 1;
            level.version += 1;
            level.totalMovements += 1;
            level.maxBusinessDate = this.maxDate(oldMaxBusinessDate, input.date);
            level.updatedAt = new Date();
            const qtyAfter = level.qtyOnHand;
            const isBackdated = input.date < oldMaxBusinessDate;
            const now = new Date();
            const movement = new StockMovement_1.StockMovement({
                id: this.generateMovementId(),
                companyId: input.companyId,
                date: input.date,
                postingSeq: level.postingSeq,
                createdAt: now,
                createdBy: input.currentUser,
                postedAt: now,
                itemId: item.id,
                warehouseId: input.warehouseId,
                direction: 'IN',
                movementType: input.movementType,
                qty: input.qty,
                uom: item.baseUom,
                referenceType: input.refs.type,
                referenceId: input.refs.docId,
                referenceLineId: input.refs.lineId,
                reversesMovementId: input.refs.reversesMovementId,
                transferPairId: input.refs.transferPairId,
                unitCostBase: converted.unitCostBase,
                totalCostBase: (0, VoucherLineEntity_1.roundMoney)(converted.unitCostBase * input.qty),
                unitCostCCY: converted.unitCostCCY,
                totalCostCCY: (0, VoucherLineEntity_1.roundMoney)(converted.unitCostCCY * input.qty),
                movementCurrency: input.moveCurrency.toUpperCase(),
                fxRateMovToBase: input.fxRateMovToBase,
                fxRateCCYToBase: converted.fxRateCCYToBase,
                fxRateKind: 'DOCUMENT',
                avgCostBaseAfter: newAvgBase,
                avgCostCCYAfter: newAvgCCY,
                qtyBefore,
                qtyAfter,
                settlesNegativeQty,
                newPositiveQty,
                negativeQtyAtPosting: qtyAfter < 0,
                costSettled: true,
                isBackdated,
                costSource: this.deriveCostSource(input.movementType),
                notes: input.notes,
                metadata: input.metadata,
            });
            level.lastMovementId = movement.id;
            await this.deps.stockLevelRepository.upsertLevelInTransaction(txn, level);
            await this.deps.stockMovementRepository.recordMovement(movement, txn);
            return movement;
        };
        if (input.transaction) {
            return execute(input.transaction);
        }
        return this.deps.transactionManager.runTransaction(async (txn) => execute(txn));
    }
    async processOUT(input) {
        this.validateDate(input.date);
        this.validateQty(input.qty);
        const { item } = await this.loadItemContext(input.companyId, input.itemId);
        await this.ensureWarehouseExists(input.warehouseId);
        const execute = async (txn) => {
            var _a, _b;
            const level = await this.getOrCreateStockLevel(txn, input.companyId, item.id, input.warehouseId);
            const qtyBefore = level.qtyOnHand;
            const oldMaxBusinessDate = level.maxBusinessDate;
            let issueCostBase = 0;
            let issueCostCCY = 0;
            let costBasis = 'MISSING';
            const hasForcedCost = input.forcedUnitCostBase !== undefined || input.forcedUnitCostCCY !== undefined;
            if (hasForcedCost) {
                const forcedBase = (_a = input.forcedUnitCostBase) !== null && _a !== void 0 ? _a : 0;
                const forcedCCY = (_b = input.forcedUnitCostCCY) !== null && _b !== void 0 ? _b : 0;
                if (forcedBase < 0 || Number.isNaN(forcedBase) || forcedCCY < 0 || Number.isNaN(forcedCCY)) {
                    throw new Error('Forced OUT costs must be valid non-negative numbers');
                }
                issueCostBase = forcedBase;
                issueCostCCY = forcedCCY;
                costBasis = issueCostBase > 0 || issueCostCCY > 0 ? 'AVG' : 'MISSING';
            }
            else if (qtyBefore > 0) {
                issueCostBase = level.avgCostBase;
                issueCostCCY = level.avgCostCCY;
                costBasis = 'AVG';
            }
            else if (level.lastCostBase > 0) {
                issueCostBase = level.lastCostBase;
                issueCostCCY = level.lastCostCCY;
                costBasis = 'LAST_KNOWN';
            }
            const settledQty = Math.min(input.qty, Math.max(qtyBefore, 0));
            const unsettledQty = input.qty - settledQty;
            const costSettled = unsettledQty === 0;
            const effectiveFxCCYToBase = issueCostCCY > 0 ? issueCostBase / issueCostCCY : 1.0;
            level.qtyOnHand -= input.qty;
            level.postingSeq += 1;
            level.version += 1;
            level.totalMovements += 1;
            level.maxBusinessDate = this.maxDate(oldMaxBusinessDate, input.date);
            level.updatedAt = new Date();
            const qtyAfter = level.qtyOnHand;
            const isBackdated = input.date < oldMaxBusinessDate;
            const now = new Date();
            const movement = new StockMovement_1.StockMovement({
                id: this.generateMovementId(),
                companyId: input.companyId,
                date: input.date,
                postingSeq: level.postingSeq,
                createdAt: now,
                createdBy: input.currentUser,
                postedAt: now,
                itemId: item.id,
                warehouseId: input.warehouseId,
                direction: 'OUT',
                movementType: input.movementType,
                qty: input.qty,
                uom: item.baseUom,
                referenceType: input.refs.type,
                referenceId: input.refs.docId,
                referenceLineId: input.refs.lineId,
                reversesMovementId: input.refs.reversesMovementId,
                transferPairId: input.refs.transferPairId,
                unitCostBase: issueCostBase,
                totalCostBase: (0, VoucherLineEntity_1.roundMoney)(issueCostBase * input.qty),
                unitCostCCY: issueCostCCY,
                totalCostCCY: (0, VoucherLineEntity_1.roundMoney)(issueCostCCY * input.qty),
                movementCurrency: item.costCurrency,
                fxRateMovToBase: effectiveFxCCYToBase,
                fxRateCCYToBase: effectiveFxCCYToBase,
                fxRateKind: 'EFFECTIVE',
                avgCostBaseAfter: level.avgCostBase,
                avgCostCCYAfter: level.avgCostCCY,
                qtyBefore,
                qtyAfter,
                settledQty,
                unsettledQty,
                unsettledCostBasis: unsettledQty > 0 ? costBasis : undefined,
                negativeQtyAtPosting: qtyAfter < 0,
                costSettled,
                isBackdated,
                costSource: this.deriveCostSource(input.movementType),
                notes: input.notes,
                metadata: input.metadata,
            });
            level.lastMovementId = movement.id;
            await this.deps.stockLevelRepository.upsertLevelInTransaction(txn, level);
            await this.deps.stockMovementRepository.recordMovement(movement, txn);
            return movement;
        };
        if (input.transaction) {
            return execute(input.transaction);
        }
        return this.deps.transactionManager.runTransaction(async (txn) => execute(txn));
    }
    async processTRANSFER(input) {
        this.validateDate(input.date);
        this.validateQty(input.qty);
        if (input.sourceWarehouseId === input.destinationWarehouseId) {
            throw new Error('Source and destination warehouses must be different');
        }
        const { item } = await this.loadItemContext(input.companyId, input.itemId);
        await this.ensureWarehouseExists(input.sourceWarehouseId);
        await this.ensureWarehouseExists(input.destinationWarehouseId);
        const executeTransfer = async (txn) => {
            var _a;
            const pairId = ((_a = input.transferPairId) === null || _a === void 0 ? void 0 : _a.trim()) || (0, crypto_1.randomUUID)();
            const now = new Date();
            const srcLevel = await this.getOrCreateStockLevel(txn, input.companyId, item.id, input.sourceWarehouseId);
            const srcQtyBefore = srcLevel.qtyOnHand;
            const srcOldMaxDate = srcLevel.maxBusinessDate;
            let transferCostBase = 0;
            let transferCostCCY = 0;
            let srcCostBasis = 'MISSING';
            if (srcQtyBefore > 0) {
                transferCostBase = srcLevel.avgCostBase;
                transferCostCCY = srcLevel.avgCostCCY;
                srcCostBasis = 'AVG';
            }
            else if (srcLevel.lastCostBase > 0) {
                transferCostBase = srcLevel.lastCostBase;
                transferCostCCY = srcLevel.lastCostCCY;
                srcCostBasis = 'LAST_KNOWN';
            }
            const srcSettledQty = Math.min(input.qty, Math.max(srcQtyBefore, 0));
            const srcUnsettledQty = input.qty - srcSettledQty;
            srcLevel.qtyOnHand -= input.qty;
            srcLevel.postingSeq += 1;
            srcLevel.version += 1;
            srcLevel.totalMovements += 1;
            srcLevel.maxBusinessDate = this.maxDate(srcOldMaxDate, input.date);
            srcLevel.updatedAt = now;
            const srcQtyAfter = srcLevel.qtyOnHand;
            const srcIsBackdated = input.date < srcOldMaxDate;
            const srcFxRate = transferCostCCY > 0 ? transferCostBase / transferCostCCY : 1.0;
            const outMov = new StockMovement_1.StockMovement({
                id: this.generateMovementId(),
                companyId: input.companyId,
                date: input.date,
                postingSeq: srcLevel.postingSeq,
                createdAt: now,
                createdBy: input.currentUser,
                postedAt: now,
                itemId: item.id,
                warehouseId: input.sourceWarehouseId,
                direction: 'OUT',
                movementType: 'TRANSFER_OUT',
                qty: input.qty,
                uom: item.baseUom,
                referenceType: 'STOCK_TRANSFER',
                referenceId: input.transferDocId,
                transferPairId: pairId,
                unitCostBase: transferCostBase,
                totalCostBase: (0, VoucherLineEntity_1.roundMoney)(transferCostBase * input.qty),
                unitCostCCY: transferCostCCY,
                totalCostCCY: (0, VoucherLineEntity_1.roundMoney)(transferCostCCY * input.qty),
                movementCurrency: item.costCurrency,
                fxRateMovToBase: srcFxRate,
                fxRateCCYToBase: srcFxRate,
                fxRateKind: 'EFFECTIVE',
                avgCostBaseAfter: srcLevel.avgCostBase,
                avgCostCCYAfter: srcLevel.avgCostCCY,
                qtyBefore: srcQtyBefore,
                qtyAfter: srcQtyAfter,
                settledQty: srcSettledQty,
                unsettledQty: srcUnsettledQty,
                unsettledCostBasis: srcUnsettledQty > 0 ? srcCostBasis : undefined,
                negativeQtyAtPosting: srcQtyAfter < 0,
                costSettled: srcUnsettledQty === 0,
                isBackdated: srcIsBackdated,
                costSource: 'TRANSFER',
                notes: input.notes,
                metadata: input.metadata,
            });
            srcLevel.lastMovementId = outMov.id;
            const dstLevel = await this.getOrCreateStockLevel(txn, input.companyId, item.id, input.destinationWarehouseId);
            const dstQtyBefore = dstLevel.qtyOnHand;
            const dstOldMaxDate = dstLevel.maxBusinessDate;
            const dstSettlesNegativeQty = Math.min(input.qty, Math.max(-dstQtyBefore, 0));
            const dstNewPositiveQty = input.qty - dstSettlesNegativeQty;
            if (dstQtyBefore <= 0) {
                dstLevel.avgCostBase = transferCostBase;
                dstLevel.avgCostCCY = transferCostCCY;
            }
            else {
                const newQty = dstQtyBefore + input.qty;
                dstLevel.avgCostBase = (0, VoucherLineEntity_1.roundMoney)(((dstLevel.avgCostBase * dstQtyBefore) + (transferCostBase * input.qty)) / newQty);
                dstLevel.avgCostCCY = (0, VoucherLineEntity_1.roundMoney)(((dstLevel.avgCostCCY * dstQtyBefore) + (transferCostCCY * input.qty)) / newQty);
            }
            dstLevel.qtyOnHand += input.qty;
            dstLevel.lastCostBase = transferCostBase;
            dstLevel.lastCostCCY = transferCostCCY;
            dstLevel.postingSeq += 1;
            dstLevel.version += 1;
            dstLevel.totalMovements += 1;
            dstLevel.maxBusinessDate = this.maxDate(dstOldMaxDate, input.date);
            dstLevel.updatedAt = now;
            const dstQtyAfter = dstLevel.qtyOnHand;
            const dstIsBackdated = input.date < dstOldMaxDate;
            const inMov = new StockMovement_1.StockMovement({
                id: this.generateMovementId(),
                companyId: input.companyId,
                date: input.date,
                postingSeq: dstLevel.postingSeq,
                createdAt: now,
                createdBy: input.currentUser,
                postedAt: now,
                itemId: item.id,
                warehouseId: input.destinationWarehouseId,
                direction: 'IN',
                movementType: 'TRANSFER_IN',
                qty: input.qty,
                uom: item.baseUom,
                referenceType: 'STOCK_TRANSFER',
                referenceId: input.transferDocId,
                transferPairId: pairId,
                unitCostBase: transferCostBase,
                totalCostBase: (0, VoucherLineEntity_1.roundMoney)(transferCostBase * input.qty),
                unitCostCCY: transferCostCCY,
                totalCostCCY: (0, VoucherLineEntity_1.roundMoney)(transferCostCCY * input.qty),
                movementCurrency: item.costCurrency,
                fxRateMovToBase: srcFxRate,
                fxRateCCYToBase: srcFxRate,
                fxRateKind: 'EFFECTIVE',
                avgCostBaseAfter: dstLevel.avgCostBase,
                avgCostCCYAfter: dstLevel.avgCostCCY,
                qtyBefore: dstQtyBefore,
                qtyAfter: dstQtyAfter,
                settlesNegativeQty: dstSettlesNegativeQty,
                newPositiveQty: dstNewPositiveQty,
                negativeQtyAtPosting: dstQtyAfter < 0,
                costSettled: true,
                isBackdated: dstIsBackdated,
                costSource: 'TRANSFER',
                notes: input.notes,
                metadata: input.metadata,
            });
            dstLevel.lastMovementId = inMov.id;
            await this.deps.stockLevelRepository.upsertLevelInTransaction(txn, srcLevel);
            await this.deps.stockLevelRepository.upsertLevelInTransaction(txn, dstLevel);
            await this.deps.stockMovementRepository.recordMovement(outMov, txn);
            await this.deps.stockMovementRepository.recordMovement(inMov, txn);
            return { outMov, inMov };
        };
        if (input.transaction) {
            return executeTransfer(input.transaction);
        }
        return this.deps.transactionManager.runTransaction(async (txn) => executeTransfer(txn));
    }
    convertCosts(unitCostInMoveCurrency, moveCurrency, baseCurrency, costCurrency, fxRateMovToBase, fxRateCCYToBase) {
        const move = moveCurrency.toUpperCase();
        const base = baseCurrency.toUpperCase();
        const cost = costCurrency.toUpperCase();
        if (unitCostInMoveCurrency < 0 || Number.isNaN(unitCostInMoveCurrency)) {
            throw new Error('unitCostInMoveCurrency must be a valid non-negative number');
        }
        if (fxRateMovToBase <= 0 || Number.isNaN(fxRateMovToBase)) {
            throw new Error('fxRateMovToBase must be greater than 0');
        }
        if (fxRateCCYToBase <= 0 || Number.isNaN(fxRateCCYToBase)) {
            throw new Error('fxRateCCYToBase must be greater than 0');
        }
        let unitCostBase = 0;
        let unitCostCCY = 0;
        let adjustedFxCCYToBase = fxRateCCYToBase;
        if (move === base) {
            unitCostBase = unitCostInMoveCurrency;
            unitCostCCY = unitCostBase / adjustedFxCCYToBase;
        }
        else if (move === cost) {
            unitCostCCY = unitCostInMoveCurrency;
            unitCostBase = unitCostCCY * adjustedFxCCYToBase;
        }
        else {
            unitCostBase = unitCostInMoveCurrency * fxRateMovToBase;
            unitCostCCY = unitCostInMoveCurrency * (fxRateMovToBase / adjustedFxCCYToBase);
        }
        if (cost === base) {
            unitCostCCY = unitCostBase;
            adjustedFxCCYToBase = 1.0;
        }
        unitCostBase = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(unitCostBase, base);
        unitCostCCY = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(unitCostCCY, cost);
        return { unitCostBase, unitCostCCY, fxRateCCYToBase: adjustedFxCCYToBase };
    }
    deriveCostSource(movementType) {
        switch (movementType) {
            case 'PURCHASE_RECEIPT':
                return 'PURCHASE';
            case 'OPENING_STOCK':
                return 'OPENING';
            case 'ADJUSTMENT_IN':
            case 'ADJUSTMENT_OUT':
                return 'ADJUSTMENT';
            case 'TRANSFER_IN':
            case 'TRANSFER_OUT':
                return 'TRANSFER';
            case 'RETURN_IN':
            case 'RETURN_OUT':
                return 'RETURN';
            case 'SALES_DELIVERY':
                return 'PURCHASE';
            default:
                return 'SETTLEMENT';
        }
    }
    async getOrCreateStockLevel(transaction, companyId, itemId, warehouseId) {
        const existing = await this.deps.stockLevelRepository.getLevelInTransaction(transaction, companyId, itemId, warehouseId);
        if (existing)
            return existing;
        return StockLevel_1.StockLevel.createNew(companyId, itemId, warehouseId);
    }
    async loadItemContext(companyId, itemId) {
        const [item, company] = await Promise.all([
            this.deps.itemRepository.getItem(itemId),
            this.deps.companyRepository.findById(companyId),
        ]);
        if (!item || item.companyId !== companyId) {
            throw new Error(`Item not found: ${itemId}`);
        }
        if (!company) {
            throw new Error(`Company not found: ${companyId}`);
        }
        return { item, baseCurrency: company.baseCurrency };
    }
    async ensureWarehouseExists(warehouseId) {
        const warehouse = await this.deps.warehouseRepository.getWarehouse(warehouseId);
        if (!warehouse) {
            throw new Error(`Warehouse not found: ${warehouseId}`);
        }
    }
    validateDate(date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error('date must be in YYYY-MM-DD format');
        }
    }
    validateQty(qty) {
        if (qty <= 0 || Number.isNaN(qty)) {
            throw new Error('qty must be greater than 0');
        }
    }
    generateMovementId() {
        return `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    maxDate(a, b) {
        return b > a ? b : a;
    }
    rebuildLevelFromMovements(currentLevel, remainingMovements, baseCurrency, costCurrency) {
        const rebuilt = StockLevel_1.StockLevel.createNew(currentLevel.companyId, currentLevel.itemId, currentLevel.warehouseId);
        rebuilt.reservedQty = currentLevel.reservedQty;
        for (const entry of remainingMovements) {
            if (entry.direction === 'IN') {
                const qtyBefore = rebuilt.qtyOnHand;
                if (qtyBefore > 0) {
                    const newQty = qtyBefore + entry.qty;
                    rebuilt.avgCostBase = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(((rebuilt.avgCostBase * qtyBefore) + (entry.unitCostBase * entry.qty)) / newQty, baseCurrency);
                    rebuilt.avgCostCCY = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(((rebuilt.avgCostCCY * qtyBefore) + (entry.unitCostCCY * entry.qty)) / newQty, costCurrency);
                }
                else {
                    rebuilt.avgCostBase = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(entry.unitCostBase, baseCurrency);
                    rebuilt.avgCostCCY = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(entry.unitCostCCY, costCurrency);
                }
                rebuilt.qtyOnHand += entry.qty;
                rebuilt.lastCostBase = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(entry.unitCostBase, baseCurrency);
                rebuilt.lastCostCCY = (0, CurrencyPrecisionHelpers_1.roundByCurrency)(entry.unitCostCCY, costCurrency);
            }
            else {
                rebuilt.qtyOnHand -= entry.qty;
            }
            rebuilt.totalMovements += 1;
            rebuilt.maxBusinessDate = this.maxDate(rebuilt.maxBusinessDate, entry.date);
            rebuilt.lastMovementId = entry.id;
        }
        return rebuilt;
    }
    async deleteMovement(companyId, id, transaction) {
        const movement = await this.deps.stockMovementRepository.getMovement(id);
        if (!movement || movement.companyId !== companyId)
            return;
        const { item, baseCurrency } = await this.loadItemContext(companyId, movement.itemId);
        const execute = async (txn) => {
            const currentLevel = await this.getOrCreateStockLevel(txn, companyId, movement.itemId, movement.warehouseId);
            const remainingMovements = (await this.deps.stockMovementRepository.getItemMovements(companyId, movement.itemId))
                .filter((entry) => entry.warehouseId === movement.warehouseId && entry.id !== id)
                .sort((a, b) => {
                if (a.postingSeq !== b.postingSeq)
                    return a.postingSeq - b.postingSeq;
                const dateCmp = a.date.localeCompare(b.date);
                if (dateCmp !== 0)
                    return dateCmp;
                return a.id.localeCompare(b.id);
            });
            const rebuiltLevel = this.rebuildLevelFromMovements(currentLevel, remainingMovements, baseCurrency, item.costCurrency);
            rebuiltLevel.postingSeq = currentLevel.postingSeq + 1;
            rebuiltLevel.version = currentLevel.version + 1;
            rebuiltLevel.updatedAt = new Date();
            await this.deps.stockLevelRepository.upsertLevelInTransaction(txn, rebuiltLevel);
            await this.deps.stockMovementRepository.deleteMovement(companyId, id, txn);
        };
        if (transaction) {
            await execute(transaction);
        }
        else {
            await this.deps.transactionManager.runTransaction(async (txn) => execute(txn));
        }
    }
}
exports.RecordStockMovementUseCase = RecordStockMovementUseCase;
//# sourceMappingURL=RecordStockMovementUseCase.js.map