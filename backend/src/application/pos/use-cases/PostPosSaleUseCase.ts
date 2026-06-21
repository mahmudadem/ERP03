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
import { IAccountingBridge, IInventoryCore, ITaxEngine } from '../../system-core';
import { PosPaymentMethod } from '../../../domain/pos/entities/PosPayment';
import { PosPaymentMethodConfig } from '../../../domain/pos/entities/PosSettings';

export interface PostPosSaleLineInput {
  itemId: string;
  qty: number;
  unitPrice: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
  warehouseId: string;
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
    private readonly taxEngine: ITaxEngine
  ) {}

  async execute(input: PostPosSaleInput): Promise<PostPosSaleResult> {
    if (!input.lines.length) throw new Error('POS sale must contain at least one line.');

    const [customer, invSettings, baseCurrencyRaw] = await Promise.all([
      this.partyRepo.getById(input.companyId, input.customerId),
      this.inventorySettingsRepo.getSettings(input.companyId),
      this.companyCurrencyRepo.getBaseCurrency(input.companyId),
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
    const postedLines: PostedPosSaleLine[] = [];
    const revenueCredits = new Map<string, number>();
    const taxCredits = new Map<string, number>();
    const cogsDebits = new Map<string, number>();
    const inventoryCredits = new Map<string, number>();

    for (const [idx, sourceLine] of input.lines.entries()) {
      const item = await this.itemRepo.getItem(sourceLine.itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${sourceLine.itemId}`);
      }

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
      if (item.trackInventory && !input.dryRun) {
        const movement = await this.inventoryCore.processOUT({
          companyId: input.companyId,
          itemId: item.id,
          warehouseId: sourceLine.warehouseId,
          qty: sourceLine.qty,
          date: input.date,
          movementType: 'SALES_DELIVERY',
          refs: { type: 'SALES_INVOICE', docId: documentId, lineId },
          currentUser: input.createdBy,
          transaction: input.transaction,
          metadata: { sourceModule: 'pos', documentPersona: 'POS_DIRECT_SALE' },
        });
        stockMovementId = movement.id;
        unitCostBase = roundMoney(movement.unitCostBase || 0, baseCurrency);
        lineCostBase = roundMoney(movement.totalCostBase || unitCostBase * sourceLine.qty, baseCurrency);

        const cogsAccounts = this.resolveCogsAccounts(item, categoryMap, invSettings);
        if (lineCostBase > 0 && cogsAccounts) {
          cogsAccountId = cogsAccounts.cogsAccountId;
          inventoryAccountId = cogsAccounts.inventoryAccountId;
          addToBucket(cogsDebits, cogsAccounts.cogsAccountId, lineCostBase, baseCurrency);
          addToBucket(inventoryCredits, cogsAccounts.inventoryAccountId, lineCostBase, baseCurrency);
        }
      }

      const revenueAccountId = this.resolveRevenueAccount(item, categoryMap);
      if (!revenueAccountId) {
        throw new Error(`No revenue account configured for item ${item.code}`);
      }
      addToBucket(revenueCredits, revenueAccountId, taxAmounts.lineTotalBase, baseCurrency);
      if (netDiscountBase > 0) {
        // POS 250d keeps line-discount accounting conservative: net revenue is
        // posted, matching POS receipt totals without adding a Sales-settings dependency.
      }
      if (taxAmounts.taxAmountBase > 0) {
        if (!tax.salesTaxAccountId) {
          throw new Error(`Tax code ${tax.code || tax.id} has no Sales Tax Account configured.`);
        }
        addToBucket(taxCredits, tax.salesTaxAccountId, taxAmounts.taxAmountBase, baseCurrency);
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
        taxAmount: taxAmounts.taxAmountBase,
        unitCostBase,
        lineCostBase,
        stockMovementId,
        revenueAccountId,
        taxAccountId: taxAmounts.taxAmountBase > 0 ? tax.salesTaxAccountId : undefined,
        cogsAccountId,
        inventoryAccountId,
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
    if (revenueVoucher?.id) voucherIds.push(revenueVoucher.id);

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
      if (cogsVoucher?.id) voucherIds.push(cogsVoucher.id);
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
          lines: [
            { accountId, side: 'Debit', baseAmount: amount, docAmount: amount, notes: `POS ${payment.method} receipt` },
            { accountId: arAccountId, side: 'Credit', baseAmount: amount, docAmount: amount, notes: `POS settlement ${input.documentNumber}` },
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
      if (receiptVoucher?.id) voucherIds.push(receiptVoucher.id);
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

  private resolveRevenueAccount(item: Item, categories: Map<string, any>): string | undefined {
    if (item.revenueAccountId) return item.revenueAccountId;
    const category = item.categoryId ? categories.get(item.categoryId) : undefined;
    return category?.defaultRevenueAccountId;
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
