import { randomUUID } from 'crypto';
import { VoucherType, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { PosReturnRefundMethod } from '../../../domain/pos/entities/PosReturn';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting';
import { IAccountingBridge, IInventoryCore } from '../../system-core';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PostPosReturnLineInput {
  itemId: string;
  qty: number;
}

export interface PostPosReturnInput {
  companyId: string;
  originalReceipt: PosReceipt;
  returnId?: string;
  returnNumber: string;
  registerId: string;
  warehouseId: string;
  date: string;
  lines: PostPosReturnLineInput[];
  refundMethod: PosReturnRefundMethod;
  settlementAccountId?: string;
  createdBy: string;
  transaction?: unknown;
}

export interface PostedPosReturnLine {
  itemId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  originalLineId?: string;
  taxAmount: number;
  lineCostBase: number;
}

export interface PostPosReturnResult {
  returnId: string;
  returnNumber: string;
  refundTotal: number;
  lines: PostedPosReturnLine[];
  voucherIds: string[];
}

export class PostPosReturnUseCase {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly itemCategoryRepo: IItemCategoryRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly inventoryCore: IInventoryCore,
    private readonly accountingBridge: IAccountingBridge
  ) {}

  async execute(input: PostPosReturnInput): Promise<PostPosReturnResult> {
    const returnId = input.returnId || `pos_ret_${randomUUID()}`;
    const baseCurrency = ((await this.companyCurrencyRepo.getBaseCurrency(input.companyId)) || 'USD').toUpperCase();
    const categories = await this.itemCategoryRepo.getCompanyCategories(input.companyId);
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const invSettings = await this.inventorySettingsRepo.getSettings(input.companyId);
    const customer = await this.partyRepo.getById(input.companyId, input.originalReceipt.customerId);
    if (!customer?.defaultARAccountId) {
      throw new Error(`Customer ${input.originalReceipt.customerId} has no AR account configured.`);
    }
    const revenueDebits = new Map<string, number>();
    const taxDebits = new Map<string, number>();
    const arCredits = new Map<string, number>();
    const inventoryDebits = new Map<string, number>();
    const cogsCredits = new Map<string, number>();
    const postedLines: PostedPosReturnLine[] = [];

    for (const sourceLine of input.lines) {
      const receiptLine = input.originalReceipt.lines.find((line) => line.itemId === sourceLine.itemId);
      if (!receiptLine) throw new Error(`No matching receipt line for item ${sourceLine.itemId}.`);
      const item = await this.itemRepo.getItem(sourceLine.itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${sourceLine.itemId}`);
      }

      const ratio = sourceLine.qty / Math.max(1, receiptLine.qty);
      const lineTotal = round2(receiptLine.lineTotal * ratio);
      const taxAmount = round2(((receiptLine as any).taxAmount || 0) * ratio);
      const lineCostBase = round2(((receiptLine as any).lineCostBase || 0) * ratio);
      const unitCostBase = round2((receiptLine as any).unitCostBase || (sourceLine.qty > 0 ? lineCostBase / sourceLine.qty : 0));

      if (item.trackInventory) {
        await this.inventoryCore.processIN({
          companyId: input.companyId,
          itemId: item.id,
          warehouseId: input.warehouseId,
          qty: sourceLine.qty,
          date: input.date,
          movementType: 'RETURN_IN',
          refs: { type: 'POS_RETURN', docId: returnId, lineId: receiptLine.salesInvoiceLineId || sourceLine.itemId },
          currentUser: input.createdBy,
          unitCostInMoveCurrency: unitCostBase,
          moveCurrency: baseCurrency,
          fxRateMovToBase: 1,
          fxRateCCYToBase: 1,
          transaction: input.transaction,
          metadata: { sourceModule: 'pos', documentPersona: 'POS_DIRECT_SALE' },
        });
      }

      const revenueAccountId = (receiptLine as any).revenueAccountId || this.resolveRevenueAccount(item, categoryMap);
      if (!revenueAccountId) throw new Error(`No revenue account configured for item ${item.code}`);
      addToBucket(revenueDebits, revenueAccountId, lineTotal);

      const taxAccountId = (receiptLine as any).taxAccountId;
      if (taxAmount > 0) {
        if (!taxAccountId) throw new Error(`No tax account captured for POS return item ${item.code}`);
        addToBucket(taxDebits, taxAccountId, taxAmount);
      }

      const arAccountId = customer.defaultARAccountId;
      addToBucket(arCredits, arAccountId, round2(lineTotal + taxAmount));

      const cogsAccountId = (receiptLine as any).cogsAccountId || this.resolveCogsAccount(item, categoryMap, invSettings);
      const inventoryAccountId = (receiptLine as any).inventoryAccountId || this.resolveInventoryAccount(item, categoryMap, invSettings);
      if (lineCostBase > 0 && cogsAccountId && inventoryAccountId) {
        addToBucket(inventoryDebits, inventoryAccountId, lineCostBase);
        addToBucket(cogsCredits, cogsAccountId, lineCostBase);
      }

      postedLines.push({
        itemId: item.id,
        qty: sourceLine.qty,
        unitPrice: receiptLine.unitPrice,
        lineTotal,
        originalLineId: receiptLine.salesInvoiceLineId,
        taxAmount,
        lineCostBase,
      });
    }

    const refundTotal = round2(postedLines.reduce((sum, line) => sum + line.lineTotal + line.taxAmount, 0));
    const voucherIds: string[] = [];

    const returnVoucher = await this.accountingBridge.recordFinancialEvent({
      kind: 'POS_RETURN_REVENUE',
      transaction: input.transaction,
      subledgerVoucher: {
        companyId: input.companyId,
        voucherType: VoucherType.SALES_RETURN,
        voucherNo: `POS-RET-${input.returnNumber}`,
        date: input.date,
        description: `POS Return ${input.returnNumber}`,
        currency: baseCurrency,
        exchangeRate: 1,
        lines: [...mapBucket(revenueDebits, 'Debit'), ...mapBucket(taxDebits, 'Debit'), ...mapBucket(arCredits, 'Credit')],
        metadata: {
          sourceModule: 'pos',
          sourceType: 'POS_RETURN',
          sourceId: returnId,
          voucherPart: 'REVENUE_REVERSAL',
          documentPersona: 'POS_DIRECT_SALE',
          originalReceiptId: input.originalReceipt.id,
        },
        createdBy: input.createdBy,
        postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
        reference: input.returnNumber,
        baseCurrencyOverride: baseCurrency,
        approved: true,
      },
    });
    if (returnVoucher.voucher?.id) voucherIds.push(returnVoucher.voucher.id);

    if (inventoryDebits.size && cogsCredits.size) {
      const cogsVoucher = await this.accountingBridge.recordFinancialEvent({
        kind: 'POS_RETURN_COGS',
        transaction: input.transaction,
        subledgerVoucher: {
          companyId: input.companyId,
          voucherType: VoucherType.SALES_RETURN,
          voucherNo: `POS-RET-COGS-${input.returnNumber}`,
          date: input.date,
          description: `POS Return ${input.returnNumber} COGS reversal`,
          currency: baseCurrency,
          exchangeRate: 1,
          lines: [...mapBucket(inventoryDebits, 'Debit'), ...mapBucket(cogsCredits, 'Credit')],
          metadata: {
            sourceModule: 'pos',
            sourceType: 'POS_RETURN',
            sourceId: returnId,
            voucherPart: 'COGS_REVERSAL',
            documentPersona: 'POS_DIRECT_SALE',
            originalReceiptId: input.originalReceipt.id,
          },
          createdBy: input.createdBy,
          postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
          reference: input.returnNumber,
          baseCurrencyOverride: baseCurrency,
          approved: true,
        },
      });
      if (cogsVoucher.voucher?.id) voucherIds.push(cogsVoucher.voucher.id);
    }

    if (input.settlementAccountId && refundTotal > 0) {
      const refundVoucher = await this.accountingBridge.recordFinancialEvent({
        kind: 'POS_RETURN_REFUND',
        transaction: input.transaction,
        subledgerVoucher: {
          companyId: input.companyId,
          voucherType: VoucherType.PAYMENT,
          voucherNo: `POS-REF-${input.returnNumber}`,
          date: input.date,
          description: `Refund for POS Return ${input.returnNumber}`,
          currency: baseCurrency,
          exchangeRate: 1,
          lines: [
            { accountId: customer.defaultARAccountId, side: 'Debit', baseAmount: refundTotal, docAmount: refundTotal },
            { accountId: input.settlementAccountId, side: 'Credit', baseAmount: refundTotal, docAmount: refundTotal },
          ],
          metadata: {
            sourceModule: 'pos',
            sourceType: 'POS_RETURN',
            sourceId: returnId,
            voucherPart: 'REFUND',
            refundMethod: input.refundMethod,
            documentPersona: 'POS_DIRECT_SALE',
            originalReceiptId: input.originalReceipt.id,
          },
          createdBy: input.createdBy,
          postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
          reference: input.returnNumber,
          baseCurrencyOverride: baseCurrency,
          approved: true,
        },
      });
      if (refundVoucher.voucher?.id) voucherIds.push(refundVoucher.voucher.id);
    }

    return { returnId, returnNumber: input.returnNumber, refundTotal, lines: postedLines, voucherIds };
  }

  private resolveRevenueAccount(item: any, categories: Map<string, any>): string | undefined {
    return item.revenueAccountId || (item.categoryId ? categories.get(item.categoryId)?.defaultRevenueAccountId : undefined);
  }

  private resolveCogsAccount(item: any, categories: Map<string, any>, invSettings: any): string | undefined {
    return item.cogsAccountId || (item.categoryId ? categories.get(item.categoryId)?.defaultCogsAccountId : undefined) || invSettings?.defaultCOGSAccountId;
  }

  private resolveInventoryAccount(item: any, categories: Map<string, any>, invSettings: any): string | undefined {
    return item.inventoryAssetAccountId || (item.categoryId ? categories.get(item.categoryId)?.defaultInventoryAssetAccountId : undefined) || invSettings?.defaultInventoryAssetAccountId;
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
