"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzeUomConversionImpactUseCase = void 0;
const SUPPORTED_REFERENCE_TYPES = new Set([
    'GOODS_RECEIPT',
    'PURCHASE_INVOICE',
    'PURCHASE_RETURN',
    'DELIVERY_NOTE',
    'SALES_INVOICE',
    'SALES_RETURN',
]);
const normalizeCode = (value) => (value || '').trim().toUpperCase();
const roundQty = (value) => Math.round((value + Number.EPSILON) * 1000000) / 1000000;
const toPositiveNumber = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0)
        return undefined;
    return value;
};
const isSameUom = (leftId, leftCode, rightId, rightCode) => {
    if (leftId && rightId && leftId === rightId)
        return true;
    const leftNorm = normalizeCode(leftCode);
    const rightNorm = normalizeCode(rightCode);
    return !!leftNorm && !!rightNorm && leftNorm === rightNorm;
};
const signedQty = (direction, qty) => (direction === 'IN' ? qty : -qty);
const asReferenceType = (value) => {
    if (!SUPPORTED_REFERENCE_TYPES.has(value))
        return null;
    return value;
};
const findLineByIdOrMovementId = (lines, lineId, movementId) => {
    if (lineId) {
        const byId = lines.find((line) => line.lineId === lineId);
        if (byId)
            return byId;
    }
    return lines.find((line) => !!line.stockMovementId && line.stockMovementId === movementId);
};
class AnalyzeUomConversionImpactUseCase {
    constructor(uomConversionRepo, itemRepo, stockMovementRepo, goodsReceiptRepo, purchaseInvoiceRepo, purchaseReturnRepo, deliveryNoteRepo, salesInvoiceRepo, salesReturnRepo) {
        this.uomConversionRepo = uomConversionRepo;
        this.itemRepo = itemRepo;
        this.stockMovementRepo = stockMovementRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.purchaseReturnRepo = purchaseReturnRepo;
        this.deliveryNoteRepo = deliveryNoteRepo;
        this.salesInvoiceRepo = salesInvoiceRepo;
        this.salesReturnRepo = salesReturnRepo;
    }
    async execute(input) {
        const conversion = await this.uomConversionRepo.getConversion(input.conversionId);
        if (!conversion || conversion.companyId !== input.companyId) {
            throw new Error(`UOM conversion not found: ${input.conversionId}`);
        }
        const item = await this.itemRepo.getItem(conversion.itemId);
        if (!item || item.companyId !== input.companyId) {
            throw new Error(`Item not found: ${conversion.itemId}`);
        }
        const movements = await this.stockMovementRepo.getItemMovements(input.companyId, item.id);
        const lineContextCache = new Map();
        const groups = new Map();
        const impactedMovements = [];
        for (const movement of movements) {
            const referenceType = asReferenceType(movement.referenceType);
            if (!referenceType || !movement.referenceId)
                continue;
            const context = await this.resolveLineContext(input.companyId, movement, referenceType, lineContextCache);
            if (!context)
                continue;
            const extracted = this.extractUsageForMovement({
                movement,
                context,
                conversion,
                itemBaseUomId: item.baseUomId,
                itemBaseUom: item.baseUom,
                proposedFactor: input.proposedFactor,
            });
            if (!extracted)
                continue;
            impactedMovements.push({
                movementId: movement.id,
                date: movement.date,
                direction: movement.direction,
                referenceType,
                referenceId: movement.referenceId,
                referenceLineId: movement.referenceLineId,
                module: context.module,
                sourceQty: extracted.sourceQty,
                sourceUomId: extracted.sourceUomId,
                sourceUom: extracted.sourceUom,
                currentBaseQty: movement.qty,
                projectedBaseQty: extracted.projectedQty,
                deltaBaseQty: extracted.projectedQty === undefined ? undefined : roundQty(extracted.projectedQty - movement.qty),
                conversionMode: extracted.mode,
                appliedFactor: extracted.appliedFactor,
            });
            const key = `${referenceType}:${movement.referenceId}`;
            const existing = groups.get(key);
            const movementCurrentNet = signedQty(movement.direction, movement.qty);
            const movementProjectedNet = extracted.projectedQty === undefined
                ? undefined
                : signedQty(movement.direction, extracted.projectedQty);
            if (!existing) {
                groups.set(key, {
                    referenceType,
                    referenceId: movement.referenceId,
                    module: context.module,
                    status: context.status,
                    canAutoFix: context.canAutoFix,
                    autoFixReason: context.autoFixReason,
                    movementCount: 1,
                    lineKeys: new Set([movement.referenceLineId || movement.id]),
                    currentNet: movementCurrentNet,
                    projectedNet: movementProjectedNet,
                });
                continue;
            }
            existing.movementCount += 1;
            existing.lineKeys.add(movement.referenceLineId || movement.id);
            existing.currentNet = roundQty(existing.currentNet + movementCurrentNet);
            if (existing.projectedNet !== undefined && movementProjectedNet !== undefined) {
                existing.projectedNet = roundQty(existing.projectedNet + movementProjectedNet);
            }
            else {
                existing.projectedNet = undefined;
            }
        }
        const impactedReferences = Array.from(groups.values())
            .map((group) => ({
            referenceType: group.referenceType,
            referenceId: group.referenceId,
            module: group.module,
            status: group.status,
            movementCount: group.movementCount,
            lineCount: group.lineKeys.size,
            currentNetBaseQty: roundQty(group.currentNet),
            projectedNetBaseQty: group.projectedNet,
            deltaNetBaseQty: group.projectedNet === undefined
                ? undefined
                : roundQty(group.projectedNet - group.currentNet),
            canAutoFix: group.canAutoFix,
            autoFixReason: group.autoFixReason,
        }))
            .sort((a, b) => `${a.referenceType}:${a.referenceId}`.localeCompare(`${b.referenceType}:${b.referenceId}`));
        const purchaseUsageCount = impactedMovements.filter((entry) => entry.module === 'purchases').length;
        const salesUsageCount = impactedMovements.filter((entry) => entry.module === 'sales').length;
        const usageCount = impactedMovements.length;
        return {
            conversion: {
                id: conversion.id,
                itemId: conversion.itemId,
                fromUomId: conversion.fromUomId,
                fromUom: conversion.fromUom,
                toUomId: conversion.toUomId,
                toUom: conversion.toUom,
                factor: conversion.factor,
                active: conversion.active,
            },
            item: {
                id: item.id,
                code: item.code,
                name: item.name,
                baseUomId: item.baseUomId,
                baseUom: item.baseUom,
            },
            usageCount,
            purchaseUsageCount,
            salesUsageCount,
            used: usageCount > 0,
            editable: usageCount === 0,
            hasAutoFixBlockers: impactedReferences.some((entry) => entry.module === 'purchases' && !entry.canAutoFix),
            hasSalesUsage: salesUsageCount > 0,
            impactedReferences,
            impactedMovements,
        };
    }
    async resolveLineContext(companyId, movement, referenceType, cache) {
        const key = `${referenceType}:${movement.referenceId}:${movement.referenceLineId || ''}:${movement.id}`;
        const cached = cache.get(key);
        if (cached !== undefined)
            return cached;
        let context = null;
        switch (referenceType) {
            case 'GOODS_RECEIPT': {
                const doc = await this.goodsReceiptRepo.getById(companyId, movement.referenceId);
                if (!doc)
                    break;
                const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
                context = {
                    module: 'purchases',
                    status: doc.status,
                    lineQty: line === null || line === void 0 ? void 0 : line.receivedQty,
                    lineUomId: line === null || line === void 0 ? void 0 : line.uomId,
                    lineUom: line === null || line === void 0 ? void 0 : line.uom,
                    canAutoFix: doc.status === 'POSTED',
                    autoFixReason: doc.status === 'POSTED' ? undefined : `Goods receipt status is ${doc.status}.`,
                };
                break;
            }
            case 'PURCHASE_INVOICE': {
                const doc = await this.purchaseInvoiceRepo.getById(companyId, movement.referenceId);
                if (!doc)
                    break;
                const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
                const canUnpost = doc.status === 'POSTED' && (doc.paidAmountBase || 0) <= 0;
                context = {
                    module: 'purchases',
                    status: doc.status,
                    lineQty: line === null || line === void 0 ? void 0 : line.invoicedQty,
                    lineUomId: line === null || line === void 0 ? void 0 : line.uomId,
                    lineUom: line === null || line === void 0 ? void 0 : line.uom,
                    canAutoFix: canUnpost,
                    autoFixReason: canUnpost
                        ? undefined
                        : (doc.status !== 'POSTED'
                            ? `Purchase invoice status is ${doc.status}.`
                            : 'Purchase invoice has payments; reverse payments before auto-fix.'),
                };
                break;
            }
            case 'PURCHASE_RETURN': {
                const doc = await this.purchaseReturnRepo.getById(companyId, movement.referenceId);
                if (!doc)
                    break;
                const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
                context = {
                    module: 'purchases',
                    status: doc.status,
                    lineQty: line === null || line === void 0 ? void 0 : line.returnQty,
                    lineUomId: line === null || line === void 0 ? void 0 : line.uomId,
                    lineUom: line === null || line === void 0 ? void 0 : line.uom,
                    canAutoFix: doc.status === 'POSTED',
                    autoFixReason: doc.status === 'POSTED' ? undefined : `Purchase return status is ${doc.status}.`,
                };
                break;
            }
            case 'DELIVERY_NOTE': {
                const doc = await this.deliveryNoteRepo.getById(companyId, movement.referenceId);
                if (!doc)
                    break;
                const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
                context = {
                    module: 'sales',
                    status: doc.status,
                    lineQty: line === null || line === void 0 ? void 0 : line.deliveredQty,
                    lineUomId: line === null || line === void 0 ? void 0 : line.uomId,
                    lineUom: line === null || line === void 0 ? void 0 : line.uom,
                    canAutoFix: false,
                    autoFixReason: 'Sales documents require manual cleanup/unpost in current version.',
                };
                break;
            }
            case 'SALES_INVOICE': {
                const doc = await this.salesInvoiceRepo.getById(companyId, movement.referenceId);
                if (!doc)
                    break;
                const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
                context = {
                    module: 'sales',
                    status: doc.status,
                    lineQty: line === null || line === void 0 ? void 0 : line.invoicedQty,
                    lineUomId: line === null || line === void 0 ? void 0 : line.uomId,
                    lineUom: line === null || line === void 0 ? void 0 : line.uom,
                    canAutoFix: false,
                    autoFixReason: 'Sales documents require manual cleanup/unpost in current version.',
                };
                break;
            }
            case 'SALES_RETURN': {
                const doc = await this.salesReturnRepo.getById(companyId, movement.referenceId);
                if (!doc)
                    break;
                const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
                context = {
                    module: 'sales',
                    status: doc.status,
                    lineQty: line === null || line === void 0 ? void 0 : line.returnQty,
                    lineUomId: line === null || line === void 0 ? void 0 : line.uomId,
                    lineUom: line === null || line === void 0 ? void 0 : line.uom,
                    canAutoFix: false,
                    autoFixReason: 'Sales documents require manual cleanup/unpost in current version.',
                };
                break;
            }
            default:
                context = null;
        }
        cache.set(key, context);
        return context;
    }
    extractUsageForMovement(args) {
        var _a, _b;
        const conversionMeta = (((_a = args.movement.metadata) === null || _a === void 0 ? void 0 : _a.uomConversion) || {});
        const metaConversionId = typeof conversionMeta.conversionId === 'string' ? conversionMeta.conversionId : undefined;
        const metaMode = typeof conversionMeta.mode === 'string' ? conversionMeta.mode.toUpperCase() : undefined;
        const sourceQty = (_b = toPositiveNumber(conversionMeta.sourceQty)) !== null && _b !== void 0 ? _b : toPositiveNumber(args.context.lineQty);
        const sourceUomId = (conversionMeta.sourceUomId || args.context.lineUomId);
        const sourceUom = (conversionMeta.sourceUom || args.context.lineUom);
        const metaAppliedFactor = toPositiveNumber(conversionMeta.appliedFactor);
        const isDirect = isSameUom(sourceUomId, sourceUom, args.conversion.fromUomId, args.conversion.fromUom)
            && isSameUom(args.itemBaseUomId, args.itemBaseUom, args.conversion.toUomId, args.conversion.toUom);
        const isReverse = isSameUom(sourceUomId, sourceUom, args.conversion.toUomId, args.conversion.toUom)
            && isSameUom(args.itemBaseUomId, args.itemBaseUom, args.conversion.fromUomId, args.conversion.fromUom);
        let mode = null;
        if (metaConversionId && metaConversionId === args.conversion.id) {
            if (metaMode === 'DIRECT' || metaMode === 'REVERSE' || metaMode === 'IDENTITY') {
                mode = metaMode;
            }
        }
        if (!mode) {
            if (isDirect)
                mode = 'DIRECT';
            else if (isReverse)
                mode = 'REVERSE';
            else
                return null;
        }
        const fallbackAppliedFactor = mode === 'REVERSE' ? (1 / args.conversion.factor) : args.conversion.factor;
        const appliedFactor = metaAppliedFactor || fallbackAppliedFactor;
        let projectedQty;
        if (sourceQty !== undefined && args.proposedFactor && args.proposedFactor > 0) {
            const projectedFactor = mode === 'REVERSE' ? (1 / args.proposedFactor) : args.proposedFactor;
            projectedQty = roundQty(sourceQty * projectedFactor);
        }
        return {
            mode,
            sourceQty,
            sourceUomId,
            sourceUom,
            appliedFactor,
            projectedQty,
        };
    }
}
exports.AnalyzeUomConversionImpactUseCase = AnalyzeUomConversionImpactUseCase;
//# sourceMappingURL=UomConversionGovernanceUseCases.js.map