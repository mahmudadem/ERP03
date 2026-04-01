"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryDTOMapper = void 0;
class InventoryDTOMapper {
    static toItemDTO(item) {
        return {
            id: item.id,
            companyId: item.companyId,
            code: item.code,
            name: item.name,
            description: item.description,
            barcode: item.barcode,
            type: item.type,
            categoryId: item.categoryId,
            brand: item.brand,
            tags: item.tags,
            baseUom: item.baseUom,
            purchaseUom: item.purchaseUom,
            salesUom: item.salesUom,
            costCurrency: item.costCurrency,
            costingMethod: item.costingMethod,
            trackInventory: item.trackInventory,
            revenueAccountId: item.revenueAccountId,
            cogsAccountId: item.cogsAccountId,
            inventoryAssetAccountId: item.inventoryAssetAccountId,
            minStockLevel: item.minStockLevel,
            maxStockLevel: item.maxStockLevel,
            reorderPoint: item.reorderPoint,
            active: item.active,
            createdBy: item.createdBy,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        };
    }
    static toWarehouseDTO(wh) {
        return {
            id: wh.id,
            companyId: wh.companyId,
            name: wh.name,
            code: wh.code,
            address: wh.address,
            isDefault: wh.isDefault,
            active: wh.active,
            createdAt: wh.createdAt.toISOString(),
            updatedAt: wh.updatedAt.toISOString(),
        };
    }
    static toCategoryDTO(category) {
        return {
            id: category.id,
            companyId: category.companyId,
            name: category.name,
            parentId: category.parentId,
            sortOrder: category.sortOrder,
            active: category.active,
            defaultRevenueAccountId: category.defaultRevenueAccountId,
            defaultCogsAccountId: category.defaultCogsAccountId,
            defaultInventoryAssetAccountId: category.defaultInventoryAssetAccountId,
        };
    }
    static toUomConversionDTO(conversion) {
        return {
            id: conversion.id,
            companyId: conversion.companyId,
            itemId: conversion.itemId,
            fromUom: conversion.fromUom,
            toUom: conversion.toUom,
            factor: conversion.factor,
            active: conversion.active,
        };
    }
    static toSettingsDTO(settings) {
        return {
            companyId: settings.companyId,
            defaultCostingMethod: settings.defaultCostingMethod,
            defaultCostCurrency: settings.defaultCostCurrency,
            allowNegativeStock: settings.allowNegativeStock,
            defaultWarehouseId: settings.defaultWarehouseId,
            autoGenerateItemCode: settings.autoGenerateItemCode,
            itemCodePrefix: settings.itemCodePrefix,
            itemCodeNextSeq: settings.itemCodeNextSeq,
        };
    }
    static toStockLevelDTO(level) {
        return {
            id: level.id,
            companyId: level.companyId,
            itemId: level.itemId,
            warehouseId: level.warehouseId,
            qtyOnHand: level.qtyOnHand,
            reservedQty: level.reservedQty,
            avgCostBase: level.avgCostBase,
            avgCostCCY: level.avgCostCCY,
            lastCostBase: level.lastCostBase,
            lastCostCCY: level.lastCostCCY,
            postingSeq: level.postingSeq,
            maxBusinessDate: level.maxBusinessDate,
            totalMovements: level.totalMovements,
            lastMovementId: level.lastMovementId,
            version: level.version,
            updatedAt: level.updatedAt.toISOString(),
        };
    }
    static toStockMovementDTO(movement) {
        return {
            id: movement.id,
            companyId: movement.companyId,
            date: movement.date,
            postingSeq: movement.postingSeq,
            createdAt: movement.createdAt.toISOString(),
            createdBy: movement.createdBy,
            postedAt: movement.postedAt.toISOString(),
            itemId: movement.itemId,
            warehouseId: movement.warehouseId,
            direction: movement.direction,
            movementType: movement.movementType,
            qty: movement.qty,
            uom: movement.uom,
            referenceType: movement.referenceType,
            referenceId: movement.referenceId,
            referenceLineId: movement.referenceLineId,
            reversesMovementId: movement.reversesMovementId,
            transferPairId: movement.transferPairId,
            unitCostBase: movement.unitCostBase,
            totalCostBase: movement.totalCostBase,
            unitCostCCY: movement.unitCostCCY,
            totalCostCCY: movement.totalCostCCY,
            movementCurrency: movement.movementCurrency,
            fxRateMovToBase: movement.fxRateMovToBase,
            fxRateCCYToBase: movement.fxRateCCYToBase,
            fxRateKind: movement.fxRateKind,
            avgCostBaseAfter: movement.avgCostBaseAfter,
            avgCostCCYAfter: movement.avgCostCCYAfter,
            qtyBefore: movement.qtyBefore,
            qtyAfter: movement.qtyAfter,
            settledQty: movement.settledQty,
            unsettledQty: movement.unsettledQty,
            unsettledCostBasis: movement.unsettledCostBasis,
            settlesNegativeQty: movement.settlesNegativeQty,
            newPositiveQty: movement.newPositiveQty,
            negativeQtyAtPosting: movement.negativeQtyAtPosting,
            costSettled: movement.costSettled,
            isBackdated: movement.isBackdated,
            costSource: movement.costSource,
            notes: movement.notes,
            metadata: movement.metadata,
        };
    }
    static toStockAdjustmentDTO(adjustment) {
        var _a;
        return {
            id: adjustment.id,
            companyId: adjustment.companyId,
            warehouseId: adjustment.warehouseId,
            date: adjustment.date,
            reason: adjustment.reason,
            notes: adjustment.notes,
            status: adjustment.status,
            voucherId: adjustment.voucherId,
            adjustmentValueBase: adjustment.adjustmentValueBase,
            createdBy: adjustment.createdBy,
            createdAt: adjustment.createdAt.toISOString(),
            postedAt: (_a = adjustment.postedAt) === null || _a === void 0 ? void 0 : _a.toISOString(),
            lines: adjustment.lines.map((line) => (Object.assign({}, line))),
        };
    }
    static toStockTransferDTO(transfer) {
        var _a;
        return {
            id: transfer.id,
            companyId: transfer.companyId,
            sourceWarehouseId: transfer.sourceWarehouseId,
            destinationWarehouseId: transfer.destinationWarehouseId,
            date: transfer.date,
            notes: transfer.notes,
            status: transfer.status,
            transferPairId: transfer.transferPairId,
            createdBy: transfer.createdBy,
            createdAt: transfer.createdAt.toISOString(),
            completedAt: (_a = transfer.completedAt) === null || _a === void 0 ? void 0 : _a.toISOString(),
            lines: transfer.lines.map((line) => (Object.assign({}, line))),
        };
    }
    static toInventoryPeriodSnapshotDTO(snapshot) {
        return {
            id: snapshot.id,
            companyId: snapshot.companyId,
            periodKey: snapshot.periodKey,
            periodEndDate: snapshot.periodEndDate,
            totalValueBase: snapshot.totalValueBase,
            totalItems: snapshot.totalItems,
            createdAt: snapshot.createdAt.toISOString(),
            snapshotData: snapshot.snapshotData.map((line) => (Object.assign({}, line))),
        };
    }
}
exports.InventoryDTOMapper = InventoryDTOMapper;
//# sourceMappingURL=InventoryDTOs.js.map