import { StockDirection, StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IGoodsReceiptRepository } from '../../../repository/interfaces/purchases/IGoodsReceiptRepository';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseReturnRepository } from '../../../repository/interfaces/purchases/IPurchaseReturnRepository';
import { IDeliveryNoteRepository } from '../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesReturnRepository } from '../../../repository/interfaces/sales/ISalesReturnRepository';

type UomReferenceType =
  | 'GOODS_RECEIPT'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN'
  | 'DELIVERY_NOTE'
  | 'SALES_INVOICE'
  | 'SALES_RETURN';

type SourceModule = 'purchases' | 'sales';
type ConversionMode = 'IDENTITY' | 'DIRECT' | 'REVERSE';

export interface UomConversionImpactInput {
  companyId: string;
  conversionId: string;
  proposedFactor?: number;
}

export interface UomConversionImpactMovement {
  movementId: string;
  date: string;
  direction: StockDirection;
  referenceType: UomReferenceType;
  referenceId: string;
  referenceLineId?: string;
  module: SourceModule;
  sourceQty?: number;
  sourceUomId?: string;
  sourceUom?: string;
  currentBaseQty: number;
  projectedBaseQty?: number;
  deltaBaseQty?: number;
  conversionMode: ConversionMode;
  appliedFactor: number;
}

export interface UomConversionImpactReference {
  referenceType: UomReferenceType;
  referenceId: string;
  module: SourceModule;
  status: string;
  movementCount: number;
  lineCount: number;
  currentNetBaseQty: number;
  projectedNetBaseQty?: number;
  deltaNetBaseQty?: number;
  canAutoFix: boolean;
  autoFixReason?: string;
}

export interface UomConversionImpactReport {
  conversion: {
    id: string;
    itemId: string;
    fromUomId?: string;
    fromUom: string;
    toUomId?: string;
    toUom: string;
    factor: number;
    active: boolean;
  };
  item: {
    id: string;
    code: string;
    name: string;
    baseUomId?: string;
    baseUom: string;
  };
  usageCount: number;
  purchaseUsageCount: number;
  salesUsageCount: number;
  used: boolean;
  editable: boolean;
  hasAutoFixBlockers: boolean;
  hasSalesUsage: boolean;
  impactedReferences: UomConversionImpactReference[];
  impactedMovements: UomConversionImpactMovement[];
}

interface MovementLineContext {
  module: SourceModule;
  status: string;
  lineQty?: number;
  lineUomId?: string;
  lineUom?: string;
  canAutoFix: boolean;
  autoFixReason?: string;
}

const SUPPORTED_REFERENCE_TYPES: ReadonlySet<string> = new Set<string>([
  'GOODS_RECEIPT',
  'PURCHASE_INVOICE',
  'PURCHASE_RETURN',
  'DELIVERY_NOTE',
  'SALES_INVOICE',
  'SALES_RETURN',
]);

const normalizeCode = (value?: string | null): string => (value || '').trim().toUpperCase();

const roundQty = (value: number): number => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

const toPositiveNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return undefined;
  return value;
};

const isSameUom = (
  leftId: string | undefined,
  leftCode: string | undefined,
  rightId: string | undefined,
  rightCode: string | undefined
): boolean => {
  if (leftId && rightId && leftId === rightId) return true;
  const leftNorm = normalizeCode(leftCode);
  const rightNorm = normalizeCode(rightCode);
  return !!leftNorm && !!rightNorm && leftNorm === rightNorm;
};

const signedQty = (direction: StockDirection, qty: number): number => (direction === 'IN' ? qty : -qty);

const asReferenceType = (value: string): UomReferenceType | null => {
  if (!SUPPORTED_REFERENCE_TYPES.has(value)) return null;
  return value as UomReferenceType;
};

const findLineByIdOrMovementId = <T extends { lineId: string; stockMovementId?: string | null }>(
  lines: T[],
  lineId: string | undefined,
  movementId: string
): T | undefined => {
  if (lineId) {
    const byId = lines.find((line) => line.lineId === lineId);
    if (byId) return byId;
  }
  return lines.find((line) => !!line.stockMovementId && line.stockMovementId === movementId);
};

export class AnalyzeUomConversionImpactUseCase {
  constructor(
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly itemRepo: IItemRepository,
    private readonly stockMovementRepo: IStockMovementRepository,
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly purchaseReturnRepo: IPurchaseReturnRepository,
    private readonly deliveryNoteRepo: IDeliveryNoteRepository,
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly salesReturnRepo: ISalesReturnRepository
  ) {}

  async execute(input: UomConversionImpactInput): Promise<UomConversionImpactReport> {
    const conversion = await this.uomConversionRepo.getConversion(input.conversionId);
    if (!conversion || conversion.companyId !== input.companyId) {
      throw new Error(`UOM conversion not found: ${input.conversionId}`);
    }

    const item = await this.itemRepo.getItem(conversion.itemId);
    if (!item || item.companyId !== input.companyId) {
      throw new Error(`Item not found: ${conversion.itemId}`);
    }

    const movements = await this.stockMovementRepo.getItemMovements(input.companyId, item.id);
    const lineContextCache = new Map<string, MovementLineContext | null>();

    type GroupState = {
      referenceType: UomReferenceType;
      referenceId: string;
      module: SourceModule;
      status: string;
      canAutoFix: boolean;
      autoFixReason?: string;
      movementCount: number;
      lineKeys: Set<string>;
      currentNet: number;
      projectedNet?: number;
    };

    const groups = new Map<string, GroupState>();
    const impactedMovements: UomConversionImpactMovement[] = [];

    for (const movement of movements) {
      const referenceType = asReferenceType(movement.referenceType);
      if (!referenceType || !movement.referenceId) continue;

      const context = await this.resolveLineContext(input.companyId, movement, referenceType, lineContextCache);
      if (!context) continue;

      const extracted = this.extractUsageForMovement({
        movement,
        context,
        conversion,
        itemBaseUomId: item.baseUomId,
        itemBaseUom: item.baseUom,
        proposedFactor: input.proposedFactor,
      });
      if (!extracted) continue;

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
          lineKeys: new Set<string>([movement.referenceLineId || movement.id]),
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
      } else {
        existing.projectedNet = undefined;
      }
    }

    const impactedReferences: UomConversionImpactReference[] = Array.from(groups.values())
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

  private async resolveLineContext(
    companyId: string,
    movement: StockMovement,
    referenceType: UomReferenceType,
    cache: Map<string, MovementLineContext | null>
  ): Promise<MovementLineContext | null> {
    const key = `${referenceType}:${movement.referenceId}:${movement.referenceLineId || ''}:${movement.id}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    let context: MovementLineContext | null = null;

    switch (referenceType) {
      case 'GOODS_RECEIPT': {
        const doc = await this.goodsReceiptRepo.getById(companyId, movement.referenceId as string);
        if (!doc) break;
        const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
        context = {
          module: 'purchases',
          status: doc.status,
          lineQty: line?.receivedQty,
          lineUomId: line?.uomId,
          lineUom: line?.uom,
          canAutoFix: doc.status === 'POSTED',
          autoFixReason: doc.status === 'POSTED' ? undefined : `Goods receipt status is ${doc.status}.`,
        };
        break;
      }
      case 'PURCHASE_INVOICE': {
        const doc = await this.purchaseInvoiceRepo.getById(companyId, movement.referenceId as string);
        if (!doc) break;
        const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
        const canUnpost = doc.status === 'POSTED' && (doc.paidAmountBase || 0) <= 0;
        context = {
          module: 'purchases',
          status: doc.status,
          lineQty: line?.invoicedQty,
          lineUomId: line?.uomId,
          lineUom: line?.uom,
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
        const doc = await this.purchaseReturnRepo.getById(companyId, movement.referenceId as string);
        if (!doc) break;
        const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
        context = {
          module: 'purchases',
          status: doc.status,
          lineQty: line?.returnQty,
          lineUomId: line?.uomId,
          lineUom: line?.uom,
          canAutoFix: doc.status === 'POSTED',
          autoFixReason: doc.status === 'POSTED' ? undefined : `Purchase return status is ${doc.status}.`,
        };
        break;
      }
      case 'DELIVERY_NOTE': {
        const doc = await this.deliveryNoteRepo.getById(companyId, movement.referenceId as string);
        if (!doc) break;
        const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
        context = {
          module: 'sales',
          status: doc.status,
          lineQty: line?.deliveredQty,
          lineUomId: line?.uomId,
          lineUom: line?.uom,
          canAutoFix: false,
          autoFixReason: 'Sales documents require manual cleanup/unpost in current version.',
        };
        break;
      }
      case 'SALES_INVOICE': {
        const doc = await this.salesInvoiceRepo.getById(companyId, movement.referenceId as string);
        if (!doc) break;
        const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
        context = {
          module: 'sales',
          status: doc.status,
          lineQty: line?.invoicedQty,
          lineUomId: line?.uomId,
          lineUom: line?.uom,
          canAutoFix: false,
          autoFixReason: 'Sales documents require manual cleanup/unpost in current version.',
        };
        break;
      }
      case 'SALES_RETURN': {
        const doc = await this.salesReturnRepo.getById(companyId, movement.referenceId as string);
        if (!doc) break;
        const line = findLineByIdOrMovementId(doc.lines, movement.referenceLineId, movement.id);
        context = {
          module: 'sales',
          status: doc.status,
          lineQty: line?.returnQty,
          lineUomId: line?.uomId,
          lineUom: line?.uom,
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

  private extractUsageForMovement(args: {
    movement: StockMovement;
    context: MovementLineContext;
    conversion: {
      id: string;
      fromUomId?: string;
      fromUom: string;
      toUomId?: string;
      toUom: string;
      factor: number;
    };
    itemBaseUomId?: string;
    itemBaseUom: string;
    proposedFactor?: number;
  }): {
    mode: ConversionMode;
    sourceQty?: number;
    sourceUomId?: string;
    sourceUom?: string;
    appliedFactor: number;
    projectedQty?: number;
  } | null {
    const conversionMeta = (args.movement.metadata?.uomConversion || {}) as Record<string, any>;
    const metaConversionId = typeof conversionMeta.conversionId === 'string' ? conversionMeta.conversionId : undefined;
    const metaMode = typeof conversionMeta.mode === 'string' ? conversionMeta.mode.toUpperCase() : undefined;

    const sourceQty = toPositiveNumber(conversionMeta.sourceQty) ?? toPositiveNumber(args.context.lineQty);
    const sourceUomId = (conversionMeta.sourceUomId || args.context.lineUomId) as string | undefined;
    const sourceUom = (conversionMeta.sourceUom || args.context.lineUom) as string | undefined;
    const metaAppliedFactor = toPositiveNumber(conversionMeta.appliedFactor);

    const isDirect = isSameUom(sourceUomId, sourceUom, args.conversion.fromUomId, args.conversion.fromUom)
      && isSameUom(args.itemBaseUomId, args.itemBaseUom, args.conversion.toUomId, args.conversion.toUom);
    const isReverse = isSameUom(sourceUomId, sourceUom, args.conversion.toUomId, args.conversion.toUom)
      && isSameUom(args.itemBaseUomId, args.itemBaseUom, args.conversion.fromUomId, args.conversion.fromUom);

    let mode: ConversionMode | null = null;
    if (metaConversionId && metaConversionId === args.conversion.id) {
      if (metaMode === 'DIRECT' || metaMode === 'REVERSE' || metaMode === 'IDENTITY') {
        mode = metaMode as ConversionMode;
      }
    }
    if (!mode) {
      if (isDirect) mode = 'DIRECT';
      else if (isReverse) mode = 'REVERSE';
      else return null;
    }

    const fallbackAppliedFactor = mode === 'REVERSE' ? (1 / args.conversion.factor) : args.conversion.factor;
    const appliedFactor = metaAppliedFactor || fallbackAppliedFactor;

    let projectedQty: number | undefined;
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
