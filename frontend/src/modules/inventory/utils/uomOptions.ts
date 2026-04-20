import { InventoryItemDTO, UomConversionDTO } from '../../../api/inventoryApi';

export interface ManagedUomOption {
  uomId?: string;
  code: string;
  label: string;
}

const normalizeCode = (value?: string | null): string => (value || '').trim().toUpperCase();

export const buildItemUomOptions = (
  item?: InventoryItemDTO | null,
  conversions: UomConversionDTO[] = []
): ManagedUomOption[] => {
  if (!item) return [];

  const candidates: ManagedUomOption[] = [
    { uomId: item.baseUomId, code: item.baseUom, label: item.baseUom },
  ];

  if (item.purchaseUom) {
    candidates.push({ uomId: item.purchaseUomId, code: item.purchaseUom, label: item.purchaseUom });
  }

  if (item.salesUom) {
    candidates.push({ uomId: item.salesUomId, code: item.salesUom, label: item.salesUom });
  }

  conversions
    .filter((conversion) => conversion.active)
    .forEach((conversion) => {
      candidates.push({ uomId: conversion.fromUomId, code: conversion.fromUom, label: conversion.fromUom });
      candidates.push({ uomId: conversion.toUomId, code: conversion.toUom, label: conversion.toUom });
    });

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const code = normalizeCode(candidate.code);
    if (!code) return false;
    const key = candidate.uomId ? `id:${candidate.uomId}` : `code:${code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    candidate.code = code;
    candidate.label = code;
    return true;
  });
};

export const getDefaultItemUomOption = (
  item: InventoryItemDTO | null | undefined,
  usage: 'sales' | 'purchase'
): ManagedUomOption | null => {
  if (!item) return null;
  if (usage === 'sales' && item.salesUom) {
    return { uomId: item.salesUomId, code: normalizeCode(item.salesUom), label: normalizeCode(item.salesUom) };
  }
  if (usage === 'purchase' && item.purchaseUom) {
    return { uomId: item.purchaseUomId, code: normalizeCode(item.purchaseUom), label: normalizeCode(item.purchaseUom) };
  }
  return { uomId: item.baseUomId, code: normalizeCode(item.baseUom), label: normalizeCode(item.baseUom) };
};

export const findItemUomOption = (
  options: ManagedUomOption[],
  uomId?: string,
  uom?: string
): ManagedUomOption | null => {
  const normalizedId = (uomId || '').trim();
  const normalizedCode = normalizeCode(uom);
  return (
    options.find((option) => {
      if (normalizedId && option.uomId === normalizedId) return true;
      if (normalizedCode && normalizeCode(option.code) === normalizedCode) return true;
      return false;
    }) || null
  );
};
