import { randomUUID } from 'crypto';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { PostingLockPolicy, VoucherType, VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { DocumentSource, SalesInvoice, SalesInvoiceLine, PaymentStatus } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
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
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IDeliveryNoteRepository } from '../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { IPaymentHistoryRepository } from '../../../repository/interfaces/shared/IPaymentHistoryRepository';
import { PaymentHistory, PaymentMethod } from '../../../domain/shared/entities/PaymentHistory';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IVoucherSequenceRepository } from '../../../repository/interfaces/accounting/IVoucherSequenceRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import {
  ItemQtyToBaseUomResult,
  convertItemQtyToBaseUomDetailed,
} from '../../inventory/services/UomResolutionService';
import { addDaysToISODate, roundMoney } from './SalesPostingHelpers';
import { generateUniqueDocumentNumber } from './SalesOrderUseCases';

export type SalesInvoicePersona = 'direct' | 'linked' | 'service';
export type SettlementMode = 'DEFERRED' | 'CASH_FULL' | 'MULTI';
export const SETTLEMENT_MODES: SettlementMode[] = ['DEFERRED', 'CASH_FULL', 'MULTI'];
export const VALID_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'];
const DOCUMENT_SOURCES: DocumentSource[] = ['native', 'default_form', 'custom_form'];

export interface SettlementRow {
  settlementAccountId: string;
  amountBase: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  paymentDate?: string;
}

export interface SettlementInput {
  settlementMode: SettlementMode;
  receivablePayableAccountId: string;
  settlements: SettlementRow[];
}

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
  formType?: string;
  voucherType?: string;
  persona?: string;
  source?: DocumentSource | string;
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

const SALES_INVOICE_PERSONA_FORM_TYPES: Record<string, SalesInvoicePersona> = {
  sales_invoice: 'direct',
  sales_invoice_direct: 'direct',
  sales_invoice_linked: 'linked',
  sales_invoice_service: 'service',
};

const normalizeSalesInvoiceToken = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

const resolveDocumentSource = (value: unknown): DocumentSource => {
  const source = normalizeSalesInvoiceToken(value);
  return DOCUMENT_SOURCES.includes(source as DocumentSource) ? source as DocumentSource : 'default_form';
};

const hasNativeLinkedSalesSource = (input: CreateSalesInvoiceInput): boolean => {
  if (input.salesOrderId) return true;
  return (input.lines || []).some((line) => !!line.soLineId || !!line.dnLineId);
};

const resolveSalesInvoicePersona = (input: CreateSalesInvoiceInput): SalesInvoicePersona => {
  if (resolveDocumentSource(input.source) === 'native') {
    return hasNativeLinkedSalesSource(input) ? 'linked' : 'direct';
  }

  const persona = normalizeSalesInvoiceToken(input.persona);
  if (persona === 'direct' || persona === 'linked' || persona === 'service') {
    return persona;
  }

  const formType = normalizeSalesInvoiceToken(input.formType || input.voucherType);
  if (SALES_INVOICE_PERSONA_FORM_TYPES[formType]) {
    return SALES_INVOICE_PERSONA_FORM_TYPES[formType];
  }

  if (persona === 'operational' || formType.includes('linked')) return 'linked';
  if (formType.includes('service')) return 'service';

  return 'direct';
};

const resolveSalesInvoiceFormType = (input: CreateSalesInvoiceInput, persona: SalesInvoicePersona): string => {
  const formType = normalizeSalesInvoiceToken(input.formType);
  if (formType) return formType;

  const voucherType = normalizeSalesInvoiceToken(input.voucherType);
  if (SALES_INVOICE_PERSONA_FORM_TYPES[voucherType]) return voucherType;

  return persona === 'direct' ? 'sales_invoice_direct' : `sales_invoice_${persona}`;
};

const resolveSalesInvoiceVoucherType = (input: CreateSalesInvoiceInput): string => {
  const voucherType = normalizeSalesInvoiceToken(input.voucherType || input.formType);
  if (!voucherType) return 'sales_invoice';
  return SALES_INVOICE_PERSONA_FORM_TYPES[voucherType] ? 'sales_invoice' : voucherType;
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

  async execute(input: CreateSalesInvoiceInput, transaction?: unknown): Promise<SalesInvoice> {
    const source = resolveDocumentSource(input.source);
    const persona = resolveSalesInvoicePersona(input);
    input = {
      ...input,
      source,
      formType: resolveSalesInvoiceFormType(input, persona),
      voucherType: resolveSalesInvoiceVoucherType(input),
      persona,
    };

    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Sales module is not initialized');

    if (input.voucherType !== 'sales_invoice') {
      throw new Error(`Invalid voucher type for sales invoice: ${input.voucherType}`);
    }

    const validPersonas = ['direct', 'linked', 'service'] as const;
    if (!validPersonas.includes(input.persona as any)) {
      throw new Error(`Invalid sales invoice persona: ${input.persona}. Must be one of: ${validPersonas.join(', ')}`);
    }

    const isPersonaAllowed = DocumentPolicyResolver.isSalesInvoicePersonaAllowed(
      settings,
      input.persona as 'direct' | 'linked' | 'service'
    );
    if (!isPersonaAllowed) {
      throw new Error(`Sales invoice persona '${input.persona}' is not allowed by company governance policy`);
    }

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

      if (input.persona === 'service' && item.type !== 'SERVICE') {
        throw new Error(`Service invoice cannot include stock item: ${item.name}`);
      }

      if (input.persona === 'linked' && item.trackInventory && !sourceLine.dnLineId) {
        throw new Error(`Linked invoice requires delivery note reference for stock item: ${item.name}`);
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
      formType: input.formType || 'sales_invoice_direct',
      voucherType: input.voucherType || 'sales_invoice',
      persona: input.persona || 'direct',
      source: input.source,
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

    await this.salesInvoiceRepo.create(si, transaction);
    await this.settingsRepo.saveSettings(settings, transaction);
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
    private readonly companyModuleRepo: ICompanyModuleRepository,
    accountingPostingService: SubledgerVoucherPostingService,
    accountRepo: IAccountRepository | undefined,
    private readonly transactionManager: ITransactionManager,
    private readonly paymentHistoryRepo?: IPaymentHistoryRepository,
    private readonly voucherRepo?: IVoucherRepository,
    private readonly voucherSequenceRepo?: IVoucherSequenceRepository,
    private readonly ledgerRepo?: ILedgerRepository
  ) {
    this.accountingPostingService = accountingPostingService;
    this.accountRepo = accountRepo;
  }

  async execute(
    companyId: string, 
    idOrSI: string | SalesInvoice, 
    createAccountingEffect: boolean = true,
    externalTransaction?: any,
    settlementInput?: SettlementInput
  ): Promise<SalesInvoice> {
    // ===================================================================
    // FIRESTORE TRANSACTION RULE: All reads must complete before any writes.
    // We pre-fetch ALL data here. The postingLogic callback only writes.
    // ===================================================================

    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales module not initialized');
    const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(invSettings);

    const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);

    const si = typeof idOrSI === 'string' 
      ? await this.salesInvoiceRepo.getById(companyId, idOrSI)
      : idOrSI;

    if (!si || si.status !== 'DRAFT') throw new Error('Invalid sales invoice state');
    const id = si.id;

    const customer = await this.partyRepo.getById(companyId, si.customerId);
    if (!customer) throw new Error(`Customer not found: ${si.customerId}`);

    let so: SalesOrder | null = null;
    if (si.salesOrderId) {
      so = await this.salesOrderRepo.getById(companyId, si.salesOrderId);
    }

    // PHASE 1A: PRE-FETCH ALL MASTER DATA (bare reads — before transaction)
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

    // PHASE 1B: PRE-FETCH STOCK LEVELS (bare reads before transaction)
    const stockLevelMap = new Map<string, StockLevel>();
    for (const line of si.lines) {
      if (line.trackInventory) {
        const warehouseId = line.warehouseId || settings.defaultWarehouseId;
        if (warehouseId && line.itemId) {
          const key = `${line.itemId}|${warehouseId}`;
          if (!stockLevelMap.has(key)) {
            const existing = await this.inventoryService.preFetchStockLevel(companyId, line.itemId, warehouseId);
            stockLevelMap.set(key, existing ?? StockLevel.createNew(companyId, line.itemId, warehouseId));
          }
        }
      }
    }

    // PHASE 1C: PRE-FETCH UOM CONVERSIONS (bare reads before transaction)
    const uomConversionMap = new Map<string, any>();
    for (const line of si.lines) {
      if (line.trackInventory) {
        const item = itemsMap.get(line.itemId);
        if (item && !uomConversionMap.has(item.id)) {
          const convs = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
          uomConversionMap.set(item.id, convs);
        }
      }
    }

    // PHASE 1C-2: VALIDATE POSTING QUANTITIES (before expensive computation)
    const allowDirect = settings.allowDirectInvoicing ?? false;
    const isSOLinked = !!si.salesOrderId;
    for (const line of si.lines) {
      const item = itemsMap.get(line.itemId);
      const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
      line.trackInventory = item?.trackInventory ?? false;
      this.validatePostingQuantity(line, soLine, allowDirect, settings.overInvoiceTolerancePct ?? 0, isSOLinked);
    }

    // PHASE 1D: COMPUTE INVENTORY MOVEMENTS OUTSIDE TRANSACTION
    // This sets line.trackInventory, line.stockMovementId, line.unitCostBase, line.lineCostBase
    // which are needed for COGS account resolution below.
    const inventoryMovements = new Map<string, { movement: StockMovement; updatedLevel: StockLevel; qtyInBaseUom: number }>();
    for (const line of si.lines) {
      line.trackInventory = itemsMap.get(line.itemId)?.trackInventory ?? false;
      if (!line.trackInventory) continue;

      const item = itemsMap.get(line.itemId);
      if (!item) continue;

      const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
      const matchedDeliveryLines = this.getMatchedDeliveryLines(line, soLine, postedDNs);
      const hasOperationalDelivery = matchedDeliveryLines.length > 0;

      if (!hasOperationalDelivery && settings.allowDirectInvoicing) {
        const warehouseId = line.warehouseId || settings.defaultWarehouseId;
        if (!warehouseId || !warehousesMap.has(warehouseId)) throw new Error(`Warehouse required for ${item.name}`);

        const convs = uomConversionMap.get(item.id) || [];
        const conversionResult = convertItemQtyToBaseUomDetailed({
          qty: line.invoicedQty,
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
        if (!level) continue;

        const qtyBefore = level.qtyOnHand;
        const oldMaxBusinessDate = level.maxBusinessDate;
        let issueCostBase = 0;
        let issueCostCCY = 0;
        let costBasis: 'AVG' | 'LAST_KNOWN' | 'MISSING' = 'MISSING';
        if (qtyBefore > 0) {
          issueCostBase = level.avgCostBase;
          issueCostCCY = level.avgCostCCY;
          costBasis = 'AVG';
        } else if (level.lastCostBase > 0) {
          issueCostBase = level.lastCostBase;
          issueCostCCY = level.lastCostCCY;
          costBasis = 'LAST_KNOWN';
        }

        const settledQty = Math.min(qtyInBaseUom, Math.max(qtyBefore, 0));
        const unsettledQty = qtyInBaseUom - settledQty;
        const effectiveFxCCYToBase = issueCostCCY > 0 ? issueCostBase / issueCostCCY : 1.0;

        const movement = new StockMovement({
          id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          companyId,
          date: si.invoiceDate,
          postingSeq: level.postingSeq + 1,
          createdAt: new Date(),
          createdBy: si.createdBy,
          postedAt: new Date(),
          itemId: item.id,
          warehouseId,
          direction: 'OUT',
          movementType: 'SALES_DELIVERY',
          qty: qtyInBaseUom,
          uom: item.baseUom,
          referenceType: 'SALES_INVOICE',
          referenceId: si.id,
          referenceLineId: line.lineId,
          reversesMovementId: undefined,
          transferPairId: undefined,
          unitCostBase: issueCostBase,
          totalCostBase: roundMoney(issueCostBase * qtyInBaseUom),
          unitCostCCY: issueCostCCY,
          totalCostCCY: roundMoney(issueCostCCY * qtyInBaseUom),
          movementCurrency: item.costCurrency,
          fxRateMovToBase: effectiveFxCCYToBase,
          fxRateCCYToBase: effectiveFxCCYToBase,
          fxRateKind: 'EFFECTIVE',
          avgCostBaseAfter: level.avgCostBase,
          avgCostCCYAfter: level.avgCostCCY,
          qtyBefore,
          qtyAfter: qtyBefore - qtyInBaseUom,
          settledQty,
          unsettledQty,
          unsettledCostBasis: unsettledQty > 0 ? costBasis : undefined,
          negativeQtyAtPosting: (qtyBefore - qtyInBaseUom) < 0,
          costSettled: unsettledQty === 0,
          isBackdated: si.invoiceDate < oldMaxBusinessDate,
          costSource: 'PURCHASE',
          notes: undefined,
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
        });

        const movementQty = qtyInBaseUom;
        level.qtyOnHand -= movementQty;
        level.postingSeq += 1;
        level.version += 1;
        level.totalMovements += 1;
        level.maxBusinessDate = si.invoiceDate > oldMaxBusinessDate ? si.invoiceDate : oldMaxBusinessDate;
        level.updatedAt = new Date();
        level.lastMovementId = movement.id;

        line.stockMovementId = movement.id;
        line.unitCostBase = roundMoney(movement.unitCostBase || 0);
        line.lineCostBase = roundMoney(qtyInBaseUom * line.unitCostBase);

        if (accountingMode === 'PERPETUAL') {
          this.assertPositiveTrackedCost(
            qtyInBaseUom,
            line.unitCostBase,
            line.itemName || item.name,
            `sales invoice ${si.invoiceNumber}`
          );
        }

        inventoryMovements.set(line.lineId, { movement, updatedLevel: level, qtyInBaseUom });
      } else {
        const operationalQty = roundMoney(line.invoicedQty);
        line.unitCostBase = roundMoney(this.resolveControlledUnitCost(line, soLine, postedDNs));
        line.lineCostBase = roundMoney(operationalQty * line.unitCostBase);
        if (accountingMode === 'PERPETUAL') {
          this.assertPositiveTrackedCost(
            operationalQty,
            line.unitCostBase,
            line.itemName || item.name,
            `sales invoice ${si.invoiceNumber}`
          );
        }
      }
    }

    // PHASE 1E: PRE-RESOLVE ALL ACCOUNT IDS (bare reads before transaction)
    // Must come after Phase 1D because COGS resolution needs computed lineCostBase.
    // Also need to compute tax amounts first to know whether to resolve tax accounts.
    for (const line of si.lines) {
      const taxCode = line.taxCodeId ? taxCodesMap.get(line.taxCodeId) : null;
      this.freezeTaxSnapshotSync(line, si.exchangeRate, taxCode || undefined);
    }
    const accountCache = new Map<string, string>();
    const resolveAccountCached = async (idOrCode: string): Promise<string> => {
      if (!idOrCode) return '';
      if (accountCache.has(idOrCode)) return accountCache.get(idOrCode)!;
      const resolved = await this.resolveAccountId(companyId, idOrCode);
      accountCache.set(idOrCode, resolved);
      return resolved;
    };

    const lineResolvedAccounts: Map<string, { revenueId: string; taxId?: string; cogsId?: string; inventoryId?: string }> = new Map();
    for (const line of si.lines) {
      const item = itemsMap.get(line.itemId);
      if (!item) throw new Error(`Item not found: ${line.itemId}`);

      const revenueId = await resolveAccountCached(
        this.resolveRevenueAccountSync(companyId, item, categoriesMap, settings.defaultRevenueAccountId)
      );
      let taxId: string | undefined;
      if (line.taxAmountBase > 0 && line.taxCodeId) {
        const sTaxCode = taxCodesMap.get(line.taxCodeId);
        if (sTaxCode?.salesTaxAccountId) {
          taxId = await resolveAccountCached(sTaxCode.salesTaxAccountId);
        }
      }
      let cogsId: string | undefined;
      let inventoryId: string | undefined;
      if (line.trackInventory && line.lineCostBase > 0) {
        const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
        const matchedDeliveryLines = this.getMatchedDeliveryLines(line, soLine, postedDNs);
        const hasOperationalDelivery = matchedDeliveryLines.length > 0;
        if (DocumentPolicyResolver.shouldInvoiceRecognizeInventory(accountingMode, hasOperationalDelivery)) {
          const accounts = this.resolveCOGSAccountsSync(companyId, item, categoriesMap, invSettings?.defaultCOGSAccountId, invSettings?.defaultInventoryAssetAccountId);
          if (accounts) {
            cogsId = await resolveAccountCached(accounts.cogsAccountId);
            inventoryId = await resolveAccountCached(accounts.inventoryAccountId);
          }
        }
      }
      lineResolvedAccounts.set(line.lineId, { revenueId, taxId, cogsId, inventoryId });
    }

    const arAccountId = this.resolveARAccount(customer, settings);
    const resolvedARId = await resolveAccountCached(arAccountId);
    const postingLogic = async (transaction: any) => {
      // --- Write inventory movements and stock levels ---
      for (const [lineId, { movement, updatedLevel }] of inventoryMovements) {
        await this.inventoryService.writeStockMovement(movement, transaction);
        await this.inventoryService.writeStockLevel(updatedLevel, transaction);
      }

      // --- Accumulate voucher lines using pre-resolved accounts ---
      const revenueCredits = new Map<string, VoucherAccumulatedLine>();
      const taxCredits = new Map<string, VoucherAccumulatedLine>();
      const cogsBucket = new Map<string, AccumulatedCOGS>();

      for (const line of si.lines) {
        const taxCode = line.taxCodeId ? taxCodesMap.get(line.taxCodeId) : null;
        this.freezeTaxSnapshotSync(line, si.exchangeRate, taxCode || undefined);

        const accounts = lineResolvedAccounts.get(line.lineId);
        if (accounts) {
          this.addToBucket(revenueCredits, accounts.revenueId, line.lineTotalBase, line.lineTotalDoc);
          if (line.taxAmountBase > 0 && accounts.taxId) {
            this.addToBucket(taxCredits, accounts.taxId, line.taxAmountBase, line.taxAmountDoc);
          }
          if (accounts.cogsId && accounts.inventoryId) {
            this.addToCOGSBucket(cogsBucket, accounts.cogsId, accounts.inventoryId, line.lineCostBase);
          }
        }
        if (so) {
          const soLine = findSOLine(so, line.soLineId, line.itemId);
          if (soLine) soLine.invoicedQty = roundMoney(soLine.invoicedQty + line.invoicedQty);
        }
      }

      this.recalcInvoiceTotals(si);

      if (shouldPostAccounting) {
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
            baseCurrencyOverride: (baseCurrency || si.currency || 'USD').toUpperCase(),
            skipAccountValidation: true,
          },
          transaction
        );
        si.voucherId = revVoucher.id;

        // Create inventory recognition voucher (COGS vs Inventory)
        if (cogsBucket.size > 0) {
          const cogsVoucherLines: VoucherAccumulatedLine[] = [];
          for (const line of Array.from(cogsBucket.values())) {
            const amount = roundMoney(line.amountBase);
            if (amount <= 0 && accountingMode === 'PERPETUAL') continue;
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

          if (cogsVoucherLines.length > 0) {
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
                baseCurrencyOverride: (baseCurrency || si.currency || 'USD').toUpperCase(),
                skipAccountValidation: true,
              },
              transaction
            );
            si.cogsVoucherId = cogsVoucher.id;
          }
        } else {
          si.cogsVoucherId = null;
        }
      } else {
        si.voucherId = null;
        si.cogsVoucherId = null;
      }

      // --- Process settlements inside the same transaction (atomic) ---
      if (settlementInput && settlementInput.settlementMode !== 'DEFERRED') {
        await this.processSettlementsInTransaction(
          companyId, si, settlementInput, baseCurrency, transaction
        );
      } else {
        // DEFERRED: ensure payment fields reflect unpaid state
        si.paymentStatus = 'UNPAID';
        si.paidAmountBase = 0;
        si.outstandingAmountBase = si.grandTotalBase;
      }

      if (so) {
        so.updatedAt = new Date();
        await this.salesOrderRepo.update(so, transaction);
      }

      si.status = 'POSTED';
      si.postedAt = new Date();
      si.updatedAt = new Date();
      await this.salesInvoiceRepo.update(si, transaction);
    };

    if (externalTransaction) {
      await postingLogic(externalTransaction);
    } else {
      await this.transactionManager.runTransaction(postingLogic);
    }

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

  private async processSettlementsInTransaction(
    companyId: string,
    si: SalesInvoice,
    settlementInput: SettlementInput,
    baseCurrency: string | null,
    transaction: any
  ): Promise<void> {
    const { settlementMode, receivablePayableAccountId, settlements } = settlementInput;
    const now = new Date();

    if (!this.paymentHistoryRepo || !this.voucherRepo || !this.voucherSequenceRepo || !this.ledgerRepo) {
      throw new Error('Payment settlement requires payment history, voucher, sequence, and ledger repositories');
    }

    if (!receivablePayableAccountId?.trim()) {
      throw new Error('receivablePayableAccountId is required for settlement');
    }

    const settlementTotal = settlements.reduce((sum, s) => sum + roundMoney(s.amountBase), 0);

    if (settlementMode === 'CASH_FULL') {
      const outstanding = roundMoney(si.grandTotalBase - (si.paidAmountBase || 0));
      if (Math.abs(settlementTotal - outstanding) > 0.01) {
        throw new Error(`CASH_FULL settlement total (${settlementTotal}) must equal outstanding amount (${outstanding})`);
      }
      if (settlements.length !== 1) {
        throw new Error('CASH_FULL mode requires exactly one settlement row');
      }
    }

    if (settlementMode === 'MULTI') {
      const outstanding = roundMoney(si.grandTotalBase - (si.paidAmountBase || 0));
      if (settlementTotal > outstanding + 0.01) {
        throw new Error(`MULTI settlement total (${settlementTotal}) exceeds outstanding amount (${outstanding})`);
      }
      if (settlements.length === 0) {
        throw new Error('MULTI mode requires at least one settlement row');
      }
      for (const s of settlements) {
        if (!s.settlementAccountId?.trim()) {
          throw new Error('Each settlement row requires a settlementAccountId');
        }
        if (s.amountBase <= 0 || Number.isNaN(s.amountBase)) {
          throw new Error('Each settlement row amount must be positive');
        }
        if (s.paymentMethod && !VALID_PAYMENT_METHODS.includes(s.paymentMethod)) {
          throw new Error(`Invalid paymentMethod: ${s.paymentMethod}`);
        }
      }
    }

    const baseCurrencyUpper = (baseCurrency || si.currency || 'USD').toUpperCase();

    for (const settlement of settlements) {
      const settlementAmountBase = roundMoney(settlement.amountBase);
      const settlementDate = settlement.paymentDate || now.toISOString().split('T')[0];
      const settlementMethod = settlement.paymentMethod || 'CASH';

      const voucherNo = await this.voucherSequenceRepo!.getNextNumber(companyId, 'RV');
      const voucherId = `vch_${randomUUID()}`;

      const docAmount = roundMoney(settlementAmountBase / si.exchangeRate);

      const drLine = new VoucherLineEntity(
        1,
        settlement.settlementAccountId,
        'Debit',
        settlementAmountBase,
        baseCurrencyUpper,
        docAmount,
        si.currency,
        si.exchangeRate,
        `Receipt for ${si.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
      );
      const crLine = new VoucherLineEntity(
        2,
        receivablePayableAccountId,
        'Credit',
        settlementAmountBase,
        baseCurrencyUpper,
        docAmount,
        si.currency,
        si.exchangeRate,
        `Receipt for ${si.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
      );

      const totalDebit = roundMoney(drLine.debitAmount);
      const totalCredit = roundMoney(crLine.creditAmount);

      const approvedVoucher = new VoucherEntity(
        voucherId,
        companyId,
        voucherNo,
        VoucherType.RECEIPT,
        settlementDate,
        `Receipt for Sales Invoice ${si.invoiceNumber}`,
        si.currency.toUpperCase(),
        baseCurrencyUpper,
        si.exchangeRate,
        [drLine, crLine],
        totalDebit,
        totalCredit,
        VoucherStatus.APPROVED,
        { sourceModule: 'sales', sourceInvoiceId: si.id, settlementMode },
        si.createdBy,
        now,
        si.createdBy,
        now,
        undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined,
        settlement.reference || null
      );

      const postedVoucher = approvedVoucher.post(si.createdBy, now, PostingLockPolicy.FLEXIBLE_LOCKED);

      await this.ledgerRepo!.recordForVoucher(postedVoucher, transaction);
      await this.voucherRepo!.save(postedVoucher, transaction);

      const paymentId = `pay_${randomUUID()}`;
      const payment = new PaymentHistory({
        id: paymentId,
        companyId,
        sourceType: 'SALES_INVOICE',
        sourceId: si.id,
        sourceNumber: si.invoiceNumber,
        amountBase: settlementAmountBase,
        currency: si.currency,
        exchangeRate: si.exchangeRate,
        amountDoc: docAmount,
        paymentDate: settlementDate,
        paymentMethod: settlementMethod,
        reference: settlement.reference || undefined,
        notes: settlement.notes || undefined,
        voucherId,
        createdBy: si.createdBy,
        createdAt: now,
      });

      await this.paymentHistoryRepo!.create(payment, transaction);

      si.paidAmountBase = roundMoney((si.paidAmountBase || 0) + settlementAmountBase);
      si.outstandingAmountBase = roundMoney(Math.max(si.grandTotalBase - si.paidAmountBase, 0));

      if (si.outstandingAmountBase <= 0) {
        si.paymentStatus = 'PAID';
      } else if (si.paidAmountBase > 0) {
        si.paymentStatus = 'PARTIALLY_PAID';
      } else {
        si.paymentStatus = 'UNPAID';
      }
    }
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

  private async isAccountingEnabled(companyId: string): Promise<boolean> {
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return !!accountingModule?.initialized;
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
      throw new Error(`Missing positive inventory cost for ${itemName} on ${documentLabel}. Perpetual accounting requires immediate cost recognition.`);
    }
  }

}
export class CreateAndPostSalesInvoiceUseCase {
  constructor(
    private readonly createUseCase: CreateSalesInvoiceUseCase,
    private readonly postUseCase: PostSalesInvoiceUseCase
  ) {}

  async execute(input: CreateSalesInvoiceInput, settlementInput?: SettlementInput): Promise<SalesInvoice> {
    const si = await this.createUseCase.execute(input);
    return this.postUseCase.execute(input.companyId, si.id, true, undefined, settlementInput);
  }
}

export class UpdateAndPostSalesInvoiceUseCase {
  constructor(
    private readonly updateUseCase: UpdateSalesInvoiceUseCase,
    private readonly postUseCase: PostSalesInvoiceUseCase
  ) {}

  async execute(input: UpdateSalesInvoiceInput, settlementInput?: SettlementInput): Promise<SalesInvoice> {
    const si = await this.updateUseCase.execute(input);
    return this.postUseCase.execute(input.companyId, si.id, true, undefined, settlementInput);
  }
}

export class UpdateSalesInvoiceUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(input: UpdateSalesInvoiceInput, transaction?: unknown): Promise<SalesInvoice> {
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
    await this.salesInvoiceRepo.update(updated, transaction);
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
