import { roundMoney } from '../../system-core/money/roundMoney';
import { randomUUID } from 'crypto';
import { VoucherType, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { Item } from '../../../domain/inventory/entities/Item';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting';
import { IAccountingBridge, ICommercialCore, IInventoryCore, ITaxEngine, arePromotionsEnabledInProduction } from '../../system-core';
import { PosPaymentMethod } from '../../../domain/pos/entities/PosPayment';
import { PosPaymentMethodConfig, PosNegativeStockPolicy } from '../../../domain/pos/entities/PosSettings';
import { CommercialPromotionRule } from '../../system-core/contracts/ICommercialCore';
import { PosNegativeStockError } from '../../../domain/pos/errors/PosNegativeStockError';
import { NegativeStockError } from '../../../domain/inventory/errors/NegativeStockError';
import { AccountMappingError } from '../../../domain/accounting/errors/AccountMappingError';
import { IPosSettingsRepository } from '../../../repository/interfaces/pos/IPosSettingsRepository';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import {
  cloneStockLevel,
  computeStockOutMovement,
  createStockLevel,
} from '../../inventory/contracts/InventoryIntegrationContracts';
import {
  buildAverageCostPoint,
  buildUpdatedItemCostingStats,
} from '../../inventory/services/ItemCostingStatsService';

export interface PostPosSaleLineInput {
  itemId: string;
  qty: number;
  unitPrice: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
  manualTaxAmount?: number;
  warehouseId: string;
  approvedCostMarginOverride?: boolean;
  appliedPromotionId?: string;
  appliedPromotionName?: string;
}

interface PromotionRuleReader {
  list(companyId: string): Promise<CommercialPromotionRule[]>;
}

export interface PostPosSalePaymentInput {
  method: PosPaymentMethod;
  amount: number;
  reference?: string;
}

export interface PostPosSaleInput {
  companyId: string;
  customerId: string;
  documentId?: string;
  documentNumber: string;
  date: string;
  lines: PostPosSaleLineInput[];
  payments: PostPosSalePaymentInput[];
  paymentMethods: PosPaymentMethodConfig[];
  cashRoundingAdjustmentBase?: number;
  cashRoundingAccountId?: string;
  /**
   * POS-specific negative-stock policy. `BLOCK` (the safe default applied by the
   * caller) refuses any line that would drive on-hand below zero, independent of
   * the company `allowNegativeStock` flag. `ALLOW` (or undefined) defers to the
   * company flag enforced inside the inventory OUT.
   */
  negativeStockPolicy?: PosNegativeStockPolicy;
  notes?: string;
  createdBy: string;
  transaction?: unknown;
  dryRun?: boolean;
}

export interface PostedPosSaleLine {
  lineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  uom: string;
  unitPrice: number;
  lineDiscount: number;
  taxCodeId?: string;
  lineTotal: number;
  taxAmount: number;
  unitCostBase: number;
  lineCostBase: number;
  stockMovementId?: string;
  revenueAccountId?: string;
  taxAccountId?: string;
  cogsAccountId?: string;
  inventoryAccountId?: string;
  appliedPromotionId?: string;
  appliedPromotionName?: string;
}

export interface PostPosSaleResult {
  documentId: string;
  documentNumber: string;
  customerName?: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  roundedGrandTotal: number;
  cashRoundingAdjustmentBase: number;
  currency: string;
  lines: PostedPosSaleLine[];
  voucherIds: string[];
}

export class PostPosSaleUseCase {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly itemCategoryRepo: IItemCategoryRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly inventoryCore: IInventoryCore,
    private readonly accountingBridge: IAccountingBridge,
    private readonly taxEngine: ITaxEngine,
    private readonly posSettingsRepo: IPosSettingsRepository,
    private readonly commercialCore?: ICommercialCore,
    private readonly promotionRuleReader?: PromotionRuleReader
  ) {}

  async execute(input: PostPosSaleInput): Promise<PostPosSaleResult> {
    if (!input.lines.length) throw new Error('POS sale must contain at least one line.');

    const [customer, invSettings, baseCurrencyRaw, posSettings] = await Promise.all([
      this.partyRepo.getById(input.companyId, input.customerId),
      this.inventorySettingsRepo.getSettings(input.companyId),
      this.companyCurrencyRepo.getBaseCurrency(input.companyId),
      this.posSettingsRepo.getSettings(input.companyId),
    ]);
    if (!customer) throw new Error(`Customer not found: ${input.customerId}`);

    const baseCurrency = (baseCurrencyRaw || 'USD').toUpperCase();
    const arAccountId = customer.defaultARAccountId;
    if (!arAccountId) {
      throw new Error(`Customer ${customer.displayName} has no AR account configured.`);
    }

    const categories = await this.itemCategoryRepo.getCompanyCategories(input.companyId);
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const documentId = input.documentId || `pos_sale_${randomUUID()}`;
    const itemMap = new Map<string, Item>();
    for (const line of input.lines) {
      if (itemMap.has(line.itemId)) continue;
      const item = await this.itemRepo.getItem(line.itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${line.itemId}`);
      }
      assertItemAllowedForPosSale(item, input.date);
      itemMap.set(item.id, item);
    }
    const saleLines = await this.applyPromotions(input, itemMap);
    await this.assertNegativeStockAllowed(input, saleLines, itemMap, invSettings);
    const postedLines: PostedPosSaleLine[] = [];
    const revenueCredits = new Map<string, number>();
    const taxCredits = new Map<string, number>();
    const cogsDebits = new Map<string, number>();
    const inventoryCredits = new Map<string, number>();

    // POS posts inside a Firestore transaction, and Firestore forbids any read
    // after the first write in a transaction. So — exactly like the Sales invoice
    // path — we pre-fetch stock levels with bare (non-transactional) reads up
    // front, compute every OUT movement with the pure `computeStockOutMovement`
    // helper (mutating an in-memory level that is threaded across lines of the
    // same item/warehouse), and defer the actual writes to a write-only phase
    // after the compute loop. This keeps the whole transaction read-free.
    const computeInventory = !input.dryRun;
    const costingBasis: 'GLOBAL' | 'WAREHOUSE' = invSettings?.costingBasis === 'GLOBAL' ? 'GLOBAL' : 'WAREHOUSE';
    const stockLevelMap = new Map<string, StockLevel>();
    const levelsByItemMap = new Map<string, StockLevel[]>();
    const stockMovements: StockMovement[] = [];
    const itemCostingStatsUpdates = new Map<string, { costingStats: Item['costingStats']; updatedAt: Date }>();
    if (computeInventory) {
      for (const item of itemMap.values()) {
        if (!item.trackInventory) continue;
        const existingLevels = await this.inventoryCore.preFetchLevelsByItem(input.companyId, item.id);
        levelsByItemMap.set(item.id, existingLevels.map(cloneStockLevel));
      }
    }

    for (const [idx, sourceLine] of saleLines.entries()) {
      const item = itemMap.get(sourceLine.itemId);
      if (!item) throw new Error(`Item not found: ${sourceLine.itemId}`);
      assertLineDiscountAllowedForPosSale(item, sourceLine);

      const tax = await this.resolveTax(input.companyId, sourceLine.taxCodeId || item.defaultSalesTaxCodeId);
      const taxAmounts = this.taxEngine.calcLine({
        quantity: sourceLine.qty,
        unitPriceDoc: sourceLine.unitPrice,
        exchangeRate: 1,
        taxRate: tax.rate,
        priceIsInclusive: tax.priceIsInclusive,
        discountType: sourceLine.discountType,
        discountValue: sourceLine.discountValue,
        currency: baseCurrency,
      });
      const taxAmountBase = sourceLine.manualTaxAmount === undefined
        ? taxAmounts.taxAmountBase
        : roundMoney(Math.max(0, Number(sourceLine.manualTaxAmount) || 0), baseCurrency);

      const netDiscountBase = roundMoney(
        taxAmounts.grossLineTotalBase - taxAmounts.lineTotalBase - taxAmounts.taxAmountBase,
        baseCurrency,
      );

      const lineId = `pos_line_${randomUUID()}`;
      let stockMovementId: string | undefined;
      let unitCostBase = 0;
      let lineCostBase = 0;
      let cogsAccountId: string | undefined;
      let inventoryAccountId: string | undefined;
      if (item.trackInventory && computeInventory) {
        const warehouseId = sourceLine.warehouseId;
        const stockLevelKey = `${item.id}|${warehouseId}`;
        let level = stockLevelMap.get(stockLevelKey);
        if (!level) {
          const itemLevels = levelsByItemMap.get(item.id) || [];
          level = itemLevels.find((l) => l.warehouseId === warehouseId);
          if (!level) {
            level = createStockLevel(input.companyId, item.id, warehouseId);
            itemLevels.push(level);
            levelsByItemMap.set(item.id, itemLevels);
          }
          stockLevelMap.set(stockLevelKey, level);
        }

        // Pure compute (no I/O): mutates `level` in place so repeated lines of
        // the same item/warehouse thread the running balance correctly.
        const { movement, unitCostBase: outUnitCostBase, lineCostBase: outLineCostBase } = computeStockOutMovement({
          companyId: input.companyId,
          item,
          level,
          warehouseId,
          qtyInBaseUom: sourceLine.qty,
          date: input.date,
          createdBy: input.createdBy,
          movementType: 'SALES_DELIVERY',
          referenceType: 'POS_DIRECT_SALE',
          referenceId: documentId,
          referenceLineId: lineId,
          costSource: 'PURCHASE',
          metadata: { sourceModule: 'pos', documentPersona: 'POS_DIRECT_SALE' },
        });
        stockMovements.push(movement);
        stockMovementId = movement.id;
        unitCostBase = roundMoney(outUnitCostBase || 0, baseCurrency);
        lineCostBase = roundMoney(outLineCostBase || unitCostBase * sourceLine.qty, baseCurrency);

        // Recompute item costing stats from the (now-mutated) levels — mirrors the
        // Sales path so POS sales keep `item.costingStats` consistent. The last
        // line of an item wins, after every decrement for that item is applied.
        const itemLevels = levelsByItemMap.get(item.id) || [];
        const avgCost = buildAverageCostPoint(itemLevels, item, baseCurrency, costingBasis, item.costingStats?.avgCost);
        const costingStats = buildUpdatedItemCostingStats(item, avgCost);
        item.costingStats = costingStats;
        itemCostingStatsUpdates.set(item.id, { costingStats, updatedAt: new Date() });

        const cogsAccounts = this.resolveCogsAccounts(item, categoryMap, invSettings);
        if (lineCostBase > 0 && cogsAccounts) {
          cogsAccountId = cogsAccounts.cogsAccountId;
          inventoryAccountId = cogsAccounts.inventoryAccountId;
          addToBucket(cogsDebits, cogsAccounts.cogsAccountId, lineCostBase, baseCurrency);
          addToBucket(inventoryCredits, cogsAccounts.inventoryAccountId, lineCostBase, baseCurrency);
        }
      }

      if (this.commercialCore && unitCostBase > 0 && !(sourceLine.unitPrice === 0 && sourceLine.appliedPromotionId)) {
        const unitNetPriceBase = roundMoney(taxAmounts.lineTotalBase / sourceLine.qty, baseCurrency);
        const margin = await this.commercialCore.validateCostMargin({
          companyId: input.companyId,
          itemId: item.id,
          unitPriceBase: unitNetPriceBase,
          quantity: sourceLine.qty,
          unitCostBase,
          actorUserId: input.createdBy,
          approvedOverride: sourceLine.approvedCostMarginOverride === true,
          source: 'pos',
        });
        if (!margin.allowed) {
          throw new Error(`POS sale line ${item.code} is below allowed cost/margin and requires approval.`);
        }
      }

      const revenueAccountId = this.resolveRevenueAccount(item, categoryMap, posSettings?.defaultRevenueAccountId);
      if (!revenueAccountId) {
        throw new AccountMappingError({
          companyId: input.companyId,
          itemId: item.id,
          accountRole: 'revenue',
          fallbackChain: ['item.revenueAccountId', 'category.defaultRevenueAccountId', 'posSettings.defaultRevenueAccountId'],
          lineNo: idx + 1,
        });
      }
      addToBucket(revenueCredits, revenueAccountId, taxAmounts.lineTotalBase, baseCurrency);
      if (netDiscountBase > 0) {
        // POS 250d keeps line-discount accounting conservative: net revenue is
        // posted, matching POS receipt totals without adding a Sales-settings dependency.
      }
      if (taxAmountBase > 0) {
        if (!tax.salesTaxAccountId) {
          const taxLabel = tax.code || tax.id;
          const hint = tax.id
            ? `Tax code ${taxLabel} needs salesTaxAccountId configured.`
            : `This POS line has a tax amount but no active Sales tax code was resolved. Assign a default Sales Tax Code to item ${item.code || item.id}, or select an active Sales/Both tax code before posting.`;
          throw new AccountMappingError({
            companyId: input.companyId,
            itemId: item.id,
            accountRole: 'tax',
            fallbackChain: ['taxCode.salesTaxAccountId'],
            lineNo: idx + 1,
            hint,
          });
        }
        addToBucket(taxCredits, tax.salesTaxAccountId, taxAmountBase, baseCurrency);
      }

      postedLines.push({
        lineId,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        qty: sourceLine.qty,
        uom: item.salesUom || item.baseUom,
        unitPrice: sourceLine.unitPrice,
        lineDiscount: netDiscountBase,
        taxCodeId: tax.id,
        lineTotal: taxAmounts.lineTotalBase,
        taxAmount: taxAmountBase,
        unitCostBase,
        lineCostBase,
        stockMovementId,
        revenueAccountId,
        taxAccountId: taxAmountBase > 0 ? tax.salesTaxAccountId : undefined,
        cogsAccountId,
        inventoryAccountId,
        appliedPromotionId: sourceLine.appliedPromotionId,
        appliedPromotionName: sourceLine.appliedPromotionName,
      });

      void idx;
    }

    const subtotal = roundMoney(postedLines.reduce((s, l) => s + l.lineTotal, 0), baseCurrency);
    const discountTotal = roundMoney(postedLines.reduce((s, l) => s + l.lineDiscount, 0), baseCurrency);
    const taxTotal = roundMoney(postedLines.reduce((s, l) => s + l.taxAmount, 0), baseCurrency);
    const grandTotal = roundMoney(subtotal + taxTotal, baseCurrency);
    const cashRoundingAdjustmentBase = roundMoney(input.cashRoundingAdjustmentBase || 0, baseCurrency);
    const roundedGrandTotal = roundMoney(grandTotal + cashRoundingAdjustmentBase, baseCurrency);
    const voucherIds: string[] = [];

    if (input.dryRun) {
      return {
        documentId,
        documentNumber: input.documentNumber,
        customerName: customer.displayName,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        roundedGrandTotal: grandTotal,
        cashRoundingAdjustmentBase: 0,
        currency: baseCurrency,
        lines: postedLines,
        voucherIds,
      };
    }

    // ── Inventory write phase (write-only; safe inside the Firestore txn) ──
    // Every inventory read happened up front via bare reads, so emitting the
    // writes here never trips Firestore's "all reads before all writes" rule.
    for (const movement of stockMovements) {
      await this.inventoryCore.writeStockMovement(movement, input.transaction);
    }
    for (const level of stockLevelMap.values()) {
      await this.inventoryCore.writeStockLevel(level, input.transaction);
    }
    for (const [itemId, update] of itemCostingStatsUpdates) {
      await this.itemRepo.updateItemInTransaction(
        input.companyId,
        itemId,
        { costingStats: update.costingStats, updatedAt: update.updatedAt } as Partial<Item>,
        input.transaction
      );
    }

    const cashRoundingAccountId = input.cashRoundingAccountId?.trim();
    if (cashRoundingAdjustmentBase !== 0 && !cashRoundingAccountId) {
      throw new Error('POS cash rounding requires a configured rounding gain/loss account.');
    }

    const roundingVoucherLines =
      cashRoundingAdjustmentBase > 0
        ? [{
            accountId: cashRoundingAccountId,
            side: 'Credit' as const,
            baseAmount: cashRoundingAdjustmentBase,
            docAmount: cashRoundingAdjustmentBase,
            notes: `POS cash rounding gain ${input.documentNumber}`,
          }]
        : cashRoundingAdjustmentBase < 0
          ? [{
              accountId: cashRoundingAccountId,
              side: 'Debit' as const,
              baseAmount: Math.abs(cashRoundingAdjustmentBase),
              docAmount: Math.abs(cashRoundingAdjustmentBase),
              notes: `POS cash rounding loss ${input.documentNumber}`,
            }]
          : [];

    const revenueVoucher = await this.accountingBridge.recordFinancialEvent({
      kind: 'POS_SALE_REVENUE',
      transaction: input.transaction,
      subledgerVoucher: {
        companyId: input.companyId,
        voucherType: VoucherType.SALES_INVOICE,
        voucherNo: `POS-${input.documentNumber}`,
        date: input.date,
        description: `POS Sale ${input.documentNumber} - ${customer.displayName}`,
        currency: baseCurrency,
        exchangeRate: 1,
        lines: [
          { accountId: arAccountId, side: 'Debit', baseAmount: roundedGrandTotal, docAmount: roundedGrandTotal, notes: `AR - ${customer.displayName} - ${input.documentNumber}` },
          ...mapBucket(revenueCredits, 'Credit', baseCurrency),
          ...mapBucket(taxCredits, 'Credit', baseCurrency),
          ...roundingVoucherLines,
        ],
        metadata: {
          sourceModule: 'pos',
          sourceType: 'POS_SALE',
          sourceId: documentId,
          voucherPart: 'REVENUE',
          documentPersona: 'POS_DIRECT_SALE',
        },
        createdBy: input.createdBy,
        postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
        reference: input.documentNumber,
        baseCurrencyOverride: baseCurrency,
        approved: true,
      },
    });
    if (revenueVoucher.voucher?.id) voucherIds.push(revenueVoucher.voucher.id);

    if (cogsDebits.size && inventoryCredits.size) {
      const cogsVoucher = await this.accountingBridge.recordFinancialEvent({
        kind: 'POS_SALE_COGS',
        transaction: input.transaction,
        subledgerVoucher: {
          companyId: input.companyId,
          voucherType: VoucherType.SALES_INVOICE,
          voucherNo: `POS-COGS-${input.documentNumber}`,
          date: input.date,
          description: `POS Sale ${input.documentNumber} COGS`,
          currency: baseCurrency,
          exchangeRate: 1,
          lines: [...mapBucket(cogsDebits, 'Debit', baseCurrency), ...mapBucket(inventoryCredits, 'Credit', baseCurrency)],
          metadata: {
            sourceModule: 'pos',
            sourceType: 'POS_SALE',
            sourceId: documentId,
            voucherPart: 'COGS',
            documentPersona: 'POS_DIRECT_SALE',
          },
          createdBy: input.createdBy,
          postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
          reference: input.documentNumber,
          baseCurrencyOverride: baseCurrency,
          approved: true,
        },
      });
      if (cogsVoucher.voucher?.id) voucherIds.push(cogsVoucher.voucher.id);
    }

    for (const payment of input.payments) {
      const accountId = input.paymentMethods.find((m) => m.code === payment.method)?.settlementAccountId;
      const amount = roundMoney(payment.amount);
      if (amount <= 0) continue;
      const receiptVoucher = await this.accountingBridge.recordFinancialEvent({
        kind: 'POS_SALE_SETTLEMENT',
        transaction: input.transaction,
        subledgerVoucher: {
          companyId: input.companyId,
          voucherType: VoucherType.RECEIPT,
          voucherNo: `POS-RV-${input.documentNumber}-${voucherIds.length + 1}`,
          date: input.date,
          description: `Receipt for POS Sale ${input.documentNumber}`,
          currency: baseCurrency,
          exchangeRate: 1,
          // `amount` is required so ReceiptVoucherStrategy treats these as
          // canonical JV-style lines (side/accountId/amount) and posts them
          // verbatim; without it the strategy falls back to its
          // depositToAccountId/source builder and throws INFRA_999.
          lines: [
            { accountId, side: 'Debit', amount, baseAmount: amount, docAmount: amount, notes: `POS ${payment.method} receipt` },
            { accountId: arAccountId, side: 'Credit', amount, baseAmount: amount, docAmount: amount, notes: `POS settlement ${input.documentNumber}` },
          ],
          metadata: {
            sourceModule: 'pos',
            sourceType: 'POS_SALE',
            sourceId: documentId,
            settlementMethod: payment.method,
            documentPersona: 'POS_DIRECT_SALE',
          },
          createdBy: input.createdBy,
          postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
          reference: payment.reference || input.documentNumber,
          baseCurrencyOverride: baseCurrency,
          approved: true,
        },
      });
      if (receiptVoucher.voucher?.id) voucherIds.push(receiptVoucher.voucher.id);
    }

    return {
      documentId,
      documentNumber: input.documentNumber,
      customerName: customer.displayName,
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      roundedGrandTotal,
      cashRoundingAdjustmentBase,
      currency: baseCurrency,
      lines: postedLines,
      voucherIds,
    };
  }

  private async applyPromotions(
    input: PostPosSaleInput,
    itemMap: Map<string, Item>
  ): Promise<PostPosSaleLineInput[]> {
    // FUP-1 hard gate: promotions stay dormant in production until the
    // stacking/cap model lands, regardless of wired reader or stored rules.
    if (!arePromotionsEnabledInProduction()) return input.lines;
    if (!this.commercialCore || !this.promotionRuleReader) return input.lines;
    if (input.lines.some((line) => line.appliedPromotionId)) return input.lines;

    const rules = await this.promotionRuleReader.list(input.companyId);
    if (!rules.length) return input.lines;

    const lineIds = input.lines.map(() => `pos_eval_${randomUUID()}`);
    const result = this.commercialCore.applyPromotions({
      asOfDate: input.date,
      source: 'pos',
      rules,
      lines: input.lines.map((line, index) => {
        const item = itemMap.get(line.itemId);
        return {
          lineId: lineIds[index],
          itemId: line.itemId,
          categoryId: item?.categoryId,
          qty: line.qty,
          unitPriceDoc: line.unitPrice,
          lineAmountDoc: roundMoney(line.qty * line.unitPrice),
          hasManualDiscount: !!line.discountType || !!line.discountValue,
        };
      }),
    });

    const discountByLine = new Map(result.lineDiscounts.map((discount) => [discount.lineId, discount]));
    const promotedLines = input.lines.map((line, index) => {
      const discount = discountByLine.get(lineIds[index]);
      if (!discount) return line;
      return {
        ...line,
        discountType: 'PERCENT' as const,
        discountValue: discount.discountPct,
        appliedPromotionId: discount.ruleId,
        appliedPromotionName: discount.ruleName,
      };
    });

    for (const freeGood of result.freeGoods) {
      if (!itemMap.has(freeGood.itemId)) {
        const item = await this.itemRepo.getItem(freeGood.itemId);
        if (!item || item.companyId !== input.companyId) continue;
        assertItemAllowedForPosSale(item, input.date);
        itemMap.set(item.id, item);
      }
      const sourceIndex = lineIds.findIndex((id) => id === freeGood.sourceLineId);
      const sourceLine = sourceIndex >= 0 ? input.lines[sourceIndex] : input.lines[0];
      if (!sourceLine) continue;
      promotedLines.push({
        itemId: freeGood.itemId,
        qty: freeGood.qty,
        unitPrice: 0,
        taxCodeId: sourceLine.taxCodeId,
        warehouseId: sourceLine.warehouseId,
        appliedPromotionId: freeGood.ruleId,
        appliedPromotionName: freeGood.ruleName,
      });
    }

    return promotedLines;
  }

  /**
   * POS-specific negative-stock guard.
   *
   * Runs before any stock is moved (in dry-run preview AND the real post) so the
   * cashier is blocked at the terminal, not after tendering. When the policy is
   * `BLOCK`, POS refuses a sale that would drive a tracked item's on-hand below
   * zero in the selling warehouse — regardless of the company `allowNegativeStock`
   * flag. When the policy is `ALLOW` (or absent) POS adds no extra block and the
   * company flag still governs inside the inventory OUT.
   *
   * Quantities are aggregated per (item, warehouse) so multiple cart lines of the
   * same item (e.g. a manual line + a promotion free-good) are checked together.
   */
  private async assertNegativeStockAllowed(
    input: PostPosSaleInput,
    saleLines: PostPosSaleLineInput[],
    itemMap: Map<string, Item>,
    invSettings?: { allowNegativeStock?: boolean } | null
  ): Promise<void> {
    const posBlocks = input.negativeStockPolicy === 'BLOCK';
    // When POS does not block, the company-wide `allowNegativeStock` flag still
    // governs. That used to be enforced inside the inventory OUT
    // (RecordStockMovementUseCase.processOUT); now that POS computes movements
    // with the pure helper, POS re-asserts the company flag here so the Task 258
    // behaviour ("ALLOW defers to the company flag") is preserved.
    const companyBlocks = invSettings?.allowNegativeStock === false;
    if (!posBlocks && !companyBlocks) return;

    const requestedByKey = new Map<string, { itemId: string; warehouseId: string; qty: number }>();
    for (const line of saleLines) {
      const item = itemMap.get(line.itemId);
      if (!item || !item.trackInventory) continue;
      const key = `${line.itemId}::${line.warehouseId}`;
      const existing = requestedByKey.get(key);
      if (existing) {
        existing.qty += line.qty;
      } else {
        requestedByKey.set(key, { itemId: line.itemId, warehouseId: line.warehouseId, qty: line.qty });
      }
    }

    for (const { itemId, warehouseId, qty } of requestedByKey.values()) {
      const level = await this.inventoryCore.preFetchStockLevel(input.companyId, itemId, warehouseId);
      const qtyBefore = level?.qtyOnHand ?? 0;
      const resultingQty = qtyBefore - qty;
      // Tolerance guards against floating-point dust on fractional quantities.
      if (resultingQty < -1e-9) {
        const item = itemMap.get(itemId);
        const details = {
          companyId: input.companyId,
          itemId,
          warehouseId,
          qtyBefore,
          requested: qty,
          resultingQty,
          itemCode: item?.code,
          itemName: item?.name,
        };
        // POS BLOCK gets the POS-accurate message (points at POS Settings); a
        // company-flag block reuses the inventory-domain error (points at
        // Inventory Settings) — matching what processOUT used to throw.
        throw posBlocks ? new PosNegativeStockError(details) : new NegativeStockError(details);
      }
    }
  }

  private async resolveTax(companyId: string, taxCodeId?: string): Promise<{
    id?: string;
    code?: string;
    rate: number;
    priceIsInclusive: boolean;
    salesTaxAccountId?: string;
  }> {
    if (!taxCodeId) return { rate: 0, priceIsInclusive: false };
    const tax = await this.taxCodeRepo.getById(companyId, taxCodeId);
    if (!tax || !tax.active || (tax.scope !== 'SALES' && tax.scope !== 'BOTH')) {
      return { rate: 0, priceIsInclusive: false };
    }
    return {
      id: tax.id,
      code: tax.code,
      rate: tax.rate,
      priceIsInclusive: tax.priceIsInclusive === true,
      salesTaxAccountId: tax.salesTaxAccountId,
    };
  }

  private resolveRevenueAccount(item: Item, categories: Map<string, any>, posDefaultRevenueAccountId?: string): string | undefined {
    if (item.revenueAccountId) return item.revenueAccountId;
    const category = item.categoryId ? categories.get(item.categoryId) : undefined;
    if (category?.defaultRevenueAccountId) return category.defaultRevenueAccountId;
    return posDefaultRevenueAccountId;
  }

  private resolveCogsAccounts(item: Item, categories: Map<string, any>, invSettings: any): { cogsAccountId: string; inventoryAccountId: string } | null {
    const category = item.categoryId ? categories.get(item.categoryId) : undefined;
    const cogsAccountId = item.cogsAccountId || category?.defaultCogsAccountId || invSettings?.defaultCOGSAccountId;
    const inventoryAccountId = item.inventoryAssetAccountId || category?.defaultInventoryAssetAccountId || invSettings?.defaultInventoryAssetAccountId;
    return cogsAccountId && inventoryAccountId ? { cogsAccountId, inventoryAccountId } : null;
  }
}

function addToBucket(bucket: Map<string, number>, accountId: string, amount: number, currency = 'USD'): void {
  bucket.set(accountId, roundMoney((bucket.get(accountId) || 0) + amount, currency));
}

function mapBucket(bucket: Map<string, number>, side: 'Debit' | 'Credit', currency = 'USD'): Array<Record<string, any>> {
  return Array.from(bucket.entries()).map(([accountId, amount]) => ({
    accountId,
    side,
    baseAmount: roundMoney(amount, currency),
    docAmount: roundMoney(amount, currency),
  }));
}

function assertItemAllowedForPosSale(item: Item, saleDate: string): void {
  if (item.active === false) {
    throw new Error(`Item ${item.code || item.id} is inactive and cannot be sold in POS.`);
  }

  const metadata = item.metadata || {};
  const posMetadata = (metadata.pos || {}) as Record<string, unknown>;
  if (posMetadata.enabled === false || metadata.posEnabled === false || metadata.isPosEnabled === false) {
    throw new Error(`Item ${item.code || item.id} is not enabled for POS sale.`);
  }
  if (posMetadata.blocked === true || metadata.blockedInPos === true) {
    throw new Error(`Item ${item.code || item.id} is blocked for POS sale.`);
  }
  if (
    readBooleanFlag(posMetadata, ['requiresBatch', 'batchRequired', 'requiresLot', 'lotRequired'])
    || readBooleanFlag(metadata, ['requiresBatch', 'batchRequired', 'requiresLot', 'lotRequired'])
  ) {
    throw new Error(`Item ${item.code || item.id} requires batch/lot selection before it can be sold in POS.`);
  }
  if (
    readBooleanFlag(posMetadata, ['requiresSerial', 'serialRequired', 'serialized'])
    || readBooleanFlag(metadata, ['requiresSerial', 'serialRequired', 'serialized'])
  ) {
    throw new Error(`Item ${item.code || item.id} requires serial selection before it can be sold in POS.`);
  }

  const expiryDate = readFirstString(posMetadata, ['expiryDate', 'expirationDate', 'expiresOn'])
    || readFirstString(metadata, ['expiryDate', 'expirationDate', 'expiresOn']);
  const expiryTracked =
    readBooleanFlag(posMetadata, ['expiryTracked', 'expirationTracked', 'perishable'])
    || readBooleanFlag(metadata, ['expiryTracked', 'expirationTracked', 'perishable']);

  if (expiryTracked && !expiryDate) {
    throw new Error(`Item ${item.code || item.id} is expiry-tracked and cannot be sold in POS without a selected valid batch/expiry date.`);
  }
  if (expiryDate && isBusinessDateBefore(expiryDate, saleDate)) {
    throw new Error(`Item ${item.code || item.id} is expired and cannot be sold in POS.`);
  }
}

function assertLineDiscountAllowedForPosSale(item: Item, line: PostPosSaleLineInput): void {
  const metadata = item.metadata || {};
  const posMetadata = (metadata.pos || {}) as Record<string, unknown>;
  const discountable =
    posMetadata.discountable !== false &&
    metadata.discountable !== false &&
    metadata.nonDiscountable !== true;
  if (discountable) return;

  const hasManualDiscount = (line.discountValue || 0) > 0;
  const hasPromotionDiscount = Boolean(line.appliedPromotionId);
  if (hasManualDiscount || hasPromotionDiscount) {
    throw new Error(`Item ${item.code || item.id} is not discountable in POS.`);
  }
}

function readBooleanFlag(source: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => source[key] === true);
}

function readFirstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function isBusinessDateBefore(candidate: string, reference: string): boolean {
  const candidateDate = candidate.slice(0, 10);
  const referenceDate = reference.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidateDate) || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return false;
  }
  return candidateDate < referenceDate;
}
