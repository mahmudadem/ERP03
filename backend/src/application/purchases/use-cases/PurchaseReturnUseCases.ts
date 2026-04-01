import { randomUUID } from 'crypto';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { PostingLockPolicy, VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
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
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IGoodsReceiptRepository } from '../../../repository/interfaces/purchases/IGoodsReceiptRepository';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPurchaseReturnRepository } from '../../../repository/interfaces/purchases/IPurchaseReturnRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
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
  description?: string;
}

export interface CreatePurchaseReturnInput {
  companyId: string;
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  purchaseOrderId?: string;
  returnDate: string;
  warehouseId?: string;
  reason: string;
  notes?: string;
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
  metadata?: Record<string, any>;
}

const determineReturnContext = (input: CreatePurchaseReturnInput): ReturnContext => {
  if (input.purchaseInvoiceId) return 'AFTER_INVOICE';
  if (input.goodsReceiptId) return 'BEFORE_INVOICE';
  throw new Error('purchaseInvoiceId or goodsReceiptId is required to create a purchase return');
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
    private readonly goodsReceiptRepo: IGoodsReceiptRepository
  ) {}

  async execute(input: CreatePurchaseReturnInput): Promise<PurchaseReturn> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Purchases module is not initialized');

    const returnContext = determineReturnContext(input);
    const now = new Date();

    if (returnContext === 'BEFORE_INVOICE' && settings.procurementControlMode !== 'CONTROLLED') {
      throw new Error('BEFORE_INVOICE returns are only allowed in CONTROLLED mode');
    }

    let purchaseInvoice: PurchaseInvoice | null = null;
    let goodsReceipt: GoodsReceipt | null = null;

    if (returnContext === 'AFTER_INVOICE') {
      purchaseInvoice = await this.purchaseInvoiceRepo.getById(input.companyId, input.purchaseInvoiceId as string);
      if (!purchaseInvoice) throw new Error(`Purchase invoice not found: ${input.purchaseInvoiceId}`);
      if (purchaseInvoice.status !== 'POSTED') {
        throw new Error('Purchase return AFTER_INVOICE requires a posted purchase invoice');
      }
    } else {
      goodsReceipt = await this.goodsReceiptRepo.getById(input.companyId, input.goodsReceiptId as string);
      if (!goodsReceipt) throw new Error(`Goods receipt not found: ${input.goodsReceiptId}`);
      if (goodsReceipt.status !== 'POSTED') {
        throw new Error('Purchase return BEFORE_INVOICE requires a posted goods receipt');
      }
    }

    const lines = purchaseInvoice
      ? this.prefillLinesFromInvoice(purchaseInvoice, input.lines)
      : this.prefillLinesFromGoodsReceipt(goodsReceipt as GoodsReceipt, input.lines);

    const warehouseId = input.warehouseId
      || (purchaseInvoice ? purchaseInvoice.lines[0]?.warehouseId : undefined)
      || goodsReceipt?.warehouseId
      || settings.defaultWarehouseId;

    if (!warehouseId) {
      throw new Error('warehouseId is required to create purchase return');
    }

    const purchaseReturn = new PurchaseReturn({
      id: randomUUID(),
      companyId: input.companyId,
      returnNumber: generateDocumentNumber(settings, 'PR'),
      purchaseInvoiceId: purchaseInvoice?.id,
      goodsReceiptId: goodsReceipt?.id,
      purchaseOrderId: input.purchaseOrderId || purchaseInvoice?.purchaseOrderId || goodsReceipt?.purchaseOrderId,
      vendorId: purchaseInvoice?.vendorId || (goodsReceipt as GoodsReceipt).vendorId,
      vendorName: purchaseInvoice?.vendorName || (goodsReceipt as GoodsReceipt).vendorName,
      returnContext,
      returnDate: input.returnDate,
      warehouseId,
      currency: purchaseInvoice?.currency || goodsReceipt?.lines[0]?.moveCurrency || 'USD',
      exchangeRate: purchaseInvoice?.exchangeRate || goodsReceipt?.lines[0]?.fxRateMovToBase || 1,
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
      uom: invoiceLine.uom,
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
      uom: grnLine.uom,
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
}

export class PostPurchaseReturnUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly purchaseReturnRepo: IPurchaseReturnRepository,
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly itemRepo: IItemRepository,
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly inventoryService: IPurchasesInventoryService,
    private readonly voucherRepo: IVoucherRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string): Promise<PurchaseReturn> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Purchases module is not initialized');

    const purchaseReturn = await this.purchaseReturnRepo.getById(companyId, id);
    if (!purchaseReturn) throw new Error(`Purchase return not found: ${id}`);
    if (purchaseReturn.status !== 'DRAFT') {
      throw new Error('Only DRAFT purchase returns can be posted');
    }

    const isAfterInvoice = purchaseReturn.returnContext === 'AFTER_INVOICE';
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
    } else {
      if (settings.procurementControlMode !== 'CONTROLLED') {
        throw new Error('BEFORE_INVOICE returns are only allowed in CONTROLLED mode');
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

    const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || purchaseReturn.currency;
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
        } else {
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
        }

        const lineTotalDoc = roundMoney(line.returnQty * line.unitCostDoc);
        const lineTotalBase = roundMoney(line.returnQty * line.unitCostBase);
        line.taxAmountDoc = roundMoney(lineTotalDoc * (line.taxRate || 0));
        line.taxAmountBase = roundMoney(lineTotalBase * (line.taxRate || 0));

        if (item.trackInventory) {
          const qtyInBaseUom = await this.convertToBaseUom(
            companyId,
            line.returnQty,
            line.uom,
            item.baseUom,
            item.id,
            item.code
          );

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
            transaction,
          } as any);

          line.stockMovementId = movement.id;
        }

        if (isAfterInvoice) {
          if (!line.accountId) {
            throw new Error(`accountId is required for AFTER_INVOICE return line ${line.lineId}`);
          }

          voucherLines.push({
            accountId: line.accountId,
            side: 'Credit',
            baseAmount: lineTotalBase,
            docAmount: lineTotalDoc,
            notes: `Return: ${line.itemName} x ${line.returnQty}`,
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
              metadata: {
                sourceModule: 'purchases',
                sourceType: 'PURCHASE_RETURN',
                sourceId: purchaseReturn.id,
                lineId: line.lineId,
                taxCodeId: line.taxCodeId,
              },
            });
          }
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

      if (isAfterInvoice) {
        const apAccountId = this.resolveAPAccount(vendor, settings.defaultAPAccountId);
        voucherLines.push({
          accountId: apAccountId,
          side: 'Debit',
          baseAmount: purchaseReturn.grandTotalBase,
          docAmount: purchaseReturn.grandTotalDoc,
          notes: `AP reversal - ${purchaseReturn.vendorName} - Return ${purchaseReturn.returnNumber}`,
          metadata: {
            sourceModule: 'purchases',
            sourceType: 'PURCHASE_RETURN',
            sourceId: purchaseReturn.id,
            vendorId: purchaseReturn.vendorId,
          },
        });

        const voucher = await this.createAccountingVoucherInTransaction(
          transaction,
          purchaseReturn,
          baseCurrency,
          voucherLines
        );
        purchaseReturn.voucherId = voucher.id;

        const invoice = purchaseInvoice as PurchaseInvoice;
        invoice.outstandingAmountBase = roundMoney(invoice.outstandingAmountBase - purchaseReturn.grandTotalBase);
        invoice.paymentStatus = recalcPaymentStatus(invoice);
        invoice.updatedAt = new Date();
        await this.purchaseInvoiceRepo.update(invoice, transaction);
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
        conversion.active
        && conversion.fromUom.toUpperCase() === normalizedFrom
        && conversion.toUom.toUpperCase() === normalizedTo
    );
    if (direct) return roundMoney(qty * direct.factor);

    const reverse = conversions.find(
      (conversion) =>
        conversion.active
        && conversion.fromUom.toUpperCase() === normalizedTo
        && conversion.toUom.toUpperCase() === normalizedFrom
    );
    if (reverse) return roundMoney(qty / reverse.factor);

    throw new Error(`No UOM conversion from ${uom} to ${baseUom} for item ${itemCode}`);
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
      if (source?.stockMovementId) return source.stockMovementId;
    }

    if (line.piLineId && purchaseInvoice) {
      const source = findPILine(purchaseInvoice, line.piLineId, line.itemId);
      if (source?.stockMovementId) return source.stockMovementId || undefined;
      if (source?.grnLineId) {
        return grnMovementByLineId.get(source.grnLineId);
      }
    }

    if (line.grnLineId) {
      return grnMovementByLineId.get(line.grnLineId);
    }

    return undefined;
  }

  private async createAccountingVoucherInTransaction(
    transaction: unknown,
    purchaseReturn: PurchaseReturn,
    baseCurrency: string,
    lines: VoucherAccumulatedLine[]
  ): Promise<VoucherEntity> {
    const isForeignCurrency = purchaseReturn.currency.toUpperCase() !== baseCurrency.toUpperCase();
    const voucherLines = lines.map((line, index) => {
      const baseAmount = roundMoney(line.baseAmount);
      const amount = isForeignCurrency ? roundMoney(line.docAmount) : baseAmount;
      const rate = isForeignCurrency ? purchaseReturn.exchangeRate : 1;

      return new VoucherLineEntity(
        index + 1,
        line.accountId,
        line.side,
        baseAmount,
        baseCurrency,
        amount,
        purchaseReturn.currency,
        rate,
        line.notes,
        undefined,
        line.metadata || {}
      );
    });

    const totalDebit = roundMoney(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
    const totalCredit = roundMoney(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
    const now = new Date();

    const voucher = new VoucherEntity(
      randomUUID(),
      purchaseReturn.companyId,
      `PR-${purchaseReturn.returnNumber}`,
      VoucherType.JOURNAL_ENTRY,
      purchaseReturn.returnDate,
      `Purchase Return ${purchaseReturn.returnNumber} - ${purchaseReturn.vendorName}`,
      purchaseReturn.currency,
      baseCurrency,
      isForeignCurrency ? purchaseReturn.exchangeRate : 1,
      voucherLines,
      totalDebit,
      totalCredit,
      VoucherStatus.APPROVED,
      {
        sourceModule: 'purchases',
        sourceType: 'PURCHASE_RETURN',
        sourceId: purchaseReturn.id,
        referenceType: 'PURCHASE_RETURN',
        referenceId: purchaseReturn.id,
      },
      purchaseReturn.createdBy,
      now,
      purchaseReturn.createdBy,
      now
    );

    const postedVoucher = voucher.post(purchaseReturn.createdBy, now, PostingLockPolicy.FLEXIBLE_LOCKED);
    await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
    await this.voucherRepo.save(postedVoucher, transaction);
    return postedVoucher;
  }
}

export class GetPurchaseReturnUseCase {
  constructor(private readonly purchaseReturnRepo: IPurchaseReturnRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseReturn> {
    const purchaseReturn = await this.purchaseReturnRepo.getById(companyId, id);
    if (!purchaseReturn) throw new Error(`Purchase return not found: ${id}`);
    return purchaseReturn;
  }
}

export class ListPurchaseReturnsUseCase {
  constructor(private readonly purchaseReturnRepo: IPurchaseReturnRepository) {}

  async execute(companyId: string, filters: ListPurchaseReturnsFilters = {}): Promise<PurchaseReturn[]> {
    return this.purchaseReturnRepo.list(companyId, {
      vendorId: filters.vendorId,
      purchaseInvoiceId: filters.purchaseInvoiceId,
      goodsReceiptId: filters.goodsReceiptId,
      status: filters.status,
    });
  }
}
