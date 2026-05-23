
import { randomUUID } from 'crypto';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { PaymentStatus, SalesInvoice, SalesInvoiceLine } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import {
  ReturnContext,
  ReturnReasonCode,
  ReturnSettlementMode,
  RestockingFeeType,
  SalesReturn,
  SalesReturnLine,
  SRStatus,
} from '../../../domain/sales/entities/SalesReturn';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { ISalesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { IAccountRepository, ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
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
import { RecordChangeService } from '../../system/services/RecordChangeService';
import {
  convertItemQtyToBaseUomDetailed,
} from '../../inventory/services/UomResolutionService';
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
  uomId?: string;
  uom?: string;
  unitPriceDoc?: number;    // Selling price — needed for revenue reversal
  taxCodeId?: string;       // Tax code for the return line
  warehouseId?: string;     // Per-line warehouse override
  description?: string;
}

export interface CreateSalesReturnInput {
  companyId: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  salesOrderId?: string;
  customerId?: string;      // Required for DIRECT returns
  customerName?: string;    // Required for DIRECT returns
  returnDate: string;
  warehouseId?: string;
  settlementMode?: ReturnSettlementMode;
  reasonCode?: ReturnReasonCode;
  reason: string;
  restockingFeeType?: RestockingFeeType;
  restockingFeeValue?: number;
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
  return 'DIRECT';
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
  salesReturn.recalculateMonetaryTotals();
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
    let lines: SalesReturnLine[];

    if (returnContext === 'AFTER_INVOICE') {
      salesInvoice = await this.salesInvoiceRepo.getById(input.companyId, input.salesInvoiceId as string);
      if (!salesInvoice) throw new Error(`Sales invoice not found: ${input.salesInvoiceId}`);
      if (salesInvoice.status !== 'POSTED') {
        throw new Error('AFTER_INVOICE returns require a posted sales invoice');
      }
      lines = this.prefillLinesFromSalesInvoice(salesInvoice, input.lines);
    } else if (returnContext === 'BEFORE_INVOICE') {
      deliveryNote = await this.deliveryNoteRepo.getById(input.companyId, input.deliveryNoteId as string);
      if (!deliveryNote) throw new Error(`Delivery note not found: ${input.deliveryNoteId}`);
      if (deliveryNote.status !== 'POSTED') {
        throw new Error('BEFORE_INVOICE returns require a posted delivery note');
      }
      lines = this.prefillLinesFromDeliveryNote(deliveryNote, input.lines);
    } else {
      // DIRECT: standalone return
      if (!input.lines?.length) {
        throw new Error('Standalone returns require at least one line with item details');
      }
      if (!input.customerId?.trim()) {
        throw new Error('customerId is required for standalone returns');
      }
      if (!input.warehouseId && !settings.defaultWarehouseId) {
        throw new Error('warehouseId is required for standalone returns');
      }
      lines = input.lines.map((inputLine, index) => ({
        lineId: inputLine.lineId || randomUUID(),
        lineNo: inputLine.lineNo ?? index + 1,
        itemId: inputLine.itemId || '',
        itemCode: '',
        itemName: '',
        returnQty: inputLine.returnQty || 0,
        uomId: inputLine.uomId,
        uom: inputLine.uom || 'EA',
        unitPriceDoc: inputLine.unitPriceDoc ?? 0,
        unitPriceBase: inputLine.unitPriceDoc ?? 0, // will be FX-adjusted at posting
        unitCostBase: 0,
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        taxCodeId: inputLine.taxCodeId,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        stockMovementId: null,
        description: inputLine.description,
      }));
    }

    const warehouseId =
      input.warehouseId ||
      deliveryNote?.warehouseId ||
      salesInvoice?.lines[0]?.warehouseId ||
      settings.defaultWarehouseId;

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
      customerId: input.customerId || salesInvoice?.customerId || (deliveryNote as DeliveryNote)?.customerId,
      customerName: input.customerName || salesInvoice?.customerName || (deliveryNote as DeliveryNote)?.customerName,
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
      netSettlementAmountDoc: 0,
      netSettlementAmountBase: 0,
      settlementMode: input.settlementMode || 'CREDIT_NOTE',
      reasonCode: input.reasonCode || 'OTHER',
      reason: input.reason,
      restockingFeeType: input.restockingFeeType,
      restockingFeeValue: input.restockingFeeValue ?? 0,
      restockingFeeAmountDoc: 0,
      restockingFeeAmountBase: 0,
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
    const unitPriceDoc = inputLine?.unitPriceDoc ?? salesInvoiceLine.unitPriceDoc;
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
      uomId: inputLine?.uomId || salesInvoiceLine.uomId,
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
      uomId: inputLine?.uomId || deliveryNoteLine.uomId,
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
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly accountRepo: IAccountRepository | undefined,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string, createAccountingEffect: boolean = true, periodLockOverride?: { reason: string; overriddenBy: string }): Promise<SalesReturn> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales module is not initialized');
    const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(invSettings);
    const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);

    const salesReturn = await this.salesReturnRepo.getById(companyId, id);
    if (!salesReturn) throw new Error(`Sales return not found: ${id}`);
    if (salesReturn.status !== 'DRAFT') {
      throw new Error('Only DRAFT sales returns can be posted');
    }

    const isAfterInvoice = salesReturn.returnContext === 'AFTER_INVOICE';
    const isBeforeInvoice = salesReturn.returnContext === 'BEFORE_INVOICE';
    const isDirect = salesReturn.returnContext === 'DIRECT';

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
    } else if (isBeforeInvoice) {
      if (!salesReturn.deliveryNoteId) {
        throw new Error('deliveryNoteId is required for BEFORE_INVOICE return');
      }
      deliveryNote = await this.deliveryNoteRepo.getById(companyId, salesReturn.deliveryNoteId);
      if (!deliveryNote) throw new Error(`Delivery note not found: ${salesReturn.deliveryNoteId}`);
      if (deliveryNote.status !== 'POSTED') {
        throw new Error('BEFORE_INVOICE returns require a posted delivery note');
      }
    } else if (isDirect) {
      if (accountingMode === 'PERPETUAL') {
        throw new Error('Standalone returns require a source document in Real-Time Costing mode');
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

    const distinctItemIds = [...new Set(salesReturn.lines.map(l => l.itemId))];
    const distinctTaxCodeIds = [...new Set(salesReturn.lines.filter(l => l.taxCodeId).map(l => l.taxCodeId as string))];

    const [itemsMap, categoriesMap, taxCodesMap] = await Promise.all([
      Promise.all(distinctItemIds.map(id => this.itemRepo.getItem(id))).then(res =>
        new Map(res.filter((i): i is Item => !!i && i.companyId === companyId).map(i => [i.id, i]))
      ),
      this.itemCategoryRepo.getCompanyCategories(companyId).then(res =>
        new Map(res.map(c => [c.id, c]))
      ),
      Promise.all(distinctTaxCodeIds.map(id => this.taxCodeRepo.getById(companyId, id))).then(res =>
        new Map(res.filter((t): t is TaxCode => !!t).map(t => [t!.id, t!]))
      ),
    ]);

    const previousReturnQtyMap = new Map<string, number>();
    const currentRunQtyBySource = new Map<string, number>();
    for (const line of salesReturn.lines) {
      if (isAfterInvoice && salesInvoice) {
        const sourceLine = findSILine(salesInvoice, line.siLineId, line.itemId);
        if (sourceLine) {
          const sourceKey = `SI:${sourceLine.lineId}`;
          const previousReturned = await this.getPreviouslyReturnedQtyForSILine(
            companyId, salesInvoice.id, sourceLine.lineId, salesReturn.id
          );
          previousReturnQtyMap.set(sourceKey, previousReturned);
        }
      } else if (isBeforeInvoice && deliveryNote) {
        const sourceLine = findDNLine(deliveryNote, line.dnLineId, line.itemId);
        if (sourceLine) {
          const sourceKey = `DN:${sourceLine.lineId}`;
          const previousReturned = await this.getPreviouslyReturnedQtyForDNLine(
            companyId, deliveryNote.id, sourceLine.lineId, salesReturn.id
          );
          previousReturnQtyMap.set(sourceKey, previousReturned);
        }
      }
    }

    const warehouseId = salesReturn.warehouseId || settings.defaultWarehouseId || '';
    const stockLevelMap = new Map<string, StockLevel>();
    for (const line of salesReturn.lines) {
      const item = itemsMap.get(line.itemId);
      if (item?.trackInventory && warehouseId) {
        const key = `${line.itemId}|${warehouseId}`;
        if (!stockLevelMap.has(key)) {
          const existing = await this.inventoryService.preFetchStockLevel(companyId, line.itemId, warehouseId);
          stockLevelMap.set(key, existing ?? StockLevel.createNew(companyId, line.itemId, warehouseId));
        }
      }
    }

    const uomConversionMap = new Map<string, any>();
    for (const itemId of distinctItemIds) {
      const item = itemsMap.get(itemId);
      if (item && !uomConversionMap.has(item.id)) {
        const convs = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
        uomConversionMap.set(item.id, convs);
      }
    }

    const revenueDebitBucket = new Map<string, VoucherBucketLine>();
    const taxDebitBucket = new Map<string, VoucherBucketLine>();
    const cogsBucket = new Map<string, COGSBucketLine>();
    const inventoryMovements = new Map<string, { movement: StockMovement; updatedLevel: StockLevel }>();

    for (const line of salesReturn.lines) {
      const item = itemsMap.get(line.itemId);
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
        line.uomId = line.uomId || sourceLine.uomId;
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
        const previousReturned = previousReturnQtyMap.get(sourceKey) || 0;
        const currentRunQty = currentRunQtyBySource.get(sourceKey) || 0;
        const remainingQty = roundMoney(sourceLine.invoicedQty - previousReturned - currentRunQty);
        if (line.returnQty > remainingQty + 0.000001) {
          throw new Error(`Return qty exceeds invoiced qty for ${line.itemName || sourceLine.itemName}`);
        }
        currentRunQtyBySource.set(sourceKey, roundMoney(currentRunQty + line.returnQty));
      } else if (isBeforeInvoice) {
        const sourceLine = findDNLine(deliveryNote as DeliveryNote, line.dnLineId, line.itemId);
        if (!sourceLine) {
          throw new Error(`Delivery note line not found for return line ${line.lineId}`);
        }

        line.dnLineId = sourceLine.lineId;
        line.soLineId = line.soLineId || sourceLine.soLineId;
        line.itemCode = line.itemCode || sourceLine.itemCode;
        line.itemName = line.itemName || sourceLine.itemName;
        line.uomId = line.uomId || sourceLine.uomId;
        line.uom = line.uom || sourceLine.uom;
        line.unitCostBase = line.unitCostBase || sourceLine.unitCostBase || 0;
        line.fxRateMovToBase = line.fxRateMovToBase || sourceLine.fxRateMovToBase || 1;
        line.fxRateCCYToBase = line.fxRateCCYToBase || sourceLine.fxRateCCYToBase || 1;
        line.taxRate = 0;
        line.taxAmountDoc = 0;
        line.taxAmountBase = 0;

        const sourceKey = `DN:${sourceLine.lineId}`;
        const previousReturned = previousReturnQtyMap.get(sourceKey) || 0;
        const currentRunQty = currentRunQtyBySource.get(sourceKey) || 0;
        const remainingQty = roundMoney(sourceLine.deliveredQty - previousReturned - currentRunQty);
        if (line.returnQty > remainingQty + 0.000001) {
          throw new Error(`Return qty exceeds delivered qty for ${line.itemName || sourceLine.itemName}`);
        }
        currentRunQtyBySource.set(sourceKey, roundMoney(currentRunQty + line.returnQty));
      } else {
        if (!item) throw new Error(`Item not found: ${line.itemId}`);
        line.itemCode = line.itemCode || item.code;
        line.itemName = line.itemName || item.name;
        line.uomId = line.uomId || item.salesUomId || item.baseUomId;
        line.uom = line.uom || item.salesUom || item.baseUom;
      }

      const lineTotalDoc = roundMoney(line.returnQty * (line.unitPriceDoc || 0));
      const lineTotalBase = roundMoney(line.returnQty * (line.unitPriceBase || 0));
      line.taxAmountDoc = roundMoney(lineTotalDoc * line.taxRate);
      line.taxAmountBase = roundMoney(lineTotalBase * line.taxRate);

      if (isAfterInvoice || isDirect) {
        if (!line.revenueAccountId) {
          const category = item.categoryId ? categoriesMap.get(item.categoryId) : null;
          line.revenueAccountId = item.revenueAccountId || category?.defaultRevenueAccountId || settings.defaultRevenueAccountId;
        }
        addToBucket(revenueDebitBucket, line.revenueAccountId, lineTotalBase, lineTotalDoc);

        if (line.taxAmountBase > 0 && line.taxCodeId) {
          const sTaxCode = taxCodesMap.get(line.taxCodeId);
          const taxAccountId = sTaxCode?.salesTaxAccountId;
          addToBucket(taxDebitBucket, taxAccountId || '', line.taxAmountBase, line.taxAmountDoc);
        }
      }

      if (item.trackInventory) {
        const convs = uomConversionMap.get(item.id) || [];
        const conversionResult = convertItemQtyToBaseUomDetailed({
          qty: line.returnQty,
          item,
          conversions: convs,
          fromUomId: line.uomId,
          fromUom: line.uom,
          round: roundMoney,
          itemCode: item.code,
        });
        const qtyInBaseUom = conversionResult.qtyInBaseUom;

        const stockLevelKey = `${item.id}|${warehouseId}`;
        const level = stockLevelMap.get(stockLevelKey);
        if (!level) throw new Error(`Stock level not pre-fetched for item ${item.code}`);

        const sourceLineCost = isAfterInvoice && salesInvoice
          ? findSILine(salesInvoice, line.siLineId, line.itemId)?.unitCostBase
          : isBeforeInvoice && deliveryNote
            ? findDNLine(deliveryNote, line.dnLineId, line.itemId)?.unitCostBase
            : undefined;

        const unitCostBase = roundMoney(
          this.resolveReturnUnitCostBase(line.unitCostBase, level, sourceLineCost)
        );
        line.unitCostBase = unitCostBase;
        const lineCostBase = roundMoney(qtyInBaseUom * unitCostBase);

        if (DocumentPolicyResolver.shouldRequirePositiveCostOnReturn(accountingMode)) {
          this.assertPositiveTrackedCost(
            qtyInBaseUom,
            unitCostBase,
            line.itemName || item.name,
            `sales return ${salesReturn.returnNumber}`
          );
        }

        const fxRateMovToBase = line.fxRateMovToBase > 0 ? line.fxRateMovToBase : (salesReturn.exchangeRate || 1);
        const fxRateCCYToBase = line.fxRateCCYToBase > 0 ? line.fxRateCCYToBase : (salesReturn.exchangeRate || 1);
        const unitCostInMoveCurrency = roundMoney(unitCostBase / fxRateMovToBase);

        const qtyBefore = level.qtyOnHand;
        const oldMaxBusinessDate = level.maxBusinessDate;
        let newAvgBase = unitCostBase;
        let newAvgCCY = unitCostInMoveCurrency;
        if (qtyBefore > 0) {
          const newQty = qtyBefore + qtyInBaseUom;
          newAvgBase = roundMoney(((level.avgCostBase * qtyBefore) + (unitCostBase * qtyInBaseUom)) / newQty);
          newAvgCCY = roundMoney(((level.avgCostCCY * qtyBefore) + (unitCostInMoveCurrency * qtyInBaseUom)) / newQty);
        }
        const settlesNegativeQty = Math.min(qtyInBaseUom, Math.max(-qtyBefore, 0));
        const newPositiveQty = qtyInBaseUom - settlesNegativeQty;
        const qtyAfter = qtyBefore + qtyInBaseUom;

        const movement = new StockMovement({
          id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          companyId,
          date: salesReturn.returnDate,
          postingSeq: level.postingSeq + 1,
          createdAt: new Date(),
          createdBy: salesReturn.createdBy,
          postedAt: new Date(),
          itemId: item.id,
          warehouseId,
          direction: 'IN',
          movementType: 'RETURN_IN',
          qty: qtyInBaseUom,
          uom: item.baseUom,
          referenceType: 'SALES_RETURN',
          referenceId: salesReturn.id,
          referenceLineId: line.lineId,
          unitCostBase,
          totalCostBase: roundMoney(unitCostBase * qtyInBaseUom),
          unitCostCCY: newAvgCCY,
          totalCostCCY: roundMoney(newAvgCCY * qtyInBaseUom),
          movementCurrency: salesReturn.currency.toUpperCase(),
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
          costSettled: unitCostBase > 0,
          isBackdated: salesReturn.returnDate < oldMaxBusinessDate,
          costSource: 'RETURN',
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
        });

        level.qtyOnHand += qtyInBaseUom;
        level.avgCostBase = newAvgBase;
        level.avgCostCCY = newAvgCCY;
        level.lastCostBase = unitCostBase;
        level.lastCostCCY = newAvgCCY;
        level.postingSeq += 1;
        level.version += 1;
        level.totalMovements += 1;
        level.maxBusinessDate = salesReturn.returnDate > oldMaxBusinessDate ? salesReturn.returnDate : oldMaxBusinessDate;
        level.updatedAt = new Date();
        level.lastMovementId = movement.id;

        line.stockMovementId = movement.id;
        inventoryMovements.set(line.lineId, { movement, updatedLevel: level });

        if (
          DocumentPolicyResolver.shouldSalesReturnReverseInventoryAccounting(
            accountingMode,
            salesReturn.returnContext
          )
        ) {
          const category = item.categoryId ? categoriesMap.get(item.categoryId) : null;
          const cogsAccountId = item.cogsAccountId || category?.defaultCogsAccountId || invSettings?.defaultCOGSAccountId;
          const inventoryAccountId = item.inventoryAssetAccountId || category?.defaultInventoryAssetAccountId || invSettings?.defaultInventoryAssetAccountId;
          if (!cogsAccountId) throw new Error(`No COGS account configured for item ${item.code}`);
          if (!inventoryAccountId) throw new Error(`No inventory account configured for item ${item.code}`);

          if (lineCostBase > 0) {
            line.cogsAccountId = line.cogsAccountId || cogsAccountId;
            line.inventoryAccountId = line.inventoryAccountId || inventoryAccountId;
            const key = `${inventoryAccountId}|${cogsAccountId}`;
            const existing = cogsBucket.get(key);
            if (existing) {
              existing.amountBase = roundMoney(existing.amountBase + lineCostBase);
            } else {
              cogsBucket.set(key, {
                inventoryAccountId,
                cogsAccountId,
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

    const accountCache = new Map<string, string>();
    const resolveAccountCached = async (idOrCode: string): Promise<string> => {
      if (!idOrCode) return '';
      if (accountCache.has(idOrCode)) return accountCache.get(idOrCode)!;
      const resolved = await this.resolveAccountId(companyId, idOrCode);
      accountCache.set(idOrCode, resolved);
      return resolved;
    };

    const arAccountId = this.resolveARAccount(customer);
    const resolvedARId = await resolveAccountCached(arAccountId);

    for (const [, line] of revenueDebitBucket) {
      line.accountId = await resolveAccountCached(line.accountId);
    }
    for (const [, line] of taxDebitBucket) {
      line.accountId = await resolveAccountCached(line.accountId);
    }
    for (const [, cogsLine] of cogsBucket) {
      cogsLine.inventoryAccountId = await resolveAccountCached(cogsLine.inventoryAccountId);
      cogsLine.cogsAccountId = await resolveAccountCached(cogsLine.cogsAccountId);
    }

    const resolvedBaseCurrency = (baseCurrency || salesReturn.currency).toUpperCase();

    await this.transactionManager.runTransaction(async (transaction) => {
      for (const [, { movement, updatedLevel }] of inventoryMovements) {
        await this.inventoryService.writeStockMovement(movement, transaction);
        await this.inventoryService.writeStockLevel(updatedLevel, transaction);
      }

      if (shouldPostAccounting && cogsBucket.size > 0) {
        const cogsVoucherLines: VoucherBucketLine[] = [];
        for (const cogsLine of Array.from(cogsBucket.values())) {
          const amount = roundMoney(cogsLine.amountBase);
          cogsVoucherLines.push({
            accountId: cogsLine.inventoryAccountId,
            baseAmount: amount,
            docAmount: amount,
          });
          cogsVoucherLines.push({
            accountId: cogsLine.cogsAccountId,
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
            currency: resolvedBaseCurrency,
            exchangeRate: 1,
            lines: cogsVoucherLines.map((vl, idx) => ({
              ...vl,
              side: idx % 2 === 0 ? 'Debit' : 'Credit',
            })),
            metadata: {
              sourceModule: 'sales',
              sourceType: 'SALES_RETURN',
              sourceId: salesReturn.id,
              referenceType: 'SALES_RETURN',
              referenceId: salesReturn.id,
              voucherPart: 'COGS',
              ...(periodLockOverride ? { periodLockOverride } : {}),
            },
            createdBy: salesReturn.createdBy,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: salesReturn.returnNumber,
            baseCurrencyOverride: resolvedBaseCurrency,
          },
          transaction
        );
        salesReturn.cogsVoucherId = cogsVoucher.id;
      } else {
        salesReturn.cogsVoucherId = null;
      }

      if (shouldPostAccounting && (isAfterInvoice || isDirect)) {
        const settlementAmountBase = roundMoney(
          salesReturn.netSettlementAmountBase ?? salesReturn.grandTotalBase
        );
        const settlementAmountDoc = roundMoney(
          salesReturn.netSettlementAmountDoc ?? salesReturn.grandTotalDoc
        );
        const restockingFeeBase = roundMoney(salesReturn.restockingFeeAmountBase || 0);
        const restockingFeeDoc = roundMoney(salesReturn.restockingFeeAmountDoc || 0);
        let restockingFeeAccountId: string | null = null;
        if (restockingFeeBase > 0 || restockingFeeDoc > 0) {
          const firstRevenueAccount = Array.from(revenueDebitBucket.values())[0]?.accountId;
          restockingFeeAccountId = await resolveAccountCached(firstRevenueAccount || settings.defaultRevenueAccountId);
          if (!restockingFeeAccountId) {
            throw new Error('No revenue account configured for restocking fee posting');
          }
        }

        const revenueVoucherLines = [
          ...Array.from(revenueDebitBucket.values()).map((line) => ({ ...line, side: 'Debit' as const })),
          ...Array.from(taxDebitBucket.values()).map((line) => ({ ...line, side: 'Debit' as const })),
          {
            accountId: resolvedARId,
            side: 'Credit' as const,
            baseAmount: settlementAmountBase,
            docAmount: settlementAmountDoc,
          },
        ];
        if (restockingFeeAccountId && (restockingFeeBase > 0 || restockingFeeDoc > 0)) {
          revenueVoucherLines.push({
            accountId: restockingFeeAccountId,
            side: 'Credit' as const,
            baseAmount: restockingFeeBase,
            docAmount: restockingFeeDoc,
          });
        }

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
              settlementMode: salesReturn.settlementMode,
              reasonCode: salesReturn.reasonCode,
              restockingFeeAmountBase: salesReturn.restockingFeeAmountBase,
              restockingFeeAmountDoc: salesReturn.restockingFeeAmountDoc,
              ...(periodLockOverride ? { periodLockOverride } : {}),
            },
            createdBy: salesReturn.createdBy,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: salesReturn.returnNumber,
            baseCurrencyOverride: resolvedBaseCurrency,
          },
          transaction
        );
        salesReturn.revenueVoucherId = revenueVoucher.id;

        if (isAfterInvoice && salesInvoice) {
          if (salesReturn.settlementMode === 'CREDIT_NOTE') {
            const invoice = salesInvoice as SalesInvoice;
            invoice.outstandingAmountBase = roundMoney(invoice.outstandingAmountBase - settlementAmountBase);
            invoice.paymentStatus = recalcPaymentStatus(invoice);
            invoice.updatedAt = new Date();
            await this.salesInvoiceRepo.update(invoice, transaction);
          }
        }

        if (salesReturn.settlementMode === 'REFUND' && settlementAmountBase > 0.0001) {
          const refundSettlementAccountRaw = this.resolveRefundSettlementAccount(settings);
          const refundSettlementAccountId = await resolveAccountCached(refundSettlementAccountRaw);

          await this.accountingPostingService.postInTransaction(
            {
              companyId,
              voucherType: VoucherType.SALES_RETURN,
              voucherNo: `SR-REF-${salesReturn.returnNumber}`,
              date: salesReturn.returnDate,
              description: `Sales Return ${salesReturn.returnNumber} Refund`,
              currency: salesReturn.currency,
              exchangeRate: salesReturn.exchangeRate,
              lines: [
                {
                  accountId: resolvedARId,
                  side: 'Debit',
                  baseAmount: settlementAmountBase,
                  docAmount: settlementAmountDoc,
                },
                {
                  accountId: refundSettlementAccountId,
                  side: 'Credit',
                  baseAmount: settlementAmountBase,
                  docAmount: settlementAmountDoc,
                },
              ],
              metadata: {
                sourceModule: 'sales',
                sourceType: 'SALES_RETURN',
                sourceId: salesReturn.id,
                referenceType: 'SALES_RETURN',
                referenceId: salesReturn.id,
                voucherPart: 'REFUND',
                settlementMode: salesReturn.settlementMode,
                ...(periodLockOverride ? { periodLockOverride } : {}),
              },
              createdBy: salesReturn.createdBy,
              postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
              reference: salesReturn.returnNumber,
              baseCurrencyOverride: resolvedBaseCurrency,
            },
            transaction
          );
        }
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

  private resolveARAccount(customer: Party): string {
    if (!customer.defaultARAccountId) {
      throw new Error(`Customer ${customer.displayName} has no linked AR account configured.`);
    }
    return customer.defaultARAccountId;
  }

  private resolveRefundSettlementAccount(settings: any): string {
    const paymentConfigs = Array.isArray(settings?.paymentMethodConfigs) ? settings.paymentMethodConfigs : [];
    const enabled = paymentConfigs.find(
      (config: any) => config && config.isEnabled !== false && typeof config.settlementAccountId === 'string' && config.settlementAccountId.trim()
    );
    const fallback = paymentConfigs.find(
      (config: any) => config && typeof config.settlementAccountId === 'string' && config.settlementAccountId.trim()
    );
    const accountId = enabled?.settlementAccountId || fallback?.settlementAccountId;
    if (!accountId) {
      throw new Error('No settlement account configured in Sales settings for refund posting');
    }
    return String(accountId).trim();
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

  private resolveReturnUnitCostBase(
    currentCostBase: number | undefined,
    level: StockLevel,
    sourceLineCost?: number
  ): number {
    if (sourceLineCost !== undefined && sourceLineCost !== null && sourceLineCost > 0) {
      return roundMoney(sourceLineCost);
    }
    const current = roundMoney(currentCostBase || 0);
    if (current > 0) return current;

    const avg = roundMoney(level.avgCostBase || 0);
    if (avg > 0) return avg;

    return roundMoney(level.lastCostBase || 0);
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

export interface UpdateSalesReturnInput {
  companyId: string;
  id: string;
  returnDate?: string;
  warehouseId?: string;
  settlementMode?: ReturnSettlementMode;
  reasonCode?: ReturnReasonCode;
  reason?: string;
  restockingFeeType?: RestockingFeeType;
  restockingFeeValue?: number;
  notes?: string;
  lines?: SalesReturnLineInput[];
}

export class UpdateSalesReturnUseCase {
  constructor(
    private readonly salesReturnRepo: ISalesReturnRepository,
    private readonly recordChangeService?: RecordChangeService
  ) {}

  async execute(input: UpdateSalesReturnInput, actor?: { userId: string; userEmail?: string }): Promise<SalesReturn> {
    const current = await this.salesReturnRepo.getById(input.companyId, input.id);
    if (!current) throw new Error(`Sales return not found: ${input.id}`);
    if (current.status !== 'DRAFT') {
      throw new Error('Only draft sales returns can be updated');
    }

    const before = current.toJSON();

    if (input.returnDate !== undefined) current.returnDate = input.returnDate;
    if (input.warehouseId !== undefined) current.warehouseId = input.warehouseId;
    if (input.settlementMode !== undefined) current.settlementMode = input.settlementMode;
    if (input.reasonCode !== undefined) current.reasonCode = input.reasonCode;
    if (input.reason !== undefined) current.reason = input.reason;
    if (input.restockingFeeType !== undefined) current.restockingFeeType = input.restockingFeeType;
    if (input.restockingFeeValue !== undefined) current.restockingFeeValue = roundMoney(input.restockingFeeValue);
    if (input.notes !== undefined) current.notes = input.notes;

    if (input.lines) {
      const existingById = new Map(current.lines.map((line) => [line.lineId, line]));
      const mappedLines: SalesReturnLine[] = input.lines.map((line, index) => {
        const existing = line.lineId ? existingById.get(line.lineId) : undefined;
        return {
          lineId: line.lineId || randomUUID(),
          lineNo: line.lineNo ?? existing?.lineNo ?? index + 1,
          siLineId: line.siLineId ?? existing?.siLineId,
          dnLineId: line.dnLineId ?? existing?.dnLineId,
          soLineId: line.soLineId ?? existing?.soLineId,
          itemId: line.itemId || existing?.itemId || '',
          itemCode: existing?.itemCode || '',
          itemName: existing?.itemName || '',
          returnQty: line.returnQty ?? existing?.returnQty ?? 0,
          uomId: line.uomId ?? existing?.uomId,
          uom: line.uom || existing?.uom || 'EA',
          unitPriceDoc: line.unitPriceDoc ?? existing?.unitPriceDoc ?? 0,
          unitPriceBase: existing?.unitPriceBase ?? 0,
          unitCostBase: existing?.unitCostBase ?? 0,
          fxRateMovToBase: existing?.fxRateMovToBase ?? 1,
          fxRateCCYToBase: existing?.fxRateCCYToBase ?? 1,
          taxCodeId: line.taxCodeId ?? existing?.taxCodeId,
          taxRate: existing?.taxRate ?? 0,
          taxAmountDoc: existing?.taxAmountDoc ?? 0,
          taxAmountBase: existing?.taxAmountBase ?? 0,
          revenueAccountId: existing?.revenueAccountId,
          cogsAccountId: existing?.cogsAccountId,
          inventoryAccountId: existing?.inventoryAccountId,
          stockMovementId: existing?.stockMovementId ?? null,
          description: line.description ?? existing?.description,
        };
      });
      current.lines = mappedLines;
    }

    current.updatedAt = new Date();
    const updated = new SalesReturn(current.toJSON() as any);
    await this.salesReturnRepo.update(updated);

    if (this.recordChangeService && actor) {
      const after = updated.toJSON();
      await this.recordChangeService.recordUpdate({
        companyId: input.companyId,
        entityType: 'SALES_RETURN',
        entityId: updated.id,
        entityNumber: updated.returnNumber ? `SR-${updated.returnNumber}` : undefined,
        userId: actor.userId,
        userEmail: actor.userEmail,
        before: before as Record<string, any>,
        after: after as Record<string, any>,
      });
    }

    return updated;
  }
}
