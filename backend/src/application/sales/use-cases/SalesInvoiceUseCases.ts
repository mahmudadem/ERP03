import { randomUUID } from 'crypto';
import { ApiError } from '../../../api/errors/ApiError';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { PostingLockPolicy, VoucherType, VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { AppliedPromotionInfo } from '../../../domain/sales/entities/AppliedPromotion';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import {
  DocumentSource,
  PaymentStatus,
  SalesDiscountType,
  SalesInvoice,
  SalesInvoiceCharge,
  SalesInvoiceLine,
} from '../../../domain/sales/entities/SalesInvoice';
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
import { IPromotionRuleRepository } from '../../../repository/interfaces/sales/IPromotionRuleRepository';
import { ICreditOverrideRepository } from '../../../repository/interfaces/sales/ICreditOverrideRepository';
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
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { PostingGateway } from '../../accounting/services/PostingGateway';
import { AccountingEngineUnavailableError } from '../../../domain/accounting/errors/AccountingEngineUnavailableError';
import { AccountMappingError } from '../../../domain/accounting/errors/AccountMappingError';
import { PersonaNotAllowedError } from '../../../domain/accounting/errors/PersonaNotAllowedError';
import { UnsettledCostError } from '../../../domain/inventory/errors/UnsettledCostError';
import { PostingLog, LineDecision } from '../../../domain/accounting/entities/PostingLog';
import { IPostingLogRepository } from '../../../repository/interfaces/accounting/IPostingLogRepository';
import { randomUUID as nodeRandomUUID } from 'crypto';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import { RecordChangeService } from '../../system/services/RecordChangeService';
import {
  ItemQtyToBaseUomResult,
  convertItemQtyToBaseUomDetailed,
} from '../../inventory/services/UomResolutionService';
import { addDaysToISODate, roundMoney } from './SalesPostingHelpers';
import { generateUniqueDocumentNumber } from './SalesOrderUseCases';
import {
  calculateSalesInvoiceChargeAmounts,
  calculateSalesInvoiceLineAmounts,
  calculateSalesInvoiceTotals,
} from '../services/SalesInvoiceCalculationService';
import { PromotionApplicationService, PromotionEvalLine } from '../services/PromotionApplicationService';
import { CreditCheckService, CreditCheckResult } from '../services/CreditCheckService';
import { CreditOverride } from '../../../domain/sales/entities/CreditOverride';
import { CreditLimitExceededError } from '../../../domain/sales/errors/CreditLimitExceededError';
import { PostingError } from '../../../domain/shared/errors/AppError';

export type SalesInvoicePersona = 'direct' | 'linked' | 'service';
export type SettlementMode = 'DEFERRED' | 'CASH_FULL' | 'MULTI';
export const SETTLEMENT_MODES: SettlementMode[] = ['DEFERRED', 'CASH_FULL', 'MULTI'];
export const VALID_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'];
const DOCUMENT_SOURCES: DocumentSource[] = ['native', 'default_form', 'custom_form'];
const resolvePaymentMethodAccount = (
  settings: SalesSettings,
  paymentMethod: PaymentMethod | undefined
): string | undefined => {
  if (!paymentMethod) return undefined;
  const config = (settings.paymentMethodConfigs || []).find(
    (entry) => entry.method === paymentMethod && (entry.isEnabled ?? true)
  );
  return config?.settlementAccountId;
};

export interface SettlementRow {
  settlementAccountId?: string;
  amountBase: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  paymentDate?: string;
}

export interface SettlementInput {
  settlementMode: SettlementMode;
  receivablePayableAccountId?: string;
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
  discountType?: SalesDiscountType;
  discountValue?: number;
  discountAmountDoc?: number;
  taxCodeId?: string;
  /** Optional per-line override. When undefined, falls back to the tax code's default. */
  priceIsInclusive?: boolean;
  warehouseId?: string;
  description?: string;
}

export interface SalesInvoiceChargeInput {
  chargeId?: string;
  code?: string;
  name: string;
  amountDoc: number;
  taxCodeId?: string;
  revenueAccountId?: string;
  description?: string;
}

export interface CreateSalesInvoiceInput {
  companyId: string;
  voucherFormId?: string;
  formType?: string;
  voucherType?: string;
  persona?: string;
  source?: DocumentSource | string;
  salesOrderId?: string;
  salespersonId?: string;
  customerId: string;
  customerInvoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesInvoiceLineInput[];
  charges?: SalesInvoiceChargeInput[];
  notes?: string;
  createdBy: string;
  /** When provided alongside a BLOCK-policy credit limit breach, the invoice creation
   *  proceeds and an audit override record is persisted. */
  creditOverrideReason?: string;
}

export interface CreateSalesInvoiceResult {
  salesInvoice: SalesInvoice;
  creditCheck?: CreditCheckResult & { outcome: 'OK' | 'WARN' | 'OVERRIDDEN' };
}

export interface UpdateSalesInvoiceInput {
  companyId: string;
  id: string;
  customerId?: string;
  salespersonId?: string;
  customerInvoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesInvoiceLineInput[];
  charges?: SalesInvoiceChargeInput[];
  notes?: string;
}

export interface ListSalesInvoicesFilters {
  customerId?: string;
  salesOrderId?: string;
  status?: 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'CANCELLED';
  paymentStatus?: PaymentStatus;
  limit?: number;
}

export interface InvoiceableLinkedSalesLine {
  sourceType: 'DELIVERY_NOTE' | 'SALES_ORDER';
  deliveryNoteId?: string;
  deliveryNoteNumber?: string;
  deliveryDate?: string;
  soLineId?: string;
  dnLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  trackInventory: boolean;
  remainingQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface InvoiceableLinkedSalesSource {
  salesOrderId: string;
  customerId: string;
  customerName: string;
  currency: string;
  exchangeRate: number;
  lines: InvoiceableLinkedSalesLine[];
}

interface VoucherAccumulatedLine {
  accountId: string;
  baseAmount: number;
  docAmount: number;
  side: 'Debit' | 'Credit';
}

interface ResolvedChargeAccount {
  revenueId: string;
  taxId?: string;
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
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly promotionRuleRepo?: IPromotionRuleRepository,
    private readonly creditCheckService?: CreditCheckService,
    private readonly creditOverrideRepo?: ICreditOverrideRepository,
    private readonly recordChangeService?: RecordChangeService,
  ) {}

  async execute(input: CreateSalesInvoiceInput, transaction?: unknown, actor?: { userId: string; userEmail?: string }): Promise<CreateSalesInvoiceResult> {
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
      input.persona as 'direct' | 'linked' | 'service',
      { formType: input.formType }
    );
    if (!isPersonaAllowed) {
      throw new PersonaNotAllowedError({
        companyId: input.companyId,
        module: 'sales',
        persona: input.persona as string,
        formType: input.formType,
      });
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
      const taxCodeId = await this.resolveTaxCodeId(
        input.companyId,
        sourceLine.taxCodeId || soLine?.taxCodeId,
        item.defaultSalesTaxCodeId
      );

      let taxRate = 0;
      let taxCode: string | undefined;
      let taxCodeInclusiveDefault = false;
      if (taxCodeId) {
        const selectedTaxCode = await this.taxCodeRepo.getById(input.companyId, taxCodeId);
        if (!selectedTaxCode) throw new Error(`Tax code not found: ${taxCodeId}`);
        assertValidSalesTaxCode(selectedTaxCode, taxCodeId);
        taxRate = selectedTaxCode.rate;
        taxCode = selectedTaxCode.code;
        taxCodeInclusiveDefault = selectedTaxCode.priceIsInclusive === true;
      }

      const effectiveInclusive =
        sourceLine.priceIsInclusive !== undefined
          ? sourceLine.priceIsInclusive === true
          : taxCodeInclusiveDefault;

      const discountType = sourceLine.discountType;
      const discountValue = sourceLine.discountValue;
      const lineAmounts = calculateSalesInvoiceLineAmounts({
        invoicedQty,
        unitPriceDoc,
        exchangeRate,
        taxRate,
        priceIsInclusive: effectiveInclusive,
        discountType,
        discountValue,
        discountAmountDoc: sourceLine.discountAmountDoc,
      });

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
        grossLineTotalDoc: lineAmounts.grossLineTotalDoc,
        discountType,
        discountValue,
        discountAmountDoc: lineAmounts.discountAmountDoc,
        lineTotalDoc: lineAmounts.lineTotalDoc,
        unitPriceBase: lineAmounts.unitPriceBase,
        grossLineTotalBase: lineAmounts.grossLineTotalBase,
        discountAmountBase: lineAmounts.discountAmountBase,
        lineTotalBase: lineAmounts.lineTotalBase,
        taxCodeId,
        taxCode,
        taxRate,
        // Set the EFFECTIVE inclusive value so the entity's normalizeLine (which now respects this
        // flag — Task 168) recomputes line totals consistently. Before this fix the use case sent
        // `undefined` whenever the line itself didn't override, and the entity then silently
        // re-applied exclusive math on top of the (correct) inclusive amounts, producing a
        // grand-total double-count on inclusive-tax invoices.
        priceIsInclusive: effectiveInclusive,
        taxAmountDoc: lineAmounts.taxAmountDoc,
        taxAmountBase: lineAmounts.taxAmountBase,
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

    const charges: SalesInvoiceCharge[] = [];
    for (let i = 0; i < (input.charges || []).length; i += 1) {
      const sourceCharge = input.charges![i];
      let taxRate = 0;
      let taxCode: string | undefined;
      let taxCodeId: string | undefined;

      if (sourceCharge.taxCodeId) {
        const selectedTaxCode = await this.taxCodeRepo.getById(input.companyId, sourceCharge.taxCodeId);
        if (!selectedTaxCode) throw new Error(`Tax code not found: ${sourceCharge.taxCodeId}`);
        assertValidSalesTaxCode(selectedTaxCode, sourceCharge.taxCodeId);
        taxCodeId = selectedTaxCode.id;
        taxRate = selectedTaxCode.rate;
        taxCode = selectedTaxCode.code;
      }

      const chargeAmounts = calculateSalesInvoiceChargeAmounts({
        amountDoc: sourceCharge.amountDoc,
        exchangeRate,
        taxRate,
      });

      charges.push({
        chargeId: sourceCharge.chargeId || randomUUID(),
        code: sourceCharge.code,
        name: sourceCharge.name,
        amountDoc: roundMoney(sourceCharge.amountDoc),
        amountBase: chargeAmounts.amountBase,
        taxCodeId,
        taxCode,
        taxRate,
        taxAmountDoc: chargeAmounts.taxAmountDoc,
        taxAmountBase: chargeAmounts.taxAmountBase,
        revenueAccountId: sourceCharge.revenueAccountId || settings.defaultRevenueAccountId,
        description: sourceCharge.description,
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
      voucherFormId: input.voucherFormId,
      formType: input.formType || 'sales_invoice_direct',
      voucherType: input.voucherType || 'sales_invoice',
      persona: input.persona || 'direct',
      source: input.source,
      salesOrderId: so?.id,
      salespersonId: input.salespersonId,
      customerId: customer!.id,
      customerName: customer!.displayName,
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
      cogsVoucherId: null,
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    si.outstandingAmountBase = si.grandTotalBase;

    // --- Credit check (direct persona only — linked/service invoices already checked at SO confirm time) ---
    let creditCheckOutcome: (CreditCheckResult & { outcome: 'OK' | 'WARN' | 'OVERRIDDEN' }) | undefined;
    if (input.persona === 'direct' && this.creditCheckService && this.creditOverrideRepo) {
      const orderAmountBase = si.grandTotalBase;
      const party = await this.partyRepo.getById(input.companyId, si.customerId).catch(() => null);
      if (party && party.creditLimit !== undefined && party.creditLimit !== null) {
        const creditCheck = await this.creditCheckService.check(input.companyId, party, orderAmountBase);
        const overLimit = creditCheck.enforced && !creditCheck.withinLimit;
        if (!overLimit || creditCheck.policy === 'NONE') {
          creditCheckOutcome = { ...creditCheck, outcome: 'OK' };
        } else if (creditCheck.policy === 'WARN') {
          creditCheckOutcome = { ...creditCheck, outcome: 'WARN' };
        } else {
          // policy === 'BLOCK'
          if (!input.creditOverrideReason) {
            throw new CreditLimitExceededError({
              companyId: input.companyId,
              customerId: party.id,
              customerName: party.displayName,
              creditLimit: creditCheck.creditLimit,
              currentExposure: creditCheck.currentExposure,
              orderAmount: creditCheck.orderAmount,
              projectedExposure: creditCheck.projectedExposure,
            });
          }
          // Override provided — persist audit record
          const overrideRecord = new CreditOverride({
            companyId: input.companyId,
            customerId: party.id,
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
            sourceNumber: si.invoiceNumber,
            creditLimit: creditCheck.creditLimit,
            currentExposure: creditCheck.currentExposure,
            orderAmount: creditCheck.orderAmount,
            projectedExposure: creditCheck.projectedExposure,
            reason: input.creditOverrideReason,
            overriddenBy: input.createdBy,
            overriddenAt: new Date(),
          });
          await this.creditOverrideRepo.create(overrideRecord, transaction);
          creditCheckOutcome = { ...creditCheck, outcome: 'OVERRIDDEN' };
        }
      }
    }

    // --- Promotion evaluation (direct persona only) ---
    if (this.promotionRuleRepo && input.persona === 'direct') {
      const rules = await this.promotionRuleRepo.list(input.companyId);
      if (rules.length > 0) {
        const promotionService = new PromotionApplicationService();

        // Build category map for promotion evaluation
        const itemCategoryMap = new Map<string, string | undefined>();
        for (const line of si.lines) {
          if (!itemCategoryMap.has(line.itemId)) {
            const item = await this.itemRepo.getItem(line.itemId);
            if (item) itemCategoryMap.set(item.id, item.categoryId);
          }
        }

        const evalLines: PromotionEvalLine[] = si.lines.map((l) => ({
          lineId: l.lineId,
          itemId: l.itemId,
          categoryId: itemCategoryMap.get(l.itemId),
          qty: l.invoicedQty,
          unitPriceDoc: l.unitPriceDoc,
          lineAmountDoc: l.grossLineTotalDoc ?? l.lineTotalDoc,
          hasManualDiscount: !!(l.discountType),
        }));

        const promoResult = promotionService.evaluate(evalLines, rules, input.invoiceDate);

        const appliedPromotions: AppliedPromotionInfo[] = [];

        // Apply line discounts
        for (const discount of promoResult.lineDiscounts) {
          const lineIndex = si.lines.findIndex((l) => l.lineId === discount.lineId);
          if (lineIndex < 0) continue;
          const line = si.lines[lineIndex];

          // Calculate promotion discount from gross line total
          const grossTotalDoc = line.grossLineTotalDoc ?? roundMoney(line.invoicedQty * line.unitPriceDoc);
          const promoDiscountDoc = roundMoney(grossTotalDoc * discount.discountPct / 100);
          const promoDiscountBase = roundMoney(promoDiscountDoc * si.exchangeRate);
          const newLineTotalDoc = roundMoney(grossTotalDoc - promoDiscountDoc);
          const newLineTotalBase = roundMoney(line.grossLineTotalBase ? line.grossLineTotalBase - promoDiscountBase : newLineTotalDoc * si.exchangeRate);

          si.lines[lineIndex] = {
            ...line,
            appliedPromotionId: discount.ruleId,
            appliedPromotionName: discount.ruleName,
            appliedDiscountPct: discount.discountPct,
            discountType: 'PERCENT',
            discountValue: discount.discountPct,
            discountAmountDoc: promoDiscountDoc,
            discountAmountBase: promoDiscountBase,
            lineTotalDoc: newLineTotalDoc,
            lineTotalBase: newLineTotalBase,
            taxAmountDoc: roundMoney(newLineTotalDoc * line.taxRate),
            taxAmountBase: roundMoney(newLineTotalBase * line.taxRate),
          };

          if (!appliedPromotions.some((p) => p.ruleId === discount.ruleId)) {
            appliedPromotions.push({
              ruleId: discount.ruleId,
              ruleName: discount.ruleName,
              type: 'THRESHOLD_DISCOUNT',
              discountPct: discount.discountPct,
            });
          }
        }

        // Add free-goods lines
        for (const freeGood of promoResult.freeGoods) {
          const item = await this.itemRepo.getItem(freeGood.itemId);
          if (!item || item.companyId !== input.companyId) continue;
          const sourceLine = si.lines.find((l) => l.lineId === freeGood.sourceLineId);
          const revenueAccountId = await this.resolveRevenueAccount(
            input.companyId,
            item.id,
            settings.defaultRevenueAccountId,
          );

          si.lines.push({
            lineId: randomUUID(),
            lineNo: si.lines.length + 1,
            soLineId: sourceLine?.soLineId,
            dnLineId: sourceLine?.dnLineId,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            trackInventory: item.trackInventory,
            invoicedQty: freeGood.qty,
            uomId: item.salesUomId || item.baseUomId,
            uom: item.salesUom || item.baseUom,
            unitPriceDoc: 0,
            grossLineTotalDoc: 0,
            discountType: undefined,
            discountValue: undefined,
            discountAmountDoc: 0,
            lineTotalDoc: 0,
            unitPriceBase: 0,
            grossLineTotalBase: 0,
            discountAmountBase: 0,
            lineTotalBase: 0,
            taxCodeId: sourceLine?.taxCodeId,
            taxCode: sourceLine?.taxCode,
            taxRate: 0,
            taxAmountDoc: 0,
            taxAmountBase: 0,
            warehouseId: sourceLine?.warehouseId ?? settings.defaultWarehouseId,
            revenueAccountId,
            cogsAccountId: item.cogsAccountId,
            inventoryAccountId: item.inventoryAssetAccountId,
            unitCostBase: undefined,
            lineCostBase: undefined,
            stockMovementId: null,
            description: `Free item (${freeGood.ruleName})`,
            appliedPromotionId: freeGood.ruleId,
            appliedPromotionName: freeGood.ruleName,
          });

          if (!appliedPromotions.some((p) => p.ruleId === freeGood.ruleId)) {
            appliedPromotions.push({
              ruleId: freeGood.ruleId,
              ruleName: freeGood.ruleName,
              type: 'BUY_X_GET_Y',
              freeQty: freeGood.qty,
              sourceLineId: freeGood.sourceLineId,
              freeItemId: freeGood.itemId,
            });
          }
        }

        // Recompute SI totals from all (potentially modified) lines + charges
        si.subtotalDoc = roundMoney(
          si.lines.reduce((sum, l) => sum + l.lineTotalDoc, 0)
          + si.charges.reduce((sum, c) => sum + c.amountDoc, 0)
        );
        si.taxTotalDoc = roundMoney(
          si.lines.reduce((sum, l) => sum + l.taxAmountDoc, 0)
          + si.charges.reduce((sum, c) => sum + (c.taxAmountDoc || 0), 0)
        );
        si.grandTotalDoc = roundMoney(si.subtotalDoc + si.taxTotalDoc);
        si.subtotalBase = roundMoney(
          si.lines.reduce((sum, l) => sum + l.lineTotalBase, 0)
          + si.charges.reduce((sum, c) => sum + (c.amountBase || 0), 0)
        );
        si.taxTotalBase = roundMoney(
          si.lines.reduce((sum, l) => sum + l.taxAmountBase, 0)
          + si.charges.reduce((sum, c) => sum + (c.taxAmountBase || 0), 0)
        );
        si.grandTotalBase = roundMoney(si.subtotalBase + si.taxTotalBase);
        si.outstandingAmountBase = roundMoney(si.grandTotalBase - si.paidAmountBase);
        si.appliedPromotions = appliedPromotions.length > 0 ? appliedPromotions : undefined;
      }
    }

    await this.salesInvoiceRepo.create(si, transaction);
    await this.settingsRepo.saveSettings(settings, transaction);

    if (this.recordChangeService && actor) {
      await this.recordChangeService.recordCreate({
        companyId: si.companyId,
        entityType: 'SALES_INVOICE',
        entityId: si.id,
        entityNumber: si.invoiceNumber ? `SI-${si.invoiceNumber}` : undefined,
        userId: actor.userId,
        userEmail: actor.userEmail,
        snapshot: si.toJSON(),
      });
    }

    return { salesInvoice: si, creditCheck: creditCheckOutcome };
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
  private readonly voucherValidationService = new VoucherValidationService();

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
    private readonly ledgerRepo?: ILedgerRepository,
    private readonly postingLogRepo?: IPostingLogRepository,
    private readonly recordChangeService?: RecordChangeService
  ) {
    this.accountingPostingService = accountingPostingService;
    this.accountRepo = accountRepo;
  }

  async execute(
    companyId: string,
    idOrSI: string | SalesInvoice,
    createAccountingEffect: boolean = true,
    externalTransaction?: any,
    settlementInput?: SettlementInput,
    periodLockOverride?: { reason: string; overriddenBy: string },
    actor?: { userId: string; userEmail?: string; lockedThroughDate?: string },
    approvalContext?: { approvedBy: string }
  ): Promise<SalesInvoice> {
    // ===================================================================
    // FIRESTORE TRANSACTION RULE: All reads must complete before any writes.
    // We pre-fetch ALL data here. The postingLogic callback only writes.
    // ===================================================================

    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales module not initialized');
    const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(invSettings);

    const shouldPostAccounting = createAccountingEffect;
    if (shouldPostAccounting && !(await this.isAccountingEngineReady(companyId))) {
      throw new AccountingEngineUnavailableError({
        companyId,
        reason: 'NOT_INITIALIZED',
        cause:
          'Sales Invoice posting requires the Accounting Engine to be initialized. ' +
          'Initialize Sales (which auto-initializes the Engine) or call InitializeAccountingUseCase first.',
      });
    }

    const si = typeof idOrSI === 'string'
      ? await this.salesInvoiceRepo.getById(companyId, idOrSI)
      : idOrSI;

    if (!si) throw new Error('Invalid sales invoice state');

    if (approvalContext && si.status === 'PENDING_APPROVAL') {
      si.status = 'DRAFT';
    }
    if (si.status !== 'DRAFT') throw new Error('Invalid sales invoice state');
    const id = si.id;

    const customer = await this.partyRepo.getById(companyId, si.customerId);
    if (!customer) throw new Error(`Customer not found: ${si.customerId}`);

    let so: SalesOrder | null = null;
    if (si.salesOrderId) {
      so = await this.salesOrderRepo.getById(companyId, si.salesOrderId);
    }

    // PHASE 1A: PRE-FETCH ALL MASTER DATA (bare reads — before transaction)
    const distinctItemIds = [...new Set(si.lines.map(l => l.itemId))];
    const distinctTaxCodeIds = [
      ...new Set([
        ...si.lines.filter((l) => l.taxCodeId).map((l) => l.taxCodeId as string),
        ...(si.charges || []).filter((c) => c.taxCodeId).map((c) => c.taxCodeId as string),
      ]),
    ];
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

        if (accountingMode === 'PERPETUAL' && invSettings?.allowDeferredCost !== true) {
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
        if (accountingMode === 'PERPETUAL' && invSettings?.allowDeferredCost !== true) {
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
    for (const charge of si.charges || []) {
      this.freezeChargeTaxSnapshotSync(charge, si.exchangeRate, charge.taxCodeId ? taxCodesMap.get(charge.taxCodeId) : undefined);
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

      const resolvedRevenueId = this.resolveRevenueAccountSync(companyId, item, categoriesMap, settings.defaultRevenueAccountId);
      if (shouldPostAccounting && line.lineTotalBase > 0 && (!resolvedRevenueId || !resolvedRevenueId.trim())) {
        throw new AccountMappingError({
          companyId,
          itemId: item.id,
          accountRole: 'revenue',
          fallbackChain: ['item.revenueAccountId', 'category.defaultRevenueAccountId', 'salesSettings.defaultRevenueAccountId'],
          lineNo: line.lineNo,
        });
      }
      const revenueId = await resolveAccountCached(resolvedRevenueId);
      let taxId: string | undefined;
      if (line.taxAmountBase > 0 && line.taxCodeId) {
        const sTaxCode = taxCodesMap.get(line.taxCodeId);
        if (sTaxCode?.salesTaxAccountId) {
          taxId = await resolveAccountCached(sTaxCode.salesTaxAccountId);
        } else if (shouldPostAccounting) {
          throw new AccountMappingError({
            companyId,
            itemId: item.id,
            accountRole: 'tax',
            fallbackChain: ['taxCode.salesTaxAccountId'],
            lineNo: line.lineNo,
            hint: `Tax code ${line.taxCodeId} has no salesTaxAccountId configured.`,
          });
        }
      }
      let cogsId: string | undefined;
      let inventoryId: string | undefined;
      let cogsStatus: 'POSTED' | 'SKIPPED_POSTED_AT_DN' | 'SKIPPED_SERVICE_ITEM' | 'SKIPPED_DEFERRED_POLICY' | 'SKIPPED_UNSETTLED_COST' | null = null;

      if (!line.trackInventory) {
        cogsStatus = 'SKIPPED_SERVICE_ITEM';
      } else if (!(line.lineCostBase! > 0)) {
        // Catches undefined, null, NaN, 0, and negative values — all mean
        // "no settled cost basis available for this line".
        if (shouldPostAccounting && invSettings?.allowDeferredCost !== true) {
          throw new UnsettledCostError({
            companyId,
            itemId: item.id,
            lineNo: line.lineNo,
          });
        }
        cogsStatus = 'SKIPPED_UNSETTLED_COST';
      } else {
        const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
        const matchedDeliveryLines = this.getMatchedDeliveryLines(line, soLine, postedDNs);
        const hasOperationalDelivery = matchedDeliveryLines.length > 0;
        if (DocumentPolicyResolver.shouldInvoiceRecognizeInventory(accountingMode, hasOperationalDelivery)) {
          const accounts = this.resolveCOGSAccountsSync(companyId, item, categoriesMap, invSettings?.defaultCOGSAccountId, invSettings?.defaultInventoryAssetAccountId);
          if (accounts) {
            cogsId = await resolveAccountCached(accounts.cogsAccountId);
            inventoryId = await resolveAccountCached(accounts.inventoryAccountId);
            cogsStatus = 'POSTED';
          } else if (shouldPostAccounting) {
            // Missing account mapping is NEVER a valid deferred-cost reason.
            throw new AccountMappingError({
              companyId,
              itemId: item.id,
              accountRole: 'cogs',
              fallbackChain: [
                'item.cogsAccountId',
                'category.defaultCogsAccountId',
                'inventorySettings.defaultCOGSAccountId',
              ],
              lineNo: line.lineNo,
              hint: 'Also requires an inventory asset account at one of the same levels.',
            });
          }
        } else {
          cogsStatus = 'SKIPPED_POSTED_AT_DN';
        }
      }
      line.cogsPostingStatus = cogsStatus;
      lineResolvedAccounts.set(line.lineId, { revenueId, taxId, cogsId, inventoryId });
    }
    const chargeResolvedAccounts = new Map<string, ResolvedChargeAccount>();
    for (const charge of si.charges || []) {
      const revenueId = await resolveAccountCached(charge.revenueAccountId || settings.defaultRevenueAccountId);
      let taxId: string | undefined;
      if ((charge.taxAmountBase || 0) > 0 && charge.taxCodeId) {
        const chargeTaxCode = taxCodesMap.get(charge.taxCodeId);
        if (chargeTaxCode?.salesTaxAccountId) {
          taxId = await resolveAccountCached(chargeTaxCode.salesTaxAccountId);
        }
      }
      chargeResolvedAccounts.set(charge.chargeId, { revenueId, taxId });
    }

    const arAccountId = this.resolveARAccount(customer, settings);
    const resolvedARId = await resolveAccountCached(arAccountId);
    const hasInvoiceDiscount = si.lines.some((line) =>
      (line.discountAmountBase || 0) > 0 ||
      (line.discountAmountDoc || 0) > 0 ||
      (line.discountValue || 0) > 0
    );
    const resolvedDiscountAccountId = hasInvoiceDiscount
      ? await resolveAccountCached(this.resolveSalesDiscountAccount(settings))
      : undefined;
    const settlementVoucherIds: string[] = [];
    const postingLogic = async (transaction: any) => {
      // --- Write inventory movements and stock levels ---
      for (const [lineId, { movement, updatedLevel }] of inventoryMovements) {
        await this.inventoryService.writeStockMovement(movement, transaction);
        await this.inventoryService.writeStockLevel(updatedLevel, transaction);
      }

      // --- Accumulate voucher lines using pre-resolved accounts ---
      const revenueCredits = new Map<string, VoucherAccumulatedLine>();
      const discountDebits = new Map<string, VoucherAccumulatedLine>();
      const chargeCredits: VoucherAccumulatedLine[] = [];
      const taxCredits = new Map<string, VoucherAccumulatedLine>();
      const cogsBucket = new Map<string, AccumulatedCOGS>();

      for (const line of si.lines) {
        const taxCode = line.taxCodeId ? taxCodesMap.get(line.taxCodeId) : null;
        this.freezeTaxSnapshotSync(line, si.exchangeRate, taxCode || undefined);

        const accounts = lineResolvedAccounts.get(line.lineId);
        if (accounts) {
          this.addToBucket(revenueCredits, accounts.revenueId, line.grossLineTotalBase, line.grossLineTotalDoc);
          if ((line.discountAmountBase || 0) > 0 && resolvedDiscountAccountId) {
            this.addToBucket(discountDebits, resolvedDiscountAccountId, line.discountAmountBase || 0, line.discountAmountDoc || 0);
          }
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
      for (const charge of si.charges || []) {
        this.freezeChargeTaxSnapshotSync(charge, si.exchangeRate, charge.taxCodeId ? taxCodesMap.get(charge.taxCodeId) : undefined);
        const accounts = chargeResolvedAccounts.get(charge.chargeId);
        if (!accounts) continue;
        chargeCredits.push({
          accountId: accounts.revenueId,
          side: 'Credit',
          baseAmount: roundMoney(charge.amountBase || 0),
          docAmount: roundMoney(charge.amountDoc || 0),
        });
        if ((charge.taxAmountBase || 0) > 0 && accounts.taxId) {
          this.addToBucket(taxCredits, accounts.taxId, charge.taxAmountBase || 0, charge.taxAmountDoc || 0);
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
          ...Array.from(discountDebits.values()).map((line) => ({ ...line, side: 'Debit' as const })),
          ...Array.from(revenueCredits.values()).map((line) => ({ ...line, side: 'Credit' as const })),
          ...chargeCredits,
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
              ...(periodLockOverride ? { periodLockOverride } : {}),
            },
            createdBy: si.createdBy,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: si.invoiceNumber,
            baseCurrencyOverride: (baseCurrency || si.currency || 'USD').toUpperCase(),
            approved: !!approvalContext,
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
                  ...(periodLockOverride ? { periodLockOverride } : {}),
                },
                createdBy: si.createdBy,
                postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
                reference: si.invoiceNumber,
                baseCurrencyOverride: (baseCurrency || si.currency || 'USD').toUpperCase(),
                approved: !!approvalContext,
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
        const ids = await this.processSettlementsInTransaction(
          companyId, si, settlementInput, settings, customer, baseCurrency, transaction
        );
        settlementVoucherIds.push(...ids);
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

    try {
      if (externalTransaction) {
        await postingLogic(externalTransaction);
      } else {
        await this.transactionManager.runTransaction(postingLogic);
      }
    } catch (err: any) {
      if (err instanceof PostingError && err.appError.code === 'APPROVAL_REQUIRED') {
        if (externalTransaction) {
          throw err;
        }
        await this.transactionManager.runTransaction(async (tx) => {
          const latestSi = await this.salesInvoiceRepo.getById(companyId, si.id);
          if (!latestSi) throw new Error('Sales invoice not found during parking');
          if (latestSi.status !== 'DRAFT') {
            throw new Error(`Cannot park sales invoice. Expected DRAFT, but current status is ${latestSi.status}`);
          }
          latestSi.status = 'PENDING_APPROVAL';
          latestSi.updatedAt = new Date();
          await this.salesInvoiceRepo.update(latestSi, tx);
        });
        si.status = 'PENDING_APPROVAL';
        si.updatedAt = new Date();
        return si;
      }
      throw err;
    }

    // PostingLog write runs AFTER the transaction commits — best-effort, must not
    // roll back the posting, and must not be subject to transaction retries (which
    // would emit duplicate logs with fresh UUIDs each attempt).
    if (this.postingLogRepo && shouldPostAccounting) {
      try {
        const voucherIds = [si.voucherId, si.cogsVoucherId, ...settlementVoucherIds].filter((v): v is string => !!v);
        const decisions: LineDecision[] = si.lines.map((ln) => {
          const resolved = lineResolvedAccounts.get(ln.lineId);
          const accounts: LineDecision['accounts'] = {};
          if (resolved?.revenueId) accounts.revenue = { resolvedId: resolved.revenueId, fallbackLevel: 'item' };
          if (resolved?.taxId) accounts.tax = { resolvedId: resolved.taxId, fallbackLevel: 'taxCode' };
          if (resolved?.cogsId) accounts.cogs = { resolvedId: resolved.cogsId, fallbackLevel: 'item' };
          if (resolved?.inventoryId) accounts.inventory = { resolvedId: resolved.inventoryId, fallbackLevel: 'item' };
          return {
            lineNo: ln.lineNo,
            itemId: ln.itemId,
            accounts,
            cogsPostingStatus: ln.cogsPostingStatus ?? null,
          };
        });
        const warnings: string[] = [];
        for (const ln of si.lines) {
          if (ln.cogsPostingStatus === 'SKIPPED_UNSETTLED_COST') {
            warnings.push(`Line ${ln.lineNo} (${ln.itemCode}): cost basis unsettled — COGS not posted at invoice time.`);
          }
        }
        const log = new PostingLog({
          id: nodeRandomUUID(),
          companyId,
          sourceModule: 'sales',
          sourceType: 'SALES_INVOICE',
          sourceId: si.id,
          sourceDocNumber: si.invoiceNumber,
          strategy: 'SalesInvoiceStrategy',
          voucherIds,
          decisions,
          warnings,
          postedAt: new Date(),
          postedBy: si.createdBy || 'SYSTEM',
        });
        await this.postingLogRepo.create(log);
      } catch (err: any) {
        // Best-effort: log loudly with detail so this isn't invisible in cloud logs.
        console.error(
          '[PostingLog] write failed for SalesInvoice',
          { siId: si.id, invoiceNumber: si.invoiceNumber, companyId, message: err?.message, stack: err?.stack }
        );
      }
    }

    const posted = (await this.salesInvoiceRepo.getById(companyId, id))!;

    if (this.recordChangeService && actor) {
      const entityNumber = posted.invoiceNumber ? `SI-${posted.invoiceNumber}` : undefined;
      await this.recordChangeService.recordPost({
        companyId,
        entityType: 'SALES_INVOICE',
        entityId: posted.id,
        entityNumber,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      if (periodLockOverride) {
        await this.recordChangeService.recordPeriodLockOverride({
          companyId,
          entityType: 'SALES_INVOICE',
          entityId: posted.id,
          entityNumber,
          userId: actor.userId,
          userEmail: actor.userEmail,
          reason: periodLockOverride.reason,
          lockedThroughDate: actor.lockedThroughDate,
        });
      }
    }

    return posted;
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
    const effectiveInclusive =
      line.priceIsInclusive !== undefined
        ? line.priceIsInclusive === true
        : tax?.priceIsInclusive === true;
    const amounts = calculateSalesInvoiceLineAmounts({
      invoicedQty: line.invoicedQty,
      unitPriceDoc: line.unitPriceDoc,
      exchangeRate: rate,
      taxRate: tax?.rate || 0,
      priceIsInclusive: effectiveInclusive,
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
    line.taxCode = tax?.code;
    line.taxRate = tax?.rate || 0;
    line.taxAmountDoc = amounts.taxAmountDoc;
    line.taxAmountBase = amounts.taxAmountBase;
  }

  private freezeChargeTaxSnapshotSync(charge: SalesInvoiceCharge, rate: number, tax?: TaxCode): void {
    const amounts = calculateSalesInvoiceChargeAmounts({
      amountDoc: charge.amountDoc,
      exchangeRate: rate,
      taxRate: tax?.rate || 0,
      taxAmountDoc: charge.taxAmountDoc,
    });
    charge.amountBase = amounts.amountBase;
    charge.taxCode = tax?.code;
    charge.taxRate = tax?.rate || 0;
    charge.taxAmountDoc = amounts.taxAmountDoc;
    charge.taxAmountBase = amounts.taxAmountBase;
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
    settings: SalesSettings,
    customer: Party,
    baseCurrency: string | null,
    transaction: any
  ): Promise<string[]> {
    const receiptVoucherIds: string[] = [];
    const { settlementMode, receivablePayableAccountId, settlements } = settlementInput;
    const now = new Date();

    if (!this.paymentHistoryRepo || !this.voucherRepo || !this.voucherSequenceRepo || !this.ledgerRepo) {
      throw new Error('Payment settlement requires payment history, voucher, sequence, and ledger repositories');
    }

    const effectiveReceivablePayableAccountId = receivablePayableAccountId?.trim() || this.resolveARAccount(customer, settings);
    const resolvedReceivablePayableAccountId = await this.resolveAccountId(companyId, effectiveReceivablePayableAccountId);

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
        if (s.amountBase <= 0 || Number.isNaN(s.amountBase)) {
          throw new Error('Each settlement row amount must be positive');
        }
        if (s.paymentMethod && !VALID_PAYMENT_METHODS.includes(s.paymentMethod)) {
          throw new Error(`Invalid paymentMethod: ${s.paymentMethod}`);
        }
        const effectiveSettlementAccountId = s.settlementAccountId?.trim() || resolvePaymentMethodAccount(settings, s.paymentMethod);
        if (!effectiveSettlementAccountId) {
          throw new Error('Each settlement row requires a settlementAccountId or configured paymentMethod mapping');
        }
      }
    }

    const baseCurrencyUpper = (baseCurrency || si.currency || 'USD').toUpperCase();

    for (const settlement of settlements) {
      const settlementAmountBase = roundMoney(settlement.amountBase);
      const settlementDate = settlement.paymentDate || now.toISOString().split('T')[0];
      const settlementMethod = settlement.paymentMethod || 'CASH';
      const effectiveSettlementAccountId =
        settlement.settlementAccountId?.trim() || resolvePaymentMethodAccount(settings, settlementMethod);
      if (!effectiveSettlementAccountId) {
        throw new Error(`No settlement account configured for payment method ${settlementMethod}`);
      }
      const resolvedSettlementAccountId = await this.resolveAccountId(companyId, effectiveSettlementAccountId);

      const voucherNo = await this.voucherSequenceRepo!.getNextNumber(companyId, 'RV');
      const voucherId = `vch_${randomUUID()}`;

      const docAmount = roundMoney(settlementAmountBase / si.exchangeRate);

      const drLine = new VoucherLineEntity(
        1,
        resolvedSettlementAccountId,
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
        resolvedReceivablePayableAccountId,
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

      if (this.accountRepo) {
        await this.voucherValidationService.validateAccounts(postedVoucher, this.accountRepo);
      }

      // Single sanctioned ledger door. This system-generated settlement receipt is policy-exempt
      // (Stage 4b will fold settlement postings into the policy set).
      const gateway = new PostingGateway(this.ledgerRepo!, this.voucherValidationService);
      await gateway.record(
        postedVoucher,
        {
          userId: si.createdBy,
          enforcePolicies: false,
          exemptionReason: 'system-generated settlement receipt for Sales Invoice (Stage 4b)',
        },
        transaction
      );
      await this.voucherRepo!.save(postedVoucher, transaction);
      receiptVoucherIds.push(voucherId);

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

    return receiptVoucherIds;
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

  private resolveSalesDiscountAccount(settings: SalesSettings): string {
    if (settings.defaultSalesExpenseAccountId) return settings.defaultSalesExpenseAccountId;
    throw new Error('Default sales expense account is required when a sales invoice contains discounts.');
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

  private async isAccountingEngineReady(companyId: string): Promise<boolean> {
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
    const totals = calculateSalesInvoiceTotals(si.lines, si.charges || []);
    si.subtotalDoc = totals.subtotalDoc;
    si.taxTotalDoc = totals.taxTotalDoc;
    si.grandTotalDoc = totals.grandTotalDoc;
    si.subtotalBase = totals.subtotalBase;
    si.taxTotalBase = totals.taxTotalBase;
    si.grandTotalBase = totals.grandTotalBase;
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
      throw new UnsettledCostError({
        companyId: '',
        itemId: itemName,
        hint: `Missing positive inventory cost for ${itemName} on ${documentLabel}. Receive stock first to establish a cost basis, or enable "Allow Deferred Cost Posting" in Inventory Settings.`,
      });
    }
  }

}
export class CreateAndPostSalesInvoiceUseCase {
  constructor(
    private readonly createUseCase: CreateSalesInvoiceUseCase,
    private readonly postUseCase: PostSalesInvoiceUseCase
  ) {}

  async execute(input: CreateSalesInvoiceInput, settlementInput?: SettlementInput, periodLockOverride?: { reason: string; overriddenBy: string }, actor?: { userId: string; userEmail?: string; lockedThroughDate?: string }): Promise<SalesInvoice> {
    const { salesInvoice: si } = await this.createUseCase.execute(input, undefined, actor);
    return this.postUseCase.execute(input.companyId, si.id, true, undefined, settlementInput, periodLockOverride, actor);
  }
}

export class UpdateAndPostSalesInvoiceUseCase {
  constructor(
    private readonly updateUseCase: UpdateSalesInvoiceUseCase,
    private readonly postUseCase: PostSalesInvoiceUseCase
  ) {}

  async execute(input: UpdateSalesInvoiceInput, settlementInput?: SettlementInput, periodLockOverride?: { reason: string; overriddenBy: string }, actor?: { userId: string; userEmail?: string; lockedThroughDate?: string }): Promise<SalesInvoice> {
    const si = await this.updateUseCase.execute(input, undefined, actor);
    return this.postUseCase.execute(input.companyId, si.id, true, undefined, settlementInput, periodLockOverride, actor);
  }
}

export class ApproveSalesInvoiceUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly postUseCase: PostSalesInvoiceUseCase
  ) {}

  async execute(
    companyId: string,
    id: string,
    actor: { userId: string; userEmail?: string; lockedThroughDate?: string },
    settlementInput?: SettlementInput,
    periodLockOverride?: { reason: string; overriddenBy: string }
  ): Promise<SalesInvoice> {
    const si = await this.salesInvoiceRepo.getById(companyId, id);
    if (!si) throw new Error(`Sales invoice not found: ${id}`);
    if (si.status !== 'PENDING_APPROVAL') {
      throw new Error('Only sales invoices pending approval can be approved');
    }
    // Re-enter the post flow with approvalContext set. This bypasses the
    // approval gate and runs the full, real post (ledger + stock + settlement)
    // exactly as a normal post would — nothing about posting is duplicated.
    return this.postUseCase.execute(
      companyId,
      si,
      true,
      undefined,
      settlementInput,
      periodLockOverride,
      actor,
      { approvedBy: actor.userId }
    );
  }
}

export class UpdateSalesInvoiceUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly recordChangeService?: RecordChangeService,
    private readonly itemRepo?: IItemRepository
  ) {}

  async execute(input: UpdateSalesInvoiceInput, transaction?: unknown, actor?: { userId: string; userEmail?: string }): Promise<SalesInvoice> {
    const current = await this.salesInvoiceRepo.getById(input.companyId, input.id);
    if (!current) throw ApiError.notFound(`Sales invoice not found: ${input.id}`);
    if (current.status !== 'DRAFT') {
      throw new Error('Only draft sales invoices can be updated');
    }

    const before = current.toJSON();

    if (input.customerId) {
      const customer = await this.partyRepo.getById(input.companyId, input.customerId);
      if (!customer) throw new Error(`Customer not found: ${input.customerId}`);
      if (!customer.roles.includes('CUSTOMER')) {
        throw new Error(`Party is not a customer: ${input.customerId}`);
      }
      current.customerId = customer.id;
      current.customerName = customer.displayName;
    }

    if (input.salespersonId !== undefined) current.salespersonId = input.salespersonId || undefined;
    if (input.customerInvoiceNumber !== undefined) current.customerInvoiceNumber = input.customerInvoiceNumber;
    if (input.invoiceDate !== undefined) current.invoiceDate = input.invoiceDate;
    if (input.dueDate !== undefined) current.dueDate = input.dueDate;
    if (input.currency !== undefined) current.currency = input.currency.toUpperCase();
    if (input.exchangeRate !== undefined) current.exchangeRate = input.exchangeRate;
    if (input.notes !== undefined) current.notes = input.notes;

    if (input.lines) {
      const existingById = new Map(current.lines.map((line) => [line.lineId, line]));

      // Pre-fetch any items referenced by lines that are NEW (no matching
      // existing line). Carrying forward existing itemCode/itemName works for
      // edits of pre-existing lines; new lines need fresh master-data lookup.
      const newItemIds = Array.from(new Set(
        input.lines
          .filter((line) => !line.lineId || !existingById.has(line.lineId!))
          .map((line) => line.itemId)
          .filter((id): id is string => !!id)
      ));
      const itemById = new Map<string, { code: string; name: string; trackInventory: boolean }>();
      if (this.itemRepo && newItemIds.length > 0) {
        await Promise.all(newItemIds.map(async (iid) => {
          const item = await this.itemRepo!.getItem(iid);
          if (item) itemById.set(iid, { code: item.code, name: item.name, trackInventory: item.trackInventory });
        }));
      }

      const mappedLines: SalesInvoiceLine[] = input.lines.map((line, index) => {
        const existing = line.lineId ? existingById.get(line.lineId) : undefined;
        const itemId = line.itemId || existing?.itemId;
        if (!itemId) {
          throw new Error(`Line ${index + 1}: itemId is required`);
        }
        const lookedUp = itemById.get(itemId);

        return {
          lineId: line.lineId || randomUUID(),
          lineNo: line.lineNo ?? existing?.lineNo ?? index + 1,
          soLineId: line.soLineId ?? existing?.soLineId,
          dnLineId: line.dnLineId ?? existing?.dnLineId,
          itemId,
          itemCode: existing?.itemCode || lookedUp?.code || '',
          itemName: existing?.itemName || lookedUp?.name || '',
          trackInventory: existing?.trackInventory ?? lookedUp?.trackInventory ?? false,
          invoicedQty: line.invoicedQty,
          uomId: line.uomId ?? existing?.uomId,
          uom: line.uom || existing?.uom || 'EA',
          unitPriceDoc: line.unitPriceDoc ?? existing?.unitPriceDoc ?? 0,
          grossLineTotalDoc: existing?.grossLineTotalDoc ?? existing?.lineTotalDoc ?? 0,
          discountType: line.discountType ?? existing?.discountType,
          discountValue: line.discountValue ?? existing?.discountValue,
          discountAmountDoc: line.discountAmountDoc ?? existing?.discountAmountDoc,
          lineTotalDoc: existing?.lineTotalDoc ?? 0,
          unitPriceBase: existing?.unitPriceBase ?? 0,
          grossLineTotalBase: existing?.grossLineTotalBase ?? existing?.lineTotalBase ?? 0,
          discountAmountBase: existing?.discountAmountBase,
          lineTotalBase: existing?.lineTotalBase ?? 0,
          taxCodeId: line.taxCodeId ?? existing?.taxCodeId,
          taxCode: existing?.taxCode,
          taxRate: existing?.taxRate ?? 0,
          priceIsInclusive: line.priceIsInclusive ?? existing?.priceIsInclusive,
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

    if (input.charges) {
      const existingById = new Map((current.charges || []).map((charge) => [charge.chargeId, charge]));
      current.charges = input.charges.map((charge, index) => {
        const existing = charge.chargeId ? existingById.get(charge.chargeId) : undefined;
        return {
          chargeId: charge.chargeId || randomUUID(),
          code: charge.code ?? existing?.code,
          name: charge.name ?? existing?.name ?? `Charge ${index + 1}`,
          amountDoc: charge.amountDoc ?? existing?.amountDoc ?? 0,
          amountBase: existing?.amountBase,
          taxCodeId: charge.taxCodeId ?? existing?.taxCodeId,
          taxCode: existing?.taxCode,
          taxRate: existing?.taxRate ?? 0,
          taxAmountDoc: existing?.taxAmountDoc ?? 0,
          taxAmountBase: existing?.taxAmountBase ?? 0,
          revenueAccountId: charge.revenueAccountId ?? existing?.revenueAccountId,
          description: charge.description ?? existing?.description,
        };
      });
    }

    current.updatedAt = new Date();
    const updated = new SalesInvoice(current.toJSON() as any);
    await this.salesInvoiceRepo.update(updated, transaction);

    if (this.recordChangeService && actor) {
      const after = updated.toJSON();
      await this.recordChangeService.recordUpdate({
        companyId: input.companyId,
        entityType: 'SALES_INVOICE',
        entityId: updated.id,
        entityNumber: updated.invoiceNumber ? `SI-${updated.invoiceNumber}` : undefined,
        userId: actor.userId,
        userEmail: actor.userEmail,
        before: before as Record<string, any>,
        after: after as Record<string, any>,
      });
    }

    return updated;
  }
}

export class GetSalesInvoiceUseCase {
  constructor(private readonly salesInvoiceRepo: ISalesInvoiceRepository) {}

  async execute(companyId: string, id: string): Promise<SalesInvoice> {
    const si = await this.salesInvoiceRepo.getById(companyId, id);
    if (!si) throw ApiError.notFound(`Sales invoice not found: ${id}`);
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

export class GetInvoiceableLinkedSalesSourceUseCase {
  constructor(
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly deliveryNoteRepo: IDeliveryNoteRepository,
    private readonly salesInvoiceRepo: ISalesInvoiceRepository
  ) {}

  async execute(companyId: string, salesOrderId: string): Promise<InvoiceableLinkedSalesSource> {
    const so = await this.salesOrderRepo.getById(companyId, salesOrderId);
    if (!so) throw new Error(`Sales order not found: ${salesOrderId}`);
    if (so.status === 'CANCELLED') {
      throw new Error(`Sales order is cancelled: ${salesOrderId}`);
    }

    const [postedDNs, postedSIs] = await Promise.all([
      this.deliveryNoteRepo.list(companyId, { salesOrderId, status: 'POSTED', limit: 500 }),
      this.salesInvoiceRepo.list(companyId, { salesOrderId, status: 'POSTED', limit: 500 }),
    ]);

    const postedQtyByDnLineId = new Map<string, number>();
    for (const si of postedSIs) {
      for (const line of si.lines) {
        if (!line.dnLineId) continue;
        postedQtyByDnLineId.set(
          line.dnLineId,
          roundMoney((postedQtyByDnLineId.get(line.dnLineId) || 0) + line.invoicedQty)
        );
      }
    }

    const lines: InvoiceableLinkedSalesLine[] = [];

    for (const dn of postedDNs) {
      for (const dnLine of dn.lines) {
        const soLine = dnLine.soLineId
          ? so.lines.find((candidate) => candidate.lineId === dnLine.soLineId)
          : so.lines.find((candidate) => candidate.itemId === dnLine.itemId && candidate.trackInventory);
        if (!soLine || !soLine.trackInventory) continue;

        const alreadyInvoicedQty = postedQtyByDnLineId.get(dnLine.lineId) || 0;
        const remainingQty = roundMoney(Math.max(dnLine.deliveredQty - alreadyInvoicedQty, 0));
        if (remainingQty <= 0) continue;

        lines.push({
          sourceType: 'DELIVERY_NOTE',
          deliveryNoteId: dn.id,
          deliveryNoteNumber: dn.dnNumber,
          deliveryDate: dn.deliveryDate,
          soLineId: soLine.lineId,
          dnLineId: dnLine.lineId,
          itemId: dnLine.itemId,
          itemCode: dnLine.itemCode || soLine.itemCode,
          itemName: dnLine.itemName || soLine.itemName,
          trackInventory: true,
          remainingQty,
          uomId: dnLine.uomId || soLine.uomId,
          uom: dnLine.uom || soLine.uom,
          unitPriceDoc: soLine.unitPriceDoc,
          taxCodeId: soLine.taxCodeId,
          warehouseId: dn.warehouseId,
          description: dnLine.description || soLine.description,
        });
      }
    }

    for (const soLine of so.lines) {
      if (soLine.trackInventory) continue;
      const remainingQty = roundMoney(Math.max(soLine.orderedQty - soLine.invoicedQty, 0));
      if (remainingQty <= 0) continue;

      lines.push({
        sourceType: 'SALES_ORDER',
        soLineId: soLine.lineId,
        itemId: soLine.itemId,
        itemCode: soLine.itemCode,
        itemName: soLine.itemName,
        trackInventory: false,
        remainingQty,
        uomId: soLine.uomId,
        uom: soLine.uom,
        unitPriceDoc: soLine.unitPriceDoc,
        taxCodeId: soLine.taxCodeId,
        warehouseId: undefined,
        description: soLine.description,
      });
    }

    return {
      salesOrderId: so.id,
      customerId: so.customerId,
      customerName: so.customerName,
      currency: so.currency,
      exchangeRate: so.exchangeRate,
      lines,
    };
  }
}
