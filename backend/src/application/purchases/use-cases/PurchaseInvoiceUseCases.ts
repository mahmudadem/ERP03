import { randomUUID } from 'crypto';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { PostingLockPolicy, VoucherType, VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import {
  DocumentSource,
  PaymentStatus,
  PendingSettlement,
  PurchaseInvoice,
  PurchaseInvoiceCharge,
  PurchaseInvoiceLine,
} from '../../../domain/purchases/entities/PurchaseInvoice';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { PaymentHistory, PaymentMethod } from '../../../domain/shared/entities/PaymentHistory';
import { IInventoryCore } from '../../inventory/contracts/InventoryIntegrationContracts';
import { IAccountRepository, ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting';
import { IExchangeRateRepository } from '../../../repository/interfaces/accounting/IExchangeRateRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { RecordSalesProfitLineFactsUseCase, PostedLineForProfitFact } from '../../reporting/use-cases/RecordSalesProfitLineFactsUseCase';
import { IPaymentHistoryRepository } from '../../../repository/interfaces/shared/IPaymentHistoryRepository';
import {
  IPartyItemPriceRepository,
  PartyItemPriceUpsertInput,
} from '../../../repository/interfaces/shared/IPartyItemPriceRepository';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IVoucherSequenceRepository } from '../../../repository/interfaces/accounting/IVoucherSequenceRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { PostingGateway } from '../../accounting/services/PostingGateway';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { AccountingEngineUnavailableError } from '../../../domain/accounting/errors/AccountingEngineUnavailableError';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import {
  ItemQtyToBaseUomResult,
  convertItemQtyToBaseUomDetailed,
} from '../../inventory/services/UomResolutionService';
import {
  buildAverageCostPoint,
  buildDocumentPricePoint,
  buildPurchaseCostPoint,
  buildUpdatedItemCostingStats,
} from '../../inventory/services/ItemCostingStatsService';
import { roundByCurrency } from '../../../domain/accounting/entities/CurrencyPrecisionHelpers';
import { addDaysToISODate, roundMoney, updatePOStatus } from './PurchasePostingHelpers';
import { generateDocumentNumberWithEngine } from './PurchaseOrderUseCases';
import { INumberingEngine } from '../../system-core/contracts/INumberingEngine';
import { PostingError } from '../../../domain/shared/errors/AppError';
import { AccountMappingError } from '../../../domain/accounting/errors/AccountMappingError';
import {
  assertPostedNonFinancialEditOnly,
  scalarChanged,
  lineSignaturesEqual,
} from '../../common/services/PostedDocumentEditGuard';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';
import { recordAuditCreate, recordAuditPeriodLockOverride, recordAuditPost, recordAuditUpdate } from '../../system-core/audit/auditEngineLegacyHelpers';
import { calculateCommercialLineAmounts } from '../../system-core/commercial/CommercialCore';
import {
  SubledgerDocumentPoster,
  SubledgerPostingEntry,
} from '../../accounting/services/SubledgerDocumentPoster';

export type PurchaseInvoicePersona = 'direct' | 'linked' | 'service';
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

const PURCHASE_INVOICE_PERSONA_FORM_TYPES: Record<string, PurchaseInvoicePersona> = {
  purchase_invoice: 'direct',
  purchase_invoice_direct: 'direct',
  purchase_invoice_linked: 'linked',
  purchase_invoice_service: 'service',
};

const normalizePurchaseInvoiceToken = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

const resolveDocumentSource = (value: unknown): DocumentSource => {
  const source = normalizePurchaseInvoiceToken(value);
  return DOCUMENT_SOURCES.includes(source as DocumentSource) ? source as DocumentSource : 'default_form';
};

const hasNativeLinkedPurchaseSource = (input: CreatePurchaseInvoiceInput): boolean => {
  if (input.purchaseOrderId) return true;
  return (input.lines || []).some((line) => !!line.poLineId || !!line.grnLineId);
};

const resolvePurchaseInvoicePersona = (input: CreatePurchaseInvoiceInput): PurchaseInvoicePersona => {
  if (resolveDocumentSource(input.source) === 'native') {
    return hasNativeLinkedPurchaseSource(input) ? 'linked' : 'direct';
  }

  const persona = normalizePurchaseInvoiceToken(input.persona);
  if (persona === 'direct' || persona === 'linked' || persona === 'service') {
    return persona;
  }

  const formType = normalizePurchaseInvoiceToken(input.formType || input.voucherType);
  if (PURCHASE_INVOICE_PERSONA_FORM_TYPES[formType]) {
    return PURCHASE_INVOICE_PERSONA_FORM_TYPES[formType];
  }

  if (persona === 'operational' || formType.includes('linked')) return 'linked';
  if (formType.includes('service')) return 'service';

  return 'direct';
};

const resolvePurchaseInvoiceFormType = (input: CreatePurchaseInvoiceInput, persona: PurchaseInvoicePersona): string => {
  const formType = normalizePurchaseInvoiceToken(input.formType);
  if (formType) return formType;

  const voucherType = normalizePurchaseInvoiceToken(input.voucherType);
  if (PURCHASE_INVOICE_PERSONA_FORM_TYPES[voucherType]) return voucherType;

  return persona === 'direct' ? 'purchase_invoice_direct' : `purchase_invoice_${persona}`;
};

const resolvePurchaseInvoiceVoucherType = (input: CreatePurchaseInvoiceInput): string => {
  const voucherType = normalizePurchaseInvoiceToken(input.voucherType || input.formType);
  if (!voucherType) return 'purchase_invoice';
  return PURCHASE_INVOICE_PERSONA_FORM_TYPES[voucherType] ? 'purchase_invoice' : voucherType;
};

export interface PurchaseInvoiceLineInput {
  lineId?: string;
  lineNo?: number;
  poLineId?: string;
  grnLineId?: string;
  itemId?: string;
  invoicedQty: number;
  uomId?: string;
  uom?: string;
  unitPriceDoc?: number;
  /** Optional line discount mirroring sales. PERCENT applies to grossLineTotal,
   *  AMOUNT is a flat discount in document currency. */
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  discountAmountDoc?: number;
  /** When true, `unitPriceDoc` already includes tax. Entity splits gross into
   *  net + tax during construction so totals match the user's input. */
  priceIsInclusive?: boolean;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface PurchaseInvoiceChargeInput {
  chargeId?: string;
  /** CHARGE adds to the bill and debits its account; DISCOUNT subtracts and credits its account. Defaults to CHARGE. */
  kind?: 'CHARGE' | 'DISCOUNT';
  code?: string;
  name: string;
  amountDoc: number;
  accountId?: string;
  description?: string;
}

export interface CreatePurchaseInvoiceInput {
  companyId: string;
  formType?: string;
  voucherType?: string;
  persona?: string;
  source?: DocumentSource | string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorInvoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseInvoiceLineInput[];
  charges?: PurchaseInvoiceChargeInput[];
  notes?: string;
  createdBy: string;
}

export interface UpdatePurchaseInvoiceInput {
  companyId: string;
  id: string;
  vendorId?: string;
  vendorInvoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseInvoiceLineInput[];
  charges?: PurchaseInvoiceChargeInput[];
  notes?: string;
}

export interface ListPurchaseInvoicesFilters {
  vendorId?: string;
  purchaseOrderId?: string;
  status?: 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'CANCELLED';
  paymentStatus?: PaymentStatus;
  limit?: number;
}

const findPOLine = (po: PurchaseOrder, poLineId?: string, itemId?: string) => {
  if (poLineId) {
    return po.lines.find((line) => line.lineId === poLineId) || null;
  }
  if (itemId) {
    return po.lines.find((line) => line.itemId === itemId) || null;
  }
  return null;
};

const hasGRNForThisLine = (line: PurchaseInvoiceLine): boolean =>
  !!line.grnLineId;

// True when this PI line's goods have already been received into stock by a posted
// Goods Receipt — either because the line carries an explicit grnLineId, or because
// it is backed by a PO line that a GRN has already received against (poLine.receivedQty > 0).
// In a PO→GRN→PI flow the GRN is the stock-movement document, so the PI must NOT re-receive.
// This guards the common case where a PI is built from the PO (poLineId only, no grnLineId):
// without it the posting double-receives the goods (and, in PERPETUAL mode, double-debits
// inventory instead of clearing GRNI). Direct invoicing (no PO / unreceived PO line) is
// unaffected — there the PI legitimately receives the stock.
const goodsAlreadyReceived = (line: PurchaseInvoiceLine, po: PurchaseOrder | null): boolean => {
  if (hasGRNForThisLine(line)) return true;
  if (!po) return false;
  const poLine = findPOLine(po, line.poLineId, line.itemId);
  return !!poLine && (poLine.receivedQty || 0) > 0;
};

const assertValidPurchaseTaxCode = (taxCode: TaxCode, taxCodeId: string): void => {
  if (!taxCode.active || (taxCode.scope !== 'PURCHASE' && taxCode.scope !== 'BOTH')) {
    throw new Error(`Tax code is not valid for purchase: ${taxCodeId}`);
  }
};

export class CreatePurchaseInvoiceUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly numberingEngine?: INumberingEngine
  ) {}

  async execute(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoice> {
    const source = resolveDocumentSource(input.source);
    const persona = resolvePurchaseInvoicePersona(input);
    input = {
      ...input,
      source,
      formType: resolvePurchaseInvoiceFormType(input, persona),
      voucherType: resolvePurchaseInvoiceVoucherType(input),
      persona,
    };

    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Purchases module is not initialized');

    if (!DocumentPolicyResolver.isPurchaseInvoicePersonaAllowed(settings, input.persona as 'direct' | 'linked' | 'service', { formType: input.formType })) {
      throw new Error(`Purchase invoice persona '${input.persona}' is not allowed by company governance policy`);
    }

    let po: PurchaseOrder | null = null;
    if (input.purchaseOrderId) {
      po = await this.purchaseOrderRepo.getById(input.companyId, input.purchaseOrderId);
      if (!po) throw new Error(`Purchase order not found: ${input.purchaseOrderId}`);
      if (po.status === 'CANCELLED') throw new Error('Cannot invoice a cancelled purchase order');
    }

    const vendorId = po?.vendorId || input.vendorId;
    const vendor = await this.partyRepo.getById(input.companyId, vendorId);
    if (!vendor) throw new Error(`Vendor not found: ${vendorId}`);
    if (!vendor.roles.includes('VENDOR')) throw new Error(`Party is not a vendor: ${vendorId}`);

    const currency = (input.currency || po?.currency || vendor.defaultCurrency || 'USD').toUpperCase();
    const exchangeRate = input.exchangeRate ?? po?.exchangeRate ?? 1;

    const currencyEnabled = await this.companyCurrencyRepo.isEnabled(input.companyId, currency);
    if (!currencyEnabled) {
      throw new Error(`Currency is not enabled for company: ${currency}`);
    }

    const sourceLines = this.resolveSourceLines(input.lines, po, settings.allowDirectInvoicing);
    if (!sourceLines.length) {
      throw new Error('Purchase invoice must contain at least one line');
    }

    const lines: PurchaseInvoiceLine[] = [];
    for (let i = 0; i < sourceLines.length; i += 1) {
      const sourceLine = sourceLines[i];
      const poLine = po ? findPOLine(po, sourceLine.poLineId, sourceLine.itemId) : null;
      const itemId = sourceLine.itemId || poLine?.itemId;
      if (!itemId) throw new Error(`Line ${i + 1}: itemId is required`);

      const item = await this.itemRepo.getItem(itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${itemId}`);
      }

      const invoicedQty = sourceLine.invoicedQty;
      const unitPriceDoc = sourceLine.unitPriceDoc ?? poLine?.unitPriceDoc ?? 0;
      const taxCodeId = await this.resolveTaxCodeId(input.companyId, sourceLine.taxCodeId, item);
      let taxRate = 0;
      let taxCodeDefaultInclusive = false;
      if (taxCodeId) {
        const taxCode = await this.taxCodeRepo.getById(input.companyId, taxCodeId);
        if (!taxCode) throw new Error(`Tax code not found: ${taxCodeId}`);
        assertValidPurchaseTaxCode(taxCode, taxCodeId);
        taxRate = taxCode.rate;
        taxCodeDefaultInclusive = taxCode.priceIsInclusive === true;
      }
      // Effective inclusive: explicit line flag wins; otherwise inherit the tax
      // code's default. Without this fallback a form that doesn't set the flag
      // (e.g. legacy PI clients) silently posts exclusive math even when the
      // tax code is configured as inclusive.
      const effectiveInclusive =
        sourceLine.priceIsInclusive !== undefined
          ? sourceLine.priceIsInclusive === true
          : taxCodeDefaultInclusive;
      const lineAmounts = calculateCommercialLineAmounts({
        quantity: invoicedQty,
        unitPriceDoc,
        exchangeRate,
        taxRate,
        priceIsInclusive: effectiveInclusive,
        discountType: sourceLine.discountType,
        discountValue: sourceLine.discountValue,
        discountAmountDoc: sourceLine.discountAmountDoc,
      });

      // Pre-totals here are illustrative; the PurchaseInvoice constructor
      // recomputes via normalizeLine, which is the source of truth for the
      // inclusive/exclusive tax split. We forward `priceIsInclusive` so the
      // entity sees it.
      lines.push({
        lineId: sourceLine.lineId || randomUUID(),
        lineNo: sourceLine.lineNo ?? i + 1,
        poLineId: sourceLine.poLineId || poLine?.lineId,
        grnLineId: sourceLine.grnLineId,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        trackInventory: item.trackInventory,
        invoicedQty,
        uomId: sourceLine.uomId || poLine?.uomId || item.purchaseUomId || item.baseUomId,
        uom: sourceLine.uom || poLine?.uom || item.purchaseUom || item.baseUom,
        unitPriceDoc,
        // Discount fields forwarded to the entity; the entity recomputes
        // discountAmountDoc/grossLineTotalDoc/lineTotalDoc/tax* from these.
        discountType: sourceLine.discountType,
        discountValue: sourceLine.discountValue,
        grossLineTotalDoc: lineAmounts.grossLineTotalDoc,
        discountAmountDoc: lineAmounts.discountAmountDoc,
        lineTotalDoc: lineAmounts.lineTotalDoc,
        unitPriceBase: lineAmounts.unitPriceBase,
        grossLineTotalBase: lineAmounts.grossLineTotalBase,
        discountAmountBase: lineAmounts.discountAmountBase,
        lineTotalBase: lineAmounts.lineTotalBase,
        taxCodeId,
        taxCode: undefined,
        taxRate,
        priceIsInclusive: effectiveInclusive,
        taxAmountDoc: lineAmounts.taxAmountDoc,
        taxAmountBase: lineAmounts.taxAmountBase,
        warehouseId: sourceLine.warehouseId || poLine?.warehouseId || settings.defaultWarehouseId,
        accountId: '',
        stockMovementId: null,
        description: sourceLine.description || poLine?.description,
      });
    }

    // Whole-invoice charges/discounts (allocation grid). Charges default to the purchase
    // expense account; discounts default to the same account (credited — net method) and can
    // be overridden per row. The entity recomputes amounts and applies the kind sign to totals.
    const charges: PurchaseInvoiceCharge[] = (input.charges || []).map((sourceCharge) => {
      const chargeKind: 'CHARGE' | 'DISCOUNT' = sourceCharge.kind === 'DISCOUNT' ? 'DISCOUNT' : 'CHARGE';
      return {
        chargeId: sourceCharge.chargeId || randomUUID(),
        kind: chargeKind,
        code: sourceCharge.code,
        name: sourceCharge.name,
        amountDoc: roundMoney(sourceCharge.amountDoc),
        amountBase: roundMoney(sourceCharge.amountDoc * exchangeRate),
        accountId: sourceCharge.accountId || settings.defaultPurchaseExpenseAccountId,
        description: sourceCharge.description,
      };
    });

    const paymentTermsDays = vendor.paymentTermsDays ?? settings.defaultPaymentTermsDays;
    const dueDate = input.dueDate || addDaysToISODate(input.invoiceDate, paymentTermsDays);
    const now = new Date();
    const invoiceNumber = await generateDocumentNumberWithEngine(settings, 'PI', input.companyId, this.numberingEngine);

    const invoice = new PurchaseInvoice({
      id: randomUUID(),
      companyId: input.companyId,
      invoiceNumber,
      vendorInvoiceNumber: input.vendorInvoiceNumber,
      formType: input.formType || 'purchase_invoice_direct',
      voucherType: input.voucherType || 'purchase_invoice',
      persona: input.persona || 'direct',
      source: input.source,
      purchaseOrderId: po?.id,
      vendorId: vendor.id,
      vendorName: vendor.displayName,
      invoiceDate: input.invoiceDate,
      dueDate,
      currency,
      exchangeRate,
      lines,
      charges,
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
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    invoice.outstandingAmountBase = invoice.grandTotalBase;

    await this.purchaseInvoiceRepo.create(invoice);
    await this.settingsRepo.saveSettings(settings);
    return invoice;
  }

  private resolveSourceLines(
    lines: PurchaseInvoiceLineInput[] | undefined,
    po: PurchaseOrder | null,
    allowDirectInvoicing: boolean
  ): PurchaseInvoiceLineInput[] {
    if (Array.isArray(lines) && lines.length > 0) {
      return lines;
    }

    if (!po) return [];

    return po.lines
      .map((line) => {
        let ceiling = 0;
        if (!allowDirectInvoicing && line.trackInventory) {
          ceiling = line.receivedQty - line.invoicedQty;
        } else if (!allowDirectInvoicing && !line.trackInventory) {
          ceiling = line.orderedQty - line.invoicedQty;
        } else {
          ceiling = line.orderedQty - line.invoicedQty;
        }

        return {
          poLineId: line.lineId,
          itemId: line.itemId,
          invoicedQty: roundMoney(Math.max(ceiling, 0)),
          uomId: line.uomId,
          uom: line.uom,
          unitPriceDoc: line.unitPriceDoc,
          taxCodeId: line.taxCodeId,
          warehouseId: line.warehouseId,
          description: line.description,
        } as PurchaseInvoiceLineInput;
      })
      .filter((line) => line.invoicedQty > 0);
  }

  private async resolveTaxCodeId(companyId: string, requestedTaxCodeId: string | undefined, item: Item): Promise<string | undefined> {
    if (requestedTaxCodeId) {
      return requestedTaxCodeId;
    }

    if (!item.defaultPurchaseTaxCodeId) return undefined;
    const defaultTax = await this.taxCodeRepo.getById(companyId, item.defaultPurchaseTaxCodeId);
    if (!defaultTax) return undefined;
    if (!defaultTax.active || (defaultTax.scope !== 'PURCHASE' && defaultTax.scope !== 'BOTH')) {
      return undefined;
    }
    return defaultTax.id;
  }
}

export class PostPurchaseInvoiceUseCase {
  private readonly accountRepo?: IAccountRepository;

  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly itemRepo: IItemRepository,
    private readonly itemCategoryRepo: IItemCategoryRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly exchangeRateRepo: IExchangeRateRepository,
    private readonly inventoryService: IInventoryCore,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    accountRepo: IAccountRepository | undefined,
    private readonly transactionManager: ITransactionManager,
    private readonly paymentHistoryRepo?: IPaymentHistoryRepository,
    private readonly voucherRepo?: IVoucherRepository,
    private readonly voucherSequenceRepo?: IVoucherSequenceRepository,
    private readonly ledgerRepo?: ILedgerRepository,
    private readonly partyItemPriceRepo?: IPartyItemPriceRepository,
    private readonly profitFactRecorder?: RecordSalesProfitLineFactsUseCase,
    private readonly numberingEngine?: INumberingEngine
  ) {
    this.accountRepo = accountRepo;
  }

  async execute(
    companyId: string,
    id: string,
    createAccountingEffect: boolean = true,
    settlementInput?: SettlementInput,
    approvalContext?: { approvedBy: string }
  ): Promise<PurchaseInvoice> {
    // ===================================================================
    // FIRESTORE TRANSACTION RULE: All reads must complete before any writes.
    // We pre-fetch ALL data here. The transaction callback only writes.
    // ===================================================================

    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Purchases module is not initialized');
    const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(invSettings);
    const shouldPostAccounting = createAccountingEffect;
    if (shouldPostAccounting && !(await this.isAccountingEngineReady(companyId))) {
      throw new AccountingEngineUnavailableError({
        companyId,
        reason: 'NOT_INITIALIZED',
        cause:
          'Purchase Invoice posting requires the Accounting Engine to be initialized. ' +
          'Initialize Purchases (which auto-initializes the Engine) or call InitializeAccountingUseCase first.',
      });
    }

    const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!pi) throw new Error(`Purchase invoice not found: ${id}`);

    if (approvalContext && pi.status === 'PENDING_APPROVAL') {
      pi.status = 'DRAFT';
    }
    if (pi.status !== 'DRAFT') throw new Error('Only DRAFT purchase invoices can be posted');

    const vendor = await this.partyRepo.getById(companyId, pi.vendorId);
    if (!vendor) throw new Error(`Vendor not found: ${pi.vendorId}`);

    const isPOLinked = !!pi.purchaseOrderId;
    let po: PurchaseOrder | null = null;
    if (isPOLinked) {
      po = await this.purchaseOrderRepo.getById(companyId, pi.purchaseOrderId as string);
    }

    const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || pi.currency;

    // PHASE 1A: PRE-FETCH ALL MASTER DATA (bare reads — before transaction)
    const distinctItemIds = [...new Set(pi.lines.map(l => l.itemId))];
    const distinctTaxCodeIds = [...new Set(pi.lines.filter(l => l.taxCodeId).map(l => l.taxCodeId as string))];
    const distinctWarehouseIds = [...new Set(pi.lines.filter(l => l.warehouseId).map(l => l.warehouseId as string))];
    if (settings.defaultWarehouseId) distinctWarehouseIds.push(settings.defaultWarehouseId);

    const [itemsMap, categoriesMap, taxCodesMap, warehousesMap] = await Promise.all([
      Promise.all(distinctItemIds.map(id => this.itemRepo.getItem(id))).then(results =>
        new Map(results.filter((i): i is Item => !!i && i.companyId === companyId).map(i => [i.id, i]))
      ),
      this.itemCategoryRepo.getCompanyCategories(companyId).then(results =>
        new Map(results.map(c => [c.id, c]))
      ),
      Promise.all(distinctTaxCodeIds.map(id => this.taxCodeRepo.getById(companyId, id))).then(results =>
        new Map(results.filter(t => !!t).map(t => [t!.id, t!]))
      ),
      Promise.all(distinctWarehouseIds.map(id => this.warehouseRepo.getWarehouse(id))).then(results =>
        new Map(results.filter(w => !!w && w.companyId === companyId).map(w => [w.id, w!]))
      )
    ]);

    // PHASE 1B: PRE-FETCH STOCK LEVELS (bare reads before transaction)
    const stockLevelMap = new Map<string, StockLevel>();
    const levelsByItemMap = new Map<string, StockLevel[]>();
    for (const itemId of distinctItemIds) {
      const existingLevels = await this.inventoryService.preFetchLevelsByItem(companyId, itemId);
      levelsByItemMap.set(itemId, existingLevels.map((level) => StockLevel.fromJSON(level.toJSON())));
    }
    for (const line of pi.lines) {
      if (settings.allowDirectInvoicing && line.trackInventory && !goodsAlreadyReceived(line, po)) {
        const warehouseId = line.warehouseId || settings.defaultWarehouseId;
        if (warehouseId && line.itemId) {
          const key = `${line.itemId}|${warehouseId}`;
          if (!stockLevelMap.has(key)) {
            const levels = levelsByItemMap.get(line.itemId) || [];
            let existing = levels.find((level) => level.warehouseId === warehouseId);
            if (!existing) {
              existing = StockLevel.createNew(companyId, line.itemId, warehouseId);
              levels.push(existing);
            }
            stockLevelMap.set(key, existing ?? StockLevel.createNew(companyId, line.itemId, warehouseId));
          }
        }
      }
    }

    // PHASE 1C: PRE-FETCH UOM CONVERSIONS (bare reads before transaction)
    const uomConversionMap = new Map<string, any>();
    for (const line of pi.lines) {
      if (settings.allowDirectInvoicing && line.trackInventory && !goodsAlreadyReceived(line, po)) {
        const item = itemsMap.get(line.itemId);
        if (item && !uomConversionMap.has(item.id)) {
          const convs = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
          uomConversionMap.set(item.id, convs);
        }
      }
    }

    // PHASE 1D: COMPUTE INVENTORY MOVEMENTS OUTSIDE TRANSACTION
    const inventoryMovements = new Map<string, { movement: StockMovement; updatedLevel: StockLevel; qtyInBaseUom: number }>();
    const itemCostingStatsUpdates = new Map<string, { costingStats: Item['costingStats']; updatedAt: Date }>();
    const partyItemPriceUpdates: PartyItemPriceUpsertInput[] = [];
    for (const line of pi.lines) {
      line.trackInventory = itemsMap.get(line.itemId)?.trackInventory ?? false;
      const itemForMemory = itemsMap.get(line.itemId);
      const purchasePricePoint = itemForMemory
        ? buildDocumentPricePoint({
          unitPriceDoc: line.unitPriceDoc,
          currency: pi.currency,
          exchangeRate: pi.exchangeRate,
          baseCurrency,
          asOf: pi.invoiceDate,
          refType: 'PURCHASE_INVOICE',
          refId: pi.id,
          qty: line.invoicedQty,
          uomId: line.uomId || itemForMemory.purchaseUomId || itemForMemory.baseUomId || line.uom || itemForMemory.baseUom,
          docType: 'PURCHASE_INVOICE',
          docId: pi.id,
          docNo: pi.invoiceNumber,
          lineId: line.lineId,
        })
        : null;
      if (purchasePricePoint && itemForMemory) {
        partyItemPriceUpdates.push({
          companyId,
          partyId: pi.vendorId,
          itemId: itemForMemory.id,
          direction: 'PURCHASE',
          pricePoint: purchasePricePoint,
        });
      }

      const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
      this.validatePostingQuantity(line, poLine, settings.allowDirectInvoicing, settings.overInvoiceTolerancePct, isPOLinked);

      const taxCode = line.taxCodeId ? taxCodesMap.get(line.taxCodeId) : null;
      this.freezeTaxSnapshotSync(line, pi.exchangeRate, taxCode || undefined);

      const hasReceiptBackedFlow = line.trackInventory && (!settings.allowDirectInvoicing || goodsAlreadyReceived(line, po));
      const clearsGRNI = DocumentPolicyResolver.shouldPurchaseInvoiceClearGRNI(
        accountingMode,
        hasReceiptBackedFlow
      );

      line.accountId = this.resolveDebitAccountSync(
        companyId,
        itemsMap.get(line.itemId)!,
        accountingMode,
        clearsGRNI,
        categoriesMap,
        settings.defaultPurchaseExpenseAccountId,
        invSettings?.defaultInventoryAssetAccountId,
        settings.defaultGRNIAccountId
      );

      if (settings.allowDirectInvoicing && line.trackInventory && !goodsAlreadyReceived(line, po)) {
        const warehouseId = line.warehouseId || settings.defaultWarehouseId;
        const warehouse = warehouseId ? warehousesMap.get(warehouseId) : null;
        if (!warehouse) throw new Error(`Warehouse required for ${line.itemName}`);

        const item = itemsMap.get(line.itemId)!;
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

        const fxRateCCYToBase = await this.resolveCCYToBaseRate(companyId, item.costCurrency, baseCurrency, pi.currency, pi.exchangeRate, pi.invoiceDate);

        const stockLevelKey = `${item.id}|${warehouseId}`;
        const level = stockLevelMap.get(stockLevelKey);
        if (!level) throw new Error(`Stock level not found for ${item.name} in warehouse ${warehouseId}`);

        const qtyBefore = level.qtyOnHand;
        const oldMaxBusinessDate = level.maxBusinessDate;
        let receiptCostBase = 0;
        let receiptCostCCY = 0;
        let costBasis: 'AVG' | 'LAST_KNOWN' | 'MISSING' = 'MISSING';
        if (qtyBefore > 0) {
          receiptCostBase = level.avgCostBase;
          receiptCostCCY = level.avgCostCCY;
          costBasis = 'AVG';
        } else if (level.lastCostBase > 0) {
          receiptCostBase = level.lastCostBase;
          receiptCostCCY = level.lastCostCCY;
          costBasis = 'LAST_KNOWN';
        }

        const movementId = `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const settlesNegativeQty = Math.min(qtyInBaseUom, Math.max(-qtyBefore, 0));
        const newPositiveQty = qtyInBaseUom - settlesNegativeQty;
        const qtyAfter = qtyBefore + qtyInBaseUom;
        const netUnitCostBase = qtyInBaseUom > 0
          ? roundMoney(line.lineTotalBase / qtyInBaseUom)
          : 0;
        const netUnitCostCCY = qtyInBaseUom > 0
          ? roundByCurrency(netUnitCostBase / fxRateCCYToBase, item.costCurrency)
          : 0;
        const netTotalCostCCY = roundByCurrency(netUnitCostCCY * qtyInBaseUom, item.costCurrency);
        const nextAvgCostBase = roundMoney(
          (level.avgCostBase * Math.max(qtyBefore, 0) + netUnitCostBase * newPositiveQty) / Math.max(qtyAfter, 1)
        );
        const nextAvgCostCCY = roundMoney(
          (level.avgCostCCY * Math.max(qtyBefore, 0) + netUnitCostCCY * newPositiveQty) / Math.max(qtyAfter, 1)
        );
        const movement = new StockMovement({
          id: movementId,
          companyId,
          date: pi.invoiceDate,
          postingSeq: level.postingSeq + 1,
          createdAt: new Date(),
          createdBy: pi.createdBy,
          postedAt: new Date(),
          itemId: item.id,
          warehouseId,
          direction: 'IN',
          movementType: 'PURCHASE_RECEIPT',
          qty: qtyInBaseUom,
          uom: item.baseUom,
          referenceType: 'PURCHASE_INVOICE',
          referenceId: pi.id,
          referenceLineId: line.lineId,
          reversesMovementId: undefined,
          transferPairId: undefined,
          unitCostBase: netUnitCostBase,
          totalCostBase: line.lineTotalBase,
          unitCostCCY: netUnitCostCCY,
          totalCostCCY: netTotalCostCCY,
          movementCurrency: pi.currency,
          fxRateMovToBase: pi.exchangeRate,
          fxRateCCYToBase,
          fxRateKind: 'EFFECTIVE',
          avgCostBaseAfter: nextAvgCostBase,
          avgCostCCYAfter: nextAvgCostCCY,
          qtyBefore,
          qtyAfter,
          settlesNegativeQty,
          newPositiveQty,
          negativeQtyAtPosting: qtyAfter < 0,
          costSettled: true,
          isBackdated: pi.invoiceDate < oldMaxBusinessDate,
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

        level.qtyOnHand += qtyInBaseUom;
        level.avgCostBase = nextAvgCostBase;
        level.avgCostCCY = nextAvgCostCCY;
        level.lastCostBase = netUnitCostBase;
        level.lastCostCCY = netUnitCostCCY;
        level.postingSeq += 1;
        level.version += 1;
        level.totalMovements += 1;
        level.maxBusinessDate = pi.invoiceDate > oldMaxBusinessDate ? pi.invoiceDate : oldMaxBusinessDate;
        level.updatedAt = new Date();
        level.lastMovementId = movement.id;

        line.stockMovementId = movement.id;
        line.warehouseId = warehouseId;

        const itemLevels = levelsByItemMap.get(item.id) || [level];
        const movementCostPoint = buildPurchaseCostPoint(movement);
        const lastPurchaseCost = purchasePricePoint ?? movementCostPoint;
        const avgCost = buildAverageCostPoint(
          itemLevels,
          item,
          baseCurrency,
          invSettings?.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE',
          movementCostPoint
        );
        const costingStats = buildUpdatedItemCostingStats(item, avgCost, { lastPurchaseCost });
        item.costingStats = costingStats;
        itemCostingStatsUpdates.set(item.id, { costingStats, updatedAt: new Date() });

        inventoryMovements.set(line.lineId, { movement, updatedLevel: level, qtyInBaseUom });
      }

      if (purchasePricePoint && itemForMemory && !itemCostingStatsUpdates.has(itemForMemory.id)) {
        const avgCost = buildAverageCostPoint(
          levelsByItemMap.get(itemForMemory.id) || [],
          itemForMemory,
          baseCurrency,
          invSettings?.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE',
          itemForMemory.costingStats?.avgCost
        );
        const costingStats = buildUpdatedItemCostingStats(itemForMemory, avgCost, { lastPurchaseCost: purchasePricePoint });
        itemForMemory.costingStats = costingStats;
        itemCostingStatsUpdates.set(itemForMemory.id, { costingStats, updatedAt: new Date() });
      }

      if (poLine) poLine.invoicedQty = roundMoney(poLine.invoicedQty + line.invoicedQty);
    }

    this.recalcInvoiceTotals(pi);

    // PHASE 1E: PRE-RESOLVE ALL ACCOUNT IDS (bare reads before transaction)
    const accountCache = new Map<string, string>();
    const resolveAccountCached = async (idOrCode: string): Promise<string> => {
      if (!idOrCode) return '';
      if (accountCache.has(idOrCode)) return accountCache.get(idOrCode)!;
      const resolved = await this.resolveAccountId(companyId, idOrCode);
      accountCache.set(idOrCode, resolved);
      return resolved;
    };

    const resolvedDebitAccounts = new Map<string, string>();
    const resolvedTaxAccounts = new Map<string, string>();
    for (const line of pi.lines) {
      resolvedDebitAccounts.set(line.lineId, await resolveAccountCached(line.accountId));
      if (line.taxAmountBase > 0 && line.taxCodeId) {
        const pTaxCode = taxCodesMap.get(line.taxCodeId);
        // Refuse loudly: silently skipping here makes the voucher post unbalanced
        // (debit = Net, credit = Net + Tax) and surfaces as a generic INFRA_999
        // "voucher is not balanced" with no clue to the cause. Mirror SI's
        // structured AccountMappingError so the shared error dialog renders a
        // proper "missing tax account" message with the tax code label, not the
        // UUID.
        if (!pTaxCode?.purchaseTaxAccountId) {
          const taxLabel = pTaxCode?.code || line.taxCode || line.taxCodeId;
          throw new AccountMappingError({
            companyId,
            itemId: line.itemId,
            accountRole: 'tax',
            fallbackChain: ['taxCode.purchaseTaxAccountId'],
            lineNo: pi.lines.indexOf(line) + 1,
            hint: `Tax code "${taxLabel}" has no Purchase Tax Account configured. Set it in Settings → Tax Codes before posting this invoice.`,
          });
        }
        resolvedTaxAccounts.set(line.lineId, await resolveAccountCached(pTaxCode.purchaseTaxAccountId));
      }
    }
    const apAccountId = this.resolveAPAccount(vendor, settings);
    const resolvedAPId = await resolveAccountCached(apAccountId);

    // Resolve the GL account for each whole-invoice charge/discount (falls back to the
    // purchase expense account, throwing a clear error if neither is set).
    const resolvedChargeAccounts = new Map<string, string>();
    for (const charge of pi.charges || []) {
      const fallback = settings.defaultPurchaseExpenseAccountId;
      const discountFallback = settings.defaultPurchaseDiscountAccountId || settings.defaultPurchaseExpenseAccountId;
      const accountSource = charge.accountId || (charge.kind === 'DISCOUNT' ? discountFallback : fallback);
      if (!accountSource) {
        throw new Error(`No GL account for ${charge.kind === 'DISCOUNT' ? 'discount' : 'charge'} "${charge.name}". Set a Default Purchase Expense account or choose one on the row.`);
      }
      resolvedChargeAccounts.set(charge.chargeId, await resolveAccountCached(accountSource));
    }

    // PHASE 2: TRANSACTION CALLBACK — WRITES ONLY
    try {
      await this.transactionManager.runTransaction(async (transaction) => {
        // Write inventory movements and stock levels
        for (const [lineId, { movement, updatedLevel }] of inventoryMovements) {
          await this.inventoryService.writeStockMovement(movement, transaction);
          await this.inventoryService.writeStockLevel(updatedLevel, transaction);
        }
        for (const [itemId, update] of itemCostingStatsUpdates) {
          await this.itemRepo.updateItemInTransaction(
            companyId,
            itemId,
            {
              costingStats: update.costingStats,
              updatedAt: update.updatedAt,
            } as Partial<Item>,
            transaction
          );
        }
        if (this.partyItemPriceRepo) {
          for (const update of partyItemPriceUpdates) {
            await this.partyItemPriceRepo.upsertLastPrice(update, transaction);
          }
        }

        // Build the posting plan — one debit entry per source line (+ its tax),
        // then the AP credit. The poster preserves this per-line granularity
        // (no accumulation) so the voucher keeps its per-line drill-down, and
        // raises a uniform AccountMappingError for any missing account.
        const postingEntries: SubledgerPostingEntry[] = [];

        for (const line of pi.lines) {
          postingEntries.push({
            role: accountingMode === 'PERIODIC' ? 'expense' : line.trackInventory ? 'inventory' : 'expense',
            accountId: resolvedDebitAccounts.get(line.lineId) || undefined,
            side: 'Debit',
            baseAmount: line.lineTotalBase,
            docAmount: line.lineTotalDoc,
            notes: `${line.itemName} x ${line.invoicedQty}`,
            metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, lineId: line.lineId, itemId: line.itemId },
            missingAccountContext: {
              itemId: line.itemId,
              fallbackChain: ['line.accountId'],
              hint: `Configure the purchase/inventory account for "${line.itemName}".`,
            },
          });

          if (line.taxAmountBase > 0 && line.taxCodeId) {
            postingEntries.push({
              role: 'tax',
              accountId: resolvedTaxAccounts.get(line.lineId),
              side: 'Debit',
              baseAmount: line.taxAmountBase,
              docAmount: line.taxAmountDoc,
              notes: `Tax: ${line.taxCode || line.taxCodeId} on ${line.itemName}`,
              metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, lineId: line.lineId, taxCodeId: line.taxCodeId },
              missingAccountContext: {
                fallbackChain: ['taxCode.purchaseTaxAccountId'],
                hint: `Tax code "${line.taxCode || line.taxCodeId}" has no Purchase Tax Account configured.`,
              },
            });
          }
        }

        // Whole-invoice charges/discounts (allocation grid). Mirror of the Sales side with the
        // GL sides flipped: a CHARGE we owe the vendor is a Debit (e.g. freight/landed cost);
        // a DISCOUNT received is a Credit. The AP credit already nets both via grandTotalBase,
        // so total debits/credits stay balanced.
        for (const charge of pi.charges || []) {
          const chargeAccountId = resolvedChargeAccounts.get(charge.chargeId);
          const isDiscount = charge.kind === 'DISCOUNT';
          postingEntries.push({
            role: isDiscount ? 'discount' : 'expense',
            accountId: chargeAccountId || undefined,
            side: isDiscount ? 'Credit' : 'Debit',
            baseAmount: roundMoney(charge.amountBase || 0),
            docAmount: roundMoney(charge.amountDoc || 0),
            notes: `${isDiscount ? 'Discount' : 'Charge'}: ${charge.name}`,
            metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, chargeId: charge.chargeId },
            missingAccountContext: {
              fallbackChain: ['charge.accountId', 'settings.defaultPurchaseExpenseAccountId'],
              hint: `Configure the GL account for ${isDiscount ? 'discount' : 'charge'} "${charge.name}".`,
            },
          });
        }

        postingEntries.push({
          role: 'ap',
          accountId: resolvedAPId || undefined,
          side: 'Credit',
          baseAmount: pi.grandTotalBase,
          docAmount: pi.grandTotalDoc,
          notes: `AP - ${pi.vendorName} - ${pi.invoiceNumber}`,
          metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, vendorId: pi.vendorId },
          missingAccountContext: { fallbackChain: ['vendor.defaultAPAccountId', 'settings AP'], hint: 'Configure the vendor or company Accounts Payable account.' },
        });

        if (shouldPostAccounting) {
          const poster = new SubledgerDocumentPoster(this.accountingPostingService);
          const voucher = await poster.post(
            {
              companyId,
              voucherType: VoucherType.PURCHASE_INVOICE,
              voucherNo: `PI-${pi.invoiceNumber}`,
              date: pi.invoiceDate,
              description: `PI ${pi.invoiceNumber} - ${pi.vendorName}`,
              currency: pi.currency,
              exchangeRate: pi.exchangeRate,
              entries: postingEntries,
              metadata: {
                sourceModule: 'purchases',
                sourceType: 'PURCHASE_INVOICE',
                sourceId: pi.id,
              },
              createdBy: pi.createdBy,
              postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
              reference: pi.invoiceNumber,
              baseCurrencyOverride: baseCurrency,
              approved: !!approvalContext,
            },
            transaction
          );

          pi.voucherId = voucher.id;
        }

        // --- Process settlements inside the same transaction (atomic) ---
        if (settlementInput && settlementInput.settlementMode !== 'DEFERRED') {
          await this.processSettlementsInTransaction(
            companyId, pi, settlementInput, baseCurrency, transaction
          );
        } else {
          // DEFERRED: ensure payment fields reflect unpaid state
          pi.paymentStatus = 'UNPAID';
          pi.paidAmountBase = 0;
          pi.outstandingAmountBase = pi.grandTotalBase;
        }

        pi.status = 'POSTED';
        pi.postedAt = new Date();
        pi.updatedAt = new Date();
        // A successful post consumes any settlement preserved while parked for
        // approval — clear it so it can never be replayed twice.
        pi.pendingSettlement = null;
        await this.purchaseInvoiceRepo.update(pi, transaction);

        // Task 246: record gross-profit facts inside the posting transaction.
        // PI: revenue=0, cost=lineTotalBase (the purchase cost is the line total).
        if (this.profitFactRecorder) {
          const rate = pi.exchangeRate || 1;
          const lines: PostedLineForProfitFact[] = pi.lines.map((l) => ({
            lineId: l.lineId,
            itemId: l.itemId,
            qtyBase: l.invoicedQty,
            uomId: l.uomId || '',
            revenueAmountDoc: 0,
            revenueAmountBase: 0,
            costAmountDoc: l.lineTotalDoc,
            costAmountBase: l.lineTotalBase,
            exchangeRateDocToBase: rate,
          }));
          await this.profitFactRecorder.execute({
            companyId: pi.companyId,
            documentType: 'PURCHASE_INVOICE',
            documentId: pi.id,
            documentNumber: pi.invoiceNumber,
            documentDate: pi.invoiceDate,
            docCurrency: pi.currency,
            baseCurrency: (baseCurrency || pi.currency || 'USD').toUpperCase(),
            snapshotVersion: 1,
            lines,
            transaction,
          });
        }

        if (po) {
          po.status = updatePOStatus(po);
          po.updatedAt = new Date();
          await this.purchaseOrderRepo.update(po, transaction);
        }
      });
    } catch (err: any) {
      if (err instanceof PostingError && err.appError.code === 'APPROVAL_REQUIRED') {
        // Preserve the settlement entered at post time so it is replayed when an
        // accountant approves the invoice. Without this, the cash payment is silently
        // dropped across the approval boundary and the invoice posts on credit.
        const parkedSettlement: PendingSettlement | null =
          settlementInput && settlementInput.settlementMode !== 'DEFERRED'
            ? (settlementInput as PendingSettlement)
            : null;
        await this.transactionManager.runTransaction(async (tx) => {
          const latestPi = await this.purchaseInvoiceRepo.getById(companyId, pi.id);
          if (!latestPi) throw new Error('Purchase invoice not found during parking');
          if (latestPi.status !== 'DRAFT') {
            throw new Error(`Cannot park purchase invoice. Expected DRAFT, but current status is ${latestPi.status}`);
          }
          latestPi.status = 'PENDING_APPROVAL';
          latestPi.pendingSettlement = parkedSettlement;
          latestPi.updatedAt = new Date();
          await this.purchaseInvoiceRepo.update(latestPi, tx);
        });
        pi.status = 'PENDING_APPROVAL';
        pi.pendingSettlement = parkedSettlement;
        pi.updatedAt = new Date();
        return pi;
      }
      throw err;
    }

    return (await this.purchaseInvoiceRepo.getById(companyId, id))!;
  }

  private async resolveAccountId(companyId: string, idOrCode: string): Promise<string> {
    if (!idOrCode) return '';
    if (!this.accountRepo) return idOrCode;
    const acc = (await this.accountRepo.getById(companyId, idOrCode)) || (await this.accountRepo.getByUserCode(companyId, idOrCode));
    return acc ? acc.id : idOrCode;
  }

  private validatePostingQuantity(line: PurchaseInvoiceLine, poLine: any, allowDirect: boolean, tolerance: number, isPOLinked: boolean): void {
    if (!isPOLinked || !poLine) return;
    const toleranceFactor = 1 + (tolerance / 100);
    const eps = 0.000001;

    if (!allowDirect && line.trackInventory) {
      const maxByReceived = (poLine.receivedQty * toleranceFactor) - poLine.invoicedQty;
      if (line.invoicedQty > maxByReceived + eps) {
        throw new Error(`Invoiced qty exceeds received qty for ${line.itemName}`);
      }
      return;
    }

    const maxByOrdered = (poLine.orderedQty * toleranceFactor) - poLine.invoicedQty;
    if (line.invoicedQty > maxByOrdered + eps) {
      throw new Error(`Invoiced qty exceeds ordered qty for ${line.itemName}`);
    }
  }

  private freezeTaxSnapshotSync(line: PurchaseInvoiceLine, rate: number, tax?: TaxCode): void {
    line.taxCode = tax?.code;
    line.taxRate = tax?.rate || 0;
    const amounts = calculateCommercialLineAmounts({
      quantity: line.invoicedQty,
      unitPriceDoc: line.unitPriceDoc,
      exchangeRate: rate,
      taxRate: line.taxRate,
      priceIsInclusive: line.priceIsInclusive === true,
      discountType: line.discountType,
      discountValue: line.discountValue,
      discountAmountDoc: line.discountAmountDoc,
    });
    line.grossLineTotalDoc = amounts.grossLineTotalDoc;
    line.discountAmountDoc = amounts.discountAmountDoc;
    line.lineTotalDoc = amounts.lineTotalDoc;
    line.unitPriceBase = amounts.unitPriceBase;
    line.grossLineTotalBase = amounts.grossLineTotalBase;
    line.discountAmountBase = amounts.discountAmountBase;
    line.lineTotalBase = amounts.lineTotalBase;
    line.taxAmountDoc = amounts.taxAmountDoc;
    line.taxAmountBase = amounts.taxAmountBase;
  }

  private recalcInvoiceTotals(pi: PurchaseInvoice): void {
    // Whole-invoice CHARGE adds to the subtotal; DISCOUNT subtracts. Both are tax-free.
    const chargeSubtotalDoc = (pi.charges || []).reduce(
      (sum, c) => sum + (c.kind === 'DISCOUNT' ? -c.amountDoc : c.amountDoc), 0);
    const chargeSubtotalBase = (pi.charges || []).reduce(
      (sum, c) => sum + (c.kind === 'DISCOUNT' ? -(c.amountBase || 0) : (c.amountBase || 0)), 0);

    pi.subtotalDoc = roundMoney(pi.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0) + chargeSubtotalDoc);
    pi.taxTotalDoc = roundMoney(pi.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    pi.grandTotalDoc = roundMoney(pi.subtotalDoc + pi.taxTotalDoc);

    pi.subtotalBase = roundMoney(pi.lines.reduce((sum, line) => sum + line.lineTotalBase, 0) + chargeSubtotalBase);
    pi.taxTotalBase = roundMoney(pi.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    pi.grandTotalBase = roundMoney(pi.subtotalBase + pi.taxTotalBase);

    pi.outstandingAmountBase = roundMoney(Math.max(pi.grandTotalBase - (pi.paidAmountBase || 0), 0));
  }

  private resolveDebitAccountSync(
    companyId: string,
    item: Item,
    accountingMode: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL',
    clearsGRNI: boolean,
    cats: Map<string, any>,
    dExp?: string,
    dInv?: string,
    dGRNI?: string
  ): string {
    if (item.trackInventory) {
      if (accountingMode === 'PERIODIC') {
        const category = item.categoryId ? cats.get(item.categoryId) : null;
        const resolved = category?.defaultPurchaseExpenseAccountId || dExp;
        if (!resolved) throw new Error(`No purchase expense account for item ${item.name}`);
        return resolved;
      }
      if (clearsGRNI) {
        if (!dGRNI) throw new Error(`No GRNI account configured for item ${item.name}`);
        return dGRNI;
      }
      return item.inventoryAssetAccountId || (item.categoryId ? cats.get(item.categoryId)?.defaultInventoryAssetAccountId : null) || dInv || '';
    }
    if (item.cogsAccountId) return item.cogsAccountId;
    const category = item.categoryId ? cats.get(item.categoryId) : null;
    const resolved = category?.defaultPurchaseExpenseAccountId || dExp;
    if (!resolved) throw new Error(`No purchase expense account for item ${item.name}`);
    return resolved;
  }

  private resolveAPAccount(vendor: Party, settings: PurchaseSettings): string {
    const aid = vendor.defaultAPAccountId || settings.defaultAPAccountId;
    if (!aid) throw new Error(`No AP account for ${vendor.displayName}`);
    return aid;
  }

  private async processSettlementsInTransaction(
    companyId: string,
    pi: PurchaseInvoice,
    settlementInput: SettlementInput,
    baseCurrency: string,
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
      const outstanding = roundMoney(pi.grandTotalBase - (pi.paidAmountBase || 0));
      if (Math.abs(settlementTotal - outstanding) > 0.01) {
        throw new Error(`CASH_FULL settlement total (${settlementTotal}) must equal outstanding amount (${outstanding})`);
      }
      if (settlements.length !== 1) {
        throw new Error('CASH_FULL mode requires exactly one settlement row');
      }
    }

    if (settlementMode === 'MULTI') {
      const outstanding = roundMoney(pi.grandTotalBase - (pi.paidAmountBase || 0));
      const allowOverpayment = (await this.settingsRepo.getSettings(companyId))?.allowOverpayment === true;
      if (!allowOverpayment && settlementTotal > outstanding + 0.01) {
        throw new Error(`MULTI settlement total (${settlementTotal}) exceeds outstanding amount (${outstanding}). Enable "allow over-payment" in Purchase settings to record the excess as a vendor credit.`);
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

    const baseCurrencyUpper = baseCurrency.toUpperCase();

    for (const settlement of settlements) {
      const settlementAmountBase = roundMoney(settlement.amountBase);
      const settlementDate = settlement.paymentDate || now.toISOString().split('T')[0];
      const settlementMethod = settlement.paymentMethod || 'CASH';

      const voucherNo = this.numberingEngine
        ? await this.numberingEngine.next({ companyId, docType: 'PV', scope: 'company', prefix: 'PV', counterWidth: 4 })
        : await this.voucherSequenceRepo!.getNextNumber(companyId, 'PV');
      const voucherId = `vch_${randomUUID()}`;

      const docAmount = roundMoney(settlementAmountBase / pi.exchangeRate);

      const drLine = new VoucherLineEntity(
        1,
        receivablePayableAccountId,
        'Debit',
        settlementAmountBase,
        baseCurrencyUpper,
        docAmount,
        pi.currency,
        pi.exchangeRate,
        `Payment for ${pi.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
      );
      const crLine = new VoucherLineEntity(
        2,
        settlement.settlementAccountId,
        'Credit',
        settlementAmountBase,
        baseCurrencyUpper,
        docAmount,
        pi.currency,
        pi.exchangeRate,
        `Payment for ${pi.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`
      );

      const totalDebit = roundMoney(drLine.debitAmount);
      const totalCredit = roundMoney(crLine.creditAmount);

      const approvedVoucher = new VoucherEntity(
        voucherId,
        companyId,
        voucherNo,
        VoucherType.PAYMENT,
        settlementDate,
        `Payment for Purchase Invoice ${pi.invoiceNumber}`,
        pi.currency.toUpperCase(),
        baseCurrencyUpper,
        pi.exchangeRate,
        [drLine, crLine],
        totalDebit,
        totalCredit,
        VoucherStatus.APPROVED,
        { sourceModule: 'purchases', sourceInvoiceId: pi.id, settlementMode },
        pi.createdBy,
        now,
        pi.createdBy,
        now,
        undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined,
        settlement.reference || null
      );

      const postedVoucher = approvedVoucher.post(pi.createdBy, now, PostingLockPolicy.FLEXIBLE_LOCKED);

      // Single sanctioned ledger door. This system-generated settlement payment is policy-exempt
      // (Stage 4b will fold settlement postings into the policy set).
      const gateway = new PostingGateway(this.ledgerRepo!, new VoucherValidationService());
      await gateway.record(
        postedVoucher,
        {
          userId: pi.createdBy,
          enforcePolicies: false,
          exemptionReason: 'system-generated settlement payment for Purchase Invoice (Stage 4b)',
        },
        transaction
      );
      await this.voucherRepo!.save(postedVoucher, transaction);

      const paymentId = `pay_${randomUUID()}`;
      const payment = new PaymentHistory({
        id: paymentId,
        companyId,
        sourceType: 'PURCHASE_INVOICE',
        sourceId: pi.id,
        sourceNumber: pi.invoiceNumber,
        amountBase: settlementAmountBase,
        currency: pi.currency,
        exchangeRate: pi.exchangeRate,
        amountDoc: docAmount,
        paymentDate: settlementDate,
        paymentMethod: settlementMethod,
        reference: settlement.reference || undefined,
        notes: settlement.notes || undefined,
        voucherId,
        createdBy: pi.createdBy,
        createdAt: now,
      });

      await this.paymentHistoryRepo!.create(payment, transaction);

      pi.paidAmountBase = roundMoney((pi.paidAmountBase || 0) + settlementAmountBase);
      pi.outstandingAmountBase = roundMoney(Math.max(pi.grandTotalBase - pi.paidAmountBase, 0));

      if (pi.outstandingAmountBase <= 0) {
        pi.paymentStatus = 'PAID';
      } else if (pi.paidAmountBase > 0) {
        pi.paymentStatus = 'PARTIALLY_PAID';
      } else {
        pi.paymentStatus = 'UNPAID';
      }
    }
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

  private async resolveCCYToBaseRate(cid: string, cost: string, base: string, move: string, rate: number, date: string): Promise<number> {
    if (cost.toUpperCase() === base.toUpperCase()) return 1;
    if (cost.toUpperCase() === move.toUpperCase()) return rate;
    const r = await this.exchangeRateRepo.getMostRecentRateBeforeDate(cid, cost, base, new Date(date));
    return r ? r.rate : rate;
  }

  private async isAccountingEngineReady(companyId: string): Promise<boolean> {
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return !!accountingModule?.initialized;
  }

}

/**
 * Returns the financial fields an update payload would actually change on a
 * posted Purchase Invoice. Non-financial fields (notes, vendorInvoiceNumber,
 * dueDate) are excluded — they are allowed on posted invoices. Edit-policy
 * Phase 0; see PostedDocumentEditGuard.
 */
function detectPurchaseInvoiceFinancialChanges(
  current: PurchaseInvoice,
  input: UpdatePurchaseInvoiceInput
): string[] {
  const changed: string[] = [];
  if (scalarChanged(input.vendorId, current.vendorId)) changed.push('vendor');
  if (scalarChanged(input.invoiceDate, current.invoiceDate)) changed.push('invoiceDate');
  if (scalarChanged(input.currency?.toUpperCase(), current.currency)) changed.push('currency');
  if (scalarChanged(input.exchangeRate, current.exchangeRate)) changed.push('exchangeRate');

  if (input.lines) {
    const existingById = new Map(current.lines.map((l) => [l.lineId, l]));
    const sig = (l: {
      itemId?: string; invoicedQty?: number; unitPriceDoc?: number; taxCodeId?: string;
      priceIsInclusive?: boolean;
    }) =>
      `${l.itemId ?? ''}|${l.invoicedQty ?? ''}|${l.unitPriceDoc ?? ''}|` +
      `${l.taxCodeId ?? ''}|${l.priceIsInclusive ?? ''}`;
    const currentSigs = current.lines.map(sig);
    const incomingSigs = input.lines.map((line) => {
      const ex = line.lineId ? existingById.get(line.lineId) : undefined;
      return sig({
        itemId: line.itemId ?? ex?.itemId,
        invoicedQty: line.invoicedQty ?? ex?.invoicedQty,
        unitPriceDoc: line.unitPriceDoc ?? ex?.unitPriceDoc,
        taxCodeId: line.taxCodeId ?? ex?.taxCodeId,
        priceIsInclusive: line.priceIsInclusive ?? ex?.priceIsInclusive,
      });
    });
    if (!lineSignaturesEqual(currentSigs, incomingSigs)) changed.push('lines');
  }

  return changed;
}

export class UpdatePurchaseInvoiceUseCase {
  constructor(
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly auditEngine?: IAuditEngine
  ) {}

  async execute(
    input: UpdatePurchaseInvoiceInput,
    actor?: { userId: string; userEmail?: string }
  ): Promise<PurchaseInvoice> {
    const current = await this.purchaseInvoiceRepo.getById(input.companyId, input.id);
    if (!current) throw new Error(`Purchase invoice not found: ${input.id}`);

    const before = current.toJSON();

    // Edit-policy Phase 0 (Task 179): DRAFT is fully editable. A POSTED invoice
    // may have only its non-financial fields changed in place; any financial
    // change is refused and must go through reversal/amendment. Other statuses
    // stay blocked as before.
    if (current.status === 'POSTED') {
      assertPostedNonFinancialEditOnly({
        status: current.status,
        entityLabel: 'purchase invoice',
        changedFinancialFields: detectPurchaseInvoiceFinancialChanges(current, input),
      });
    } else if (current.status !== 'DRAFT') {
      throw new Error('Only draft purchase invoices can be updated');
    }

    // On a POSTED invoice only non-financial fields are written (the guard above
    // already rejected any financial change). Financial apply blocks are gated to
    // DRAFT so a posted document's amounts/lines are never re-touched here.
    const isDraft = current.status === 'DRAFT';

    if (isDraft && input.vendorId) {
      const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
      if (!vendor) throw new Error(`Vendor not found: ${input.vendorId}`);
      if (!vendor.roles.includes('VENDOR')) throw new Error(`Party is not a vendor: ${input.vendorId}`);
      current.vendorId = vendor.id;
      current.vendorName = vendor.displayName;
    }

    // Non-financial — always editable, including on POSTED.
    if (input.vendorInvoiceNumber !== undefined) current.vendorInvoiceNumber = input.vendorInvoiceNumber;
    if (input.dueDate !== undefined) current.dueDate = input.dueDate;
    if (input.notes !== undefined) current.notes = input.notes;

    // Financial — DRAFT only.
    if (isDraft && input.invoiceDate !== undefined) current.invoiceDate = input.invoiceDate;
    if (isDraft && input.currency !== undefined) current.currency = input.currency.toUpperCase();
    if (isDraft && input.exchangeRate !== undefined) current.exchangeRate = input.exchangeRate;

    if (isDraft && input.lines) {
      const existingById = new Map(current.lines.map((line) => [line.lineId, line]));
      const mappedLines: PurchaseInvoiceLine[] = input.lines.map((line, index) => {
        const existing = line.lineId ? existingById.get(line.lineId) : undefined;
        return {
          lineId: line.lineId || randomUUID(),
          lineNo: line.lineNo ?? existing?.lineNo ?? index + 1,
          poLineId: line.poLineId ?? existing?.poLineId,
          grnLineId: line.grnLineId ?? existing?.grnLineId,
          itemId: line.itemId || existing?.itemId || '',
          itemCode: existing?.itemCode || '',
          itemName: existing?.itemName || '',
          trackInventory: existing?.trackInventory ?? false,
          invoicedQty: line.invoicedQty,
          uomId: line.uomId ?? existing?.uomId,
          uom: line.uom || existing?.uom || 'EA',
          unitPriceDoc: line.unitPriceDoc ?? existing?.unitPriceDoc ?? 0,
          discountType: line.discountType ?? existing?.discountType,
          discountValue: line.discountValue ?? existing?.discountValue,
          lineTotalDoc: existing?.lineTotalDoc ?? 0,
          unitPriceBase: existing?.unitPriceBase ?? 0,
          lineTotalBase: existing?.lineTotalBase ?? 0,
          taxCodeId: line.taxCodeId ?? existing?.taxCodeId,
          taxCode: existing?.taxCode,
          taxRate: existing?.taxRate ?? 0,
          priceIsInclusive:
            line.priceIsInclusive !== undefined
              ? line.priceIsInclusive === true
              : existing?.priceIsInclusive === true,
          taxAmountDoc: existing?.taxAmountDoc ?? 0,
          taxAmountBase: existing?.taxAmountBase ?? 0,
          warehouseId: line.warehouseId ?? existing?.warehouseId,
          accountId: existing?.accountId || '',
          stockMovementId: existing?.stockMovementId ?? null,
          description: line.description ?? existing?.description,
        };
      });
      current.lines = mappedLines;
    }

    if (isDraft && input.charges) {
      const existingById = new Map((current.charges || []).map((charge) => [charge.chargeId, charge]));
      current.charges = input.charges.map((charge, index) => {
        const existing = charge.chargeId ? existingById.get(charge.chargeId) : undefined;
        return {
          chargeId: charge.chargeId || randomUUID(),
          kind: (charge.kind ?? existing?.kind ?? 'CHARGE') as 'CHARGE' | 'DISCOUNT',
          code: charge.code ?? existing?.code,
          name: charge.name ?? existing?.name ?? `Charge ${index + 1}`,
          amountDoc: charge.amountDoc ?? existing?.amountDoc ?? 0,
          amountBase: existing?.amountBase,
          accountId: charge.accountId ?? existing?.accountId,
          description: charge.description ?? existing?.description,
        };
      });
    }

    current.updatedAt = new Date();
    const updated = new PurchaseInvoice(current.toJSON() as any);
    await this.purchaseInvoiceRepo.update(updated);

    if (this.auditEngine && actor) {
      const after = updated.toJSON();
      await recordAuditUpdate(this.auditEngine, {
        companyId: input.companyId,
        entityType: 'PURCHASE_INVOICE',
        entityId: updated.id,
        entityNumber: updated.invoiceNumber ? `PI-${updated.invoiceNumber}` : undefined,
        userId: actor.userId,
        userEmail: actor.userEmail,
        before: before as Record<string, any>,
        after: after as Record<string, any>,
      });
    }

    return updated;
  }
}

export class GetPurchaseInvoiceUseCase {
  constructor(private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseInvoice> {
    const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!pi) throw new Error(`Purchase invoice not found: ${id}`);
    return pi;
  }
}

export class ListPurchaseInvoicesUseCase {
  constructor(private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository) {}

  async execute(companyId: string, filters: ListPurchaseInvoicesFilters = {}): Promise<PurchaseInvoice[]> {
    return this.purchaseInvoiceRepo.list(companyId, {
      vendorId: filters.vendorId,
      purchaseOrderId: filters.purchaseOrderId,
      status: filters.status,
      paymentStatus: filters.paymentStatus,
      limit: filters.limit,
    });
  }
}

export class UnpostPurchaseInvoiceUseCase {
  constructor(
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly inventoryService: IInventoryCore,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string, currentUser: string, createAccountingEffect: boolean = true): Promise<PurchaseInvoice> {
    const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!pi) throw new Error(`Purchase invoice not found: ${id}`);
    if (pi.status !== 'POSTED') throw new Error('Only POSTED purchase invoices can be unposted');

    if (pi.paidAmountBase > 0) {
      throw new Error('Cannot unpost an invoice that has payments applied. Reverse the payments first.');
    }

    const shouldPostAccounting = createAccountingEffect && await this.isAccountingEngineReady(companyId);

    let po: PurchaseOrder | null = null;
    if (pi.purchaseOrderId) {
      po = await this.purchaseOrderRepo.getById(companyId, pi.purchaseOrderId);
    }

    // Firestore requires ALL reads before ALL writes within a single transaction.
    // Both the voucher deletion (it queries the ledger entries to delete) and each
    // inventory movement reversal (it reads the stock level to rebuild it) are
    // read-then-write blocks, so they cannot legally share one transaction. Run
    // each as its own transaction (each is internally read-before-write). Order is
    // voucher -> inventory -> PO/PI so a mid-way failure leaves the PI still POSTED
    // in the DB and the unpost can be safely retried.

    // 1. Delete the accounting voucher (own transaction).
    if (shouldPostAccounting && pi.voucherId) {
      const voucherId = pi.voucherId;
      await this.transactionManager.runTransaction(async (transaction) => {
        await this.accountingPostingService.deleteVoucherInTransaction(companyId, voucherId, transaction);
      });
      pi.voucherId = null;
    }

    // 2. Reverse inventory movements — each deleteMovement runs in its own
    //    transaction (no shared txn passed), keeping its reads before its writes.
    for (const line of pi.lines) {
      if (line.stockMovementId) {
        await this.inventoryService.deleteMovement(companyId, line.stockMovementId);
        line.stockMovementId = null;
      }

      // Reverse PO invoicedQty (in-memory; persisted in step 3).
      if (po) {
        const poLine = findPOLine(po, line.poLineId, line.itemId);
        if (poLine) {
          poLine.invoicedQty = roundMoney(Math.max(0, poLine.invoicedQty - line.invoicedQty));
        }
      }
    }

    // 3. Update PO status + revert PI to DRAFT (own transaction; pure writes).
    await this.transactionManager.runTransaction(async (transaction) => {
      if (po) {
        po.status = updatePOStatus(po);
        po.updatedAt = new Date();
        await this.purchaseOrderRepo.update(po, transaction);
      }

      pi.status = 'DRAFT';
      pi.postedAt = undefined;
      pi.updatedAt = new Date();
      await this.purchaseInvoiceRepo.update(pi, transaction);
    });

    const unposted = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!unposted) throw new Error('Failed to retrieve invoice after unposting');
    return unposted;
  }

  private async isAccountingEngineReady(companyId: string): Promise<boolean> {
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return !!accountingModule?.initialized;
  }
}

export class ApprovePurchaseInvoiceUseCase {
  constructor(
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly postUseCase: PostPurchaseInvoiceUseCase
  ) {}

  async execute(
    companyId: string,
    id: string,
    actor: { userId: string; userEmail?: string },
    settlementInput?: SettlementInput
  ): Promise<PurchaseInvoice> {
    const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!pi) throw new Error(`Purchase invoice not found: ${id}`);
    if (pi.status !== 'PENDING_APPROVAL') {
      throw new Error('Only purchase invoices pending approval can be approved');
    }
    // Replay the settlement entered at post time (preserved on the invoice while
    // parked). An explicit settlementInput on the approval request takes precedence;
    // otherwise honour the stored intent so the cash payment is not lost across the
    // approval boundary. The post clears pendingSettlement on success.
    const effectiveSettlement: SettlementInput | undefined =
      settlementInput ?? (pi.pendingSettlement ? (pi.pendingSettlement as SettlementInput) : undefined);
    // Re-enter the real post with approvalContext set (bypasses the gate).
    return this.postUseCase.execute(companyId, id, true, effectiveSettlement, { approvedBy: actor.userId });
  }
}

export class CreateAndPostPurchaseInvoiceUseCase {
  constructor(
    private readonly createUseCase: CreatePurchaseInvoiceUseCase,
    private readonly postUseCase: PostPurchaseInvoiceUseCase
  ) {}

  async execute(input: CreatePurchaseInvoiceInput, settlementInput?: SettlementInput): Promise<PurchaseInvoice> {
    const pi = await this.createUseCase.execute(input);
    return this.postUseCase.execute(input.companyId, pi.id, true, settlementInput);
  }
}

export class UpdateAndPostPurchaseInvoiceUseCase {
  constructor(
    private readonly updateUseCase: UpdatePurchaseInvoiceUseCase,
    private readonly postUseCase: PostPurchaseInvoiceUseCase
  ) {}

  async execute(input: UpdatePurchaseInvoiceInput, settlementInput?: SettlementInput): Promise<PurchaseInvoice> {
    const pi = await this.updateUseCase.execute(input);
    return this.postUseCase.execute(input.companyId, pi.id, true, settlementInput);
  }
}
