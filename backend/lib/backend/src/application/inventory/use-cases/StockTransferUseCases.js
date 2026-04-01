"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListStockTransfersUseCase = exports.CompleteStockTransferUseCase = exports.CreateStockTransferUseCase = void 0;
const crypto_1 = require("crypto");
const StockTransfer_1 = require("../../../domain/inventory/entities/StockTransfer");
class CreateStockTransferUseCase {
    constructor(transferRepo, warehouseRepo, itemRepo, stockLevelRepo) {
        this.transferRepo = transferRepo;
        this.warehouseRepo = warehouseRepo;
        this.itemRepo = itemRepo;
        this.stockLevelRepo = stockLevelRepo;
    }
    async execute(input) {
        var _a;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
            throw new Error('date must be in YYYY-MM-DD format');
        }
        if (input.sourceWarehouseId === input.destinationWarehouseId) {
            throw new Error('Source and destination warehouses must be different');
        }
        if (!Array.isArray(input.lines) || input.lines.length === 0) {
            throw new Error('Transfer lines are required');
        }
        const [sourceWarehouse, destinationWarehouse] = await Promise.all([
            this.warehouseRepo.getWarehouse(input.sourceWarehouseId),
            this.warehouseRepo.getWarehouse(input.destinationWarehouseId),
        ]);
        if (!sourceWarehouse || sourceWarehouse.companyId !== input.companyId) {
            throw new Error(`Source warehouse not found: ${input.sourceWarehouseId}`);
        }
        if (!destinationWarehouse || destinationWarehouse.companyId !== input.companyId) {
            throw new Error(`Destination warehouse not found: ${input.destinationWarehouseId}`);
        }
        const lines = [];
        for (const line of input.lines) {
            if (!((_a = line.itemId) === null || _a === void 0 ? void 0 : _a.trim())) {
                throw new Error('Transfer line itemId is required');
            }
            if (line.qty <= 0 || Number.isNaN(line.qty)) {
                throw new Error(`Transfer qty must be greater than 0 for item ${line.itemId}`);
            }
            const item = await this.itemRepo.getItem(line.itemId);
            if (!item || item.companyId !== input.companyId) {
                throw new Error(`Item not found: ${line.itemId}`);
            }
            if (!item.trackInventory) {
                throw new Error(`Item is not inventory-tracked: ${line.itemId}`);
            }
            const level = await this.stockLevelRepo.getLevel(input.companyId, line.itemId, input.sourceWarehouseId);
            let unitCostBaseAtTransfer = 0;
            let unitCostCCYAtTransfer = 0;
            if (level) {
                if (level.qtyOnHand > 0) {
                    unitCostBaseAtTransfer = level.avgCostBase;
                    unitCostCCYAtTransfer = level.avgCostCCY;
                }
                else if (level.lastCostBase > 0) {
                    unitCostBaseAtTransfer = level.lastCostBase;
                    unitCostCCYAtTransfer = level.lastCostCCY;
                }
            }
            lines.push({
                itemId: line.itemId,
                qty: line.qty,
                unitCostBaseAtTransfer,
                unitCostCCYAtTransfer,
            });
        }
        const transfer = new StockTransfer_1.StockTransfer({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            sourceWarehouseId: input.sourceWarehouseId,
            destinationWarehouseId: input.destinationWarehouseId,
            date: input.date,
            notes: input.notes,
            lines,
            status: 'DRAFT',
            transferPairId: (0, crypto_1.randomUUID)(),
            createdBy: input.createdBy,
            createdAt: new Date(),
        });
        await this.transferRepo.createTransfer(transfer);
        return transfer;
    }
}
exports.CreateStockTransferUseCase = CreateStockTransferUseCase;
class CompleteStockTransferUseCase {
    constructor(transferRepo, movementUseCase, transactionManager) {
        this.transferRepo = transferRepo;
        this.movementUseCase = movementUseCase;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, transferId, userId) {
        const transfer = await this.transferRepo.getTransfer(transferId);
        if (!transfer || transfer.companyId !== companyId) {
            throw new Error(`Stock transfer not found: ${transferId}`);
        }
        if (transfer.status !== 'DRAFT') {
            throw new Error('Only DRAFT stock transfers can be completed');
        }
        const completedAt = new Date();
        const lineResults = await this.transactionManager.runTransaction(async (txn) => {
            const costs = [];
            for (const line of transfer.lines) {
                const result = await this.movementUseCase.processTRANSFER({
                    companyId,
                    itemId: line.itemId,
                    sourceWarehouseId: transfer.sourceWarehouseId,
                    destinationWarehouseId: transfer.destinationWarehouseId,
                    qty: line.qty,
                    date: transfer.date,
                    transferDocId: transfer.id,
                    transferPairId: transfer.transferPairId,
                    transaction: txn,
                    currentUser: userId,
                    notes: transfer.notes,
                    metadata: {
                        source: 'stock-transfer',
                        transferId: transfer.id,
                    },
                });
                costs.push({
                    unitCostBase: result.outMov.unitCostBase,
                    unitCostCCY: result.outMov.unitCostCCY,
                });
            }
            return costs;
        });
        const completedLines = transfer.lines.map((line, index) => {
            var _a, _b, _c, _d;
            return (Object.assign(Object.assign({}, line), { unitCostBaseAtTransfer: (_b = (_a = lineResults[index]) === null || _a === void 0 ? void 0 : _a.unitCostBase) !== null && _b !== void 0 ? _b : line.unitCostBaseAtTransfer, unitCostCCYAtTransfer: (_d = (_c = lineResults[index]) === null || _c === void 0 ? void 0 : _c.unitCostCCY) !== null && _d !== void 0 ? _d : line.unitCostCCYAtTransfer }));
        });
        await this.transferRepo.updateTransfer(transfer.id, {
            status: 'COMPLETED',
            completedAt,
            lines: completedLines,
        });
        const updated = await this.transferRepo.getTransfer(transfer.id);
        if (!updated) {
            throw new Error(`Stock transfer not found after completion: ${transfer.id}`);
        }
        return updated;
    }
}
exports.CompleteStockTransferUseCase = CompleteStockTransferUseCase;
class ListStockTransfersUseCase {
    constructor(transferRepo) {
        this.transferRepo = transferRepo;
    }
    async execute(companyId, input = {}) {
        if (input.status) {
            return this.transferRepo.getByStatus(companyId, input.status, {
                limit: input.limit,
                offset: input.offset,
            });
        }
        return this.transferRepo.getCompanyTransfers(companyId, {
            limit: input.limit,
            offset: input.offset,
        });
    }
}
exports.ListStockTransfersUseCase = ListStockTransfersUseCase;
//# sourceMappingURL=StockTransferUseCases.js.map