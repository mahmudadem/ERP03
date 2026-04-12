
import { randomUUID } from 'crypto';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { PaymentStatus, SalesInvoice, SalesInvoiceLine } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import {
  ReturnContext,
  SalesReturn,
  SalesReturnLine,
  SRStatus,
} from '../../../domain/sales/entities/SalesReturn';
import { Party } from '../../../domain/shared/entities/Party';
import { ISalesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IDeliveryNoteRepository } from '../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { ISalesReturnRepository } from '../../../repository/interfaces/sales/ISalesReturnRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import { generateUniqueDocumentNumber } from './SalesOrderUseCases';
import { roundMoney, updateSOStatus } from './SalesPostingHelpers';

export interface SalesReturnLineInput {
  lineId?: string;
  lineNo?: number;
  siLineId?: string;
  dnLineId?: string;
  soLineId?: string;
  itemId?: string;
  returnQty?: number;
  uom?: string;
  description?: string;
}

export interface CreateSalesReturnInput {
  companyId: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  salesOrderId?: string;
  returnDate: string;
  warehouseId?: string;
  reason: string;
  notes?: string;
  lines?: SalesReturnLineInput[];
  createdBy: string;
}

export interface ListSalesReturnsFilters {
  customerId?: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  status?: SRStatus;
}

interface VoucherBucketLine {
  accountId: string;
  baseAmount: number;
  docAmount: number;
}

interface COGSBucketLine {
  inventoryAccountId: string;
  cogsAccountId: string;
  amountBase: number;
}
const determineReturnContext = (input: CreateSalesReturnInput): ReturnContext => {
  if (input.salesInvoiceId) return 'AFTER_INVOICE';
  if (input.deliveryNoteId) return 'BEFORE_INVOICE';
  throw new Error('salesInvoiceId or deliveryNoteId is required to create a sales return');
};

const findSILine = (
  si: SalesInvoice,
  siLineId?: string,
  itemId?: string
): SalesInvoiceLine | null => {
  if (siLineId) return si.lines.find((line) => line.lineId === siLineId) || null;
  if (itemId) return si.lines.find((line) => line.itemId === itemId) || null;
  return null;
};

const findDNLine = (
  dn: DeliveryNote,
  dnLineId?: string,
  itemId?: string
): DeliveryNote['lines'][number] | null => {
  if (dnLineId) return dn.lines.find((line) => line.lineId === dnLineId) || null;
  if (itemId) return dn.lines.find((line) => line.itemId === itemId) || null;
  return null;
};

const findSOLine = (
  so: SalesOrder,
  soLineId?: string,
  itemId?: string
): SalesOrder['lines'][number] | null => {
  if (soLineId) return so.lines.find((line) => line.lineId === soLineId) || null;
  if (itemId) return so.lines.find((line) => line.itemId === itemId) || null;
  return null;
};

const recalcPaymentStatus = (si: SalesInvoice): PaymentStatus => {
  if (si.outstandingAmountBase <= 0) return 'PAID';
  if (si.paidAmountBase > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

const recalcReturnTotals = (salesReturn: SalesReturn): void => {
  salesReturn.subtotalDoc = roundMoney(
    salesReturn.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * (line.unitPriceDoc || 0)), 0)
  );
  salesReturn.subtotalBase = roundMoney(
    salesReturn.lines.reduce((sum, line) => sum + roundMoney(line.returnQty * (line.unitPriceBase || 0)), 0)
  );
  salesReturn.taxTotalDoc = roundMoney(salesReturn.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
  salesReturn.taxTotalBase = roundMoney(salesReturn.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
  salesReturn.grandTotalDoc = roundMoney(salesReturn.subtotalDoc + salesReturn.taxTotalDoc);
  salesReturn.grandTotalBase = roundMoney(salesReturn.subtotalBase + salesReturn.taxTotalBase);
};

const addToBucket = (
  bucket: Map<string, VoucherBucketLine>,
  accountId: string,
  baseAmount: number,
  docAmount: number
): void => {
  if (!accountId || (baseAmount <= 0 && docAmount <= 0)) return;
  const current = bucket.get(accountId);
  if (current) {
    current.baseAmount = roundMoney(current.baseAmount + baseAmount);
    current.docAmount = roundMoney(current.docAmount + docAmount);
    return;
  }

  bucket.set(accountId, {
    accountId,
    baseAmount: roundMoney(baseAmount),
    docAmount: roundMoney(docAmount),
  });
};

export class CreateSalesReturnUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly salesReturnRepo: ISalesReturnRepository,
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly deliveryNoteRepo: IDeliveryNoteRepository
  ) {}

  async execute(input: CreateSalesReturnInput): Promise<SalesReturn> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Sales module is not initialized');

    const returnContext = determineReturnContext(input);
    if (returnContext === 'BEFORE_INVOICE' && !settings.requireSOForStockItems) {
      throw new Error('BEFORE_INVOICE returns require "Require Sales Orders for Stock Items" to be enabled.');
    }

    let salesInvoice: SalesInvoice | null = null;
    let deliveryNote: DeliveryNote | null = null;
    if (returnContext === 'AFTER_INVOICE') {
      salesInvoice = await this.salesInvoiceRepo.getById(input.companyId, input.salesInvoiceId as string);
      if (!salesInvoice) throw new Error(`Sales invoice not found: ${input.salesInvoiceId}`);
      if (salesInvoice.status !== 'POSTED') {
        throw new Error('AFTER_INVOICE returns require a posted sales invoice');
      }
    } else {
      deliveryNote = await this.deliveryNoteRepo.getById(input.companyId, input.deliveryNoteId as string);
      if (!deliveryNote) throw new Error(`Delivery note not found: ${input.deliveryNoteId}`);
      if (deliveryNote.status !== 'POSTED') {
        throw new Error('BEFORE_INVOICE returns require a posted delivery note');
      }
    }

    const lines = salesInvoice
      ? this.prefillLinesFromSalesInvoice(salesInvoice, input.lines)
      : this.prefillLinesFromDeliveryNote(deliveryNote as DeliveryNote, input.lines);

    const warehouseId =
      input.warehouseId
      || deliveryNote?.warehouseId
      || salesInvoice?.lines[0]?.warehouseId
      || settings.defaultWarehouseId;
    if (!warehouseId) {
      throw new Error('warehouseId is required to create sales return');
    }

    const now = new Date();
    const returnNumber = await generateUniqueDocumentNumber(
      settings,
      'SR',
      async (candidate) => !!(await this.salesReturnRepo.getByNumber(input.companyId, candidate))
    );
    const salesReturn = new SalesReturn({
      id: randomUUID(),
      companyId: input.companyId,
      returnNumber,
      salesInvoiceId: salesInvoice?.id,
      deliveryNoteId: deliveryNote?.id,
      salesOrderId: input.salesOrderId || salesInvoice?.salesOrderId || deliveryNote?.salesOrderId,
      customerId: salesInvoice?.customerId || (deliveryNote as DeliveryNote).customerId,
      customerName: salesInvoice?.customerName || (deliveryNote as DeliveryNote).customerName,
      returnContext,
      returnDate: input.returnDate,
      warehouseId,
      currency: salesInvoice?.currency || deliveryNote?.lines[0]?.moveCurrency || 'USD',
      exchangeRate: salesInvoice?.exchangeRate || deliveryNote?.lines[0]?.fxRateMovToBase || 1,
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
      revenueVoucherId: null,
      cogsVoucherId: null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.salesReturnRepo.create(salesReturn);
    await this.settingsRepo.saveSettings(settings);
    return salesReturn;
  }

  private prefillLinesFromSalesInvoice(
    salesInvoice: SalesInvoice,
    inputLines?: SalesReturnLineInput[]
  ): SalesReturnLine[] {
    if (!inputLines?.length) {
      return salesInvoice.lines.map((line, index) =>
        this.mapSalesInvoiceLineToReturnLine(line, index + 1, undefined, salesInvoice.exchangeRate)
      );
    }

    const mapped = inputLines.map((inputLine, index) => {
      const source = findSILine(salesInvoice, inputLine.siLineId, inputLine.itemId);
      if (!source) {
        throw new Error(`Sales invoice line not found for return line ${index + 1}`);
      }
      return this.mapSalesInvoiceLineToReturnLine(source, index + 1, inputLine, salesInvoice.exchangeRate);
    });

    if (!mapped.length) {
      throw new Error('Sales return must contain at least one line');
    }

    return mapped;
  }

  private prefillLinesFromDeliveryNote(
    deliveryNote: DeliveryNote,
    inputLines?: SalesReturnLineInput[]
  ): SalesReturnLine[] {
    if (!inputLines?.length) {
      return deliveryNote.lines.map((line, index) => this.mapDeliveryNoteLineToReturnLine(line, index + 1, undefined));
    }

    const mapped = inputLines.map((inputLine, index) => {
      const source = findDNLine(deliveryNote, inputLine.dnLineId, inputLine.itemId);
      if (!source) {
        throw new Error(`Delivery note line not found for return line ${index + 1}`);
      }
      return this.mapDeliveryNoteLineToReturnLine(source, index + 1, inputLine);
    });

    if (!mapped.length) {
      throw new Error('Sales return must contain at least one line');
    }

    return mapped;
  }
  private mapSalesInvoiceLineToReturnLine(
    salesInvoiceLine: SalesInvoiceLine,
    lineNo: number,
    inputLine?: SalesReturnLineInput,
    exchangeRate: number = 1
  ): SalesReturnLine {
    const returnQty = inputLine?.returnQty ?? salesInvoiceLine.invoicedQty;
    const taxRate = salesInvoiceLine.taxRate || 0;
    const unitPriceDoc = salesInvoiceLine.unitPriceDoc;
    const unitPriceBase = salesInvoiceLine.unitPriceBase || roundMoney(unitPriceDoc * (exchangeRate || 1));

    return {
      lineId: inputLine?.lineId || randomUUID(),
      lineNo: inputLine?.lineNo ?? lineNo,
      siLineId: salesInvoiceLine.lineId,
      dnLineId: salesInvoiceLine.dnLineId,
      soLineId: inputLine?.soLineId || salesInvoiceLine.soLineId,
      itemId: salesInvoiceLine.itemId,
      itemCode: salesInvoiceLine.itemCode,
      itemName: salesInvoiceLine.itemName,
      returnQty,
      uom: inputLine?.uom || salesInvoiceLine.uom,
      unitPriceDoc,
      unitPriceBase,
      unitCostBase: salesInvoiceLine.unitCostBase || 0,
      fxRateMovToBase: exchangeRate,
      fxRateCCYToBase: exchangeRate,
      taxCodeId: salesInvoiceLine.taxCodeId,
      taxRate,
      taxAmountDoc: roundMoney(returnQty * unitPriceDoc * taxRate),
      taxAmountBase: roundMoney(returnQty * unitPriceBase * taxRate),
      revenueAccountId: salesInvoiceLine.revenueAccountId,
      cogsAccountId: salesInvoiceLine.cogsAccountId,
      inventoryAccountId: salesInvoiceLine.inventoryAccountId,
      stockMovementId: null,
      description: inputLine?.description || salesInvoiceLine.description,
    };
  }

  private mapDeliveryNoteLineToReturnLine(
    deliveryNoteLine: DeliveryNote['lines'][number],
    lineNo: number,
    inputLine?: SalesReturnLineInput
  ): SalesReturnLine {
    const returnQty = inputLine?.returnQty ?? deliveryNoteLine.deliveredQty;
    return {
      lineId: inputLine?.lineId || randomUUID(),
      lineNo: inputLine?.lineNo ?? lineNo,
      dnLineId: deliveryNoteLine.lineId,
      soLineId: inputLine?.soLineId || deliveryNoteLine.soLineId,
      itemId: deliveryNoteLine.itemId,
      itemCode: deliveryNoteLine.itemCode,
      itemName: deliveryNoteLine.itemName,
      returnQty,
      uom: inputLine?.uom || deliveryNoteLine.uom,
      unitCostBase: deliveryNoteLine.unitCostBase || 0,
      fxRateMovToBase: deliveryNoteLine.fxRateMovToBase || 1,
      fxRateCCYToBase: deliveryNoteLine.fxRateCCYToBase || 1,
      taxRate: 0,
      taxAmountDoc: 0,
      taxAmountBase: 0,
      stockMovementId: null,
      description: inputLine?.description || deliveryNoteLine.description,
    };
  }
}

export class PostSalesReturnUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly salesReturnRepo: ISalesReturnRepository,
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly deliveryNoteRepo: IDeliveryNoteRepository,
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly itemRepo: IItemRepository,
    private readonly itemCategoryRepo: IItemCategoryRepository,
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly inventoryService: ISalesInventoryService,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string): Promise<SalesReturn> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales module is not initialized');
    const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
    const isPerpetual = invSettings?.inventoryAccountingMethod === 'PERPETUAL';

    const salesReturn = await this.salesReturnRepo.getById(companyId, id);
    if (!salesReturn) throw new Error(`Sales return not found: ${id}`);
    if (salesReturn.status !== 'DRAFT') {
      throw new Error('Only DRAFT sales returns can be posted');
    }

    const isAfterInvoice = salesReturn.returnContext === 'AFTER_INVOICE';
    if (!isAfterInvoice && !settings.requireSOForStockItems) {
      throw new Error('BEFORE_INVOICE returns require "Require Sales Orders for Stock Items" to be enabled.');
    }

    let salesInvoice: SalesInvoice | null = null;
    let deliveryNote: DeliveryNote | null = null;
    if (isAfterInvoice) {
      if (!salesReturn.salesInvoiceId) {
        throw new Error('salesInvoiceId is required for AFTER_INVOICE return');
      }
      salesInvoice = await this.salesInvoiceRepo.getById(companyId, salesReturn.salesInvoiceId);
      if (!salesInvoice) throw new Error(`Sales invoice not found: ${salesReturn.salesInvoiceId}`);
      if (salesInvoice.status !== 'POSTED') {
        throw new Error('AFTER_INVOICE returns require a posted sales invoice');
      }
    } else {
      if (!salesReturn.deliveryNoteId) {
        throw new Error('deliveryNoteId is required for BEFORE_INVOICE return');
      }
      deliveryNote = await this.deliveryNoteRepo.getById(companyId, salesReturn.deliveryNoteId);
      if (!deliveryNote) throw new Error(`Delivery note not found: ${salesReturn.deliveryNoteId}`);
      if (deliveryNote.status !== 'POSTED') {
        throw new Error('BEFORE_INVOICE returns require a posted delivery note');
      }
    }

    const effectiveSOId = salesReturn.salesOrderId || salesInvoice?.salesOrderId || deliveryNote?.salesOrderId;
    const salesOrder = effectiveSOId
      ? await this.salesOrderRepo.getById(companyId, effectiveSOId)
      : null;
    if (effectiveSOId && !salesOrder) {
      throw new Error(`Sales order not found: ${effectiveSOId}`);
    }

    const customer = await this.partyRepo.getById(companyId, salesReturn.customerId);
    if (!customer) throw new Error(`Customer not found: ${salesReturn.customerId}`);

    const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || salesReturn.currency;
    const revenueDebitBucket = new Map<string, VoucherBucketLine>();
    const taxDebitBucket = new Map<string, VoucherBucketLine>();
    const cogsBucket = new Map<string, COGSBucketLine>();
    const currentRunQtyBySource = new Map<string, number>();

    await this.transactionManager.runTransaction(async (transaction) => {
      for (const line of salesReturn.lines) {
        const item = await this.itemRepo.getItem(line.itemId);
        if (!item || item.companyId !== companyId) {
          throw new Error(`Item not found: ${line.itemId}`);
        }

        if (isAfterInvoice) {
          const sourceLine = findSILine(salesInvoice as SalesInvoice, line.siLineId, line.itemId);
          if (!sourceLine) {
            throw new Error(`Sales invoice line not found for return line ${line.lineId}`);
          }

          line.siLineId = sourceLine.lineId;
          line.dnLineId = line.dnLineId || sourceLine.dnLineId;
          line.soLineId = line.soLineId || sourceLine.soLineId;
          line.itemCode = line.itemCode || sourceLine.itemCode;
          line.itemName = line.itemName || sourceLine.itemName;
          line.uom = line.uom || sourceLine.uom;
          line.unitPriceDoc = line.unitPriceDoc ?? sourceLine.unitPriceDoc;
          line.unitPriceBase = line.unitPriceBase ?? sourceLine.unitPriceBase;
          line.unitCostBase = line.unitCostBase || sourceLine.unitCostBase || 0;
          line.taxCodeId = line.taxCodeId || sourceLine.taxCodeId;
          line.taxRate = Number.isNaN(line.taxRate) ? sourceLine.taxRate : line.taxRate;
          line.revenueAccountId = line.revenueAccountId || sourceLine.revenueAccountId;
          line.cogsAccountId = line.cogsAccountId || sourceLine.cogsAccountId;
          line.inventoryAccountId = line.inventoryAccountId || sourceLine.inventoryAccountId;

          const sourceKey = `SI:${sourceLine.lineId}`;
          const previousReturned = await this.getPreviouslyReturnedQtyForSILine(
            companyId,
            (salesInvoice as SalesInvoice).id,
            sourceLine.lineId,
            salesReturn.id
          );
          const currentRunQty = currentRunQtyBySource.get(sourceKey) || 0;
          const remainingQty = roundMoney(sourceLine.invoicedQty - previousReturned - currentRunQty);
          if (line.returnQty > remainingQty + 0.000001) {
            throw new Error(`Return qty exceeds invoiced qty for ${line.itemName || sourceLine.itemName}`);
          }
          currentRunQtyBySource.set(sourceKey, roundMoney(currentRunQty + line.returnQty));
        } else {
          const sourceLine = findDNLine(deliveryNote as DeliveryNote, line.dnLineId, line.itemId);
          if (!sourceLine) {
            throw new Error(`Delivery note line not found for return line ${line.lineId}`);
          }

          line.dnLineId = sourceLine.lineId;
          line.soLineId = line.soLineId || sourceLine.soLineId;
          line.itemCode = line.itemCode || sourceLine.itemCode;
          line.itemName = line.itemName || sourceLine.itemName;
          line.uom = line.uom || sourceLine.uom;
          line.unitCostBase = line.unitCostBase || sourceLine.unitCostBase || 0;
          line.fxRateMovToBase = line.fxRateMovToBase || sourceLine.fxRateMovToBase || 1;
          line.fxRateCCYToBase = line.fxRateCCYToBase || sourceLine.fxRateCCYToBase || 1;
          line.taxRate = 0;
          line.taxAmountDoc = 0;
          line.taxAmountBase = 0;

          const sourceKey = `DN:${sourceLine.lineId}`;
          const previousReturned = await this.getPreviouslyReturnedQtyForDNLine(
            companyId,
            (deliveryNote as DeliveryNote).id,
            sourceLine.lineId,
            salesReturn.id
          );
          const currentRunQty = currentRunQtyBySource.get(sourceKey) || 0;
          const remainingQty = roundMoney(sourceLine.deliveredQty - previousReturned - currentRunQty);
          if (line.returnQty > remainingQty + 0.000001) {
            throw new Error(`Return qty exceeds delivered qty for ${line.itemName || sourceLine.itemName}`);
          }
          currentRunQtyBySource.set(sourceKey, roundMoney(currentRunQty + line.returnQty));
        }

        const lineTotalDoc = roundMoney(line.returnQty * (line.unitPriceDoc || 0));
        const lineTotalBase = roundMoney(line.returnQty * (line.unitPriceBase || 0));
        line.taxAmountDoc = roundMoney(lineTotalDoc * line.taxRate);
        line.taxAmountBase = roundMoney(lineTotalBase * line.taxRate);

        if (isAfterInvoice) {
          if (!line.revenueAccountId) {
            line.revenueAccountId = await this.resolveRevenueAccount(companyId, item, settings.defaultRevenueAccountId);
          }
          addToBucket(revenueDebitBucket, line.revenueAccountId, lineTotalBase, lineTotalDoc);

          if (line.taxAmountBase > 0) {
            const taxAccountId = await this.resolveSalesTaxAccount(companyId, line.taxCodeId);
            addToBucket(taxDebitBucket, taxAccountId, line.taxAmountBase, line.taxAmountDoc);
          }
        }
        if (item.trackInventory) {
          const qtyInBaseUom = await this.convertToBaseUom(
            companyId,
            line.returnQty,
            line.uom,
            item.baseUom,
            item.id,
            item.code
          );

          const unitCostBase = roundMoney(line.unitCostBase || 0);
          line.unitCostBase = unitCostBase;
          const lineCostBase = roundMoney(qtyInBaseUom * unitCostBase);
          this.assertPositiveTrackedCost(
            qtyInBaseUom,
            unitCostBase,
            line.itemName || item.name,
            `sales return ${salesReturn.returnNumber}`
          );

          const fxRateMovToBase = line.fxRateMovToBase > 0 ? line.fxRateMovToBase : (salesReturn.exchangeRate || 1);
          const fxRateCCYToBase = line.fxRateCCYToBase > 0 ? line.fxRateCCYToBase : (salesReturn.exchangeRate || 1);
          const unitCostInMoveCurrency = roundMoney(unitCostBase / fxRateMovToBase);

          const movement = await this.inventoryService.processIN({
            companyId,
            itemId: line.itemId,
            warehouseId: salesReturn.warehouseId,
            qty: qtyInBaseUom,
            date: salesReturn.returnDate,
            movementType: 'RETURN_IN',
            refs: {
              type: 'SALES_RETURN',
              docId: salesReturn.id,
              lineId: line.lineId,
            },
            currentUser: salesReturn.createdBy,
            unitCostInMoveCurrency,
            moveCurrency: salesReturn.currency,
            fxRateMovToBase,
            fxRateCCYToBase,
            transaction,
          });

          line.stockMovementId = movement.id;

          if (isPerpetual) {
            const accounts = await this.resolveCOGSAccounts(
              companyId,
              item,
              invSettings?.defaultCOGSAccountId,
              invSettings?.defaultInventoryAssetAccountId,
              true
            );
            if (lineCostBase > 0) {
              line.cogsAccountId = line.cogsAccountId || accounts.cogsAccountId;
              line.inventoryAccountId = line.inventoryAccountId || accounts.inventoryAccountId;
              const key = `${accounts.inventoryAccountId}|${accounts.cogsAccountId}`;
              const existing = cogsBucket.get(key);
              if (existing) {
                existing.amountBase = roundMoney(existing.amountBase + lineCostBase);
              } else {
                cogsBucket.set(key, {
                  inventoryAccountId: accounts.inventoryAccountId,
                  cogsAccountId: accounts.cogsAccountId,
                  amountBase: lineCostBase,
                });
              }
            }
          }
        }

        if (salesOrder) {
          const soLine = findSOLine(salesOrder, line.soLineId, line.itemId);
          if (soLine) {
            soLine.returnedQty = roundMoney(soLine.returnedQty + line.returnQty);
            if (isAfterInvoice) {
              soLine.invoicedQty = Math.max(0, roundMoney(soLine.invoicedQty - line.returnQty));
            } else {
              soLine.deliveredQty = Math.max(0, roundMoney(soLine.deliveredQty - line.returnQty));
            }
          }
        }
      }

      recalcReturnTotals(salesReturn);

      if (isPerpetual && cogsBucket.size > 0) {
        const cogsVoucherLines: VoucherBucketLine[] = [];
        for (const line of Array.from(cogsBucket.values())) {
          const amount = roundMoney(line.amountBase);
          cogsVoucherLines.push({
            accountId: line.inventoryAccountId,
            baseAmount: amount,
            docAmount: amount,
          });
          cogsVoucherLines.push({
            accountId: line.cogsAccountId,
            baseAmount: amount,
            docAmount: amount,
          });
        }

        const cogsVoucher = await this.accountingPostingService.postInTransaction(
          {
            companyId,
            voucherType: VoucherType.SALES_RETURN,
            voucherNo: `SR-COGS-${salesReturn.returnNumber}`,
            date: salesReturn.returnDate,
            description: `Sales Return ${salesReturn.returnNumber} COGS Reversal`,
            currency: baseCurrency,
            exchangeRate: 1,
            lines: cogsVoucherLines.map((line, idx) => ({
              ...line,
              side: idx % 2 === 0 ? 'Debit' : 'Credit',
            })),
            metadata: {
              sourceModule: 'sales',
              sourceType: 'SALES_RETURN',
              sourceId: salesReturn.id,
              referenceType: 'SALES_RETURN',
              referenceId: salesReturn.id,
              voucherPart: 'COGS',
            },
            createdBy: salesReturn.createdBy,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: salesReturn.returnNumber,
          },
          transaction
        );
        salesReturn.cogsVoucherId = cogsVoucher.id;
      } else {
        salesReturn.cogsVoucherId = null;
      }

      if (isAfterInvoice) {
        const arAccountId = this.resolveARAccount(customer);
        const revenueVoucherLines = [
          ...Array.from(revenueDebitBucket.values()).map((line) => ({ ...line, side: 'Debit' as const })),
          ...Array.from(taxDebitBucket.values()).map((line) => ({ ...line, side: 'Debit' as const })),
          {
            accountId: arAccountId,
            side: 'Credit' as const,
            baseAmount: roundMoney(salesReturn.grandTotalBase),
            docAmount: roundMoney(salesReturn.grandTotalDoc),
          },
        ];

        const revenueVoucher = await this.accountingPostingService.postInTransaction(
          {
            companyId,
            voucherType: VoucherType.SALES_RETURN,
            voucherNo: `SR-REV-${salesReturn.returnNumber}`,
            date: salesReturn.returnDate,
            description: `Sales Return ${salesReturn.returnNumber} Revenue Reversal`,
            currency: salesReturn.currency,
            exchangeRate: salesReturn.exchangeRate,
            lines: revenueVoucherLines,
            metadata: {
              sourceModule: 'sales',
              sourceType: 'SALES_RETURN',
              sourceId: salesReturn.id,
              referenceType: 'SALES_RETURN',
              referenceId: salesReturn.id,
              voucherPart: 'REVENUE',
            },
            createdBy: salesReturn.createdBy,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: salesReturn.returnNumber,
          },
          transaction
        );
        salesReturn.revenueVoucherId = revenueVoucher.id;

        const invoice = salesInvoice as SalesInvoice;
        invoice.outstandingAmountBase = roundMoney(invoice.outstandingAmountBase - salesReturn.grandTotalBase);
        invoice.paymentStatus = recalcPaymentStatus(invoice);
        invoice.updatedAt = new Date();
        await this.salesInvoiceRepo.update(invoice, transaction);
      } else {
        salesReturn.revenueVoucherId = null;
      }

      if (salesOrder) {
        salesOrder.status = updateSOStatus(salesOrder);
        salesOrder.updatedAt = new Date();
        await this.salesOrderRepo.update(salesOrder, transaction);
      }

      salesReturn.status = 'POSTED';
      salesReturn.postedAt = new Date();
      salesReturn.updatedAt = new Date();
      await this.salesReturnRepo.update(salesReturn, transaction);
    });

    const posted = await this.salesReturnRepo.getById(companyId, id);
    if (!posted) throw new Error(`Sales return not found after posting: ${id}`);
    return posted;
  }

  private resolveARAccount(customer: Party): string {
    if (!customer.defaultARAccountId) {
      throw new Error(`Customer ${customer.displayName} has no linked AR account configured.`);
    }
    return customer.defaultARAccountId;
  }

  private async resolveRevenueAccount(
    companyId: string,
    item: any,
    defaultRevenueAccountId: string
  ): Promise<string> {
    if (item.revenueAccountId) return item.revenueAccountId;

    if (item.categoryId) {
      const category = await this.itemCategoryRepo.getCategory(item.categoryId);
      if (category && category.companyId === companyId && category.defaultRevenueAccountId) {
        return category.defaultRevenueAccountId;
      }
    }

    if (!defaultRevenueAccountId) {
      throw new Error(`No revenue account configured for item ${item.code}`);
    }

    return defaultRevenueAccountId;
  }
  private async resolveCOGSAccounts(
    companyId: string,
    item: any,
    defaultCOGSAccountId: string | undefined,
    defaultInventoryAssetAccountId: string | undefined,
    strict: boolean
  ): Promise<{ cogsAccountId: string; inventoryAccountId: string } | null> {
    let category: any = null;
    if (item.categoryId) {
      category = await this.itemCategoryRepo.getCategory(item.categoryId);
      if (category?.companyId !== companyId) {
        category = null;
      }
    }

    const cogsAccountId = item.cogsAccountId || category?.defaultCogsAccountId || defaultCOGSAccountId;
    const inventoryAccountId = item.inventoryAssetAccountId || category?.defaultInventoryAssetAccountId || defaultInventoryAssetAccountId;

    if (!cogsAccountId || !inventoryAccountId) {
      if (strict) {
        if (!cogsAccountId) throw new Error(`No COGS account configured for item ${item.code}`);
        throw new Error(`No inventory account configured for item ${item.code}`);
      }
      return null;
    }

    return { cogsAccountId, inventoryAccountId };
  }

  private async resolveSalesTaxAccount(companyId: string, taxCodeId?: string): Promise<string> {
    if (!taxCodeId) {
      throw new Error('taxCodeId is required for sales tax reversal');
    }

    const taxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
    if (!taxCode) throw new Error(`Tax code not found: ${taxCodeId}`);
    if (!taxCode.salesTaxAccountId) {
      throw new Error(`Tax code ${taxCode.code} has no sales tax account`);
    }

    return taxCode.salesTaxAccountId;
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

  private async getPreviouslyReturnedQtyForSILine(
    companyId: string,
    salesInvoiceId: string,
    siLineId: string,
    excludeReturnId: string
  ): Promise<number> {
    const returns = await this.salesReturnRepo.list(companyId, {
      salesInvoiceId,
      status: 'POSTED',
    });

    return roundMoney(
      returns.reduce((sum, entry) => {
        if (entry.id === excludeReturnId) return sum;
        const qty = entry.lines
          .filter((line) => line.siLineId === siLineId)
          .reduce((lineSum, line) => lineSum + line.returnQty, 0);
        return sum + qty;
      }, 0)
    );
  }

  private async getPreviouslyReturnedQtyForDNLine(
    companyId: string,
    deliveryNoteId: string,
    dnLineId: string,
    excludeReturnId: string
  ): Promise<number> {
    const returns = await this.salesReturnRepo.list(companyId, {
      deliveryNoteId,
      status: 'POSTED',
    });

    return roundMoney(
      returns.reduce((sum, entry) => {
        if (entry.id === excludeReturnId) return sum;
        const qty = entry.lines
          .filter((line) => line.dnLineId === dnLineId)
          .reduce((lineSum, line) => lineSum + line.returnQty, 0);
        return sum + qty;
      }, 0)
    );
  }

  private assertPositiveTrackedCost(qty: number, unitCostBase: number, itemName: string, documentLabel: string): void {
    if (qty > 0 && !(unitCostBase > 0)) {
      throw new Error(`Missing positive inventory cost for ${itemName} on ${documentLabel}`);
    }
  }
}

export class GetSalesReturnUseCase {
  constructor(private readonly salesReturnRepo: ISalesReturnRepository) {}

  async execute(companyId: string, id: string): Promise<SalesReturn> {
    const salesReturn = await this.salesReturnRepo.getById(companyId, id);
    if (!salesReturn) throw new Error(`Sales return not found: ${id}`);
    return salesReturn;
  }
}

export class ListSalesReturnsUseCase {
  constructor(private readonly salesReturnRepo: ISalesReturnRepository) {}

  async execute(companyId: string, filters: ListSalesReturnsFilters = {}): Promise<SalesReturn[]> {
    return this.salesReturnRepo.list(companyId, {
      customerId: filters.customerId,
      salesInvoiceId: filters.salesInvoiceId,
      deliveryNoteId: filters.deliveryNoteId,
      status: filters.status,
    });
  }
}
