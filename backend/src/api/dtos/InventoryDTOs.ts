
/**
 * InventoryDTOs.ts
 */
import { Item } from '../../domain/inventory/entities/Item';
import { ItemCategory } from '../../domain/inventory/entities/ItemCategory';
import { InventorySettings } from '../../domain/inventory/entities/InventorySettings';
import { InventoryPeriodSnapshot } from '../../domain/inventory/entities/InventoryPeriodSnapshot';
import { StockAdjustment } from '../../domain/inventory/entities/StockAdjustment';
import { StockLevel } from '../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../domain/inventory/entities/StockMovement';
import { StockTransfer } from '../../domain/inventory/entities/StockTransfer';
import { UomConversion } from '../../domain/inventory/entities/UomConversion';
import { Warehouse } from '../../domain/inventory/entities/Warehouse';

export interface ItemDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  barcode?: string;
  type: Item['type'];
  categoryId?: string;
  brand?: string;
  tags?: string[];
  baseUom: string;
  purchaseUom?: string;
  salesUom?: string;
  costCurrency: string;
  costingMethod: Item['costingMethod'];
  trackInventory: boolean;
  revenueAccountId?: string;
  cogsAccountId?: string;
  inventoryAssetAccountId?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseDTO {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address?: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemCategoryDTO {
  id: string;
  companyId: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  active: boolean;
  defaultRevenueAccountId?: string;
  defaultCogsAccountId?: string;
  defaultInventoryAssetAccountId?: string;
}

export interface UomConversionDTO {
  id: string;
  companyId: string;
  itemId: string;
  fromUom: string;
  toUom: string;
  factor: number;
  active: boolean;
}

export interface InventorySettingsDTO {
  companyId: string;
  defaultCostingMethod: 'MOVING_AVG';
  defaultCostCurrency: string;
  allowNegativeStock: boolean;
  defaultWarehouseId?: string;
  autoGenerateItemCode: boolean;
  itemCodePrefix?: string;
  itemCodeNextSeq: number;
}

export interface StockLevelDTO {
  id: string;
  companyId: string;
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  reservedQty: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastCostBase: number;
  lastCostCCY: number;
  postingSeq: number;
  maxBusinessDate: string;
  totalMovements: number;
  lastMovementId: string;
  version: number;
  updatedAt: string;
}

export interface StockMovementDTO {
  id: string;
  companyId: string;
  date: string;
  postingSeq: number;
  createdAt: string;
  createdBy: string;
  postedAt: string;
  itemId: string;
  warehouseId: string;
  direction: 'IN' | 'OUT';
  movementType: string;
  qty: number;
  uom: string;
  referenceType: string;
  referenceId?: string;
  referenceLineId?: string;
  reversesMovementId?: string;
  transferPairId?: string;
  unitCostBase: number;
  totalCostBase: number;
  unitCostCCY: number;
  totalCostCCY: number;
  movementCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  fxRateKind: 'DOCUMENT' | 'EFFECTIVE';
  avgCostBaseAfter: number;
  avgCostCCYAfter: number;
  qtyBefore: number;
  qtyAfter: number;
  settledQty?: number;
  unsettledQty?: number;
  unsettledCostBasis?: 'AVG' | 'LAST_KNOWN' | 'MISSING';
  settlesNegativeQty?: number;
  newPositiveQty?: number;
  negativeQtyAtPosting: boolean;
  costSettled: boolean;
  isBackdated: boolean;
  costSource: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface StockAdjustmentDTO {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string;
  reason: string;
  notes?: string;
  status: 'DRAFT' | 'POSTED';
  voucherId?: string;
  adjustmentValueBase: number;
  createdBy: string;
  createdAt: string;
  postedAt?: string;
  lines: Array<{
    itemId: string;
    currentQty: number;
    newQty: number;
    adjustmentQty: number;
    unitCostBase: number;
    unitCostCCY: number;
  }>;
}

export interface StockTransferDTO {
  id: string;
  companyId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  date: string;
  notes?: string;
  status: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED';
  transferPairId: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  lines: Array<{
    itemId: string;
    qty: number;
    unitCostBaseAtTransfer: number;
    unitCostCCYAtTransfer: number;
  }>;
}

export interface InventoryPeriodSnapshotDTO {
  id: string;
  companyId: string;
  periodKey: string;
  periodEndDate: string;
  totalValueBase: number;
  totalItems: number;
  createdAt: string;
  snapshotData: Array<{
    itemId: string;
    warehouseId: string;
    qtyOnHand: number;
    avgCostBase: number;
    avgCostCCY: number;
    lastCostBase: number;
    lastCostCCY: number;
    valueBase: number;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export class InventoryDTOMapper {
  static toItemDTO(item: Item): ItemDTO {
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

  static toWarehouseDTO(wh: Warehouse): WarehouseDTO {
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

  static toCategoryDTO(category: ItemCategory): ItemCategoryDTO {
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

  static toUomConversionDTO(conversion: UomConversion): UomConversionDTO {
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

  static toSettingsDTO(settings: InventorySettings): InventorySettingsDTO {
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

  static toStockLevelDTO(level: StockLevel): StockLevelDTO {
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

  static toStockMovementDTO(movement: StockMovement): StockMovementDTO {
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

  static toStockAdjustmentDTO(adjustment: StockAdjustment): StockAdjustmentDTO {
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
      postedAt: adjustment.postedAt?.toISOString(),
      lines: adjustment.lines.map((line) => ({ ...line })),
    };
  }

  static toStockTransferDTO(transfer: StockTransfer): StockTransferDTO {
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
      completedAt: transfer.completedAt?.toISOString(),
      lines: transfer.lines.map((line) => ({ ...line })),
    };
  }

  static toInventoryPeriodSnapshotDTO(snapshot: InventoryPeriodSnapshot): InventoryPeriodSnapshotDTO {
    return {
      id: snapshot.id,
      companyId: snapshot.companyId,
      periodKey: snapshot.periodKey,
      periodEndDate: snapshot.periodEndDate,
      totalValueBase: snapshot.totalValueBase,
      totalItems: snapshot.totalItems,
      createdAt: snapshot.createdAt.toISOString(),
      snapshotData: snapshot.snapshotData.map((line) => ({ ...line })),
    };
  }
}
