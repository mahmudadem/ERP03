import { randomUUID } from 'crypto';
import { IPurchasesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { GoodsReceipt, GoodsReceiptLine } from '../../../domain/purchases/entities/GoodsReceipt';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IGoodsReceiptRepository } from '../../../repository/interfaces/purchases/IGoodsReceiptRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { generateDocumentNumber } from './PurchaseOrderUseCases';
import { roundMoney, updatePOStatus } from './PurchasePostingHelpers';

export interface GoodsReceiptLineInput {
  lineId?: string;
  lineNo?: number;
  poLineId?: string;
  itemId?: string;
  receivedQty: number;
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

    if (settings.procurementControlMode === 'CONTROLLED' && !input.purchaseOrderId) {
      throw new Error('purchaseOrderId is required in CONTROLLED mode');
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
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly itemRepo: IItemRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly inventoryService: IPurchasesInventoryService,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string): Promise<GoodsReceipt> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Purchases module is not initialized');

    const grn = await this.goodsReceiptRepo.getById(companyId, id);
    if (!grn) throw new Error(`Goods receipt not found: ${id}`);
    if (grn.status !== 'DRAFT') throw new Error('Only DRAFT goods receipts can be posted');

    const warehouse = await this.warehouseRepo.getWarehouse(grn.warehouseId);
    if (!warehouse || warehouse.companyId !== companyId) {
      throw new Error(`Warehouse not found: ${grn.warehouseId}`);
    }

    let po: PurchaseOrder | null = null;
    if (settings.procurementControlMode === 'CONTROLLED') {
      if (!grn.purchaseOrderId) {
        throw new Error('purchaseOrderId is required in CONTROLLED mode');
      }
    }

    if (grn.purchaseOrderId) {
      po = await this.purchaseOrderRepo.getById(companyId, grn.purchaseOrderId);
      if (!po) throw new Error(`Purchase order not found: ${grn.purchaseOrderId}`);
      if (settings.procurementControlMode === 'CONTROLLED') {
        validatePOLinkedForReceipt(po);
      }
    }

    await this.transactionManager.runTransaction(async (transaction) => {
      for (const line of grn.lines) {
        const item = await this.itemRepo.getItem(line.itemId);
        if (!item || item.companyId !== companyId) {
          throw new Error(`Item not found: ${line.itemId}`);
        }
        if (!item.trackInventory) {
          throw new Error(`Goods receipt line item must track inventory: ${item.code}`);
        }

        const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
        if (po && !poLine) {
          throw new Error(`PO line not found for GRN line ${line.lineId}`);
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

        const qtyInBaseUom = await this.convertToBaseUom(companyId, line.receivedQty, line.uom, item.baseUom, item.id, item.code);
        const movement = await this.inventoryService.processIN({
          companyId,
          itemId: line.itemId,
          warehouseId: grn.warehouseId,
          qty: qtyInBaseUom,
          date: grn.receiptDate,
          movementType: 'PURCHASE_RECEIPT',
          refs: {
            type: 'GOODS_RECEIPT',
            docId: grn.id,
            lineId: line.lineId,
          },
          currentUser: grn.createdBy,
          unitCostInMoveCurrency: line.unitCostDoc,
          moveCurrency: line.moveCurrency,
          fxRateMovToBase: line.fxRateMovToBase,
          fxRateCCYToBase: line.fxRateCCYToBase,
          transaction,
        } as any);

        line.stockMovementId = movement.id;
        if (poLine) {
          poLine.receivedQty = roundMoney(poLine.receivedQty + line.receivedQty);
        }
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

  private async convertToBaseUom(
    companyId: string,
    qty: number,
    uom: string,
    baseUom: string,
    itemId: string,
    itemCode: string
  ): Promise<number> {
    if (uom.toUpperCase() === baseUom.toUpperCase()) {
      return qty;
    }

    const conversions = await this.uomConversionRepo.getConversionsForItem(companyId, itemId, { active: true });
    const normalizedFrom = uom.toUpperCase();
    const normalizedTo = baseUom.toUpperCase();

    const direct = conversions.find(
      (conversion) =>
        conversion.active &&
        conversion.fromUom.toUpperCase() === normalizedFrom &&
        conversion.toUom.toUpperCase() === normalizedTo
    );
    if (direct) return roundMoney(qty * direct.factor);

    const reverse = conversions.find(
      (conversion) =>
        conversion.active &&
        conversion.fromUom.toUpperCase() === normalizedTo &&
        conversion.toUom.toUpperCase() === normalizedFrom
    );
    if (reverse) return roundMoney(qty / reverse.factor);

    throw new Error(`No UOM conversion from ${uom} to ${baseUom} for item ${itemCode}`);
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
