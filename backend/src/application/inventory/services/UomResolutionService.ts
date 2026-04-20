import { Item } from '../../../domain/inventory/entities/Item';
import { UomConversion } from '../../../domain/inventory/entities/UomConversion';

export type ItemUomUsage = 'base' | 'purchase' | 'sales';

export interface ItemUomSelection {
  uomId?: string;
  uom: string;
}

export type ConversionDirection = 'IDENTITY' | 'DIRECT' | 'REVERSE';

export interface ItemQtyToBaseUomTrace {
  mode: ConversionDirection;
  factor: number;
  fromUomId?: string;
  fromUom: string;
  baseUomId?: string;
  baseUom: string;
  conversionId?: string;
}

export interface ItemQtyToBaseUomResult {
  qtyInBaseUom: number;
  trace: ItemQtyToBaseUomTrace;
}

const normalizeCode = (value?: string | null): string => (value || '').trim().toUpperCase();

const dedupeSelections = (selections: Array<ItemUomSelection | undefined | null>): ItemUomSelection[] => {
  const seen = new Set<string>();
  const output: ItemUomSelection[] = [];

  selections.forEach((selection) => {
    if (!selection?.uom?.trim()) return;
    const key = selection.uomId ? `id:${selection.uomId}` : `code:${normalizeCode(selection.uom)}`;
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push({
      uomId: selection.uomId || undefined,
      uom: selection.uom.trim().toUpperCase(),
    });
  });

  return output;
};

export const buildItemUomSelections = (
  item: Item,
  conversions: UomConversion[] = []
): ItemUomSelection[] =>
  dedupeSelections([
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

export const getDefaultItemUomSelection = (item: Item, usage: ItemUomUsage): ItemUomSelection => {
  if (usage === 'purchase' && item.purchaseUom) {
    return { uomId: item.purchaseUomId, uom: item.purchaseUom };
  }
  if (usage === 'sales' && item.salesUom) {
    return { uomId: item.salesUomId, uom: item.salesUom };
  }
  return { uomId: item.baseUomId, uom: item.baseUom };
};

export const findMatchingItemUomSelection = (
  item: Item,
  conversions: UomConversion[] = [],
  uomId?: string,
  uom?: string
): ItemUomSelection | null => {
  const normalizedId = (uomId || '').trim();
  const normalizedCode = normalizeCode(uom);

  if (!normalizedId && !normalizedCode) return null;

  const selections = buildItemUomSelections(item, conversions);
  return (
    selections.find((selection) => {
      if (normalizedId && selection.uomId === normalizedId) return true;
      if (normalizedCode && normalizeCode(selection.uom) === normalizedCode) return true;
      return false;
    }) || null
  );
};

export const resolveItemUomSelection = ({
  item,
  usage,
  conversions = [],
  uomId,
  uom,
  fallbackUomId,
  fallbackUom,
}: {
  item: Item;
  usage: ItemUomUsage;
  conversions?: UomConversion[];
  uomId?: string;
  uom?: string;
  fallbackUomId?: string;
  fallbackUom?: string;
}): ItemUomSelection => {
  const direct = findMatchingItemUomSelection(item, conversions, uomId, uom);
  if (direct) return direct;

  const fallback = findMatchingItemUomSelection(item, conversions, fallbackUomId, fallbackUom);
  if (fallback) return fallback;

  return getDefaultItemUomSelection(item, usage);
};

export const convertItemQtyToBaseUomDetailed = ({
  qty,
  item,
  conversions = [],
  fromUomId,
  fromUom,
  round,
  itemCode,
}: {
  qty: number;
  item: Item;
  conversions?: UomConversion[];
  fromUomId?: string;
  fromUom?: string;
  round: (value: number) => number;
  itemCode?: string;
}): ItemQtyToBaseUomResult => {
  const from = resolveItemUomSelection({
    item,
    usage: 'base',
    conversions,
    uomId: fromUomId,
    uom: fromUom,
  });
  const base = getDefaultItemUomSelection(item, 'base');

  if (
    (from.uomId && base.uomId && from.uomId === base.uomId)
    || normalizeCode(from.uom) === normalizeCode(base.uom)
  ) {
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
    if (!conversion.active) return false;
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
    if (!conversion.active) return false;
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

export const convertItemQtyToBaseUom = (input: Parameters<typeof convertItemQtyToBaseUomDetailed>[0]): number =>
  convertItemQtyToBaseUomDetailed(input).qtyInBaseUom;
