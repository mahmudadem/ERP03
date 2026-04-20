import { randomUUID } from 'crypto';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { SalesInvoice, SalesInvoiceLine, PaymentStatus } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { Item } from '../../../domain/inventory/entities/Item';
import { ISalesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { IAccountRepository, ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IDeliveryNoteRepository } from '../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import {
  ItemQtyToBaseUomResult,
  convertItemQtyToBaseUomDetailed,
} from '../../inventory/services/UomResolutionService';
import { addDaysToISODate, roundMoney } from './SalesPostingHelpers';
import { generateUniqueDocumentNumber } from './SalesOrderUseCases';

export interface SalesInvoiceLineInput {
  lineId?: string;
  lineNo?: number;
  soLineId?: string;
  dnLineId?: string;
  itemId?: string;
  invoicedQty: number;
  uomId?: string;
  uom?: string;
  unitPriceDoc?: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface CreateSalesInvoiceInput {
  companyId: string;
  salesOrderId?: string;
  customerId: string;
  customerInvoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesInvoiceLineInput[];
  notes?: string;
  createdBy: string;
}

export interface UpdateSalesInvoiceInput {
  companyId: string;
  id: string;
  customerId?: string;
  customerInvoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesInvoiceLineInput[];
  notes?: string;
}

export interface ListSalesInvoicesFilters {
  customerId?: string;
  salesOrderId?: string;
  status?: 'DRAFT' | 'POSTED' | 'CANCELLED';
  paymentStatus?: PaymentStatus;
  limit?: number;
}

interface VoucherAccumulatedLine {
  accountId: string;
  baseAmount: number;
  docAmount: number;
  side: 'Debit' | 'Credit';
}

interface AccumulatedCOGS {
  cogsAccountId: string;
  inventoryAccountId: string;
  amountBase: number;
}

const findSOLine = (so: SalesOrder, soLineId?: string, itemId?: string) => {
  if (soLineId) {
    return so.lines.find((line) => line.lineId === soLineId) || null;
  }
  if (itemId) {
    return so.lines.find((line) => line.itemId === itemId) || null;
  }
  return null;
};

const hasDNForThisLine = (line: SalesInvoiceLine): boolean => !!line.dnLineId;

const assertValidSalesTaxCode = (taxCode: TaxCode, taxCodeId: string): void => {
  if (!taxCode.active || (taxCode.scope !== 'SALES' && taxCode.scope !== 'BOTH')) {
    throw new Error(`Tax code is not valid for sales: ${taxCodeId}`);
  }
};

export class CreateSalesInvoiceUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository,
    private readonly itemCategoryRepo: IItemCategoryRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository
  ) {}

  async execute(input: CreateSalesInvoiceInput): Promise<SalesInvoice> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Sales module is not initialized');

    let so: SalesOrder | null = null;
    if (input.salesOrderId) {
      so = await this.salesOrderRepo.getById(input.companyId, input.salesOrderId);
      if (!so) throw new Error(`Sales order not found: ${input.salesOrderId}`);
      if (so.status === 'CANCELLED') {
        throw new Error('Cannot create invoice from a cancelled sales order');
      }
    }

    const customerId = so?.customerId || input.customerId;
    const customer = await this.partyRepo.getById(input.companyId, customerId);
    this.assertCustomer(customer, customerId);

    const currency = (input.currency || so?.currency || customer?.defaultCurrency || 'USD').toUpperCase();
    const exchangeRate = input.exchangeRate ?? so?.exchangeRate ?? 1;

    if (exchangeRate <= 0 || Number.isNaN(exchangeRate)) {
      throw new Error('exchangeRate must be greater than 0');
    }

    const currencyEnabled = await this.companyCurrencyRepo.isEnabled(input.companyId, currency);
    if (!currencyEnabled) {
      throw new Error(`Currency is not enabled for company: ${currency}`);
    }

    const sourceLines = this.resolveSourceLines(input.lines, so, settings.allowDirectInvoicing);
    if (!sourceLines.length) {
      throw new Error('Sales invoice must contain at least one line');
    }

    const lines: SalesInvoiceLine[] = [];

    for (let i = 0; i < sourceLines.length; i += 1) {
      const sourceLine = sourceLines[i];
      const soLine = so ? findSOLine(so, sourceLine.soLineId, sourceLine.itemId) : null;
      const itemId = sourceLine.itemId || soLine?.itemId;
      if (!itemId) throw new Error(`Line ${i + 1}: itemId is required`);

      const item = await this.itemRepo.getItem(itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${itemId}`);
      }

      const invoicedQty = sourceLine.invoicedQty;
      const unitPriceDoc = sourceLine.unitPriceDoc ?? soLine?.unitPriceDoc ?? 0;
      const lineTotalDoc = roundMoney(invoicedQty * unitPriceDoc);
      const unitPriceBase = roundMoney(unitPriceDoc * exchangeRate);
      const lineTotalBase = roundMoney(lineTotalDoc * exchangeRate);

      const taxCodeId = await this.resolveTaxCodeId(
        input.companyId,
        sourceLine.taxCodeId || soLine?.taxCodeId,
        item.defaultSalesTaxCodeId
      );

      let taxRate = 0;
      let taxCode: string | undefined;
      if (taxCodeId) {
        const selectedTaxCode = await this.taxCodeRepo.getById(input.companyId, taxCodeId);
        if (!selectedTaxCode) throw new Error(`Tax code not found: ${taxCodeId}`);
        assertValidSalesTaxCode(selectedTaxCode, taxCodeId);
        taxRate = selectedTaxCode.rate;
        taxCode = selectedTaxCode.code;
      }

      const revenueAccountId = await this.resolveRevenueAccount(
        input.companyId,
        item.id,
        settings.defaultRevenueAccountId
      );

      lines.push({
        lineId: sourceLine.lineId || randomUUID(),
        lineNo: sourceLine.lineNo ?? i + 1,
        soLineId: sourceLine.soLineId || soLine?.lineId,
        dnLineId: sourceLine.dnLineId,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        trackInventory: item.trackInventory,
        invoicedQty,
        uomId: sourceLine.uomId || soLine?.uomId || item.salesUomId || item.baseUomId,
        uom: sourceLine.uom || soLine?.uom || item.salesUom || item.baseUom,
        unitPriceDoc,
        lineTotalDoc,
        unitPriceBase,
        lineTotalBase,
        taxCodeId,
        taxCode,
        taxRate,
        taxAmountDoc: roundMoney(lineTotalDoc * taxRate),
        taxAmountBase: roundMoney(lineTotalBase * taxRate),
        warehouseId: sourceLine.warehouseId || soLine?.warehouseId || settings.defaultWarehouseId,
        revenueAccountId,
        cogsAccountId: item.cogsAccountId,
        inventoryAccountId: item.inventoryAssetAccountId,
        unitCostBase: undefined,
        lineCostBase: undefined,
        stockMovementId: null,
        description: sourceLine.description || soLine?.description,
      });
    }

    const paymentTermsDays = customer!.paymentTermsDays ?? settings.defaultPaymentTermsDays;
    const dueDate = input.dueDate || addDaysToISODate(input.invoiceDate, paymentTermsDays);
    const now = new Date();
    const invoiceNumber = await generateUniqueDocumentNumber(
      settings,
      'SI',
      async (candidate) => !!(await this.salesInvoiceRepo.getByNumber(input.companyId, candidate))
    );

    const si = new SalesInvoice({
      id: randomUUID(),
      companyId: input.companyId,
      invoiceNumber,
      customerInvoiceNumber: input.customerInvoiceNumber,
      salesOrderId: so?.id,
      customerId: customer!.id,
      customerName: customer!.displayName,
      invoiceDate: input.invoiceDate,
      dueDate,
      currency,
      exchangeRate,
      lines,
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      paymentTermsDays,
      paymentStatus: 'UNPAID',
      paidAmountBase: 0,
      outstandingAmountBase: 0,
      status: 'DRAFT',
      voucherId: null,
      cogsVoucherId: null,
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    si.outstandingAmountBase = si.grandTotalBase;

    await this.salesInvoiceRepo.create(si);
    await this.settingsRepo.saveSettings(settings);
    return si;
  }

  private assertCustomer(customer: Party | null, customerId: string): void {
    if (!customer) throw new Error(`Customer not found: ${customerId}`);
    if (!customer.roles.includes('CUSTOMER')) {
      throw new Error(`Party is not a customer: ${customerId}`);
    }
  }

  private resolveSourceLines(
    lines: SalesInvoiceLineInput[] | undefined,
    so: SalesOrder | null,
    allowDirectInvoicing: boolean
  ): SalesInvoiceLineInput[] {
    if (Array.isArray(lines) && lines.length > 0) {
      return lines;
    }

    if (!so) return [];

    return so.lines
      .map((line) => {
        let ceiling = 0;

        if (!allowDirectInvoicing && line.trackInventory) {
          ceiling = line.deliveredQty - line.invoicedQty;
        } else if (!allowDirectInvoicing && !line.trackInventory) {
          ceiling = line.orderedQty - line.invoicedQty;
        } else {
          ceiling = line.orderedQty - line.invoicedQty;
        }

        return {
          soLineId: line.lineId,
          itemId: line.itemId,
          dnLineId: undefined,
          invoicedQty: roundMoney(Math.max(ceiling, 0)),
          uomId: line.uomId,
          uom: line.uom,
          unitPriceDoc: line.unitPriceDoc,
          taxCodeId: line.taxCodeId,
          warehouseId: line.warehouseId,
          description: line.description,
        } as SalesInvoiceLineInput;
      })
      .filter((line) => line.invoicedQty > 0);
  }

  private async resolveTaxCodeId(
    companyId: string,
    requestedTaxCodeId: string | undefined,
    defaultItemTaxCodeId: string | undefined
  ): Promise<string | undefined> {
    if (requestedTaxCodeId) return requestedTaxCodeId;
    if (!defaultItemTaxCodeId) return undefined;

    const taxCode = await this.taxCodeRepo.getById(companyId, defaultItemTaxCodeId);
    if (!taxCode) return undefined;
    if (!taxCode.active || (taxCode.scope !== 'SALES' && taxCode.scope !== 'BOTH')) {
      return undefined;
    }

    return taxCode.id;
  }

  private async resolveRevenueAccount(
    companyId: string,
    itemId: string,
    defaultRevenueAccountId: string
  ): Promise<string> {
    const item = await this.itemRepo.getItem(itemId);
    if (!item) throw new Error(`Item not found while resolving revenue account: ${itemId}`);

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
}

export class PostSalesInvoiceUseCase {
  private readonly accountingPostingService: SubledgerVoucherPostingService;
  private readonly accountRepo?: IAccountRepository;

  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly deliveryNoteRepo: IDeliveryNoteRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly itemRepo: IItemRepository,
    private readonly itemCategoryRepo: IItemCategoryRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly inventoryService: ISalesInventoryService,
    accountingPostingService: SubledgerVoucherPostingService,
    accountRepo: IAccountRepository | undefined,
    private readonly transactionManager: ITransactionManager
  ) {
    this.accountingPostingService = accountingPostingService;
    this.accountRepo = accountRepo;
  }

  async execute(companyId: string, id: string): Promise<SalesInvoice> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales module not initialized');
    const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(invSettings);

    const si = await this.salesInvoiceRepo.getById(companyId, id);
    if (!si || si.status !== 'DRAFT') throw new Error('Invalid sales invoice state');

    const customer = await this.partyRepo.getById(companyId, si.customerId);
    if (!customer) throw new Error(`Customer not found: ${si.customerId}`);

    let so: SalesOrder | null = null;
    if (si.salesOrderId) {
      so = await this.salesOrderRepo.getById(companyId, si.salesOrderId);
    }

    // PHASE 1: PRE-FETCH ALL DATA (Thunder-Fast)
    const distinctItemIds = [...new Set(si.lines.map(l => l.itemId))];
    const distinctTaxCodeIds = [...new Set(si.lines.filter(l => l.taxCodeId).map(l => l.taxCodeId as string))];
    const distinctWarehouseIds = [...new Set(si.lines.filter(l => l.warehouseId).map(l => (l.warehouseId as string)))];
    if (settings.defaultWarehouseId) distinctWarehouseIds.push(settings.defaultWarehouseId);

    const [itemsMap, categoriesMap, taxCodesMap, warehousesMap, baseCurrency, postedDNs] = await Promise.all([
      Promise.all(distinctItemIds.map(id => this.itemRepo.getItem(id))).then(res => 
        new Map(res.filter((i): i is Item => !!i && i.companyId === companyId).map(i => [i.id, i]))
      ),
      this.itemCategoryRepo.getCompanyCategories(companyId).then(res => 
        new Map(res.map(c => [c.id, c]))
      ),
      Promise.all(distinctTaxCodeIds.map(id => this.taxCodeRepo.getById(companyId, id))).then(res => 
        new Map(res.filter(t => !!t).map(t => [t!.id, t!]))
      ),
      Promise.all(distinctWarehouseIds.map(id => this.warehouseRepo.getWarehouse(id))).then(res => 
        new Map(res.filter(w => !!w && w.companyId === companyId).map(w => [w.id, w!]))
      ),
      this.companyCurrencyRepo.getBaseCurrency(companyId),
      so ? this.deliveryNoteRepo.list(companyId, { salesOrderId: so.id, status: 'POSTED', limit: 200 }) : Promise.resolve([])
    ]);

    const arAccountId = this.resolveARAccount(customer, settings);
    const revenueCredits = new Map<string, VoucherAccumulatedLine>();
    const taxCredits = new Map<string, VoucherAccumulatedLine>();
    const cogsBucket = new Map<string, AccumulatedCOGS>();

    // PHASE 2: ATOMIC POSTING (Writes Only)
    await this.transactionManager.runTransaction(async (transaction) => {
      for (const line of si.lines) {
        const item = itemsMap.get(line.itemId);
        if (!item) throw new Error(`Item not found: ${line.itemId}`);
        line.trackInventory = item.trackInventory;

        const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
        this.validatePostingQuantity(line, soLine, settings.allowDirectInvoicing, settings.overInvoiceTolerancePct, !!so);

        const taxCode = line.taxCodeId ? taxCodesMap.get(line.taxCodeId) : null;
        this.freezeTaxSnapshotSync(line, si.exchangeRate, taxCode || undefined);

        line.revenueAccountId = this.resolveRevenueAccountSync(companyId, item, categoriesMap, settings.defaultRevenueAccountId);
        const resolvedRevId = await this.resolveAccountId(companyId, line.revenueAccountId);
        this.addToBucket(revenueCredits, resolvedRevId, line.lineTotalBase, line.lineTotalDoc);

        if (line.taxAmountBase > 0 && line.taxCodeId) {
          const sTaxCode = taxCodesMap.get(line.taxCodeId);
          if (sTaxCode?.salesTaxAccountId) {
            const resolvedTaxId = await this.resolveAccountId(companyId, sTaxCode.salesTaxAccountId);
            this.addToBucket(taxCredits, resolvedTaxId, line.taxAmountBase, line.taxAmountDoc);
          }
        }

        // Inventory movement / cost recognition
        if (line.trackInventory) {
          const matchedDeliveryLines = this.getMatchedDeliveryLines(line, soLine, postedDNs);
          const hasOperationalDelivery = matchedDeliveryLines.length > 0;

          if (!hasOperationalDelivery && settings.allowDirectInvoicing) {
            const warehouseId = line.warehouseId || settings.defaultWarehouseId;
            if (!warehouseId || !warehousesMap.has(warehouseId)) throw new Error(`Warehouse required for ${item.name}`);

            const conversionResult = await this.convertToBaseUom(
              companyId,
              line.invoicedQty,
              line.uomId,
              line.uom,
              item
            );
            const qtyInBaseUom = conversionResult.qtyInBaseUom;
            const movement = await this.inventoryService.processOUT({
              companyId,
              itemId: line.itemId,
              warehouseId,
              qty: qtyInBaseUom,
              date: si.invoiceDate,
              movementType: 'SALES_DELIVERY',
              refs: { type: 'SALES_INVOICE', docId: si.id, lineId: line.lineId },
              currentUser: si.createdBy,
              metadata: {
                uomConversion: {
                  conversionId: conversionResult.trace.conversionId,
                  mode: conversionResult.trace.mode,
                  appliedFactor: conversionResult.trace.factor,
                  sourceQty: line.invoicedQty,
                  sourceUomId: line.uomId,
                  sourceUom: line.uom,
                  baseUomId: item.baseUomId,
                  baseUom: item.baseUom,
                },
              },
              transaction,
            });

            line.stockMovementId = movement.id;
            line.unitCostBase = roundMoney(movement.unitCostBase || 0);
            line.lineCostBase = roundMoney(qtyInBaseUom * line.unitCostBase);
            this.assertPositiveTrackedCost(
              qtyInBaseUom,
              line.unitCostBase,
              line.itemName || item.name,
              `sales invoice ${si.invoiceNumber}`
            );
          } else {
            const operationalQty = roundMoney(line.invoicedQty);
            line.unitCostBase = roundMoney(this.resolveControlledUnitCost(line, soLine, postedDNs));
            line.lineCostBase = roundMoney(operationalQty * line.unitCostBase);
            this.assertPositiveTrackedCost(
              operationalQty,
              line.unitCostBase,
              line.itemName || item.name,
              `sales invoice ${si.invoiceNumber}`
            );
          }

          if (
            line.lineCostBase
            && DocumentPolicyResolver.shouldInvoiceRecognizeInventory(accountingMode, hasOperationalDelivery)
          ) {
            const accounts = this.resolveCOGSAccountsSync(
              companyId,
              item,
              categoriesMap,
              invSettings?.defaultCOGSAccountId,
              invSettings?.defaultInventoryAssetAccountId
            );
            if (accounts) {
              const resCOGSId = await this.resolveAccountId(companyId, accounts.cogsAccountId);
              const resInvId = await this.resolveAccountId(companyId, accounts.inventoryAccountId);
              this.addToCOGSBucket(cogsBucket, resCOGSId, resInvId, line.lineCostBase);
            }
          }
        }
        if (soLine) soLine.invoicedQty = roundMoney(soLine.invoicedQty + line.invoicedQty);
      }

      this.recalcInvoiceTotals(si);
      const resolvedARId = await this.resolveAccountId(companyId, arAccountId);

      // Create main invoice voucher (AR vs Revenue + Tax)
      const revenueVoucherLines: VoucherAccumulatedLine[] = [
        {
          accountId: resolvedARId,
          side: 'Debit',
          baseAmount: roundMoney(si.grandTotalBase),
          docAmount: roundMoney(si.grandTotalDoc),
        },
        ...Array.from(revenueCredits.values()).map((line) => ({ ...line, side: 'Credit' as const })),
        ...Array.from(taxCredits.values()).map((line) => ({ ...line, side: 'Credit' as const })),
      ];

      const revVoucher = await this.accountingPostingService.postInTransaction(
        {
          companyId,
          voucherType: VoucherType.SALES_INVOICE,
          voucherNo: `SI-${si.invoiceNumber}`,
          date: si.invoiceDate,
          description: `Sales Invoice ${si.invoiceNumber} - ${si.customerName}`,
          currency: si.currency,
          exchangeRate: si.exchangeRate,
          lines: revenueVoucherLines,
          metadata: {
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
            voucherPart: 'REVENUE',
          },
          createdBy: si.createdBy,
          postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
          reference: si.invoiceNumber,
        },
        transaction
      );
      si.voucherId = revVoucher.id;

      // Create inventory recognition voucher (COGS vs Inventory)
      if (cogsBucket.size > 0) {
        const cogsVoucherLines: VoucherAccumulatedLine[] = [];
        for (const line of Array.from(cogsBucket.values())) {
          const amount = roundMoney(line.amountBase);
          cogsVoucherLines.push({
            accountId: line.cogsAccountId,
            side: 'Debit',
            baseAmount: amount,
            docAmount: amount,
          });
          cogsVoucherLines.push({
            accountId: line.inventoryAccountId,
            side: 'Credit',
            baseAmount: amount,
            docAmount: amount,
          });
        }

        const cogsVoucher = await this.accountingPostingService.postInTransaction(
          {
            companyId,
            voucherType: VoucherType.SALES_INVOICE,
            voucherNo: `SI-COGS-${si.invoiceNumber}`,
            date: si.invoiceDate,
            description: `Sales Invoice ${si.invoiceNumber} COGS`,
            currency: (baseCurrency || si.currency).toUpperCase(),
            exchangeRate: 1,
            lines: cogsVoucherLines,
            metadata: {
              sourceModule: 'sales',
              sourceType: 'SALES_INVOICE',
              sourceId: si.id,
              voucherPart: 'COGS',
            },
            createdBy: si.createdBy,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: si.invoiceNumber,
          },
          transaction
        );
        si.cogsVoucherId = cogsVoucher.id;
      } else {
        si.cogsVoucherId = null;
      }

      if (so) {
        so.updatedAt = new Date();
        await this.salesOrderRepo.update(so, transaction);
      }

      si.status = 'POSTED';
      si.postedAt = new Date();
      si.updatedAt = new Date();
      si.paymentStatus = 'UNPAID';
      si.paidAmountBase = 0;
      si.outstandingAmountBase = si.grandTotalBase;
      await this.salesInvoiceRepo.update(si, transaction);
    });

    return (await this.salesInvoiceRepo.getById(companyId, id))!;
  }

  private async resolveAccountId(companyId: string, idOrCode: string): Promise<string> {
    if (!idOrCode) return '';
    if (!this.accountRepo) return idOrCode;
    const acc = (await this.accountRepo.getById(companyId, idOrCode)) || (await this.accountRepo.getByUserCode(companyId, idOrCode));
    return acc ? acc.id : idOrCode;
  }

  private validatePostingQuantity(line: any, soLine: any, allowDirect: boolean, tolerance: number, isSOLinked: boolean): void {
    if (!isSOLinked || !soLine) return;
    const toleranceFactor = 1 + (tolerance / 100);
    const eps = 0.000001;

    if (!allowDirect && line.trackInventory) {
      const maxByDelivered = (soLine.deliveredQty * toleranceFactor) - soLine.invoicedQty;
      if (line.invoicedQty > maxByDelivered + eps) {
        throw new Error(`Invoiced qty exceeds delivered qty for ${line.itemName}`);
      }
      return;
    }

    const maxByOrdered = (soLine.orderedQty * toleranceFactor) - soLine.invoicedQty;
    if (line.invoicedQty > maxByOrdered + eps) {
      throw new Error(`Invoiced qty exceeds ordered qty for ${line.itemName}`);
    }
  }

  private freezeTaxSnapshotSync(line: SalesInvoiceLine, rate: number, tax?: TaxCode): void {
    line.lineTotalDoc = roundMoney(line.invoicedQty * line.unitPriceDoc);
    line.unitPriceBase = roundMoney(line.unitPriceDoc * rate);
    line.lineTotalBase = roundMoney(line.lineTotalDoc * rate);
    line.taxCode = tax?.code;
    line.taxRate = tax?.rate || 0;
    line.taxAmountDoc = roundMoney(line.lineTotalDoc * line.taxRate);
    line.taxAmountBase = roundMoney(line.lineTotalBase * line.taxRate);
  }

  private resolveRevenueAccountSync(cid: string, item: Item, cats: Map<string, any>, dRev: string): string {
    return item.revenueAccountId || (item.categoryId ? cats.get(item.categoryId)?.defaultRevenueAccountId : null) || dRev;
  }

  private resolveCOGSAccountsSync(cid: string, item: Item, cats: Map<string, any>, dCOGS?: string, dInv?: string) {
    const c = item.categoryId ? cats.get(item.categoryId) : null;
    const cogsId = item.cogsAccountId || c?.defaultCogsAccountId || dCOGS;
    const invId = item.inventoryAssetAccountId || c?.defaultInventoryAssetAccountId || dInv;
    return (cogsId && invId) ? { cogsAccountId: cogsId, inventoryAccountId: invId } : null;
  }

  private resolveARAccount(customer: Party, settings: SalesSettings): string {
    const aid = customer.defaultARAccountId || settings.defaultARAccountId;
    if (!aid) throw new Error(`No AR account resolved for ${customer.displayName}`);
    return aid;
  }

  private addToBucket(bucket: Map<string, VoucherAccumulatedLine>, aid: string, base: number, doc: number): void {
    const existing = bucket.get(aid);
    if (existing) {
      existing.baseAmount = roundMoney(existing.baseAmount + base);
      existing.docAmount = roundMoney(existing.docAmount + doc);
    } else {
      bucket.set(aid, { accountId: aid, baseAmount: roundMoney(base), docAmount: roundMoney(doc), side: 'Credit' });
    }
  }

  private addToCOGSBucket(bucket: Map<string, AccumulatedCOGS>, cogsId: string, invId: string, amount: number): void {
    const key = `${cogsId}|${invId}`;
    const existing = bucket.get(key);
    if (existing) {
      existing.amountBase = roundMoney(existing.amountBase + amount);
    } else {
      bucket.set(key, { cogsAccountId: cogsId, inventoryAccountId: invId, amountBase: roundMoney(amount) });
    }
  }

  private getMatchedDeliveryLines(line: SalesInvoiceLine, soLine: SalesOrder['lines'][number] | null, postedDNs: DeliveryNote[]) {
    return postedDNs
      .flatMap((dn) => dn.lines)
      .filter(
        (entry) =>
          (
            entry.lineId === line.dnLineId
            || entry.soLineId === line.soLineId
            || (!!soLine && entry.itemId === soLine.itemId)
          )
          && entry.unitCostBase > 0
      );
  }

  private resolveControlledUnitCost(line: SalesInvoiceLine, soLine: SalesOrder['lines'][number] | null, postedDNs: DeliveryNote[]): number {
    const matched = this.getMatchedDeliveryLines(line, soLine, postedDNs);
    if (!matched.length) return 0;
    const totalV = matched.reduce((s, l) => s + (l.unitCostBase * l.deliveredQty), 0);
    const totalQ = matched.reduce((s, l) => s + l.deliveredQty, 0);
    return totalQ > 0 ? (totalV / totalQ) : 0;
  }

  private recalcInvoiceTotals(si: SalesInvoice): void {
    si.subtotalDoc = roundMoney(si.lines.reduce((s, l) => s + l.lineTotalDoc, 0));
    si.taxTotalDoc = roundMoney(si.lines.reduce((s, l) => s + l.taxAmountDoc, 0));
    si.grandTotalDoc = roundMoney(si.subtotalDoc + si.taxTotalDoc);
    si.subtotalBase = roundMoney(si.lines.reduce((s, l) => s + l.lineTotalBase, 0));
    si.taxTotalBase = roundMoney(si.lines.reduce((s, l) => s + l.taxAmountBase, 0));
    si.grandTotalBase = roundMoney(si.subtotalBase + si.taxTotalBase);
  }

  private async convertToBaseUom(
    cid: string,
    qty: number,
    uomId: string | undefined,
    uom: string,
    item: Item
  ): Promise<ItemQtyToBaseUomResult> {
    const convs = await this.uomConversionRepo.getConversionsForItem(cid, item.id, { active: true });
    return convertItemQtyToBaseUomDetailed({
      qty,
      item,
      conversions: convs,
      fromUomId: uomId,
      fromUom: uom,
      round: roundMoney,
      itemCode: item.code,
    });
  }

  private assertPositiveTrackedCost(qty: number, unitCostBase: number, itemName: string, documentLabel: string): void {
    if (qty > 0 && !(unitCostBase > 0)) {
      throw new Error(`Missing positive inventory cost for ${itemName} on ${documentLabel}`);
    }
  }

}

export class UpdateSalesInvoiceUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(input: UpdateSalesInvoiceInput): Promise<SalesInvoice> {
    const current = await this.salesInvoiceRepo.getById(input.companyId, input.id);
    if (!current) throw new Error(`Sales invoice not found: ${input.id}`);
    if (current.status !== 'DRAFT') {
      throw new Error('Only draft sales invoices can be updated');
    }

    if (input.customerId) {
      const customer = await this.partyRepo.getById(input.companyId, input.customerId);
      if (!customer) throw new Error(`Customer not found: ${input.customerId}`);
      if (!customer.roles.includes('CUSTOMER')) {
        throw new Error(`Party is not a customer: ${input.customerId}`);
      }
      current.customerId = customer.id;
      current.customerName = customer.displayName;
    }

    if (input.customerInvoiceNumber !== undefined) current.customerInvoiceNumber = input.customerInvoiceNumber;
    if (input.invoiceDate !== undefined) current.invoiceDate = input.invoiceDate;
    if (input.dueDate !== undefined) current.dueDate = input.dueDate;
    if (input.currency !== undefined) current.currency = input.currency.toUpperCase();
    if (input.exchangeRate !== undefined) current.exchangeRate = input.exchangeRate;
    if (input.notes !== undefined) current.notes = input.notes;

    if (input.lines) {
      const existingById = new Map(current.lines.map((line) => [line.lineId, line]));
      const mappedLines: SalesInvoiceLine[] = input.lines.map((line, index) => {
        const existing = line.lineId ? existingById.get(line.lineId) : undefined;
        const itemId = line.itemId || existing?.itemId;
        if (!itemId) {
          throw new Error(`Line ${index + 1}: itemId is required`);
        }

        return {
          lineId: line.lineId || randomUUID(),
          lineNo: line.lineNo ?? existing?.lineNo ?? index + 1,
          soLineId: line.soLineId ?? existing?.soLineId,
          dnLineId: line.dnLineId ?? existing?.dnLineId,
          itemId,
          itemCode: existing?.itemCode || '',
          itemName: existing?.itemName || '',
          trackInventory: existing?.trackInventory ?? false,
          invoicedQty: line.invoicedQty,
          uomId: line.uomId ?? existing?.uomId,
          uom: line.uom || existing?.uom || 'EA',
          unitPriceDoc: line.unitPriceDoc ?? existing?.unitPriceDoc ?? 0,
          lineTotalDoc: existing?.lineTotalDoc ?? 0,
          unitPriceBase: existing?.unitPriceBase ?? 0,
          lineTotalBase: existing?.lineTotalBase ?? 0,
          taxCodeId: line.taxCodeId ?? existing?.taxCodeId,
          taxCode: existing?.taxCode,
          taxRate: existing?.taxRate ?? 0,
          taxAmountDoc: existing?.taxAmountDoc ?? 0,
          taxAmountBase: existing?.taxAmountBase ?? 0,
          warehouseId: line.warehouseId ?? existing?.warehouseId,
          revenueAccountId: existing?.revenueAccountId || '',
          cogsAccountId: existing?.cogsAccountId,
          inventoryAccountId: existing?.inventoryAccountId,
          unitCostBase: existing?.unitCostBase,
          lineCostBase: existing?.lineCostBase,
          stockMovementId: existing?.stockMovementId ?? null,
          description: line.description ?? existing?.description,
        };
      });

      current.lines = mappedLines;
    }

    current.updatedAt = new Date();
    const updated = new SalesInvoice(current.toJSON() as any);
    await this.salesInvoiceRepo.update(updated);
    return updated;
  }
}

export class GetSalesInvoiceUseCase {
  constructor(private readonly salesInvoiceRepo: ISalesInvoiceRepository) {}

  async execute(companyId: string, id: string): Promise<SalesInvoice> {
    const si = await this.salesInvoiceRepo.getById(companyId, id);
    if (!si) throw new Error(`Sales invoice not found: ${id}`);
    return si;
  }
}

export class ListSalesInvoicesUseCase {
  constructor(private readonly salesInvoiceRepo: ISalesInvoiceRepository) {}

  async execute(companyId: string, filters: ListSalesInvoicesFilters = {}): Promise<SalesInvoice[]> {
    return this.salesInvoiceRepo.list(companyId, {
      customerId: filters.customerId,
      salesOrderId: filters.salesOrderId,
      status: filters.status,
      paymentStatus: filters.paymentStatus,
      limit: filters.limit,
    });
  }
}
