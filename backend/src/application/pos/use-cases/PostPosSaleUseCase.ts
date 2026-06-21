import { randomUUID } from 'crypto';
import { VoucherType, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { Item } from '../../../domain/inventory/entities/Item';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting';
import { IAccountingBridge, IInventoryCore } from '../../system-core';
import { PosPaymentMethod } from '../../../domain/pos/entities/PosPayment';
import { PosPaymentMethodConfig } from '../../../domain/pos/entities/PosSettings';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

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
    private readonly accountingBridge: IAccountingBridge
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
      const amounts = calculateLineAmounts({
        qty: sourceLine.qty,
        unitPrice: sourceLine.unitPrice,
        taxRate: tax.rate,
        priceIsInclusive: tax.priceIsInclusive,
        discountType: sourceLine.discountType,
        discountValue: sourceLine.discountValue,
      });

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
        unitCostBase = round2(movement.unitCostBase || 0);
        lineCostBase = round2(movement.totalCostBase || unitCostBase * sourceLine.qty);

        const cogsAccounts = this.resolveCogsAccounts(item, categoryMap, invSettings);
        if (lineCostBase > 0 && cogsAccounts) {
          cogsAccountId = cogsAccounts.cogsAccountId;
          inventoryAccountId = cogsAccounts.inventoryAccountId;
          addToBucket(cogsDebits, cogsAccounts.cogsAccountId, lineCostBase);
          addToBucket(inventoryCredits, cogsAccounts.inventoryAccountId, lineCostBase);
        }
      }

      const revenueAccountId = this.resolveRevenueAccount(item, categoryMap);
      if (!revenueAccountId) {
        throw new Error(`No revenue account configured for item ${item.code}`);
      }
      addToBucket(revenueCredits, revenueAccountId, amounts.revenueBase);
      if (amounts.discountBase > 0) {
        // POS 250d keeps line-discount accounting conservative: net revenue is
        // posted, matching POS receipt totals without adding a Sales-settings dependency.
      }
      if (amounts.taxBase > 0) {
        if (!tax.salesTaxAccountId) {
          throw new Error(`Tax code ${tax.code || tax.id} has no Sales Tax Account configured.`);
        }
        addToBucket(taxCredits, tax.salesTaxAccountId, amounts.taxBase);
      }

      postedLines.push({
        lineId,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        qty: sourceLine.qty,
        uom: item.salesUom || item.baseUom,
        unitPrice: sourceLine.unitPrice,
        lineDiscount: amounts.discountBase,
        taxCodeId: tax.id,
        lineTotal: amounts.lineTotalBase,
        taxAmount: amounts.taxBase,
        unitCostBase,
        lineCostBase,
        stockMovementId,
        revenueAccountId,
        taxAccountId: amounts.taxBase > 0 ? tax.salesTaxAccountId : undefined,
        cogsAccountId,
        inventoryAccountId,
      });

      void idx;
    }

    const subtotal = round2(postedLines.reduce((s, l) => s + l.lineTotal, 0));
    const discountTotal = round2(postedLines.reduce((s, l) => s + l.lineDiscount, 0));
    const taxTotal = round2(postedLines.reduce((s, l) => s + l.taxAmount, 0));
    const grandTotal = round2(subtotal + taxTotal);
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
        lines: postedLines,
        voucherIds,
      };
    }

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
          { accountId: arAccountId, side: 'Debit', baseAmount: grandTotal, docAmount: grandTotal, notes: `AR - ${customer.displayName} - ${input.documentNumber}` },
          ...mapBucket(revenueCredits, 'Credit'),
          ...mapBucket(taxCredits, 'Credit'),
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
          lines: [...mapBucket(cogsDebits, 'Debit'), ...mapBucket(inventoryCredits, 'Credit')],
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
      const amount = round2(payment.amount);
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

function addToBucket(bucket: Map<string, number>, accountId: string, amount: number): void {
  bucket.set(accountId, round2((bucket.get(accountId) || 0) + amount));
}

function mapBucket(bucket: Map<string, number>, side: 'Debit' | 'Credit'): Array<Record<string, any>> {
  return Array.from(bucket.entries()).map(([accountId, amount]) => ({
    accountId,
    side,
    baseAmount: round2(amount),
    docAmount: round2(amount),
  }));
}

function calculateLineAmounts(input: {
  qty: number;
  unitPrice: number;
  taxRate: number;
  priceIsInclusive: boolean;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
}): { revenueBase: number; lineTotalBase: number; discountBase: number; taxBase: number } {
  const gross = round2(input.qty * input.unitPrice);
  const discount = input.discountType === 'PERCENT'
    ? round2(gross * ((input.discountValue || 0) / 100))
    : round2(input.discountValue || 0);
  const afterDiscount = round2(gross - discount);
  if (input.priceIsInclusive && input.taxRate > 0) {
    const lineTotalBase = round2(afterDiscount / (1 + input.taxRate));
    return {
      revenueBase: lineTotalBase,
      lineTotalBase,
      discountBase: round2(discount / (1 + input.taxRate)),
      taxBase: round2(afterDiscount - lineTotalBase),
    };
  }
  return {
    revenueBase: afterDiscount,
    lineTotalBase: afterDiscount,
    discountBase: discount,
    taxBase: round2(afterDiscount * input.taxRate),
  };
}
