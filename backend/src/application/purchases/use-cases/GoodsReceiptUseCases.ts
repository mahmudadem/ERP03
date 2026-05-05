import { randomUUID } from 'crypto';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { IPurchasesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { GoodsReceipt, GoodsReceiptLine } from '../../../domain/purchases/entities/GoodsReceipt';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { IAccountRepository, ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IGoodsReceiptRepository } from '../../../repository/interfaces/purchases/IGoodsReceiptRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import {
  convertItemQtyToBaseUomDetailed,
} from '../../inventory/services/UomResolutionService';
import { generateDocumentNumber } from './PurchaseOrderUseCases';
import { roundMoney, updatePOStatus } from './PurchasePostingHelpers';

export interface GoodsReceiptLineInput {
  lineId?: string;
  lineNo?: number;
  poLineId?: string;
  itemId?: string;
  receivedQty: number;
  uomId?: string;
  uom?: string;
  unitCostDoc?: number;
  moveCurrency?: string;
  fxRateMovToBase?: number;
  fxRateCCYToBase?: number;
  description?: string;
}

export interface CreateGoodsReceiptInput {
  companyId: string;
  purchaseOrderId?: string;
  vendorId?: string;
  receiptDate: string;
  warehouseId: string;
  lines?: GoodsReceiptLineInput[];
  notes?: string;
  createdBy: string;
}

export interface ListGoodsReceiptsFilters {
  purchaseOrderId?: string;
  status?: 'DRAFT' | 'POSTED' | 'CANCELLED';
  limit?: number;
}

export interface UpdateGoodsReceiptInput {
  companyId: string;
  id: string;
  vendorId?: string;
  receiptDate?: string;
  warehouseId?: string;
  lines?: GoodsReceiptLineInput[];
  notes?: string;
}

const validatePOLinkedForReceipt = (po: PurchaseOrder): void => {
  if (!['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
    throw new Error(`Purchase order must be CONFIRMED or PARTIALLY_RECEIVED. Current: ${po.status}`);
  }
};

const findPOLine = (po: PurchaseOrder, poLineId?: string, itemId?: string) => {
  if (poLineId) {
    return po.lines.find((line) => line.lineId === poLineId) || null;
  }
  if (itemId) {
    return po.lines.find((line) => line.itemId === itemId) || null;
  }
  return null;
};

export class CreateGoodsReceiptUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository
  ) {}

  async execute(input: CreateGoodsReceiptInput): Promise<GoodsReceipt> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) {
      throw new Error('Purchases module is not initialized');
    }

    if (settings.requirePOForStockItems && !input.purchaseOrderId) {
      throw new Error('A Purchase Order reference is required to create a goods receipt.');
    }

    let po: PurchaseOrder | null = null;
    if (input.purchaseOrderId) {
      po = await this.purchaseOrderRepo.getById(input.companyId, input.purchaseOrderId);
      if (!po) throw new Error(`Purchase order not found: ${input.purchaseOrderId}`);
      validatePOLinkedForReceipt(po);
    }

    let vendorId = input.vendorId || '';
    let vendorName = '';

    if (po) {
      vendorId = po.vendorId;
      vendorName = po.vendorName;
    } else {
      if (!vendorId) throw new Error('vendorId is required for standalone goods receipt');
      const vendor = await this.partyRepo.getById(input.companyId, vendorId);
      if (!vendor) throw new Error(`Vendor not found: ${vendorId}`);
      if (!vendor.roles.includes('VENDOR')) throw new Error(`Party is not a vendor: ${vendorId}`);
      vendorName = vendor.displayName;
    }

    const sourceLines = this.resolveSourceLines(input.lines, po);
    const lines: GoodsReceiptLine[] = [];
    for (let i = 0; i < sourceLines.length; i += 1) {
      const line = sourceLines[i];
      const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
      const itemId = line.itemId || poLine?.itemId;
      if (!itemId) {
        throw new Error(`Line ${i + 1}: itemId is required`);
      }

      const item = await this.itemRepo.getItem(itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${itemId}`);
      }

      const receivedQty = line.receivedQty ?? (poLine ? Math.max(poLine.orderedQty - poLine.receivedQty, 0) : 0);
      const unitCostDoc = line.unitCostDoc ?? poLine?.unitPriceDoc ?? 0;
      const moveCurrency = (line.moveCurrency || po?.currency || item.costCurrency || 'USD').toUpperCase();
      const fxRateMovToBase = line.fxRateMovToBase ?? po?.exchangeRate ?? 1;
      const fxRateCCYToBase = line.fxRateCCYToBase ?? fxRateMovToBase;

      lines.push({
        lineId: line.lineId || randomUUID(),
        lineNo: line.lineNo ?? i + 1,
        poLineId: line.poLineId || poLine?.lineId,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        receivedQty,
        uomId: line.uomId || poLine?.uomId || item.purchaseUomId || item.baseUomId,
        uom: line.uom || poLine?.uom || item.purchaseUom || item.baseUom,
        unitCostDoc,
        unitCostBase: roundMoney(unitCostDoc * fxRateMovToBase),
        moveCurrency,
        fxRateMovToBase,
        fxRateCCYToBase,
        stockMovementId: null,
        description: line.description,
      });
    }

    const now = new Date();
    const grn = new GoodsReceipt({
      id: randomUUID(),
      companyId: input.companyId,
      grnNumber: generateDocumentNumber(settings, 'GRN'),
      purchaseOrderId: po?.id,
      vendorId,
      vendorName,
      receiptDate: input.receiptDate,
      warehouseId: input.warehouseId,
      lines,
      status: 'DRAFT',
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.goodsReceiptRepo.create(grn);
    await this.settingsRepo.saveSettings(settings);
    return grn;
  }

  private resolveSourceLines(lines: GoodsReceiptLineInput[] | undefined, po: PurchaseOrder | null): GoodsReceiptLineInput[] {
    if (Array.isArray(lines) && lines.length > 0) {
      return lines;
    }

    if (!po) {
      throw new Error('At least one line is required');
    }

    return po.lines
      .filter((line) => line.trackInventory && line.orderedQty - line.receivedQty > 0)
      .map((line) => ({
        poLineId: line.lineId,
        itemId: line.itemId,
        receivedQty: roundMoney(line.orderedQty - line.receivedQty),
        uomId: line.uomId,
        uom: line.uom,
        unitCostDoc: line.unitPriceDoc,
        moveCurrency: po.currency,
        fxRateMovToBase: po.exchangeRate,
        fxRateCCYToBase: po.exchangeRate,
        description: line.description,
      }));
  }
}

export class PostGoodsReceiptUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly itemRepo: IItemRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly inventoryService: IPurchasesInventoryService,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly accountRepo: IAccountRepository | undefined,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string, createAccountingEffect: boolean = true): Promise<GoodsReceipt> {
    // ===================================================================
    // FIRESTORE TRANSACTION RULE: All reads must complete before any writes.
    // We pre-fetch ALL data here. The postingLogic callback only writes.
    // ===================================================================

    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Purchases module is not initialized');
    const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(invSettings);
    const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);

    const grn = await this.goodsReceiptRepo.getById(companyId, id);
    if (!grn) throw new Error(`Goods receipt not found: ${id}`);
    if (grn.status !== 'DRAFT') throw new Error('Only DRAFT goods receipts can be posted');

    const warehouse = await this.warehouseRepo.getWarehouse(grn.warehouseId);
    if (!warehouse || warehouse.companyId !== companyId) {
      throw new Error(`Warehouse not found: ${grn.warehouseId}`);
    }

    let po: PurchaseOrder | null = null;
    if (settings.requirePOForStockItems) {
      if (!grn.purchaseOrderId) {
        throw new Error('A Purchase Order reference is required to post a goods receipt.');
      }
    }

    if (grn.purchaseOrderId) {
      po = await this.purchaseOrderRepo.getById(companyId, grn.purchaseOrderId);
      if (!po) throw new Error(`Purchase order not found: ${grn.purchaseOrderId}`);
      if (settings.requirePOForStockItems) {
        validatePOLinkedForReceipt(po);
      }
    }

    const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || 'USD';

    // PHASE 1A: PRE-FETCH ALL MASTER DATA (bare reads before transaction)
    const distinctItemIds = [...new Set(grn.lines.map(l => l.itemId))];
    const itemsMap = new Map<string, Item>();
    for (const itemId of distinctItemIds) {
      const item = await this.itemRepo.getItem(itemId);
      if (item && item.companyId === companyId) {
        itemsMap.set(item.id, item);
      }
    }

    // Validate all items track inventory
    for (const line of grn.lines) {
      const item = itemsMap.get(line.itemId);
      if (!item || item.companyId !== companyId) throw new Error(`Item not found: ${line.itemId}`);
      if (!item.trackInventory) throw new Error(`Goods receipt line item must track inventory: ${item.code}`);
    }

    // PHASE 1B: PRE-FETCH STOCK LEVELS (bare reads before transaction)
    const stockLevelMap = new Map<string, StockLevel>();
    for (const line of grn.lines) {
      const key = `${line.itemId}|${grn.warehouseId}`;
      if (!stockLevelMap.has(key)) {
        const existing = await this.inventoryService.preFetchStockLevel(companyId, line.itemId, grn.warehouseId);
        stockLevelMap.set(key, existing ?? StockLevel.createNew(companyId, line.itemId, grn.warehouseId));
      }
    }

    // PHASE 1C: PRE-FETCH UOM CONVERSIONS (bare reads before transaction)
    const uomConversionMap = new Map<string, any>();
    for (const itemId of distinctItemIds) {
      const item = itemsMap.get(itemId);
      if (item && !uomConversionMap.has(item.id)) {
        const convs = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
        uomConversionMap.set(item.id, convs);
      }
    }

    // PHASE 1D: COMPUTE INVENTORY MOVEMENTS OUTSIDE TRANSACTION (pure computation)
    const inventoryMovements = new Map<string, { movement: StockMovement; updatedLevel: StockLevel }>();
    const receiptAccountingBucket = new Map<string, number>();

    for (const line of grn.lines) {
      const item = itemsMap.get(line.itemId)!;

      const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
      if (po && !poLine) {
        throw new Error(`PO line not found for GRN line ${line.lineId}`);
      }

      // Guarantee a meaningful inbound cost
      if (line.unitCostDoc <= 0) {
        if (poLine && poLine.unitPriceDoc > 0) {
          line.unitCostDoc = poLine.unitPriceDoc;
          line.unitCostBase = roundMoney(line.unitCostDoc * line.fxRateMovToBase);
        } else {
          throw new Error(`Unit cost must be greater than 0 for stock item ${line.itemCode || item.code}`);
        }
      }

      if (poLine) {
        const openQty = poLine.orderedQty - poLine.receivedQty;
        if (!settings.allowOverDelivery) {
          if (line.receivedQty > openQty + 0.000001) {
            throw new Error(`Received qty exceeds open qty for item ${line.itemName || poLine.itemName}`);
          }
        } else {
          const maxQty = openQty * (1 + settings.overDeliveryTolerancePct / 100);
          if (line.receivedQty > maxQty + 0.000001) {
            throw new Error(`Received qty exceeds tolerance for item ${line.itemName || poLine.itemName}`);
          }
        }
      }

      const convs = uomConversionMap.get(item.id) || [];
      const conversionResult = convertItemQtyToBaseUomDetailed({
        qty: line.receivedQty,
        item,
        conversions: convs,
        fromUomId: line.uomId,
        fromUom: line.uom,
        round: roundMoney,
        itemCode: item.code,
      });
      const qtyInBaseUom = conversionResult.qtyInBaseUom;

      // Compute IN movement (mirrors processIN logic but without DB reads)
      const stockLevelKey = `${item.id}|${grn.warehouseId}`;
      const level = stockLevelMap.get(stockLevelKey);
      if (!level) throw new Error(`Stock level not pre-fetched for item ${item.code}`);

      const qtyBefore = level.qtyOnHand;
      const oldMaxBusinessDate = level.maxBusinessDate;
      const unitCostBase = roundMoney(line.unitCostDoc * line.fxRateMovToBase);
      const unitCostCCY = roundMoney(line.unitCostDoc * (line.fxRateCCYToBase || line.fxRateMovToBase));
      const totalCostBase = roundMoney(unitCostBase * qtyInBaseUom);
      const totalCostCCY = roundMoney(unitCostCCY * qtyInBaseUom);
      const moveCurrency = (line.moveCurrency || item.costCurrency || 'USD').toUpperCase();
      const fxRateMovToBase = line.fxRateMovToBase || 1;
      const fxRateCCYToBase = line.fxRateCCYToBase || fxRateMovToBase;

      // AVG cost recalculation
      let newAvgBase = unitCostBase;
      let newAvgCCY = unitCostCCY;
      if (qtyBefore > 0) {
        const newQty = qtyBefore + qtyInBaseUom;
        newAvgBase = roundMoney(((level.avgCostBase * qtyBefore) + (unitCostBase * qtyInBaseUom)) / newQty);
        newAvgCCY = roundMoney(((level.avgCostCCY * qtyBefore) + (unitCostCCY * qtyInBaseUom)) / newQty);
      }

      const settlesNegativeQty = Math.min(qtyInBaseUom, Math.max(-qtyBefore, 0));
      const newPositiveQty = qtyInBaseUom - settlesNegativeQty;
      const qtyAfter = qtyBefore + qtyInBaseUom;

      const movement = new StockMovement({
        id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        companyId,
        date: grn.receiptDate,
        postingSeq: level.postingSeq + 1,
        createdAt: new Date(),
        createdBy: grn.createdBy,
        postedAt: new Date(),
        itemId: item.id,
        warehouseId: grn.warehouseId,
        direction: 'IN',
        movementType: 'PURCHASE_RECEIPT',
        qty: qtyInBaseUom,
        uom: item.baseUom,
        referenceType: 'GOODS_RECEIPT',
        referenceId: grn.id,
        referenceLineId: line.lineId,
        unitCostBase,
        totalCostBase,
        unitCostCCY,
        totalCostCCY,
        movementCurrency: moveCurrency,
        fxRateMovToBase,
        fxRateCCYToBase,
        fxRateKind: 'DOCUMENT',
        avgCostBaseAfter: newAvgBase,
        avgCostCCYAfter: newAvgCCY,
        qtyBefore,
        qtyAfter,
        settlesNegativeQty,
        newPositiveQty,
        negativeQtyAtPosting: qtyAfter < 0,
        costSettled: true,
        isBackdated: grn.receiptDate < oldMaxBusinessDate,
        costSource: 'PURCHASE',
        metadata: {
          uomConversion: {
            conversionId: conversionResult.trace.conversionId,
            mode: conversionResult.trace.mode,
            appliedFactor: conversionResult.trace.factor,
            sourceQty: line.receivedQty,
            sourceUomId: line.uomId,
            sourceUom: line.uom,
            baseUomId: item.baseUomId,
            baseUom: item.baseUom,
          },
        },
      });

      // Update stock level in memory
      level.qtyOnHand += qtyInBaseUom;
      level.avgCostBase = newAvgBase;
      level.avgCostCCY = newAvgCCY;
      level.lastCostBase = unitCostBase;
      level.lastCostCCY = unitCostCCY;
      level.postingSeq += 1;
      level.version += 1;
      level.totalMovements += 1;
      level.maxBusinessDate = grn.receiptDate > oldMaxBusinessDate ? grn.receiptDate : oldMaxBusinessDate;
      level.updatedAt = new Date();
      level.lastMovementId = movement.id;

      line.stockMovementId = movement.id;
      line.unitCostBase = roundMoney(movement.unitCostBase || line.unitCostBase);

      if (poLine) {
        poLine.receivedQty = roundMoney(poLine.receivedQty + line.receivedQty);
      }

      inventoryMovements.set(line.lineId, { movement, updatedLevel: level });

      // Pre-resolve inventory account ID for accounting
      if (DocumentPolicyResolver.shouldPostGoodsReceiptAccounting(accountingMode)) {
        const inventoryAccountId = item.inventoryAssetAccountId || invSettings?.defaultInventoryAssetAccountId;
        if (!inventoryAccountId) {
          throw new Error(`No inventory account configured for item ${item.code}`);
        }
        const resolvedInventoryId = await this.resolveAccountId(companyId, inventoryAccountId);
        const current = receiptAccountingBucket.get(resolvedInventoryId) || 0;
        receiptAccountingBucket.set(
          resolvedInventoryId,
          roundMoney(current + (movement.totalCostBase || roundMoney(qtyInBaseUom * line.unitCostBase)))
        );
      }
    }

    // Pre-resolve base currency and GRNI account
    const resolvedBaseCurrency = (baseCurrency || 'USD').toUpperCase();

    // PHASE 2: TRANSACTION CALLBACK — WRITES ONLY
    await this.transactionManager.runTransaction(async (transaction) => {
      // Write inventory movements and stock levels
      for (const [, { movement, updatedLevel }] of inventoryMovements) {
        await this.inventoryService.writeStockMovement(movement, transaction);
        await this.inventoryService.writeStockLevel(updatedLevel, transaction);
      }

      // Create GRNI voucher if needed
      if (DocumentPolicyResolver.shouldPostGoodsReceiptAccounting(accountingMode) && receiptAccountingBucket.size > 0) {
        if (!settings.defaultGRNIAccountId) {
          throw new Error('Default GRNI account is required for perpetual goods receipt posting.');
        }

        const resolvedGRNIAccountId = await this.resolveAccountId(companyId, settings.defaultGRNIAccountId);

        const voucherLines: Array<Record<string, any>> = [];
        let totalBase = 0;
        for (const [inventoryAccountId, amount] of Array.from(receiptAccountingBucket.entries())) {
          totalBase = roundMoney(totalBase + amount);
          voucherLines.push({
            accountId: inventoryAccountId,
            side: 'Debit',
            amount,
            baseAmount: amount,
            docAmount: amount,
          });
        }
        voucherLines.push({
          accountId: resolvedGRNIAccountId,
          side: 'Credit',
          amount: totalBase,
          baseAmount: totalBase,
          docAmount: totalBase,
        });

        if (shouldPostAccounting) {
          const voucher = await this.accountingPostingService.postInTransaction(
            {
              companyId,
              voucherType: VoucherType.JOURNAL_ENTRY,
              voucherNo: `GRN-${grn.grnNumber}`,
              date: grn.receiptDate,
              description: `Goods Receipt ${grn.grnNumber}`,
              currency: resolvedBaseCurrency,
              exchangeRate: 1,
              lines: voucherLines,
              metadata: {
                sourceModule: 'purchases',
                sourceType: 'GOODS_RECEIPT',
                sourceId: grn.id,
              },
              createdBy: grn.createdBy,
              postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
              reference: grn.grnNumber,
              baseCurrencyOverride: resolvedBaseCurrency,
              skipAccountValidation: true,
            },
            transaction
          );
          grn.voucherId = voucher.id;
        } else {
          grn.voucherId = null;
        }
      } else {
        grn.voucherId = null;
      }

      grn.status = 'POSTED';
      grn.postedAt = new Date();
      grn.updatedAt = new Date();
      await this.goodsReceiptRepo.update(grn, transaction);

      if (po) {
        po.status = updatePOStatus(po);
        po.updatedAt = new Date();
        await this.purchaseOrderRepo.update(po, transaction);
      }
    });

    const posted = await this.goodsReceiptRepo.getById(companyId, id);
    if (!posted) throw new Error(`Goods receipt not found after posting: ${id}`);
    return posted;
  }

  private async resolveAccountId(companyId: string, idOrCode: string): Promise<string> {
    if (!idOrCode) return '';
    if (!this.accountRepo) return idOrCode;
    const acc = (await this.accountRepo.getById(companyId, idOrCode)) || (await this.accountRepo.getByUserCode(companyId, idOrCode));
    return acc ? acc.id : idOrCode;
  }

  private async isAccountingEnabled(companyId: string): Promise<boolean> {
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return !!accountingModule?.initialized;
  }
}

export class GetGoodsReceiptUseCase {
  constructor(private readonly goodsReceiptRepo: IGoodsReceiptRepository) {}

  async execute(companyId: string, id: string): Promise<GoodsReceipt> {
    const grn = await this.goodsReceiptRepo.getById(companyId, id);
    if (!grn) throw new Error(`Goods receipt not found: ${id}`);
    return grn;
  }
}

export class ListGoodsReceiptsUseCase {
  constructor(private readonly goodsReceiptRepo: IGoodsReceiptRepository) {}

  async execute(companyId: string, filters: ListGoodsReceiptsFilters = {}): Promise<GoodsReceipt[]> {
    return this.goodsReceiptRepo.list(companyId, {
      purchaseOrderId: filters.purchaseOrderId,
      status: filters.status,
      limit: filters.limit,
    });
  }
}

export class UpdateGoodsReceiptUseCase {
  constructor(private readonly goodsReceiptRepo: IGoodsReceiptRepository, private readonly partyRepo: IPartyRepository) {}

  async execute(input: UpdateGoodsReceiptInput): Promise<GoodsReceipt> {
    const current = await this.goodsReceiptRepo.getById(input.companyId, input.id);
    if (!current) throw new Error(`Goods receipt not found: ${input.id}`);
    if (current.status !== 'DRAFT') {
      throw new Error('Only draft goods receipts can be updated');
    }

    if (input.vendorId !== undefined) {
      if (!input.vendorId) throw new Error('vendorId is required');
      const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
      if (!vendor) throw new Error(`Vendor not found: ${input.vendorId}`);
      if (!vendor.roles.includes('VENDOR')) throw new Error(`Party is not a vendor: ${input.vendorId}`);
      current.vendorId = vendor.id;
      current.vendorName = vendor.displayName;
    }

    if (input.receiptDate !== undefined) current.receiptDate = input.receiptDate;
    if (input.warehouseId !== undefined) current.warehouseId = input.warehouseId;
    if (input.notes !== undefined) current.notes = input.notes;

    if (input.lines) {
      const existingById = new Map(current.lines.map((line) => [line.lineId, line]));
      const mappedLines: GoodsReceiptLine[] = input.lines.map((line, index) => {
        const existing = line.lineId ? existingById.get(line.lineId) : undefined;
        return {
          lineId: line.lineId || randomUUID(),
          lineNo: line.lineNo ?? existing?.lineNo ?? index + 1,
          poLineId: line.poLineId ?? existing?.poLineId,
          itemId: line.itemId || existing?.itemId || '',
          itemCode: existing?.itemCode || '',
          itemName: existing?.itemName || '',
          receivedQty: line.receivedQty,
          uomId: line.uomId ?? existing?.uomId,
          uom: line.uom || existing?.uom || 'EA',
          unitCostDoc: line.unitCostDoc ?? existing?.unitCostDoc ?? 0,
          unitCostBase: existing?.unitCostBase ?? 0,
          moveCurrency: line.moveCurrency || existing?.moveCurrency || 'USD',
          fxRateMovToBase: line.fxRateMovToBase ?? existing?.fxRateMovToBase ?? 1,
          fxRateCCYToBase: line.fxRateCCYToBase ?? existing?.fxRateCCYToBase ?? 1,
          stockMovementId: existing?.stockMovementId ?? null,
          description: line.description ?? existing?.description,
        };
      });
      current.lines = mappedLines;
    }

    current.updatedAt = new Date();
    const updated = new GoodsReceipt(current.toJSON() as any);
    await this.goodsReceiptRepo.update(updated);
    return updated;
  }
}

export class UnpostGoodsReceiptUseCase {
  constructor(
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly inventoryService: IPurchasesInventoryService,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string, createAccountingEffect: boolean = true): Promise<GoodsReceipt> {
    const grn = await this.goodsReceiptRepo.getById(companyId, id);
    if (!grn) throw new Error(`Goods receipt not found: ${id}`);
    if (grn.status !== 'POSTED') throw new Error('Only POSTED goods receipts can be unposted');

    const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);

    let po: PurchaseOrder | null = null;
    if (grn.purchaseOrderId) {
      po = await this.purchaseOrderRepo.getById(companyId, grn.purchaseOrderId);
    }

    await this.transactionManager.runTransaction(async (transaction) => {
      if (shouldPostAccounting) {
      if (grn.voucherId) {
        await this.accountingPostingService.deleteVoucherInTransaction(companyId, grn.voucherId, transaction);
        grn.voucherId = null;
      }
      }

      // 1. Reverse inventory movements
      for (const line of grn.lines) {
        if (line.stockMovementId) {
          await this.inventoryService.deleteMovement(companyId, line.stockMovementId, transaction);
          line.stockMovementId = null;
        }

        // 2. Reverse PO receivedQty
        if (po) {
          const poLine = findPOLine(po, line.poLineId, line.itemId);
          if (poLine) {
            poLine.receivedQty = roundMoney(Math.max(0, poLine.receivedQty - line.receivedQty));
          }
        }
      }

      // 3. Update PO status
      if (po) {
        po.status = updatePOStatus(po);
        po.updatedAt = new Date();
        await this.purchaseOrderRepo.update(po, transaction);
      }

      // 4. Revert GRN to DRAFT
      grn.status = 'DRAFT';
      grn.postedAt = undefined;
      grn.updatedAt = new Date();
      await this.goodsReceiptRepo.update(grn, transaction);
    });

    const unposted = await this.goodsReceiptRepo.getById(companyId, id);
    if (!unposted) throw new Error('Failed to retrieve goods receipt after unposting');
    return unposted;
  }

  private async isAccountingEnabled(companyId: string): Promise<boolean> {
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return !!accountingModule?.initialized;
  }
}
