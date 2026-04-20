import { randomUUID } from 'crypto';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { roundMoney as roundLedgerMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { Item } from '../../../domain/inventory/entities/Item';
import { GoodsReceipt } from '../../../domain/purchases/entities/GoodsReceipt';
import {
  PaymentStatus,
  PurchaseInvoice,
  PurchaseInvoiceLine,
} from '../../../domain/purchases/entities/PurchaseInvoice';
import {
  PurchaseReturn,
  PurchaseReturnLine,
  PRStatus,
  ReturnContext,
} from '../../../domain/purchases/entities/PurchaseReturn';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { Party } from '../../../domain/shared/entities/Party';
import { IPurchasesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IGoodsReceiptRepository } from '../../../repository/interfaces/purchases/IGoodsReceiptRepository';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPurchaseReturnRepository } from '../../../repository/interfaces/purchases/IPurchaseReturnRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { ICompanySettingsRepository } from '../../../repository/interfaces/core/ICompanySettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import {
  ItemQtyToBaseUomResult,
  convertItemQtyToBaseUomDetailed,
} from '../../inventory/services/UomResolutionService';
import { generateDocumentNumber } from './PurchaseOrderUseCases';
import { roundMoney, updatePOStatus } from './PurchasePostingHelpers';

export interface PurchaseReturnLineInput {
  lineId?: string;
  lineNo?: number;
  piLineId?: string;
  grnLineId?: string;
  poLineId?: string;
  itemId?: string;
  returnQty?: number;
  unitCostDoc?: number;
  uomId?: string;
  uom?: string;
  accountId?: string;
  description?: string;
}

export interface CreatePurchaseReturnInput {
  companyId: string;
  vendorId?: string;
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  purchaseOrderId?: string;
  returnDate: string;
  warehouseId?: string;
  reason: string;
  notes?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseReturnLineInput[];
  createdBy: string;
}

export interface ListPurchaseReturnsFilters {
  vendorId?: string;
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  status?: PRStatus;
}

interface VoucherAccumulatedLine {
  accountId: string;
  side: 'Debit' | 'Credit';
  baseAmount: number;
  docAmount: number;
  notes: string;
  effectiveRate?: number; 
  metadata?: Record<string, any>;
}

const determineReturnContext = (input: CreatePurchaseReturnInput): ReturnContext => {
  if (input.purchaseInvoiceId) return 'AFTER_INVOICE';
  if (input.goodsReceiptId) return 'BEFORE_INVOICE';
  if (input.vendorId) return 'DIRECT';
  throw new Error('purchaseInvoiceId, goodsReceiptId, or vendorId is required to create a purchase return');
};

const findPOLine = (
  po: PurchaseOrder,
  poLineId?: string,
  itemId?: string
): PurchaseOrder['lines'][number] | null => {
  if (poLineId) return po.lines.find((line) => line.lineId === poLineId) || null;
  if (itemId) return po.lines.find((line) => line.itemId === itemId) || null;
  return null;
};

const findPILine = (
  pi: PurchaseInvoice,
  piLineId?: string,
  itemId?: string
): PurchaseInvoiceLine | null => {
  if (piLineId) return pi.lines.find((line) => line.lineId === piLineId) || null;
  if (itemId) return pi.lines.find((line) => line.itemId === itemId) || null;
  return null;
};

const findGRNLine = (
  grn: GoodsReceipt,
  grnLineId?: string,
  itemId?: string
): GoodsReceipt['lines'][number] | null => {
  if (grnLineId) return grn.lines.find((line) => line.lineId === grnLineId) || null;
  if (itemId) return grn.lines.find((line) => line.itemId === itemId) || null;
  return null;
};

const recalcPaymentStatus = (pi: PurchaseInvoice): PaymentStatus => {
  if (pi.outstandingAmountBase <= 0) return 'PAID';
  if (pi.paidAmountBase > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

const recalcReturnTotals = (purchaseReturn: PurchaseReturn): void => {
  purchaseReturn.subtotalDoc = roundMoney(
    purchaseReturn.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * line.unitCostDoc), 0)
  );
  purchaseReturn.subtotalBase = roundMoney(
    purchaseReturn.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * line.unitCostBase), 0)
  );
  purchaseReturn.taxTotalDoc = roundMoney(
    purchaseReturn.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0)
  );
  purchaseReturn.taxTotalBase = roundMoney(
    purchaseReturn.lines.reduce((sum, line) => sum + line.taxAmountBase, 0)
  );
  purchaseReturn.grandTotalDoc = roundMoney(purchaseReturn.subtotalDoc + purchaseReturn.taxTotalDoc);
  purchaseReturn.grandTotalBase = roundMoney(purchaseReturn.subtotalBase + purchaseReturn.taxTotalBase);
};

export class CreatePurchaseReturnUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly purchaseReturnRepo: IPurchaseReturnRepository,
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository
  ) {}

  async execute(input: CreatePurchaseReturnInput): Promise<PurchaseReturn> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Purchases module is not initialized');

    const returnContext = determineReturnContext(input);
    const now = new Date();

    if (returnContext === 'BEFORE_INVOICE' && !settings.requirePOForStockItems) {
      throw new Error('BEFORE_INVOICE returns require "Require Purchase Orders for Stock Items" to be enabled.');
    }

    let purchaseInvoice: PurchaseInvoice | null = null;
    let goodsReceipt: GoodsReceipt | null = null;

    if (returnContext === 'AFTER_INVOICE') {
      purchaseInvoice = await this.purchaseInvoiceRepo.getById(input.companyId, input.purchaseInvoiceId as string);
      if (!purchaseInvoice) throw new Error(`Purchase invoice not found: ${input.purchaseInvoiceId}`);
      if (purchaseInvoice.status !== 'POSTED') {
        throw new Error('Purchase return AFTER_INVOICE requires a posted purchase invoice');
      }
    } else if (returnContext === 'BEFORE_INVOICE') {
      goodsReceipt = await this.goodsReceiptRepo.getById(input.companyId, input.goodsReceiptId as string);
      if (!goodsReceipt) throw new Error(`Goods receipt not found: ${input.goodsReceiptId}`);
      if (goodsReceipt.status !== 'POSTED') {
        throw new Error('Purchase return BEFORE_INVOICE requires a posted goods receipt');
      }
    }

    const lines = purchaseInvoice
      ? this.prefillLinesFromInvoice(purchaseInvoice, input.lines)
      : goodsReceipt
        ? this.prefillLinesFromGoodsReceipt(goodsReceipt, input.lines)
        : await this.createLinesDirectly(input.companyId, input.lines);

    const warehouseId = input.warehouseId
      || (purchaseInvoice ? purchaseInvoice.lines[0]?.warehouseId : undefined)
      || goodsReceipt?.warehouseId
      || settings.defaultWarehouseId;

    if (!warehouseId) {
      throw new Error('warehouseId is required to create purchase return');
    }

    let vendorId = input.vendorId || purchaseInvoice?.vendorId || goodsReceipt?.vendorId;
    let vendorName = purchaseInvoice?.vendorName || goodsReceipt?.vendorName || '';

    if (!vendorId) {
      throw new Error('vendorId is required for purchase return');
    }

    if (!vendorName) {
      const vendor = await this.partyRepo.getById(input.companyId, vendorId);
      vendorName = vendor?.displayName || '';
    }

    const purchaseReturn = new PurchaseReturn({
      id: randomUUID(),
      companyId: input.companyId,
      returnNumber: generateDocumentNumber(settings, 'PR'),
      purchaseInvoiceId: purchaseInvoice?.id,
      goodsReceiptId: goodsReceipt?.id,
      purchaseOrderId: input.purchaseOrderId || purchaseInvoice?.purchaseOrderId || goodsReceipt?.purchaseOrderId,
      vendorId,
      vendorName,
      returnContext,
      returnDate: input.returnDate,
      warehouseId,
      currency: input.currency || purchaseInvoice?.currency || goodsReceipt?.lines[0]?.moveCurrency || 'USD',
      exchangeRate: input.exchangeRate || purchaseInvoice?.exchangeRate || goodsReceipt?.lines[0]?.fxRateMovToBase || 1,
      lines,
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      reason: input.reason,
      notes: input.notes,
      status: 'DRAFT',
      voucherId: null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.purchaseReturnRepo.create(purchaseReturn);
    await this.settingsRepo.saveSettings(settings);
    return purchaseReturn;
  }

  private prefillLinesFromInvoice(
    purchaseInvoice: PurchaseInvoice,
    inputLines?: PurchaseReturnLineInput[]
  ): PurchaseReturnLine[] {
    if (!inputLines?.length) {
      return purchaseInvoice.lines.map((line, index) =>
        this.mapInvoiceLineToReturnLine(line, index + 1, undefined, purchaseInvoice.exchangeRate)
      );
    }

    const mapped = inputLines.map((inputLine, index) => {
      const source = findPILine(purchaseInvoice, inputLine.piLineId, inputLine.itemId);
      if (!source) {
        throw new Error(`Invoice line not found for return line ${index + 1}`);
      }

      return this.mapInvoiceLineToReturnLine(source, index + 1, inputLine, purchaseInvoice.exchangeRate);
    });

    if (!mapped.length) {
      throw new Error('Purchase return must contain at least one line');
    }

    return mapped;
  }

  private prefillLinesFromGoodsReceipt(
    goodsReceipt: GoodsReceipt,
    inputLines?: PurchaseReturnLineInput[]
  ): PurchaseReturnLine[] {
    if (!inputLines?.length) {
      return goodsReceipt.lines.map((line, index) => this.mapGRNLineToReturnLine(line, index + 1, undefined));
    }

    const mapped = inputLines.map((inputLine, index) => {
      const source = findGRNLine(goodsReceipt, inputLine.grnLineId, inputLine.itemId);
      if (!source) {
        throw new Error(`GRN line not found for return line ${index + 1}`);
      }

      return this.mapGRNLineToReturnLine(source, index + 1, inputLine);
    });

    if (!mapped.length) {
      throw new Error('Purchase return must contain at least one line');
    }

    return mapped;
  }

  private mapInvoiceLineToReturnLine(
    invoiceLine: PurchaseInvoiceLine,
    lineNo: number,
    inputLine?: PurchaseReturnLineInput,
    exchangeRate: number = 1
  ): PurchaseReturnLine {
    const returnQty = inputLine?.returnQty ?? invoiceLine.invoicedQty;
    const taxRate = invoiceLine.taxRate || 0;
    const taxAmountDoc = roundMoney(returnQty * invoiceLine.unitPriceDoc * taxRate);
    const taxAmountBase = roundMoney(returnQty * invoiceLine.unitPriceBase * taxRate);

    return {
      lineId: inputLine?.lineId || randomUUID(),
      lineNo: inputLine?.lineNo ?? lineNo,
      piLineId: invoiceLine.lineId,
      grnLineId: invoiceLine.grnLineId,
      poLineId: inputLine?.poLineId || invoiceLine.poLineId,
      itemId: invoiceLine.itemId,
      itemCode: invoiceLine.itemCode,
      itemName: invoiceLine.itemName,
      returnQty,
      uomId: inputLine?.uomId || invoiceLine.uomId,
      uom: inputLine?.uom || invoiceLine.uom,
      unitCostDoc: invoiceLine.unitPriceDoc,
      unitCostBase: invoiceLine.unitPriceBase,
      fxRateMovToBase: exchangeRate,
      fxRateCCYToBase: exchangeRate,
      taxCodeId: invoiceLine.taxCodeId,
      taxCode: invoiceLine.taxCode,
      taxRate,
      taxAmountDoc,
      taxAmountBase,
      accountId: invoiceLine.accountId,
      stockMovementId: null,
      description: inputLine?.description || invoiceLine.description,
    };
  }

  private mapGRNLineToReturnLine(
    grnLine: GoodsReceipt['lines'][number],
    lineNo: number,
    inputLine?: PurchaseReturnLineInput
  ): PurchaseReturnLine {
    const returnQty = inputLine?.returnQty ?? grnLine.receivedQty;
    return {
      lineId: inputLine?.lineId || randomUUID(),
      lineNo: inputLine?.lineNo ?? lineNo,
      grnLineId: grnLine.lineId,
      poLineId: inputLine?.poLineId || grnLine.poLineId,
      itemId: grnLine.itemId,
      itemCode: grnLine.itemCode,
      itemName: grnLine.itemName,
      returnQty,
      uomId: inputLine?.uomId || grnLine.uomId,
      uom: inputLine?.uom || grnLine.uom,
      unitCostDoc: grnLine.unitCostDoc,
      unitCostBase: grnLine.unitCostBase,
      fxRateMovToBase: grnLine.fxRateMovToBase,
      fxRateCCYToBase: grnLine.fxRateCCYToBase,
      taxRate: 0,
      taxAmountDoc: 0,
      taxAmountBase: 0,
      stockMovementId: null,
      description: inputLine?.description || grnLine.description,
    };
  }

  private async createLinesDirectly(companyId: string, inputLines?: PurchaseReturnLineInput[]): Promise<PurchaseReturnLine[]> {
    if (!inputLines?.length) {
      throw new Error('DIRECT purchase return requires lines to be provided manually');
    }

    const lines: PurchaseReturnLine[] = [];
    for (let i = 0; i < inputLines.length; i += 1) {
      const input = inputLines[i];
      if (!input.itemId) throw new Error(`Line ${i + 1}: itemId is required`);
      
      const item = await this.itemRepo.getItem(input.itemId);
      if (!item || item.companyId !== companyId) throw new Error(`Line ${i + 1}: Item not found: ${input.itemId}`);

      const qty = input.returnQty || 0;
      const unitCost = input.unitCostDoc || 0;

      lines.push({
        lineId: input.lineId || randomUUID(),
        lineNo: input.lineNo || (i + 1),
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        returnQty: qty,
        uomId: input.uomId || item.purchaseUomId || item.baseUomId,
        uom: input.uom || item.purchaseUom || item.baseUom,
        unitCostDoc: unitCost,
        unitCostBase: 0, 
        fxRateMovToBase: 0,
        fxRateCCYToBase: 0,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        description: input.description,
      });
    }
    return lines;
  }
}

export class PostPurchaseReturnUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly purchaseReturnRepo: IPurchaseReturnRepository,
    private readonly companySettingsRepo: ICompanySettingsRepository,
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly itemRepo: IItemRepository,
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly inventoryService: IPurchasesInventoryService,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string): Promise<PurchaseReturn> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Purchases module is not initialized');
    const inventorySettings = await this.inventorySettingsRepo.getSettings(companyId);
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(inventorySettings);

    const purchaseReturn = await this.purchaseReturnRepo.getById(companyId, id);
    if (!purchaseReturn) throw new Error(`Purchase return not found: ${id}`);
    if (purchaseReturn.status !== 'DRAFT') {
      throw new Error('Only DRAFT purchase returns can be posted');
    }

    const isAfterInvoice = purchaseReturn.returnContext === 'AFTER_INVOICE';
    const isDirect = purchaseReturn.returnContext === 'DIRECT';
    const shouldCreateVoucher = DocumentPolicyResolver.shouldPurchaseReturnCreateVoucher(
      accountingMode,
      purchaseReturn.returnContext
    );
    let purchaseInvoice: PurchaseInvoice | null = null;
    let goodsReceipt: GoodsReceipt | null = null;
    let purchaseOrder: PurchaseOrder | null = null;

    if (isAfterInvoice) {
      if (!purchaseReturn.purchaseInvoiceId) {
        throw new Error('purchaseInvoiceId is required for AFTER_INVOICE return');
      }
      purchaseInvoice = await this.purchaseInvoiceRepo.getById(companyId, purchaseReturn.purchaseInvoiceId);
      if (!purchaseInvoice) throw new Error(`Purchase invoice not found: ${purchaseReturn.purchaseInvoiceId}`);
      if (purchaseInvoice.status !== 'POSTED') {
        throw new Error('Purchase return AFTER_INVOICE requires posted purchase invoice');
      }
    } else if (purchaseReturn.returnContext === 'BEFORE_INVOICE') {
      if (!settings.requirePOForStockItems) {
        throw new Error('BEFORE_INVOICE returns require "Require Purchase Orders for Stock Items" to be enabled.');
      }
      if (!purchaseReturn.goodsReceiptId) {
        throw new Error('goodsReceiptId is required for BEFORE_INVOICE return');
      }
      goodsReceipt = await this.goodsReceiptRepo.getById(companyId, purchaseReturn.goodsReceiptId);
      if (!goodsReceipt) throw new Error(`Goods receipt not found: ${purchaseReturn.goodsReceiptId}`);
      if (goodsReceipt.status !== 'POSTED') {
        throw new Error('Purchase return BEFORE_INVOICE requires posted goods receipt');
      }
    }

    if (purchaseReturn.purchaseOrderId) {
      purchaseOrder = await this.purchaseOrderRepo.getById(companyId, purchaseReturn.purchaseOrderId);
      if (!purchaseOrder) throw new Error(`Purchase order not found: ${purchaseReturn.purchaseOrderId}`);
    }

    const vendor = await this.partyRepo.getById(companyId, purchaseReturn.vendorId);
    if (!vendor) throw new Error(`Vendor not found: ${purchaseReturn.vendorId}`);

    const voucherLines: VoucherAccumulatedLine[] = [];
    const currentRunQtyBySource = new Map<string, number>();

    const originalMovementByGRNLineId = new Map<string, string>();
    if (isAfterInvoice && purchaseInvoice?.purchaseOrderId) {
      const grns = await this.goodsReceiptRepo.list(companyId, {
        purchaseOrderId: purchaseInvoice.purchaseOrderId,
        status: 'POSTED',
        limit: 500,
      });

      grns.forEach((grn) => {
        grn.lines.forEach((line) => {
          if (line.stockMovementId) {
            originalMovementByGRNLineId.set(line.lineId, line.stockMovementId);
          }
        });
      });
    }

    await this.transactionManager.runTransaction(async (transaction) => {
      for (const line of purchaseReturn.lines) {
        const item = await this.itemRepo.getItem(line.itemId);
        if (!item || item.companyId !== companyId) {
          throw new Error(`Item not found: ${line.itemId}`);
        }

        if (isAfterInvoice) {
          const sourceLine = findPILine(purchaseInvoice as PurchaseInvoice, line.piLineId, line.itemId);
          if (!sourceLine) {
            throw new Error(`Purchase invoice line not found for return line ${line.lineId}`);
          }

          const sourceKey = `PI:${sourceLine.lineId}`;
          const prevReturned = await this.getPreviouslyReturnedQtyForPILine(
            companyId,
            (purchaseInvoice as PurchaseInvoice).id,
            sourceLine.lineId,
            purchaseReturn.id
          );
          const currentRun = currentRunQtyBySource.get(sourceKey) || 0;
          const remaining = roundMoney(sourceLine.invoicedQty - prevReturned - currentRun);
          if (line.returnQty > remaining + 0.000001) {
            throw new Error(`Return qty exceeds invoiced qty for ${line.itemName || sourceLine.itemName}`);
          }
          currentRunQtyBySource.set(sourceKey, roundMoney(currentRun + line.returnQty));

          line.accountId = line.accountId || sourceLine.accountId;
          line.taxCodeId = line.taxCodeId || sourceLine.taxCodeId;
          line.taxCode = line.taxCode || sourceLine.taxCode;
          line.taxRate = Number.isNaN(line.taxRate) ? sourceLine.taxRate : line.taxRate;
          line.unitCostDoc = roundMoney(line.unitCostDoc || sourceLine.unitPriceDoc);
          line.unitCostBase = roundMoney(line.unitCostBase || sourceLine.unitPriceBase);
        } else if (purchaseReturn.returnContext === 'BEFORE_INVOICE') {
          const sourceLine = findGRNLine(goodsReceipt as GoodsReceipt, line.grnLineId, line.itemId);
          if (!sourceLine) {
            throw new Error(`Goods receipt line not found for return line ${line.lineId}`);
          }

          const sourceKey = `GRN:${sourceLine.lineId}`;
          const prevReturned = await this.getPreviouslyReturnedQtyForGRNLine(
            companyId,
            (goodsReceipt as GoodsReceipt).id,
            sourceLine.lineId,
            purchaseReturn.id
          );
          const currentRun = currentRunQtyBySource.get(sourceKey) || 0;
          const remaining = roundMoney(sourceLine.receivedQty - prevReturned - currentRun);
          if (line.returnQty > remaining + 0.000001) {
            throw new Error(`Return qty exceeds received qty for ${line.itemName || sourceLine.itemName}`);
          }
          currentRunQtyBySource.set(sourceKey, roundMoney(currentRun + line.returnQty));

          line.unitCostDoc = roundMoney(line.unitCostDoc || sourceLine.unitCostDoc);
          line.unitCostBase = roundMoney(line.unitCostBase || sourceLine.unitCostBase);
          line.taxRate = 0;
          line.taxCodeId = undefined;
          line.taxCode = undefined;
        } else if (isDirect) {
          line.accountId = line.accountId || settings.defaultPurchaseExpenseAccountId;
          if (!line.accountId) {
             throw new Error(`Account is required for manual return line ${line.lineId}`);
          }
          line.unitCostBase = roundMoney(line.unitCostDoc * purchaseReturn.exchangeRate);
          line.taxRate = 0;
        }

        const lineTotalDoc = roundMoney(line.returnQty * line.unitCostDoc);
        const lineTotalBase = roundMoney(line.returnQty * line.unitCostBase);
        line.taxAmountDoc = roundMoney(lineTotalDoc * (line.taxRate || 0));
        line.taxAmountBase = roundMoney(lineTotalBase * (line.taxRate || 0));

        if (item.trackInventory) {
          const conversionResult = await this.convertToBaseUom(
            companyId,
            line.returnQty,
            line.uomId,
            line.uom,
            item
          );
          const qtyInBaseUom = conversionResult.qtyInBaseUom;

          const reversesMovementId = this.findOriginalMovementId(
            line,
            purchaseInvoice,
            goodsReceipt,
            originalMovementByGRNLineId
          );

          const movement = await this.inventoryService.processOUT({
            companyId,
            itemId: line.itemId,
            warehouseId: purchaseReturn.warehouseId,
            qty: qtyInBaseUom,
            date: purchaseReturn.returnDate,
            movementType: 'RETURN_OUT',
            refs: {
              type: 'PURCHASE_RETURN',
              docId: purchaseReturn.id,
              lineId: line.lineId,
              reversesMovementId,
            } as any,
            currentUser: purchaseReturn.createdBy,
            metadata: {
              uomConversion: {
                conversionId: conversionResult.trace.conversionId,
                mode: conversionResult.trace.mode,
                appliedFactor: conversionResult.trace.factor,
                sourceQty: line.returnQty,
                sourceUomId: line.uomId,
                sourceUom: line.uom,
                baseUomId: item.baseUomId,
                baseUom: item.baseUom,
              },
            },
            transaction,
          } as any);

          line.stockMovementId = movement.id;
        }

        if (isAfterInvoice && shouldCreateVoucher) {
          const creditAccountId = item.trackInventory
            ? this.resolveInventoryAccount(item, inventorySettings?.defaultInventoryAssetAccountId)
            : line.accountId;
          if (!creditAccountId) {
            throw new Error(`accountId is required for AFTER_INVOICE return line ${line.lineId}`);
          }

          voucherLines.push({
            accountId: creditAccountId,
            side: 'Credit',
            baseAmount: lineTotalBase,
            docAmount: lineTotalDoc,
            notes: `Return: ${line.itemName} x ${line.returnQty}`,
            effectiveRate: line.unitCostDoc > 0 ? line.unitCostBase / line.unitCostDoc : purchaseReturn.exchangeRate,
            metadata: {
              sourceModule: 'purchases',
              sourceType: 'PURCHASE_RETURN',
              sourceId: purchaseReturn.id,
              lineId: line.lineId,
              itemId: line.itemId,
            },
          });

          if (line.taxAmountBase > 0) {
            const taxAccountId = await this.resolvePurchaseTaxAccount(companyId, line.taxCodeId);
            voucherLines.push({
              accountId: taxAccountId,
              side: 'Credit',
              baseAmount: line.taxAmountBase,
              docAmount: line.taxAmountDoc,
              notes: `Tax reversal: ${line.taxCode || line.taxCodeId || ''}`,
              effectiveRate: line.taxAmountDoc > 0 ? line.taxAmountBase / line.taxAmountDoc : purchaseReturn.exchangeRate,
              metadata: {
                sourceModule: 'purchases',
                sourceType: 'PURCHASE_RETURN',
                sourceId: purchaseReturn.id,
                lineId: line.lineId,
                taxCodeId: line.taxCodeId,
              },
            });
          }
        } else if (purchaseReturn.returnContext === 'BEFORE_INVOICE' && shouldCreateVoucher) {
          const inventoryAccountId = this.resolveInventoryAccount(item, inventorySettings?.defaultInventoryAssetAccountId);
          voucherLines.push({
            accountId: inventoryAccountId,
            side: 'Credit',
            baseAmount: lineTotalBase,
            docAmount: lineTotalDoc,
            notes: `Return before invoice: ${line.itemName} x ${line.returnQty}`,
            metadata: {
              sourceModule: 'purchases',
              sourceType: 'PURCHASE_RETURN',
              sourceId: purchaseReturn.id,
              lineId: line.lineId,
              itemId: line.itemId,
            },
          });
        } else if (isDirect && shouldCreateVoucher) {
           if (!line.accountId) throw new Error(`Account is required for direct return line ${line.lineId}`);
           voucherLines.push({
             accountId: line.accountId,
             side: 'Credit',
             baseAmount: lineTotalBase,
             docAmount: lineTotalDoc,
             notes: `Direct Return: ${line.itemName} x ${line.returnQty}`,
             metadata: {
               sourceModule: 'purchases',
               sourceType: 'PURCHASE_RETURN',
               sourceId: purchaseReturn.id,
               lineId: line.lineId,
               itemId: line.itemId,
             },
           });
        }

        if (purchaseOrder) {
          const poLine = findPOLine(purchaseOrder, line.poLineId, line.itemId);
          if (poLine) {
            if (!isAfterInvoice) {
              const nextReceivedQty = roundMoney(poLine.receivedQty - line.returnQty);
              if (nextReceivedQty < -0.000001) {
                throw new Error(`Return qty would make receivedQty negative for PO line ${poLine.lineId}`);
              }
              poLine.receivedQty = Math.max(0, nextReceivedQty);
            }

            poLine.returnedQty = roundMoney(poLine.returnedQty + line.returnQty);
          }
        }
      }

      recalcReturnTotals(purchaseReturn);

      if (isAfterInvoice || isDirect) {
        const apAccountId = this.resolveAPAccount(vendor, settings.defaultAPAccountId);
        const apDebitBase = roundMoney(purchaseReturn.grandTotalDoc * purchaseReturn.exchangeRate);

        voucherLines.push({
          accountId: apAccountId,
          side: 'Debit',
          baseAmount: apDebitBase,
          docAmount: purchaseReturn.grandTotalDoc,
          notes: `AP reversal - ${purchaseReturn.vendorName} - Return ${purchaseReturn.returnNumber} @ ${purchaseReturn.exchangeRate}`,
          effectiveRate: purchaseReturn.exchangeRate,
          metadata: {
            sourceModule: 'purchases',
            sourceType: 'PURCHASE_RETURN',
            sourceId: purchaseReturn.id,
            vendorId: purchaseReturn.vendorId,
          },
        });

        const inventoryTaxCreditBase = purchaseReturn.grandTotalBase;
        const exchangeDiff = roundMoney(apDebitBase - inventoryTaxCreditBase);

        if (Math.abs(exchangeDiff) > 0.001) {
          let gainLossAccountId = settings.exchangeGainLossAccountId;
          
          if (!gainLossAccountId) {
            const globalSettings = await this.companySettingsRepo.getSettings(companyId);
            gainLossAccountId = globalSettings?.exchangeGainLossAccountId;
          }

          if (!gainLossAccountId) {
            throw new Error('Exchange Gain/Loss account is not configured in Purchases or Global Accounting Settings. Cannot post multi-currency return with rate difference.');
          }

          voucherLines.push({
            accountId: gainLossAccountId,
            side: exchangeDiff > 0 ? 'Credit' : 'Debit',
            baseAmount: Math.abs(exchangeDiff),
            docAmount: 0,
            notes: `Exchange ${exchangeDiff > 0 ? 'Gain' : 'Loss'} on Purchase Return ${purchaseReturn.returnNumber}`,
            metadata: {
              sourceModule: 'purchases',
              sourceType: 'PURCHASE_RETURN',
              sourceId: purchaseReturn.id,
              isExchangeDifference: true,
            },
          });
        }

        const voucher = await this.accountingPostingService.postInTransaction(
          {
            companyId,
            voucherType: VoucherType.PURCHASE_RETURN,
            voucherNo: `RET-VCH-${purchaseReturn.returnNumber}`,
            date: purchaseReturn.returnDate,
            description: `Purchase Return: ${purchaseReturn.returnNumber} - ${purchaseReturn.vendorName}`,
            currency: purchaseReturn.currency,
            exchangeRate: purchaseReturn.exchangeRate,
            lines: voucherLines,
            metadata: {
              sourceModule: 'purchases',
              sourceType: 'PURCHASE_RETURN',
              sourceId: purchaseReturn.id,
              originType: 'purchase_return',
            },
            createdBy: purchaseReturn.createdBy,
            postingLockPolicy: PostingLockPolicy.STRICT_LOCKED,
            reference: purchaseReturn.returnNumber,
          },
          transaction
        );
        purchaseReturn.voucherId = voucher.id;

        if (isAfterInvoice) {
          const invoice = purchaseInvoice as PurchaseInvoice;
          invoice.outstandingAmountBase = roundMoney(invoice.outstandingAmountBase - purchaseReturn.grandTotalBase);
          invoice.paymentStatus = recalcPaymentStatus(invoice);
          invoice.updatedAt = new Date();
          await this.purchaseInvoiceRepo.update(invoice, transaction);
        }
      } else if (shouldCreateVoucher) {
        if (!settings.defaultGRNIAccountId) {
          throw new Error('Default GRNI account is required for perpetual goods-return reversals before invoice.');
        }

        voucherLines.push({
          accountId: settings.defaultGRNIAccountId,
          side: 'Debit',
          baseAmount: purchaseReturn.grandTotalBase,
          docAmount: purchaseReturn.grandTotalDoc,
          notes: `GRNI reversal - ${purchaseReturn.vendorName} - Return ${purchaseReturn.returnNumber}`,
          metadata: {
            sourceModule: 'purchases',
            sourceType: 'PURCHASE_RETURN',
            sourceId: purchaseReturn.id,
            vendorId: purchaseReturn.vendorId,
          },
        });

        const voucher = await this.accountingPostingService.postInTransaction(
          {
            companyId,
            voucherType: VoucherType.PURCHASE_RETURN,
            voucherNo: `RET-VCH-${purchaseReturn.returnNumber}`,
            date: purchaseReturn.returnDate,
            description: `Purchase Return: ${purchaseReturn.returnNumber} - ${purchaseReturn.vendorName}`,
            currency: purchaseReturn.currency,
            exchangeRate: purchaseReturn.exchangeRate,
            lines: voucherLines,
            metadata: {
              sourceModule: 'purchases',
              sourceType: 'PURCHASE_RETURN',
              sourceId: purchaseReturn.id,
              originType: 'purchase_return',
            },
            createdBy: purchaseReturn.createdBy,
            postingLockPolicy: PostingLockPolicy.STRICT_LOCKED,
            reference: purchaseReturn.returnNumber,
          },
          transaction
        );
        purchaseReturn.voucherId = voucher.id;
      } else {
        purchaseReturn.voucherId = null;
      }

      purchaseReturn.status = 'POSTED';
      purchaseReturn.postedAt = new Date();
      purchaseReturn.updatedAt = new Date();
      await this.purchaseReturnRepo.update(purchaseReturn, transaction);

      if (purchaseOrder) {
        purchaseOrder.status = updatePOStatus(purchaseOrder);
        purchaseOrder.updatedAt = new Date();
        await this.purchaseOrderRepo.update(purchaseOrder, transaction);
      }
    });

    const posted = await this.purchaseReturnRepo.getById(companyId, id);
    if (!posted) throw new Error(`Purchase return not found after posting: ${id}`);
    return posted;
  }

  private resolveAPAccount(vendor: Party, defaultAPAccountId: string): string {
    return vendor.defaultAPAccountId || defaultAPAccountId;
  }

  private resolveInventoryAccount(item: Item, defaultInventoryAccountId?: string): string {
    const inventoryAccountId = item.inventoryAssetAccountId || defaultInventoryAccountId;
    if (!inventoryAccountId) {
      throw new Error(`No inventory account configured for item ${item.code}`);
    }
    return inventoryAccountId;
  }

  private async resolvePurchaseTaxAccount(companyId: string, taxCodeId?: string): Promise<string> {
    if (!taxCodeId) throw new Error('taxCodeId is required for tax reversal line');
    const taxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
    if (!taxCode) throw new Error(`Tax code not found: ${taxCodeId}`);
    if (!taxCode.purchaseTaxAccountId) {
      throw new Error(`TaxCode ${taxCode.code} has no purchase tax account`);
    }
    return taxCode.purchaseTaxAccountId;
  }

  private async convertToBaseUom(
    companyId: string,
    qty: number,
    uomId: string | undefined,
    uom: string,
    item: Item
  ): Promise<ItemQtyToBaseUomResult> {
    const conversions = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
    return convertItemQtyToBaseUomDetailed({
      qty,
      item,
      conversions,
      fromUomId: uomId,
      fromUom: uom,
      round: roundLedgerMoney,
      itemCode: item.code,
    });
  }

  private async getPreviouslyReturnedQtyForPILine(
    companyId: string,
    purchaseInvoiceId: string,
    piLineId: string,
    excludeReturnId: string
  ): Promise<number> {
    const returns = await this.purchaseReturnRepo.list(companyId, {
      purchaseInvoiceId,
      status: 'POSTED',
    });

    return roundMoney(
      returns.reduce((sum, entry) => {
        if (entry.id === excludeReturnId) return sum;
        const qty = entry.lines
          .filter((line) => line.piLineId === piLineId)
          .reduce((lineSum, line) => lineSum + line.returnQty, 0);
        return sum + qty;
      }, 0)
    );
  }

  private async getPreviouslyReturnedQtyForGRNLine(
    companyId: string,
    goodsReceiptId: string,
    grnLineId: string,
    excludeReturnId: string
  ): Promise<number> {
    const returns = await this.purchaseReturnRepo.list(companyId, {
      goodsReceiptId,
      status: 'POSTED',
    });

    return roundMoney(
      returns.reduce((sum, entry) => {
        if (entry.id === excludeReturnId) return sum;
        const qty = entry.lines
          .filter((line) => line.grnLineId === grnLineId)
          .reduce((lineSum, line) => lineSum + line.returnQty, 0);
        return sum + qty;
      }, 0)
    );
  }

  private findOriginalMovementId(
    line: PurchaseReturnLine,
    purchaseInvoice: PurchaseInvoice | null,
    goodsReceipt: GoodsReceipt | null,
    grnMovementByLineId: Map<string, string>
  ): string | undefined {
    if (line.grnLineId && goodsReceipt) {
      const source = findGRNLine(goodsReceipt, line.grnLineId, line.itemId);
      return source?.stockMovementId;
    }
    if (line.grnLineId) {
      return grnMovementByLineId.get(line.grnLineId);
    }
    return undefined;
  }

}

export interface UpdatePurchaseReturnInput {
  id: string;
  companyId: string;
  vendorId?: string;
  returnDate?: string;
  warehouseId?: string;
  reason?: string;
  notes?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseReturnLineInput[];
}

export class UpdatePurchaseReturnUseCase {
  constructor(
    private readonly purchaseReturnRepo: IPurchaseReturnRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository
  ) {}

  async execute(input: UpdatePurchaseReturnInput): Promise<PurchaseReturn> {
    const existing = await this.purchaseReturnRepo.getById(input.companyId, input.id);
    if (!existing) throw new Error(`Purchase return not found: ${input.id}`);
    if (existing.status !== 'DRAFT') {
      throw new Error('Only DRAFT purchase returns can be updated directly. Unpost the document first if it is already posted.');
    }

    if (input.vendorId && input.vendorId !== existing.vendorId) {
      if (existing.purchaseInvoiceId || existing.goodsReceiptId) {
        throw new Error('Vendor cannot be changed for a source-linked return.');
      }
      const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
      if (!vendor) throw new Error(`Vendor not found: ${input.vendorId}`);
      existing.vendorId = vendor.id;
      existing.vendorName = vendor.displayName || '';
    }

    if (input.returnDate) existing.returnDate = input.returnDate;
    if (input.warehouseId) existing.warehouseId = input.warehouseId;
    if (input.reason) existing.reason = input.reason;
    if (input.notes !== undefined) existing.notes = input.notes;
    if (input.currency) existing.currency = input.currency;
    if (input.exchangeRate) existing.exchangeRate = input.exchangeRate;

    if (input.lines) {
      const newLines: PurchaseReturnLine[] = [];
      for (let i = 0; i < input.lines.length; i++) {
        const lineInput = input.lines[i];
        if (!lineInput.itemId) throw new Error(`Line ${i + 1}: itemId is required`);
        const item = await this.itemRepo.getItem(lineInput.itemId);
        if (!item) throw new Error(`Line ${i + 1}: Item not found: ${lineInput.itemId}`);

        const returnQty = lineInput.returnQty || 0;
        const unitCostDoc = lineInput.unitCostDoc || 0;
        const unitCostBase = roundMoney(unitCostDoc * existing.exchangeRate);

        newLines.push({
          lineId: lineInput.lineId || randomUUID(),
          lineNo: lineInput.lineNo || (i + 1),
          piLineId: lineInput.piLineId,
          grnLineId: lineInput.grnLineId,
          poLineId: lineInput.poLineId,
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          returnQty,
          uomId: lineInput.uomId || item.purchaseUomId || item.baseUomId,
          uom: lineInput.uom || item.purchaseUom || item.baseUom,
          unitCostDoc,
          unitCostBase,
          fxRateMovToBase: existing.exchangeRate,
          fxRateCCYToBase: existing.exchangeRate,
          taxRate: 0, 
          taxAmountDoc: 0,
          taxAmountBase: 0,
          accountId: lineInput.accountId,
          description: lineInput.description,
        });
      }
      existing.lines = newLines;
    }

    recalcReturnTotals(existing);
    existing.updatedAt = new Date();

    await this.purchaseReturnRepo.update(existing);
    return existing;
  }
}

export class UnpostPurchaseReturnUseCase {
  constructor(
    private readonly purchaseReturnRepo: IPurchaseReturnRepository,
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly inventoryService: IPurchasesInventoryService,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string, currentUser: string): Promise<PurchaseReturn> {
    const purchaseReturn = await this.purchaseReturnRepo.getById(companyId, id);
    if (!purchaseReturn) throw new Error(`Purchase return not found: ${id}`);
    if (purchaseReturn.status !== 'POSTED') {
      throw new Error('Only POSTED purchase returns can be unposted');
    }

    let purchaseInvoice: PurchaseInvoice | null = null;
    let purchaseOrder: PurchaseOrder | null = null;

    if (purchaseReturn.purchaseInvoiceId) {
      purchaseInvoice = await this.purchaseInvoiceRepo.getById(companyId, purchaseReturn.purchaseInvoiceId);
    }
    if (purchaseReturn.purchaseOrderId) {
      purchaseOrder = await this.purchaseOrderRepo.getById(companyId, purchaseReturn.purchaseOrderId);
    }

    await this.transactionManager.runTransaction(async (transaction) => {
      if (purchaseReturn.voucherId) {
        await this.accountingPostingService.deleteVoucherInTransaction(companyId, purchaseReturn.voucherId, transaction);
        purchaseReturn.voucherId = null;
      }

      for (const line of purchaseReturn.lines) {
        if (line.stockMovementId) {
          await this.inventoryService.deleteMovement(companyId, line.stockMovementId, transaction);
          line.stockMovementId = null;
        }

        if (purchaseOrder) {
          const poLine = findPOLine(purchaseOrder, line.poLineId, line.itemId);
          if (poLine) {
            if (purchaseReturn.returnContext === 'BEFORE_INVOICE') {
               poLine.receivedQty = roundMoney(poLine.receivedQty + line.returnQty);
            }
            poLine.returnedQty = roundMoney(poLine.returnedQty - line.returnQty);
          }
        }
      }

      if (purchaseInvoice) {
        purchaseInvoice.outstandingAmountBase = roundMoney(purchaseInvoice.outstandingAmountBase + purchaseReturn.grandTotalBase);
        purchaseInvoice.paymentStatus = recalcPaymentStatus(purchaseInvoice);
        purchaseInvoice.updatedAt = new Date();
        await this.purchaseInvoiceRepo.update(purchaseInvoice, transaction);
      }

      if (purchaseOrder) {
        purchaseOrder.status = updatePOStatus(purchaseOrder);
        purchaseOrder.updatedAt = new Date();
        await this.purchaseOrderRepo.update(purchaseOrder, transaction);
      }

      purchaseReturn.status = 'DRAFT';
      purchaseReturn.postedAt = undefined;
      purchaseReturn.updatedAt = new Date();
      await this.purchaseReturnRepo.update(purchaseReturn, transaction);
    });

    const unposted = await this.purchaseReturnRepo.getById(companyId, id);
    if (!unposted) throw new Error('Failed to retrieve return after unposting');
    return unposted;
  }
}

export class GetPurchaseReturnUseCase {
  constructor(private readonly purchaseReturnRepo: IPurchaseReturnRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseReturn> {
    const pr = await this.purchaseReturnRepo.getById(companyId, id);
    if (!pr) throw new Error(`Purchase return not found: ${id}`);
    return pr;
  }
}

export class ListPurchaseReturnsUseCase {
  constructor(private readonly purchaseReturnRepo: IPurchaseReturnRepository) {}

  async execute(companyId: string, filters: ListPurchaseReturnsFilters): Promise<PurchaseReturn[]> {
    return this.purchaseReturnRepo.list(companyId, filters);
  }
}
