import { randomUUID } from 'crypto';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { PostingLockPolicy, VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { SalesInvoice, SalesInvoiceLine, PaymentStatus } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { ISalesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IDeliveryNoteRepository } from '../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { addDaysToISODate, roundMoney } from './SalesPostingHelpers';
import { generateDocumentNumber } from './SalesOrderUseCases';

export interface SalesInvoiceLineInput {
  lineId?: string;
  lineNo?: number;
  soLineId?: string;
  dnLineId?: string;
  itemId?: string;
  invoicedQty: number;
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

const addToBucket = (
  bucket: Map<string, VoucherAccumulatedLine>,
  accountId: string,
  baseAmount: number,
  docAmount: number
): void => {
  if (baseAmount <= 0 && docAmount <= 0) return;

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

    const sourceLines = this.resolveSourceLines(input.lines, so, settings.salesControlMode);
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

    const si = new SalesInvoice({
      id: randomUUID(),
      companyId: input.companyId,
      invoiceNumber: generateDocumentNumber(settings, 'SI'),
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
    mode: 'SIMPLE' | 'CONTROLLED'
  ): SalesInvoiceLineInput[] {
    if (Array.isArray(lines) && lines.length > 0) {
      return lines;
    }

    if (!so) return [];

    return so.lines
      .map((line) => {
        let ceiling = 0;

        if (mode === 'CONTROLLED' && line.trackInventory) {
          ceiling = line.deliveredQty - line.invoicedQty;
        } else if (mode === 'CONTROLLED' && !line.trackInventory) {
          ceiling = line.orderedQty - line.invoicedQty;
        } else {
          ceiling = line.orderedQty - line.invoicedQty;
        }

        return {
          soLineId: line.lineId,
          itemId: line.itemId,
          dnLineId: undefined,
          invoicedQty: roundMoney(Math.max(ceiling, 0)),
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
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
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
    private readonly voucherRepo: IVoucherRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string): Promise<SalesInvoice> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales module is not initialized');

    const si = await this.salesInvoiceRepo.getById(companyId, id);
    if (!si) throw new Error(`Sales invoice not found: ${id}`);
    if (si.status !== 'DRAFT') throw new Error('Only DRAFT sales invoices can be posted');

    const customer = await this.partyRepo.getById(companyId, si.customerId);
    if (!customer) throw new Error(`Customer not found: ${si.customerId}`);

    const isSOLinked = !!si.salesOrderId;
    let so: SalesOrder | null = null;
    if (isSOLinked) {
      so = await this.salesOrderRepo.getById(companyId, si.salesOrderId as string);
      if (!so) throw new Error(`Sales order not found: ${si.salesOrderId}`);
      if (so.status === 'CANCELLED') {
        throw new Error('Cannot post invoice for cancelled sales order');
      }
    }

    let postedDNs: DeliveryNote[] = [];
    if (so && settings.salesControlMode === 'CONTROLLED' && si.lines.some((line) => line.trackInventory)) {
      postedDNs = await this.deliveryNoteRepo.list(companyId, {
        salesOrderId: so.id,
        status: 'POSTED',
        limit: 500,
      });
    }

    const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || si.currency;
    const revenueCredits = new Map<string, VoucherAccumulatedLine>();
    const taxCredits = new Map<string, VoucherAccumulatedLine>();
    const cogsBucket = new Map<string, AccumulatedCOGS>();

    await this.transactionManager.runTransaction(async (transaction) => {
      for (const line of si.lines) {
        const item = await this.itemRepo.getItem(line.itemId);
        if (!item || item.companyId !== companyId) {
          throw new Error(`Item not found: ${line.itemId}`);
        }

        line.trackInventory = item.trackInventory;

        const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
        if (so && !soLine) {
          throw new Error(`SO line not found for SI line ${line.lineId}`);
        }

        this.validatePostingQuantity(
          line,
          soLine,
          settings.salesControlMode,
          settings.overInvoiceTolerancePct,
          isSOLinked
        );

        await this.freezeTaxSnapshot(companyId, line, si.exchangeRate);
        line.revenueAccountId = await this.resolveRevenueAccount(companyId, item, settings.defaultRevenueAccountId);

        addToBucket(revenueCredits, line.revenueAccountId, line.lineTotalBase, line.lineTotalDoc);

        if (line.taxAmountBase > 0) {
          const salesTaxAccountId = await this.resolveSalesTaxAccount(companyId, line.taxCodeId);
          addToBucket(taxCredits, salesTaxAccountId, line.taxAmountBase, line.taxAmountDoc);
        }

        if (settings.salesControlMode === 'SIMPLE' && line.trackInventory && !hasDNForThisLine(line)) {
          const warehouseId = line.warehouseId || settings.defaultWarehouseId;
          if (!warehouseId) {
            throw new Error(`warehouseId is required for stock item ${line.itemName || item.name}`);
          }

          const warehouse = await this.warehouseRepo.getWarehouse(warehouseId);
          if (!warehouse || warehouse.companyId !== companyId) {
            throw new Error(`Warehouse not found: ${warehouseId}`);
          }

          const qtyInBaseUom = await this.convertToBaseUom(
            companyId,
            line.invoicedQty,
            line.uom,
            item.baseUom,
            item.id,
            item.code
          );

          const movement = await this.inventoryService.processOUT({
            companyId,
            itemId: line.itemId,
            warehouseId,
            qty: qtyInBaseUom,
            date: si.invoiceDate,
            movementType: 'SALES_DELIVERY',
            refs: {
              type: 'SALES_INVOICE',
              docId: si.id,
              lineId: line.lineId,
            },
            currentUser: si.createdBy,
            transaction,
          });

          line.stockMovementId = movement.id;
          line.unitCostBase = roundMoney(movement.unitCostBase || 0);
          line.lineCostBase = roundMoney(qtyInBaseUom * line.unitCostBase);

          const accounts = await this.resolveCOGSAccounts(companyId, item, settings.defaultCOGSAccountId, true);
          line.cogsAccountId = accounts.cogsAccountId;
          line.inventoryAccountId = accounts.inventoryAccountId;

          if (line.lineCostBase > 0) {
            const key = `${accounts.cogsAccountId}|${accounts.inventoryAccountId}`;
            const existing = cogsBucket.get(key);
            if (existing) {
              existing.amountBase = roundMoney(existing.amountBase + line.lineCostBase);
            } else {
              cogsBucket.set(key, {
                cogsAccountId: accounts.cogsAccountId,
                inventoryAccountId: accounts.inventoryAccountId,
                amountBase: roundMoney(line.lineCostBase),
              });
            }
          }
        }

        if (settings.salesControlMode === 'CONTROLLED' && line.trackInventory) {
          const unitCostBase = this.resolveControlledUnitCost(line, soLine, postedDNs);
          line.unitCostBase = roundMoney(unitCostBase);
          line.lineCostBase = roundMoney(line.invoicedQty * line.unitCostBase);

          const accounts = await this.resolveCOGSAccounts(companyId, item, settings.defaultCOGSAccountId, false);
          if (accounts) {
            line.cogsAccountId = accounts.cogsAccountId;
            line.inventoryAccountId = accounts.inventoryAccountId;
          }
        }

        if (soLine) {
          soLine.invoicedQty = roundMoney(soLine.invoicedQty + line.invoicedQty);
        }
      }

      this.recalcInvoiceTotals(si);

      const arAccountId = this.resolveARAccount(customer, settings.defaultARAccountId);
      const revenueVoucher = await this.createRevenueVoucherInTransaction(
        transaction,
        si,
        baseCurrency,
        arAccountId,
        Array.from(revenueCredits.values()),
        Array.from(taxCredits.values())
      );
      si.voucherId = revenueVoucher.id;

      if (cogsBucket.size > 0) {
        const cogsVoucher = await this.createCOGSVoucherInTransaction(
          transaction,
          si,
          baseCurrency,
          Array.from(cogsBucket.values())
        );
        si.cogsVoucherId = cogsVoucher.id;
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

    const posted = await this.salesInvoiceRepo.getById(companyId, id);
    if (!posted) throw new Error(`Sales invoice not found after posting: ${id}`);
    return posted;
  }

  private validatePostingQuantity(
    line: SalesInvoiceLine,
    soLine: SalesOrder['lines'][number] | null,
    mode: 'SIMPLE' | 'CONTROLLED',
    overInvoiceTolerancePct: number,
    isSOLinked: boolean
  ): void {
    if (!isSOLinked || !soLine) {
      return;
    }

    if (mode === 'CONTROLLED' && soLine.trackInventory) {
      const ceiling = soLine.deliveredQty - soLine.invoicedQty;
      if (line.invoicedQty > ceiling + 0.000001) {
        throw new Error(`Cannot invoice more than delivered for ${line.itemName}`);
      }
      return;
    }

    if (mode === 'CONTROLLED' && !soLine.trackInventory) {
      const ceiling = soLine.orderedQty - soLine.invoicedQty;
      if (line.invoicedQty > ceiling + 0.000001) {
        throw new Error(`Cannot invoice more than ordered for service ${line.itemName}`);
      }
      return;
    }

    const ceiling = soLine.orderedQty - soLine.invoicedQty;
    const maxAllowed = ceiling * (1 + overInvoiceTolerancePct / 100);
    if (line.invoicedQty > maxAllowed + 0.000001) {
      throw new Error(`Invoice qty exceeds order qty for ${line.itemName}`);
    }
  }

  private async freezeTaxSnapshot(companyId: string, line: SalesInvoiceLine, exchangeRate: number): Promise<void> {
    line.lineTotalDoc = roundMoney(line.invoicedQty * line.unitPriceDoc);
    line.unitPriceBase = roundMoney(line.unitPriceDoc * exchangeRate);
    line.lineTotalBase = roundMoney(line.lineTotalDoc * exchangeRate);

    if (!line.taxCodeId) {
      line.taxCode = undefined;
      line.taxRate = 0;
      line.taxAmountDoc = 0;
      line.taxAmountBase = 0;
      return;
    }

    const taxCode = await this.taxCodeRepo.getById(companyId, line.taxCodeId);
    if (!taxCode) throw new Error(`Tax code not found: ${line.taxCodeId}`);
    assertValidSalesTaxCode(taxCode, line.taxCodeId);

    line.taxCode = taxCode.code;
    line.taxRate = taxCode.rate;
    line.taxAmountDoc = roundMoney(line.lineTotalDoc * line.taxRate);
    line.taxAmountBase = roundMoney(line.lineTotalBase * line.taxRate);
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
    const inventoryAccountId = item.inventoryAssetAccountId || category?.defaultInventoryAssetAccountId;

    if (!cogsAccountId || !inventoryAccountId) {
      if (strict) {
        if (!cogsAccountId) throw new Error(`No COGS account configured for item ${item.code}`);
        throw new Error(`No inventory account configured for item ${item.code}`);
      }
      return null;
    }

    return { cogsAccountId, inventoryAccountId };
  }

  private resolveARAccount(customer: Party, defaultARAccountId: string): string {
    return customer.defaultARAccountId || defaultARAccountId;
  }

  private async resolveSalesTaxAccount(companyId: string, taxCodeId?: string): Promise<string> {
    if (!taxCodeId) {
      throw new Error('taxCodeId is required for sales tax line');
    }

    const taxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
    if (!taxCode) throw new Error(`Tax code not found: ${taxCodeId}`);
    if (!taxCode.salesTaxAccountId) {
      throw new Error(`Tax code ${taxCode.code} has no sales tax account`);
    }

    return taxCode.salesTaxAccountId;
  }

  private resolveControlledUnitCost(
    line: SalesInvoiceLine,
    soLine: SalesOrder['lines'][number] | null,
    postedDNs: DeliveryNote[]
  ): number {
    if (line.dnLineId) {
      for (const dn of postedDNs) {
        const dnLine = dn.lines.find((entry) => entry.lineId === line.dnLineId);
        if (dnLine && dnLine.unitCostBase > 0) {
          return dnLine.unitCostBase;
        }
      }
    }

    if (line.soLineId) {
      const matched = postedDNs
        .flatMap((dn) => dn.lines)
        .filter((dnLine) => dnLine.soLineId === line.soLineId && dnLine.unitCostBase > 0);

      if (matched.length > 0) {
        const weightedCost = matched.reduce((sum, dnLine) => sum + (dnLine.unitCostBase * dnLine.deliveredQty), 0);
        const totalQty = matched.reduce((sum, dnLine) => sum + dnLine.deliveredQty, 0);
        if (totalQty > 0) {
          return weightedCost / totalQty;
        }
      }
    }

    if (soLine) {
      const matchedByItem = postedDNs
        .flatMap((dn) => dn.lines)
        .filter((dnLine) => dnLine.itemId === soLine.itemId && dnLine.unitCostBase > 0);

      if (matchedByItem.length > 0) {
        const weightedCost = matchedByItem.reduce((sum, dnLine) => sum + (dnLine.unitCostBase * dnLine.deliveredQty), 0);
        const totalQty = matchedByItem.reduce((sum, dnLine) => sum + dnLine.deliveredQty, 0);
        if (totalQty > 0) {
          return weightedCost / totalQty;
        }
      }
    }

    return 0;
  }

  private recalcInvoiceTotals(si: SalesInvoice): void {
    si.subtotalDoc = roundMoney(si.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
    si.taxTotalDoc = roundMoney(si.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    si.grandTotalDoc = roundMoney(si.subtotalDoc + si.taxTotalDoc);

    si.subtotalBase = roundMoney(si.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
    si.taxTotalBase = roundMoney(si.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    si.grandTotalBase = roundMoney(si.subtotalBase + si.taxTotalBase);
  }

  private async createRevenueVoucherInTransaction(
    transaction: unknown,
    si: SalesInvoice,
    baseCurrency: string,
    arAccountId: string,
    revenueCredits: VoucherAccumulatedLine[],
    taxCredits: VoucherAccumulatedLine[]
  ): Promise<VoucherEntity> {
    const voucherLines: VoucherLineEntity[] = [];
    const isForeignCurrency = si.currency.toUpperCase() !== baseCurrency.toUpperCase();

    let seq = 1;
    voucherLines.push(
      new VoucherLineEntity(
        seq++,
        arAccountId,
        'Debit',
        roundMoney(si.grandTotalBase),
        baseCurrency,
        isForeignCurrency ? roundMoney(si.grandTotalDoc) : roundMoney(si.grandTotalBase),
        si.currency,
        isForeignCurrency ? si.exchangeRate : 1,
        `AR - ${si.customerName} - ${si.invoiceNumber}`,
        undefined,
        {
          sourceModule: 'sales',
          sourceType: 'SALES_INVOICE',
          sourceId: si.id,
          customerId: si.customerId,
        }
      )
    );

    for (const line of revenueCredits) {
      voucherLines.push(
        new VoucherLineEntity(
          seq++,
          line.accountId,
          'Credit',
          roundMoney(line.baseAmount),
          baseCurrency,
          isForeignCurrency ? roundMoney(line.docAmount) : roundMoney(line.baseAmount),
          si.currency,
          isForeignCurrency ? si.exchangeRate : 1,
          `Revenue - ${si.invoiceNumber}`,
          undefined,
          {
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
          }
        )
      );
    }

    for (const line of taxCredits) {
      voucherLines.push(
        new VoucherLineEntity(
          seq++,
          line.accountId,
          'Credit',
          roundMoney(line.baseAmount),
          baseCurrency,
          isForeignCurrency ? roundMoney(line.docAmount) : roundMoney(line.baseAmount),
          si.currency,
          isForeignCurrency ? si.exchangeRate : 1,
          `Sales tax - ${si.invoiceNumber}`,
          undefined,
          {
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
          }
        )
      );
    }

    const totalDebit = roundMoney(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
    const totalCredit = roundMoney(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
    const now = new Date();

    const voucher = new VoucherEntity(
      randomUUID(),
      si.companyId,
      `SI-${si.invoiceNumber}`,
      VoucherType.JOURNAL_ENTRY,
      si.invoiceDate,
      `Sales Invoice ${si.invoiceNumber} - ${si.customerName}`,
      si.currency,
      baseCurrency,
      isForeignCurrency ? si.exchangeRate : 1,
      voucherLines,
      totalDebit,
      totalCredit,
      VoucherStatus.APPROVED,
      {
        sourceModule: 'sales',
        sourceType: 'SALES_INVOICE',
        sourceId: si.id,
        referenceType: 'SALES_INVOICE',
        referenceId: si.id,
      },
      si.createdBy,
      now,
      si.createdBy,
      now
    );

    const postedVoucher = voucher.post(si.createdBy, now, PostingLockPolicy.FLEXIBLE_LOCKED);
    await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
    await this.voucherRepo.save(postedVoucher, transaction);
    return postedVoucher;
  }

  private async createCOGSVoucherInTransaction(
    transaction: unknown,
    si: SalesInvoice,
    baseCurrency: string,
    lines: AccumulatedCOGS[]
  ): Promise<VoucherEntity> {
    const voucherLines: VoucherLineEntity[] = [];

    let seq = 1;
    for (const line of lines) {
      const amount = roundMoney(line.amountBase);

      voucherLines.push(
        new VoucherLineEntity(
          seq++,
          line.cogsAccountId,
          'Debit',
          amount,
          baseCurrency,
          amount,
          baseCurrency,
          1,
          `COGS - ${si.invoiceNumber}`,
          undefined,
          {
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
          }
        )
      );

      voucherLines.push(
        new VoucherLineEntity(
          seq++,
          line.inventoryAccountId,
          'Credit',
          amount,
          baseCurrency,
          amount,
          baseCurrency,
          1,
          `Inventory reduction - ${si.invoiceNumber}`,
          undefined,
          {
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
          }
        )
      );
    }

    const totalDebit = roundMoney(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
    const totalCredit = roundMoney(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
    const now = new Date();

    const voucher = new VoucherEntity(
      randomUUID(),
      si.companyId,
      `SI-COGS-${si.invoiceNumber}`,
      VoucherType.JOURNAL_ENTRY,
      si.invoiceDate,
      `Sales Invoice ${si.invoiceNumber} COGS`,
      baseCurrency,
      baseCurrency,
      1,
      voucherLines,
      totalDebit,
      totalCredit,
      VoucherStatus.APPROVED,
      {
        sourceModule: 'sales',
        sourceType: 'SALES_INVOICE',
        sourceId: si.id,
        referenceType: 'SALES_INVOICE',
        referenceId: si.id,
      },
      si.createdBy,
      now,
      si.createdBy,
      now
    );

    const postedVoucher = voucher.post(si.createdBy, now, PostingLockPolicy.FLEXIBLE_LOCKED);
    await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
    await this.voucherRepo.save(postedVoucher, transaction);
    return postedVoucher;
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
