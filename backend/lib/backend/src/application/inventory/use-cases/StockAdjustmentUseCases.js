"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostStockAdjustmentUseCase = exports.CreateStockAdjustmentUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const StockAdjustment_1 = require("../../../domain/inventory/entities/StockAdjustment");
const VoucherUseCases_1 = require("../../accounting/use-cases/VoucherUseCases");
class CreateStockAdjustmentUseCase {
    constructor(adjustmentRepo) {
        this.adjustmentRepo = adjustmentRepo;
    }
    async execute(input) {
        const lines = input.lines.map((line) => ({
            itemId: line.itemId,
            currentQty: line.currentQty,
            newQty: line.newQty,
            adjustmentQty: line.newQty - line.currentQty,
            unitCostBase: line.unitCostBase,
            unitCostCCY: line.unitCostCCY,
        }));
        const adjustmentValueBase = (0, VoucherLineEntity_1.roundMoney)(lines.reduce((sum, line) => sum + Math.abs(line.adjustmentQty) * line.unitCostBase, 0));
        const adjustment = new StockAdjustment_1.StockAdjustment({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            warehouseId: input.warehouseId,
            date: input.date,
            reason: input.reason,
            notes: input.notes,
            lines,
            status: 'DRAFT',
            adjustmentValueBase,
            createdBy: input.createdBy,
            createdAt: new Date(),
        });
        await this.adjustmentRepo.createAdjustment(adjustment);
        return adjustment;
    }
}
exports.CreateStockAdjustmentUseCase = CreateStockAdjustmentUseCase;
class PostStockAdjustmentUseCase {
    constructor(adjustmentRepo, itemRepo, movementUseCase, voucherDeps) {
        this.adjustmentRepo = adjustmentRepo;
        this.itemRepo = itemRepo;
        this.movementUseCase = movementUseCase;
        this.voucherDeps = voucherDeps;
    }
    async execute(companyId, adjustmentId, userId) {
        const adjustment = await this.adjustmentRepo.getAdjustment(adjustmentId);
        if (!adjustment || adjustment.companyId !== companyId) {
            throw new Error(`Stock adjustment not found: ${adjustmentId}`);
        }
        if (adjustment.status !== 'DRAFT') {
            throw new Error('Only DRAFT adjustments can be posted');
        }
        const itemCache = new Map();
        for (const line of adjustment.lines) {
            if (line.adjustmentQty === 0)
                continue;
            const item = await this.itemRepo.getItem(line.itemId);
            if (!item || item.companyId !== companyId) {
                throw new Error(`Item not found for adjustment line: ${line.itemId}`);
            }
            itemCache.set(line.itemId, item);
            if (line.adjustmentQty > 0) {
                const fxRate = line.unitCostCCY > 0 ? line.unitCostBase / line.unitCostCCY : 1;
                const inInput = {
                    companyId,
                    itemId: line.itemId,
                    warehouseId: adjustment.warehouseId,
                    qty: line.adjustmentQty,
                    date: adjustment.date,
                    movementType: 'ADJUSTMENT_IN',
                    refs: {
                        type: 'STOCK_ADJUSTMENT',
                        docId: adjustment.id,
                    },
                    currentUser: userId,
                    notes: adjustment.notes,
                    unitCostInMoveCurrency: line.unitCostCCY,
                    moveCurrency: item.costCurrency,
                    fxRateMovToBase: fxRate,
                    fxRateCCYToBase: fxRate,
                };
                await this.movementUseCase.processIN(inInput);
            }
            else {
                const outInput = {
                    companyId,
                    itemId: line.itemId,
                    warehouseId: adjustment.warehouseId,
                    qty: Math.abs(line.adjustmentQty),
                    date: adjustment.date,
                    movementType: 'ADJUSTMENT_OUT',
                    refs: {
                        type: 'STOCK_ADJUSTMENT',
                        docId: adjustment.id,
                    },
                    currentUser: userId,
                    notes: adjustment.notes,
                };
                await this.movementUseCase.processOUT(outInput);
            }
        }
        const voucherId = await this.createVoucherForAdjustment(companyId, userId, adjustment, itemCache);
        const updatePatch = {
            status: 'POSTED',
            postedAt: new Date(),
        };
        if (voucherId) {
            updatePatch.voucherId = voucherId;
        }
        await this.adjustmentRepo.updateAdjustment(adjustment.id, updatePatch);
        const posted = await this.adjustmentRepo.getAdjustment(adjustment.id);
        if (!posted) {
            throw new Error(`Stock adjustment not found after posting: ${adjustment.id}`);
        }
        return posted;
    }
    async createVoucherForAdjustment(companyId, userId, adjustment, itemCache) {
        if (!this.voucherDeps) {
            console.warn(`[Inventory][PostStockAdjustmentUseCase] Accounting dependencies not provided; skipping GL voucher for adjustment ${adjustment.id}.`);
            return undefined;
        }
        const voucherLines = [];
        let computedAmountBase = 0;
        for (const line of adjustment.lines) {
            if (line.adjustmentQty === 0)
                continue;
            const item = itemCache.get(line.itemId) || (await this.itemRepo.getItem(line.itemId));
            if (!item || item.companyId !== companyId) {
                console.warn(`[Inventory][PostStockAdjustmentUseCase] Skipping GL voucher for adjustment ${adjustment.id}: item not found (${line.itemId}).`);
                return undefined;
            }
            if (!item.inventoryAssetAccountId || !item.cogsAccountId) {
                console.warn(`[Inventory][PostStockAdjustmentUseCase] Skipping GL voucher for adjustment ${adjustment.id}: item ${item.id} is missing inventoryAssetAccountId or cogsAccountId.`);
                return undefined;
            }
            const amountBase = (0, VoucherLineEntity_1.roundMoney)(Math.abs(line.adjustmentQty) * line.unitCostBase);
            if (amountBase <= 0)
                continue;
            computedAmountBase = (0, VoucherLineEntity_1.roundMoney)(computedAmountBase + amountBase);
            const isAdjustmentOut = line.adjustmentQty < 0;
            const debitAccountId = isAdjustmentOut ? item.cogsAccountId : item.inventoryAssetAccountId;
            const creditAccountId = isAdjustmentOut ? item.inventoryAssetAccountId : item.cogsAccountId;
            voucherLines.push({
                accountId: debitAccountId,
                side: 'Debit',
                amount: amountBase,
                notes: `Stock adjustment ${adjustment.id} (${line.itemId})`,
                metadata: {
                    source: 'inventory-adjustment',
                    adjustmentId: adjustment.id,
                    itemId: line.itemId,
                    warehouseId: adjustment.warehouseId,
                    direction: isAdjustmentOut ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
                },
            });
            voucherLines.push({
                accountId: creditAccountId,
                side: 'Credit',
                amount: amountBase,
                notes: `Stock adjustment ${adjustment.id} (${line.itemId})`,
                metadata: {
                    source: 'inventory-adjustment',
                    adjustmentId: adjustment.id,
                    itemId: line.itemId,
                    warehouseId: adjustment.warehouseId,
                    direction: isAdjustmentOut ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
                },
            });
        }
        if (voucherLines.length === 0) {
            console.warn(`[Inventory][PostStockAdjustmentUseCase] Skipping GL voucher for adjustment ${adjustment.id}: no monetary adjustment lines.`);
            return undefined;
        }
        const expectedAmount = (0, VoucherLineEntity_1.roundMoney)(adjustment.adjustmentValueBase);
        if (Math.abs(computedAmountBase - expectedAmount) > 0.01) {
            console.warn(`[Inventory][PostStockAdjustmentUseCase] Adjustment amount mismatch for ${adjustment.id}: expected=${expectedAmount}, computed=${computedAmountBase}.`);
        }
        const createVoucherUseCase = new VoucherUseCases_1.CreateVoucherUseCase(this.voucherDeps.voucherRepository, this.voucherDeps.accountRepository, this.voucherDeps.companyModuleSettingsRepository, this.voucherDeps.permissionChecker, this.voucherDeps.transactionManager, this.voucherDeps.voucherTypeDefinitionRepository, this.voucherDeps.accountingPolicyConfigProvider, this.voucherDeps.ledgerRepository, this.voucherDeps.policyRegistry, this.voucherDeps.companyCurrencyRepository, this.voucherDeps.voucherSequenceRepository);
        try {
            const voucher = await createVoucherUseCase.execute(companyId, userId, {
                type: 'JV',
                date: adjustment.date,
                description: `Inventory adjustment ${adjustment.id} (${adjustment.reason})`,
                sourceModule: 'inventory',
                reference: {
                    type: 'STOCK_ADJUSTMENT',
                    id: adjustment.id,
                },
                metadata: {
                    sourceModule: 'inventory',
                    referenceType: 'STOCK_ADJUSTMENT',
                    referenceId: adjustment.id,
                    adjustmentId: adjustment.id,
                    adjustmentReason: adjustment.reason,
                    adjustmentValueBase: expectedAmount,
                },
                lines: voucherLines,
            });
            return voucher.id;
        }
        catch (error) {
            console.warn(`[Inventory][PostStockAdjustmentUseCase] Failed to create GL voucher for adjustment ${adjustment.id}:`, error);
            return undefined;
        }
    }
}
exports.PostStockAdjustmentUseCase = PostStockAdjustmentUseCase;
//# sourceMappingURL=StockAdjustmentUseCases.js.map