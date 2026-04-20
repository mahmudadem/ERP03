"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertItemQtyToBaseUom = exports.convertItemQtyToBaseUomDetailed = exports.resolveItemUomSelection = exports.findMatchingItemUomSelection = exports.getDefaultItemUomSelection = exports.buildItemUomSelections = void 0;
const normalizeCode = (value) => (value || '').trim().toUpperCase();
const dedupeSelections = (selections) => {
    const seen = new Set();
    const output = [];
    selections.forEach((selection) => {
        var _a;
        if (!((_a = selection === null || selection === void 0 ? void 0 : selection.uom) === null || _a === void 0 ? void 0 : _a.trim()))
            return;
        const key = selection.uomId ? `id:${selection.uomId}` : `code:${normalizeCode(selection.uom)}`;
        if (!key || seen.has(key))
            return;
        seen.add(key);
        output.push({
            uomId: selection.uomId || undefined,
            uom: selection.uom.trim().toUpperCase(),
        });
    });
    return output;
};
const buildItemUomSelections = (item, conversions = []) => dedupeSelections([
    { uomId: item.baseUomId, uom: item.baseUom },
    item.purchaseUom ? { uomId: item.purchaseUomId, uom: item.purchaseUom } : undefined,
    item.salesUom ? { uomId: item.salesUomId, uom: item.salesUom } : undefined,
    ...conversions
        .filter((conversion) => conversion.active)
        .flatMap((conversion) => [
        { uomId: conversion.fromUomId, uom: conversion.fromUom },
        { uomId: conversion.toUomId, uom: conversion.toUom },
    ]),
]);
exports.buildItemUomSelections = buildItemUomSelections;
const getDefaultItemUomSelection = (item, usage) => {
    if (usage === 'purchase' && item.purchaseUom) {
        return { uomId: item.purchaseUomId, uom: item.purchaseUom };
    }
    if (usage === 'sales' && item.salesUom) {
        return { uomId: item.salesUomId, uom: item.salesUom };
    }
    return { uomId: item.baseUomId, uom: item.baseUom };
};
exports.getDefaultItemUomSelection = getDefaultItemUomSelection;
const findMatchingItemUomSelection = (item, conversions = [], uomId, uom) => {
    const normalizedId = (uomId || '').trim();
    const normalizedCode = normalizeCode(uom);
    if (!normalizedId && !normalizedCode)
        return null;
    const selections = (0, exports.buildItemUomSelections)(item, conversions);
    return (selections.find((selection) => {
        if (normalizedId && selection.uomId === normalizedId)
            return true;
        if (normalizedCode && normalizeCode(selection.uom) === normalizedCode)
            return true;
        return false;
    }) || null);
};
exports.findMatchingItemUomSelection = findMatchingItemUomSelection;
const resolveItemUomSelection = ({ item, usage, conversions = [], uomId, uom, fallbackUomId, fallbackUom, }) => {
    const direct = (0, exports.findMatchingItemUomSelection)(item, conversions, uomId, uom);
    if (direct)
        return direct;
    const fallback = (0, exports.findMatchingItemUomSelection)(item, conversions, fallbackUomId, fallbackUom);
    if (fallback)
        return fallback;
    return (0, exports.getDefaultItemUomSelection)(item, usage);
};
exports.resolveItemUomSelection = resolveItemUomSelection;
const convertItemQtyToBaseUomDetailed = ({ qty, item, conversions = [], fromUomId, fromUom, round, itemCode, }) => {
    const from = (0, exports.resolveItemUomSelection)({
        item,
        usage: 'base',
        conversions,
        uomId: fromUomId,
        uom: fromUom,
    });
    const base = (0, exports.getDefaultItemUomSelection)(item, 'base');
    if ((from.uomId && base.uomId && from.uomId === base.uomId)
        || normalizeCode(from.uom) === normalizeCode(base.uom)) {
        return {
            qtyInBaseUom: qty,
            trace: {
                mode: 'IDENTITY',
                factor: 1,
                fromUomId: from.uomId,
                fromUom: from.uom,
                baseUomId: base.uomId,
                baseUom: base.uom,
            },
        };
    }
    const direct = conversions.find((conversion) => {
        if (!conversion.active)
            return false;
        if (from.uomId && base.uomId && conversion.fromUomId && conversion.toUomId) {
            return conversion.fromUomId === from.uomId && conversion.toUomId === base.uomId;
        }
        return normalizeCode(conversion.fromUom) === normalizeCode(from.uom)
            && normalizeCode(conversion.toUom) === normalizeCode(base.uom);
    });
    if (direct) {
        return {
            qtyInBaseUom: round(qty * direct.factor),
            trace: {
                mode: 'DIRECT',
                factor: direct.factor,
                fromUomId: from.uomId,
                fromUom: from.uom,
                baseUomId: base.uomId,
                baseUom: base.uom,
                conversionId: direct.id,
            },
        };
    }
    const reverse = conversions.find((conversion) => {
        if (!conversion.active)
            return false;
        if (from.uomId && base.uomId && conversion.fromUomId && conversion.toUomId) {
            return conversion.fromUomId === base.uomId && conversion.toUomId === from.uomId;
        }
        return normalizeCode(conversion.fromUom) === normalizeCode(base.uom)
            && normalizeCode(conversion.toUom) === normalizeCode(from.uom);
    });
    if (reverse) {
        return {
            qtyInBaseUom: round(qty / reverse.factor),
            trace: {
                mode: 'REVERSE',
                factor: 1 / reverse.factor,
                fromUomId: from.uomId,
                fromUom: from.uom,
                baseUomId: base.uomId,
                baseUom: base.uom,
                conversionId: reverse.id,
            },
        };
    }
    throw new Error(`No UOM conversion from ${from.uom} to ${base.uom} for item ${itemCode || item.code}`);
};
exports.convertItemQtyToBaseUomDetailed = convertItemQtyToBaseUomDetailed;
const convertItemQtyToBaseUom = (input) => (0, exports.convertItemQtyToBaseUomDetailed)(input).qtyInBaseUom;
exports.convertItemQtyToBaseUom = convertItemQtyToBaseUom;
//# sourceMappingURL=UomResolutionService.js.map