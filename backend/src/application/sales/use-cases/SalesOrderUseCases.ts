import { roundMoney } from '../../system-core/money/roundMoney';
import { randomUUID } from 'crypto';
import { Item } from '../../../domain/inventory/entities/Item';
import { AppliedPromotionInfo } from '../../../domain/sales/entities/AppliedPromotion';
import { CreditOverride } from '../../../domain/sales/entities/CreditOverride';
import { SalesOrder, SalesOrderLine, SOItemType, SOStatus } from '../../../domain/sales/entities/SalesOrder';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { CreditLimitExceededError } from '../../../domain/sales/errors/CreditLimitExceededError';
import { SalesRuleError } from '../../../domain/sales/errors/SalesRuleError';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';
import { recordAuditCreate, recordAuditPeriodLockOverride, recordAuditPost, recordAuditUpdate } from '../../system-core/audit/auditEngineLegacyHelpers';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { ICreditOverrideRepository } from '../../../repository/interfaces/sales/ICreditOverrideRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { CreditCheckResult, CreditCheckService } from '../services/CreditCheckService';
import { PromotionApplicationService, PromotionEvalLine } from '../services/PromotionApplicationService';
import { IPromotionRuleRepository } from '../../../repository/interfaces/sales/IPromotionRuleRepository';


export const generateDocumentNumber = (
  settings: SalesSettings,
  docType: 'SO' | 'DN' | 'SI' | 'SR' | 'QT'
): string => {
  let prefix = '';
  let seq = 1;

  if (docType === 'SO') {
    prefix = settings.soNumberPrefix;
    seq = settings.soNumberNextSeq;
    settings.soNumberNextSeq += 1;
  } else if (docType === 'DN') {
    prefix = settings.dnNumberPrefix;
    seq = settings.dnNumberNextSeq;
    settings.dnNumberNextSeq += 1;
  } else if (docType === 'SI') {
    prefix = settings.siNumberPrefix;
    seq = settings.siNumberNextSeq;
    settings.siNumberNextSeq += 1;
  } else if (docType === 'QT') {
    prefix = settings.quoteNumberPrefix;
    seq = settings.quoteNumberNextSeq;
    settings.quoteNumberNextSeq += 1;
  } else {
    prefix = settings.srNumberPrefix;
    seq = settings.srNumberNextSeq;
    settings.srNumberNextSeq += 1;
  }

  return `${prefix}-${String(seq).padStart(5, '0')}`;
};

export const generateUniqueDocumentNumber = async (
  settings: SalesSettings,
  docType: 'SO' | 'DN' | 'SI' | 'SR' | 'QT',
  exists: (candidate: string) => Promise<boolean>
): Promise<string> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = generateDocumentNumber(settings, docType);
    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Unable to allocate a unique ${docType} document number`);
};

export interface SalesOrderLineInput {
  lineId?: string;
  lineNo?: number;
  itemId: string;
  orderedQty: number;
  uomId?: string;
  uom?: string;
  unitPriceDoc: number;
  /** Optional line-level trade discount. PERCENT applies to grossLineTotal,
   *  AMOUNT is a flat discount in document currency. */
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  /** When true, `unitPriceDoc` already includes tax. The entity splits the
   *  gross into net + tax so totals match the user's input expectation. */
  priceIsInclusive?: boolean;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
  /** Optional promotion marker. When set, this line is treated as user-confirmed
   *  (typically a free-goods line added by the frontend after the user clicked
   *  Apply on a previewed promotion suggestion). The server preserves it as-is
   *  and skips re-evaluation. */
  appliedPromotionId?: string;
  appliedPromotionName?: string;
  appliedDiscountPct?: number;
}

export interface CreateSalesOrderInput {
  companyId: string;
  customerId: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  promisedDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesOrderLineInput[];
  notes?: string;
  internalNotes?: string;
  /** Skip server-side auto promotion evaluation. The frontend uses this when
   *  the user has already previewed and decided per-rule which to apply. Lines
   *  carrying `appliedPromotionId` are preserved as-is. Defaults to false. */
  skipPromotions?: boolean;
  createdBy: string;
}

export interface UpdateSalesOrderInput {
  companyId: string;
  id: string;
  customerId?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  promisedDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: SalesOrderLineInput[];
  notes?: string;
  internalNotes?: string;
}

export interface ListSalesOrdersFilters {
  status?: SOStatus;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

const assertValidSalesTaxCode = (taxCode: TaxCode, taxCodeId: string): void => {
  if (!taxCode.active || (taxCode.scope !== 'SALES' && taxCode.scope !== 'BOTH')) {
    throw new Error(`Tax code is not valid for sales: ${taxCodeId}`);
  }
};

export class CreateSalesOrderUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly promotionRuleRepo?: IPromotionRuleRepository,
    private readonly auditEngine?: IAuditEngine,
  ) {}

  async execute(input: CreateSalesOrderInput, actor?: { userId: string; userEmail?: string }): Promise<SalesOrder> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Sales module is not initialized');

    const customer = await this.partyRepo.getById(input.companyId, input.customerId);
    this.assertCustomer(customer, input.customerId);

    const currencyEnabled = await this.companyCurrencyRepo.isEnabled(input.companyId, input.currency);
    if (!currencyEnabled) {
      throw new Error(`Currency is not enabled for company: ${input.currency}`);
    }

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error('Sales order must contain at least one line');
    }

    const lines: SalesOrderLine[] = [];
    for (let i = 0; i < input.lines.length; i += 1) {
      lines.push(await this.buildLine(input.companyId, input.lines[i], i, input.exchangeRate));
    }

    const now = new Date();
    const orderNumber = await generateUniqueDocumentNumber(
      settings,
      'SO',
      async (candidate) => !!(await this.salesOrderRepo.getByNumber(input.companyId, candidate))
    );
    const so = new SalesOrder({
      id: randomUUID(),
      companyId: input.companyId,
      orderNumber,
      customerId: customer!.id,
      customerName: customer!.displayName,
      orderDate: input.orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate,
      promisedDate: input.promisedDate,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      lines,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      status: 'DRAFT',
      notes: input.notes,
      internalNotes: input.internalNotes,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // --- Promotion evaluation ---
    // Skip if the caller explicitly opted out (user previewed and decided
    // per-rule on the frontend) or if any incoming line already carries an
    // applied-promotion marker (treat as user-driven choice).
    const userAlreadyDecided =
      input.skipPromotions === true ||
      so.lines.some((l) => (l as any).appliedPromotionId);

    if (this.promotionRuleRepo && !userAlreadyDecided) {
      const rules = await this.promotionRuleRepo.list(input.companyId);
      if (rules.length > 0) {
        const promotionService = new PromotionApplicationService();

        // Build category map for promotion evaluation
        const itemCategoryMap = new Map<string, string | undefined>();
        for (const line of so.lines) {
          if (!itemCategoryMap.has(line.itemId)) {
            const item = await this.itemRepo.getItem(line.itemId);
            if (item) itemCategoryMap.set(item.id, item.categoryId);
          }
        }

        const evalLines: PromotionEvalLine[] = so.lines.map((l) => ({
          lineId: l.lineId,
          itemId: l.itemId,
          categoryId: itemCategoryMap.get(l.itemId),
          qty: l.orderedQty,
          unitPriceDoc: l.unitPriceDoc,
          lineAmountDoc: l.lineTotalDoc,
          hasManualDiscount: false, // SO lines have no manual discount concept
        }));

        const promoResult = promotionService.evaluate(evalLines, rules, input.orderDate);

        const appliedPromotions: AppliedPromotionInfo[] = [];

        // Apply line discounts
        for (const discount of promoResult.lineDiscounts) {
          const lineIndex = so.lines.findIndex((l) => l.lineId === discount.lineId);
          if (lineIndex < 0) continue;
          const line = so.lines[lineIndex];
          const discountAmtDoc = roundMoney(line.lineTotalDoc * discount.discountPct / 100);
          const discountAmtBase = roundMoney(line.lineTotalBase * discount.discountPct / 100);
          so.lines[lineIndex] = {
            ...line,
            appliedPromotionId: discount.ruleId,
            appliedPromotionName: discount.ruleName,
            appliedDiscountPct: discount.discountPct,
            lineTotalDoc: roundMoney(line.lineTotalDoc - discountAmtDoc),
            lineTotalBase: roundMoney(line.lineTotalBase - discountAmtBase),
            taxAmountDoc: roundMoney((line.lineTotalDoc - discountAmtDoc) * line.taxRate),
            taxAmountBase: roundMoney((line.lineTotalBase - discountAmtBase) * line.taxRate),
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
          const sourceLine = so.lines.find((l) => l.lineId === freeGood.sourceLineId);
          so.lines.push({
            lineId: randomUUID(),
            lineNo: so.lines.length + 1,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            itemType: item.type as SOItemType,
            trackInventory: item.trackInventory,
            orderedQty: freeGood.qty,
            uomId: item.salesUomId || item.baseUomId,
            uom: item.salesUom || item.baseUom,
            deliveredQty: 0,
            invoicedQty: 0,
            returnedQty: 0,
            unitPriceDoc: 0,
            lineTotalDoc: 0,
            unitPriceBase: 0,
            lineTotalBase: 0,
            taxCodeId: sourceLine?.taxCodeId,
            taxRate: 0,
            taxAmountDoc: 0,
            taxAmountBase: 0,
            warehouseId: sourceLine?.warehouseId,
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

        // Recompute SO totals from all (potentially modified) lines
        so.subtotalDoc = roundMoney(so.lines.reduce((sum, l) => sum + l.lineTotalDoc, 0));
        so.taxTotalDoc = roundMoney(so.lines.reduce((sum, l) => sum + l.taxAmountDoc, 0));
        so.grandTotalDoc = roundMoney(so.subtotalDoc + so.taxTotalDoc);
        so.subtotalBase = roundMoney(so.lines.reduce((sum, l) => sum + l.lineTotalBase, 0));
        so.taxTotalBase = roundMoney(so.lines.reduce((sum, l) => sum + l.taxAmountBase, 0));
        so.grandTotalBase = roundMoney(so.subtotalBase + so.taxTotalBase);
        so.appliedPromotions = appliedPromotions.length > 0 ? appliedPromotions : undefined;
      }
    }

    await this.salesOrderRepo.create(so);
    await this.settingsRepo.saveSettings(settings);

    if (this.auditEngine && actor) {
      await recordAuditCreate(this.auditEngine, {
        companyId: so.companyId,
        entityType: 'SALES_ORDER',
        entityId: so.id,
        entityNumber: `SO-${so.orderNumber}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
        snapshot: so.toJSON(),
      });
    }

    return so;
  }

  private assertCustomer(customer: Party | null, customerId: string): void {
    if (!customer) throw new Error(`Customer not found: ${customerId}`);
    if (!customer.roles.includes('CUSTOMER')) {
      throw new Error(`Party is not a customer: ${customerId}`);
    }
  }

  private async buildLine(
    companyId: string,
    lineInput: SalesOrderLineInput,
    index: number,
    exchangeRate: number
  ): Promise<SalesOrderLine> {
    const item = await this.itemRepo.getItem(lineInput.itemId);
    if (!item) throw new Error(`Item not found: ${lineInput.itemId}`);

    let taxCodeId = lineInput.taxCodeId;
    let taxRate = 0;

    if (!taxCodeId && item.defaultSalesTaxCodeId) {
      const defaultTaxCode = await this.taxCodeRepo.getById(companyId, item.defaultSalesTaxCodeId);
      if (defaultTaxCode && defaultTaxCode.active && (defaultTaxCode.scope === 'SALES' || defaultTaxCode.scope === 'BOTH')) {
        taxCodeId = defaultTaxCode.id;
        taxRate = defaultTaxCode.rate;
      }
    } else if (taxCodeId) {
      const selectedTaxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
      if (!selectedTaxCode) throw new Error(`Tax code not found: ${taxCodeId}`);
      assertValidSalesTaxCode(selectedTaxCode, taxCodeId);
      taxRate = selectedTaxCode.rate;
    }

    // Pre-totals here are illustrative; the SalesOrder constructor recomputes
    // via normalizeLine, which is the source of truth for inclusive/exclusive
    // splits. We forward `priceIsInclusive` so the entity sees it.
    const lineTotalDoc = roundMoney(lineInput.orderedQty * lineInput.unitPriceDoc);
    const unitPriceBase = roundMoney(lineInput.unitPriceDoc * exchangeRate);
    const lineTotalBase = roundMoney(lineTotalDoc * exchangeRate);
    const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
    const taxAmountBase = roundMoney(lineTotalBase * taxRate);

    return {
      lineId: lineInput.lineId || randomUUID(),
      lineNo: lineInput.lineNo ?? index + 1,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      itemType: item.type,
      trackInventory: item.trackInventory,
      orderedQty: lineInput.orderedQty,
      uomId: lineInput.uomId || item.salesUomId || item.baseUomId,
      uom: lineInput.uom || item.salesUom || item.baseUom,
      deliveredQty: 0,
      invoicedQty: 0,
      returnedQty: 0,
      unitPriceDoc: lineInput.unitPriceDoc,
      // Discount forwarded; entity recomputes gross/discount/lineTotal/tax.
      discountType: lineInput.discountType,
      discountValue: lineInput.discountValue,
      lineTotalDoc,
      unitPriceBase,
      lineTotalBase,
      taxCodeId,
      taxRate,
      priceIsInclusive: lineInput.priceIsInclusive === true,
      taxAmountDoc,
      taxAmountBase,
      warehouseId: lineInput.warehouseId,
      description: lineInput.description,
      appliedPromotionId: lineInput.appliedPromotionId,
      appliedPromotionName: lineInput.appliedPromotionName,
      appliedDiscountPct: lineInput.appliedDiscountPct,
    } as SalesOrderLine;
  }
}

export class UpdateSalesOrderUseCase {
  constructor(
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly auditEngine?: IAuditEngine
  ) {}

  async execute(input: UpdateSalesOrderInput, actor?: { userId: string; userEmail?: string }): Promise<SalesOrder> {
    const current = await this.salesOrderRepo.getById(input.companyId, input.id);
    if (!current) throw new Error(`Sales order not found: ${input.id}`);
    if (current.status !== 'DRAFT') {
      throw new SalesRuleError('SALES_ORDER_INVALID_STATE', 'Only draft sales orders can be updated', {
        fieldHints: ['status'],
      });
    }

    const before = current.toJSON();

    const customer = await this.partyRepo.getById(input.companyId, input.customerId || current.customerId);
    if (!customer) throw new Error(`Customer not found: ${input.customerId || current.customerId}`);
    if (!customer.roles.includes('CUSTOMER')) {
      throw new Error(`Party is not a customer: ${customer.id}`);
    }

    const exchangeRate = input.exchangeRate ?? current.exchangeRate;
    const rawLines: SalesOrderLineInput[] = input.lines
      ? input.lines
      : current.lines.map((line) => ({
          lineId: line.lineId,
          lineNo: line.lineNo,
          itemId: line.itemId,
          orderedQty: line.orderedQty,
          uomId: line.uomId,
          uom: line.uom,
          unitPriceDoc: line.unitPriceDoc,
          priceIsInclusive: line.priceIsInclusive,
          taxCodeId: line.taxCodeId,
          warehouseId: line.warehouseId,
          description: line.description,
        }));

    const currentLineById = new Map(current.lines.map((line) => [line.lineId, line]));
    const lines: SalesOrderLine[] = [];
    for (let i = 0; i < rawLines.length; i += 1) {
      lines.push(await this.buildLine(input.companyId, rawLines[i], i, exchangeRate, currentLineById.get(rawLines[i].lineId || '')));
    }

    const updated = new SalesOrder({
      id: current.id,
      companyId: current.companyId,
      orderNumber: current.orderNumber,
      customerId: customer.id,
      customerName: customer.displayName,
      orderDate: input.orderDate ?? current.orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate ?? current.expectedDeliveryDate,
      promisedDate: input.promisedDate ?? current.promisedDate,
      currency: input.currency ?? current.currency,
      exchangeRate,
      lines,
      subtotalBase: 0,
      taxTotalBase: 0,
      grandTotalBase: 0,
      subtotalDoc: 0,
      taxTotalDoc: 0,
      grandTotalDoc: 0,
      status: current.status,
      notes: input.notes ?? current.notes,
      internalNotes: input.internalNotes ?? current.internalNotes,
      createdBy: current.createdBy,
      createdAt: current.createdAt,
      updatedAt: new Date(),
      confirmedAt: current.confirmedAt,
      closedAt: current.closedAt,
    });

    await this.salesOrderRepo.update(updated);

    if (this.auditEngine && actor) {
      const after = updated.toJSON();
      await recordAuditUpdate(this.auditEngine, {
        companyId: input.companyId,
        entityType: 'SALES_ORDER',
        entityId: updated.id,
        entityNumber: updated.orderNumber ? `SO-${updated.orderNumber}` : undefined,
        userId: actor.userId,
        userEmail: actor.userEmail,
        before: before as Record<string, any>,
        after: after as Record<string, any>,
      });
    }

    return updated;
  }

  private async buildLine(
    companyId: string,
    lineInput: SalesOrderLineInput,
    index: number,
    exchangeRate: number,
    currentLine?: SalesOrderLine
  ): Promise<SalesOrderLine> {
    const item = await this.itemRepo.getItem(lineInput.itemId);
    if (!item) throw new Error(`Item not found: ${lineInput.itemId}`);

    let taxRate = 0;
    if (lineInput.taxCodeId) {
      const taxCode = await this.taxCodeRepo.getById(companyId, lineInput.taxCodeId);
      if (!taxCode) throw new Error(`Tax code not found: ${lineInput.taxCodeId}`);
      assertValidSalesTaxCode(taxCode, lineInput.taxCodeId);
      taxRate = taxCode.rate;
    }

    const lineTotalDoc = roundMoney(lineInput.orderedQty * lineInput.unitPriceDoc);
    const unitPriceBase = roundMoney(lineInput.unitPriceDoc * exchangeRate);
    const lineTotalBase = roundMoney(lineTotalDoc * exchangeRate);
    const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
    const taxAmountBase = roundMoney(lineTotalBase * taxRate);
    const priceIsInclusive =
      lineInput.priceIsInclusive !== undefined
        ? lineInput.priceIsInclusive === true
        : currentLine?.priceIsInclusive === true;

    return {
      lineId: lineInput.lineId || currentLine?.lineId || randomUUID(),
      lineNo: lineInput.lineNo ?? currentLine?.lineNo ?? index + 1,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      itemType: item.type,
      trackInventory: item.trackInventory,
      orderedQty: lineInput.orderedQty,
      uomId: lineInput.uomId || currentLine?.uomId || item.salesUomId || item.baseUomId,
      uom: lineInput.uom || item.salesUom || item.baseUom,
      deliveredQty: currentLine?.deliveredQty ?? 0,
      invoicedQty: currentLine?.invoicedQty ?? 0,
      returnedQty: currentLine?.returnedQty ?? 0,
      unitPriceDoc: lineInput.unitPriceDoc,
      discountType: lineInput.discountType ?? currentLine?.discountType,
      discountValue: lineInput.discountValue ?? currentLine?.discountValue,
      lineTotalDoc,
      unitPriceBase,
      lineTotalBase,
      taxCodeId: lineInput.taxCodeId,
      taxRate,
      priceIsInclusive,
      taxAmountDoc,
      taxAmountBase,
      warehouseId: lineInput.warehouseId,
      description: lineInput.description,
    };
  }
}

export interface ConfirmSalesOrderResult {
  salesOrder: SalesOrder;
  creditCheck: CreditCheckResult & { outcome: 'OK' | 'WARN' | 'OVERRIDDEN' };
}

export class ConfirmSalesOrderUseCase {
  constructor(
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly creditCheckService: CreditCheckService,
    private readonly creditOverrideRepo: ICreditOverrideRepository
  ) {}

  async execute(
    companyId: string,
    id: string,
    options?: { override?: { reason: string; userId: string } }
  ): Promise<ConfirmSalesOrderResult> {
    // --- existing guards ---
    const so = await this.salesOrderRepo.getById(companyId, id);
    if (!so) throw new Error(`Sales order not found: ${id}`);
    if (so.status !== 'DRAFT') {
      throw new SalesRuleError('SALES_ORDER_INVALID_STATE', 'Only draft sales orders can be confirmed', {
        fieldHints: ['status'],
      });
    }
    if (!so.lines.length) throw new Error('Sales order must contain at least one line');

    // --- credit check ---
    let creditCheckWithOutcome: CreditCheckResult & { outcome: 'OK' | 'WARN' | 'OVERRIDDEN' };

    const party = await this.partyRepo.getById(companyId, so.customerId).catch(() => null);

    if (!party) {
      // Customer not found — proceed without enforcement
      creditCheckWithOutcome = {
        enforced: false,
        creditLimit: 0,
        currentExposure: 0,
        orderAmount: so.grandTotalBase,
        projectedExposure: so.grandTotalBase,
        withinLimit: true,
        policy: 'NONE',
        outcome: 'OK',
      };
    } else {
      const creditCheck = await this.creditCheckService.check(companyId, party, so.grandTotalBase);

      const overLimit = creditCheck.enforced && !creditCheck.withinLimit;

      if (!overLimit || creditCheck.policy === 'NONE') {
        // Under limit, or limit not enforced, or policy NONE — confirm without fuss
        creditCheckWithOutcome = { ...creditCheck, outcome: 'OK' };
      } else if (creditCheck.policy === 'WARN') {
        // Over limit but only warn — confirm, surface the warning to the caller
        creditCheckWithOutcome = { ...creditCheck, outcome: 'WARN' };
      } else {
        // policy === 'BLOCK'
        if (!options?.override) {
          throw new CreditLimitExceededError({
            customerId: so.customerId,
            creditLimit: creditCheck.creditLimit,
            currentExposure: creditCheck.currentExposure,
            orderAmount: creditCheck.orderAmount,
            projectedExposure: creditCheck.projectedExposure,
          });
        }

        // Override provided — persist an audit record and confirm
        const overrideRecord = new CreditOverride({
          companyId,
          customerId: so.customerId,
          sourceType: 'SALES_ORDER',
          sourceId: so.id,
          sourceNumber: so.orderNumber,
          creditLimit: creditCheck.creditLimit,
          currentExposure: creditCheck.currentExposure,
          orderAmount: creditCheck.orderAmount,
          projectedExposure: creditCheck.projectedExposure,
          reason: options.override.reason,
          overriddenBy: options.override.userId,
          overriddenAt: new Date(),
        });
        await this.creditOverrideRepo.create(overrideRecord);

        creditCheckWithOutcome = { ...creditCheck, outcome: 'OVERRIDDEN' };
      }
    }

    // --- confirm ---
    so.status = 'CONFIRMED';
    so.confirmedAt = new Date();
    so.updatedAt = new Date();

    await this.salesOrderRepo.update(so);

    return { salesOrder: so, creditCheck: creditCheckWithOutcome };
  }
}

export class CancelSalesOrderUseCase {
  constructor(private readonly salesOrderRepo: ISalesOrderRepository) {}

  async execute(companyId: string, id: string): Promise<SalesOrder> {
    const so = await this.salesOrderRepo.getById(companyId, id);
    if (!so) throw new Error(`Sales order not found: ${id}`);
    if (!['DRAFT', 'CONFIRMED'].includes(so.status)) {
      throw new SalesRuleError('SALES_ORDER_INVALID_STATE', 'Only draft or confirmed sales orders can be cancelled', {
        fieldHints: ['status'],
      });
    }

    const hasLinkedActivity = so.lines.some((line) => line.deliveredQty > 0 || line.invoicedQty > 0);
    if (hasLinkedActivity) {
      throw new SalesRuleError(
        'SALES_ORDER_INVALID_STATE',
        'Cannot cancel sales order with delivered or invoiced quantities',
        { fieldHints: ['status'] }
      );
    }

    so.status = 'CANCELLED';
    so.updatedAt = new Date();
    await this.salesOrderRepo.update(so);
    return so;
  }
}

export class CloseSalesOrderUseCase {
  constructor(private readonly salesOrderRepo: ISalesOrderRepository) {}

  async execute(companyId: string, id: string): Promise<SalesOrder> {
    const so = await this.salesOrderRepo.getById(companyId, id);
    if (!so) throw new Error(`Sales order not found: ${id}`);
    if (!['CONFIRMED', 'PARTIALLY_DELIVERED', 'FULLY_DELIVERED'].includes(so.status)) {
      throw new SalesRuleError('SALES_ORDER_INVALID_STATE', 'Only confirmed or delivered sales orders can be closed', {
        fieldHints: ['status'],
      });
    }

    so.status = 'CLOSED';
    so.closedAt = new Date();
    so.updatedAt = new Date();
    await this.salesOrderRepo.update(so);
    return so;
  }
}

export class GetSalesOrderUseCase {
  constructor(private readonly salesOrderRepo: ISalesOrderRepository) {}

  async execute(companyId: string, id: string): Promise<SalesOrder> {
    const so = await this.salesOrderRepo.getById(companyId, id);
    if (!so) throw new Error(`Sales order not found: ${id}`);
    return so;
  }
}

export class ListSalesOrdersUseCase {
  constructor(private readonly salesOrderRepo: ISalesOrderRepository) {}

  async execute(companyId: string, filters: ListSalesOrdersFilters = {}): Promise<SalesOrder[]> {
    const usesDateFilter = Boolean(filters.dateFrom || filters.dateTo);
    const orders = await this.salesOrderRepo.list(companyId, {
      status: filters.status,
      customerId: filters.customerId,
      limit: usesDateFilter ? undefined : filters.limit,
      offset: usesDateFilter ? undefined : filters.offset,
    });

    if (!usesDateFilter) return orders;

    const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const to = filters.dateTo ? new Date(filters.dateTo) : null;
    const filtered = orders.filter((order) => {
      const date = new Date(order.orderDate);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });

    const offset = Math.max(0, filters.offset || 0);
    const sliced = filtered.slice(offset);
    if (!filters.limit || filters.limit < 0) return sliced;
    return sliced.slice(0, filters.limit);
  }
}
