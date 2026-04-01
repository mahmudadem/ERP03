import { randomUUID } from 'crypto';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { PostingLockPolicy, VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { Item } from '../../../domain/inventory/entities/Item';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import {
  PaymentStatus,
  PurchaseInvoice,
  PurchaseInvoiceLine,
} from '../../../domain/purchases/entities/PurchaseInvoice';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { IPurchasesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { IExchangeRateRepository } from '../../../repository/interfaces/accounting/IExchangeRateRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { addDaysToISODate, roundMoney, updatePOStatus } from './PurchasePostingHelpers';
import { generateDocumentNumber } from './PurchaseOrderUseCases';

export interface PurchaseInvoiceLineInput {
  lineId?: string;
  lineNo?: number;
  poLineId?: string;
  grnLineId?: string;
  itemId?: string;
  invoicedQty: number;
  uom?: string;
  unitPriceDoc?: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface CreatePurchaseInvoiceInput {
  companyId: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorInvoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseInvoiceLineInput[];
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
  notes?: string;
}

export interface ListPurchaseInvoicesFilters {
  vendorId?: string;
  purchaseOrderId?: string;
  status?: 'DRAFT' | 'POSTED' | 'CANCELLED';
  paymentStatus?: PaymentStatus;
  limit?: number;
}

interface VoucherAccumulatedLine {
  accountId: string;
  side: 'Debit' | 'Credit';
  baseAmount: number;
  docAmount: number;
  notes: string;
  metadata?: Record<string, any>;
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
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository
  ) {}

  async execute(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoice> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) throw new Error('Purchases module is not initialized');

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

    const sourceLines = this.resolveSourceLines(input.lines, po, settings.procurementControlMode);
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
      const lineTotalDoc = roundMoney(invoicedQty * unitPriceDoc);
      const unitPriceBase = roundMoney(unitPriceDoc * exchangeRate);
      const lineTotalBase = roundMoney(lineTotalDoc * exchangeRate);

      const taxCodeId = await this.resolveTaxCodeId(input.companyId, sourceLine.taxCodeId, item);
      let taxRate = 0;
      if (taxCodeId) {
        const taxCode = await this.taxCodeRepo.getById(input.companyId, taxCodeId);
        if (!taxCode) throw new Error(`Tax code not found: ${taxCodeId}`);
        assertValidPurchaseTaxCode(taxCode, taxCodeId);
        taxRate = taxCode.rate;
      }

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
        uom: sourceLine.uom || poLine?.uom || item.purchaseUom || item.baseUom,
        unitPriceDoc,
        lineTotalDoc,
        unitPriceBase,
        lineTotalBase,
        taxCodeId,
        taxCode: undefined,
        taxRate,
        taxAmountDoc: roundMoney(lineTotalDoc * taxRate),
        taxAmountBase: roundMoney(lineTotalBase * taxRate),
        warehouseId: sourceLine.warehouseId || poLine?.warehouseId || settings.defaultWarehouseId,
        accountId: '',
        stockMovementId: null,
        description: sourceLine.description || poLine?.description,
      });
    }

    const paymentTermsDays = vendor.paymentTermsDays ?? settings.defaultPaymentTermsDays;
    const dueDate = input.dueDate || addDaysToISODate(input.invoiceDate, paymentTermsDays);
    const now = new Date();

    const invoice = new PurchaseInvoice({
      id: randomUUID(),
      companyId: input.companyId,
      invoiceNumber: generateDocumentNumber(settings, 'PI'),
      vendorInvoiceNumber: input.vendorInvoiceNumber,
      purchaseOrderId: po?.id,
      vendorId: vendor.id,
      vendorName: vendor.displayName,
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
    mode: 'SIMPLE' | 'CONTROLLED'
  ): PurchaseInvoiceLineInput[] {
    if (Array.isArray(lines) && lines.length > 0) {
      return lines;
    }

    if (!po) return [];

    return po.lines
      .map((line) => {
        let ceiling = 0;
        if (mode === 'CONTROLLED' && line.trackInventory) {
          ceiling = line.receivedQty - line.invoicedQty;
        } else if (mode === 'CONTROLLED' && !line.trackInventory) {
          ceiling = line.orderedQty - line.invoicedQty;
        } else {
          ceiling = line.orderedQty - line.invoicedQty;
        }

        return {
          poLineId: line.lineId,
          itemId: line.itemId,
          invoicedQty: roundMoney(Math.max(ceiling, 0)),
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
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
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
    private readonly inventoryService: IPurchasesInventoryService,
    private readonly voucherRepo: IVoucherRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string): Promise<PurchaseInvoice> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Purchases module is not initialized');

    const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!pi) throw new Error(`Purchase invoice not found: ${id}`);
    if (pi.status !== 'DRAFT') throw new Error('Only DRAFT purchase invoices can be posted');

    const vendor = await this.partyRepo.getById(companyId, pi.vendorId);
    if (!vendor) throw new Error(`Vendor not found: ${pi.vendorId}`);

    const isPOLinked = !!pi.purchaseOrderId;
    let po: PurchaseOrder | null = null;
    if (isPOLinked) {
      po = await this.purchaseOrderRepo.getById(companyId, pi.purchaseOrderId as string);
      if (!po) throw new Error(`Purchase order not found: ${pi.purchaseOrderId}`);
      if (po.status === 'CANCELLED') throw new Error('Cannot post invoice for cancelled purchase order');
    }

    const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || pi.currency;
    const voucherLines: VoucherAccumulatedLine[] = [];
    const apAccountId = this.resolveAPAccount(vendor, settings.defaultAPAccountId);

    await this.transactionManager.runTransaction(async (transaction) => {
      for (const line of pi.lines) {
        const item = await this.itemRepo.getItem(line.itemId);
        if (!item || item.companyId !== companyId) {
          throw new Error(`Item not found: ${line.itemId}`);
        }
        line.trackInventory = item.trackInventory;

        const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
        if (isPOLinked && !poLine) {
          throw new Error(`PO line not found for invoice line ${line.lineId}`);
        }

        this.validatePostingQuantity(line, poLine, settings.procurementControlMode, settings.overInvoiceTolerancePct, isPOLinked);

        // Step 2: Freeze tax snapshot at posting time.
        await this.freezeTaxSnapshot(companyId, line, pi.exchangeRate);

        // Step 3: Resolve accounts with hierarchy.
        line.accountId = await this.resolveDebitAccount(companyId, item, settings.defaultPurchaseExpenseAccountId);

        // Step 4: Inventory movement for SIMPLE stock lines without GRN.
        if (settings.procurementControlMode === 'SIMPLE' && item.trackInventory && !hasGRNForThisLine(line)) {
          const warehouseId = line.warehouseId || settings.defaultWarehouseId;
          if (!warehouseId) {
            throw new Error(`Warehouse required for stock item ${line.itemName || item.name}`);
          }
          const warehouse = await this.warehouseRepo.getWarehouse(warehouseId);
          if (!warehouse || warehouse.companyId !== companyId) {
            throw new Error(`Warehouse not found: ${warehouseId}`);
          }

          const qtyInBaseUom = await this.convertToBaseUom(companyId, line.invoicedQty, line.uom, item.baseUom, item.id, item.code);
          const fxRateCCYToBase = await this.resolveCCYToBaseRate(
            companyId,
            item.costCurrency,
            baseCurrency,
            pi.currency,
            pi.exchangeRate,
            pi.invoiceDate
          );

          const movement = await this.inventoryService.processIN({
            companyId,
            itemId: line.itemId,
            warehouseId,
            qty: qtyInBaseUom,
            date: pi.invoiceDate,
            movementType: 'PURCHASE_RECEIPT',
            refs: {
              type: 'PURCHASE_INVOICE',
              docId: pi.id,
              lineId: line.lineId,
            },
            currentUser: pi.createdBy,
            unitCostInMoveCurrency: line.unitPriceDoc,
            moveCurrency: pi.currency,
            fxRateMovToBase: pi.exchangeRate,
            fxRateCCYToBase,
            transaction,
          } as any);

          line.stockMovementId = movement.id;
          line.warehouseId = warehouseId;
        }

        if (settings.procurementControlMode === 'CONTROLLED' && !isPOLinked && item.trackInventory) {
          throw new Error(`CONTROLLED mode stock invoices require PO/GRN: ${line.itemName || item.name}`);
        }

        // Step 5: Debit line amount and tax.
        voucherLines.push({
          accountId: line.accountId,
          side: 'Debit',
          baseAmount: line.lineTotalBase,
          docAmount: line.lineTotalDoc,
          notes: `${line.itemName} x ${line.invoicedQty}`,
          metadata: {
            sourceModule: 'purchases',
            sourceType: 'PURCHASE_INVOICE',
            sourceId: pi.id,
            lineId: line.lineId,
            itemId: line.itemId,
          },
        });

        if (line.taxAmountBase > 0) {
          const taxAccountId = await this.resolvePurchaseTaxAccount(companyId, line.taxCodeId);
          voucherLines.push({
            accountId: taxAccountId,
            side: 'Debit',
            baseAmount: line.taxAmountBase,
            docAmount: line.taxAmountDoc,
            notes: `Tax: ${line.taxCode || line.taxCodeId || ''} on ${line.itemName}`,
            metadata: {
              sourceModule: 'purchases',
              sourceType: 'PURCHASE_INVOICE',
              sourceId: pi.id,
              lineId: line.lineId,
              taxCodeId: line.taxCodeId,
            },
          });
        }

        if (poLine) {
          poLine.invoicedQty = roundMoney(poLine.invoicedQty + line.invoicedQty);
        }
      }

      // Step 8 (part 1): freeze totals.
      pi.subtotalBase = roundMoney(pi.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
      pi.taxTotalBase = roundMoney(pi.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
      pi.grandTotalBase = roundMoney(pi.subtotalBase + pi.taxTotalBase);
      pi.subtotalDoc = roundMoney(pi.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
      pi.taxTotalDoc = roundMoney(pi.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
      pi.grandTotalDoc = roundMoney(pi.subtotalDoc + pi.taxTotalDoc);

      // Step 6: Credit AP total.
      voucherLines.push({
        accountId: apAccountId,
        side: 'Credit',
        baseAmount: pi.grandTotalBase,
        docAmount: pi.grandTotalDoc,
        notes: `AP - ${pi.vendorName} - ${pi.invoiceNumber}`,
        metadata: {
          sourceModule: 'purchases',
          sourceType: 'PURCHASE_INVOICE',
          sourceId: pi.id,
          vendorId: pi.vendorId,
        },
      });

      // Step 7: Create voucher.
      const voucher = await this.createAccountingVoucherInTransaction(
        transaction,
        pi,
        baseCurrency,
        voucherLines
      );

      // Step 8 (part 2): finalize.
      pi.voucherId = voucher.id;
      pi.paidAmountBase = 0;
      pi.outstandingAmountBase = pi.grandTotalBase;
      pi.paymentStatus = 'UNPAID';
      pi.status = 'POSTED';
      pi.postedAt = new Date();
      pi.updatedAt = new Date();
      await this.purchaseInvoiceRepo.update(pi, transaction);

      if (po) {
        po.status = updatePOStatus(po);
        po.updatedAt = new Date();
        await this.purchaseOrderRepo.update(po, transaction);
      }
    });

    const posted = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!posted) throw new Error(`Purchase invoice not found after posting: ${id}`);
    return posted;
  }

  private validatePostingQuantity(
    line: PurchaseInvoiceLine,
    poLine: PurchaseOrder['lines'][number] | null,
    mode: 'SIMPLE' | 'CONTROLLED',
    overInvoiceTolerancePct: number,
    isPOLinked: boolean
  ): void {
    if (!isPOLinked || !poLine) {
      return;
    }

    if (mode === 'CONTROLLED' && line.trackInventory) {
      const openInvoiceQty = poLine.receivedQty - poLine.invoicedQty;
      if (line.invoicedQty > openInvoiceQty + 0.000001) {
        throw new Error(`Invoiced qty exceeds received qty for item ${line.itemName}`);
      }
      return;
    }

    if (mode === 'CONTROLLED' && !line.trackInventory) {
      const openInvoiceQty = poLine.orderedQty - poLine.invoicedQty;
      if (line.invoicedQty > openInvoiceQty + 0.000001) {
        throw new Error(`Invoiced qty exceeds ordered qty for service ${line.itemName}`);
      }
      return;
    }

    const maxQty = poLine.orderedQty * (1 + overInvoiceTolerancePct / 100);
    const remaining = maxQty - poLine.invoicedQty;
    if (line.invoicedQty > remaining + 0.000001) {
      throw new Error(`Invoiced qty exceeds ordered qty for item ${line.itemName}`);
    }
  }

  private async freezeTaxSnapshot(companyId: string, line: PurchaseInvoiceLine, exchangeRate: number): Promise<void> {
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
    assertValidPurchaseTaxCode(taxCode, line.taxCodeId);

    line.taxCode = taxCode.code;
    line.taxRate = taxCode.rate;
    line.taxAmountDoc = roundMoney(line.lineTotalDoc * line.taxRate);
    line.taxAmountBase = roundMoney(line.lineTotalBase * line.taxRate);
  }

  private async resolveDebitAccount(companyId: string, item: Item, defaultExpenseAccountId?: string): Promise<string> {
    if (item.trackInventory) {
      if (item.inventoryAssetAccountId) return item.inventoryAssetAccountId;
      if (item.categoryId) {
        const category = await this.itemCategoryRepo.getCategory(item.categoryId);
        if (category && category.companyId === companyId && category.defaultInventoryAssetAccountId) {
          return category.defaultInventoryAssetAccountId;
        }
      }
      if (!defaultExpenseAccountId) {
        throw new Error(`No inventory/expense account resolved for item ${item.code}`);
      }
      return defaultExpenseAccountId;
    }

    if (item.cogsAccountId) return item.cogsAccountId;
    if (item.categoryId) {
      const category = await this.itemCategoryRepo.getCategory(item.categoryId);
      if (category && category.companyId === companyId && category.defaultCogsAccountId) {
        return category.defaultCogsAccountId;
      }
    }
    if (!defaultExpenseAccountId) {
      throw new Error(`No expense account resolved for item ${item.code}`);
    }
    return defaultExpenseAccountId;
  }

  private resolveAPAccount(vendor: Party, defaultAPAccountId: string): string {
    return vendor.defaultAPAccountId || defaultAPAccountId;
  }

  private async resolvePurchaseTaxAccount(companyId: string, taxCodeId?: string): Promise<string> {
    if (!taxCodeId) {
      throw new Error('taxCodeId is required for tax line');
    }

    const taxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
    if (!taxCode) throw new Error(`Tax code not found: ${taxCodeId}`);
    if (!taxCode.purchaseTaxAccountId) {
      throw new Error(`TaxCode ${taxCode.code} has no purchase tax account`);
    }
    return taxCode.purchaseTaxAccountId;
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
        conversion.active &&
        conversion.fromUom.toUpperCase() === normalizedFrom &&
        conversion.toUom.toUpperCase() === normalizedTo
    );
    if (direct) return roundMoney(qty * direct.factor);

    const reverse = conversions.find(
      (conversion) =>
        conversion.active &&
        conversion.fromUom.toUpperCase() === normalizedTo &&
        conversion.toUom.toUpperCase() === normalizedFrom
    );
    if (reverse) return roundMoney(qty / reverse.factor);

    throw new Error(`No UOM conversion from ${uom} to ${baseUom} for item ${itemCode}`);
  }

  private async resolveCCYToBaseRate(
    companyId: string,
    costCurrency: string,
    baseCurrency: string,
    moveCurrency: string,
    fxRateMovToBase: number,
    invoiceDate: string
  ): Promise<number> {
    if (costCurrency.toUpperCase() === baseCurrency.toUpperCase()) {
      return 1;
    }

    if (costCurrency.toUpperCase() === moveCurrency.toUpperCase()) {
      return fxRateMovToBase;
    }

    const rate = await this.exchangeRateRepo.getMostRecentRateBeforeDate(
      companyId,
      costCurrency,
      baseCurrency,
      new Date(invoiceDate)
    );
    if (rate) return rate.rate;

    return fxRateMovToBase;
  }

  private async createAccountingVoucherInTransaction(
    transaction: unknown,
    pi: PurchaseInvoice,
    baseCurrency: string,
    lines: VoucherAccumulatedLine[]
  ): Promise<VoucherEntity> {
    const isForeignCurrency = pi.currency.toUpperCase() !== baseCurrency.toUpperCase();
    const voucherLines = lines.map((line, index) => {
      const baseAmount = roundMoney(line.baseAmount);
      const amount = isForeignCurrency ? roundMoney(line.docAmount) : baseAmount;
      const rate = isForeignCurrency ? pi.exchangeRate : 1;

      return new VoucherLineEntity(
        index + 1,
        line.accountId,
        line.side,
        baseAmount,
        baseCurrency,
        amount,
        pi.currency,
        rate,
        line.notes,
        undefined,
        line.metadata || {}
      );
    });

    const totalDebit = roundMoney(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
    const totalCredit = roundMoney(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
    const now = new Date();

    const voucher = new VoucherEntity(
      randomUUID(),
      pi.companyId,
      `PI-${pi.invoiceNumber}`,
      VoucherType.JOURNAL_ENTRY,
      pi.invoiceDate,
      `Purchase Invoice ${pi.invoiceNumber} - ${pi.vendorName}`,
      pi.currency,
      baseCurrency,
      isForeignCurrency ? pi.exchangeRate : 1,
      voucherLines,
      totalDebit,
      totalCredit,
      VoucherStatus.APPROVED,
      {
        sourceModule: 'purchases',
        sourceType: 'PURCHASE_INVOICE',
        sourceId: pi.id,
        referenceType: 'PURCHASE_INVOICE',
        referenceId: pi.id,
      },
      pi.createdBy,
      now,
      pi.createdBy,
      now
    );

    const postedVoucher = voucher.post(pi.createdBy, now, PostingLockPolicy.FLEXIBLE_LOCKED);
    await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
    await this.voucherRepo.save(postedVoucher, transaction);
    return postedVoucher;
  }
}

export class UpdatePurchaseInvoiceUseCase {
  constructor(
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(input: UpdatePurchaseInvoiceInput): Promise<PurchaseInvoice> {
    const current = await this.purchaseInvoiceRepo.getById(input.companyId, input.id);
    if (!current) throw new Error(`Purchase invoice not found: ${input.id}`);
    if (current.status !== 'DRAFT') {
      throw new Error('Only draft purchase invoices can be updated');
    }

    if (input.vendorId) {
      const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
      if (!vendor) throw new Error(`Vendor not found: ${input.vendorId}`);
      if (!vendor.roles.includes('VENDOR')) throw new Error(`Party is not a vendor: ${input.vendorId}`);
      current.vendorId = vendor.id;
      current.vendorName = vendor.displayName;
    }

    if (input.vendorInvoiceNumber !== undefined) current.vendorInvoiceNumber = input.vendorInvoiceNumber;
    if (input.invoiceDate !== undefined) current.invoiceDate = input.invoiceDate;
    if (input.dueDate !== undefined) current.dueDate = input.dueDate;
    if (input.currency !== undefined) current.currency = input.currency.toUpperCase();
    if (input.exchangeRate !== undefined) current.exchangeRate = input.exchangeRate;
    if (input.notes !== undefined) current.notes = input.notes;

    if (input.lines) {
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
          accountId: existing?.accountId || '',
          stockMovementId: existing?.stockMovementId ?? null,
          description: line.description ?? existing?.description,
        };
      });
      current.lines = mappedLines;
    }

    current.updatedAt = new Date();
    const updated = new PurchaseInvoice(current.toJSON() as any);
    await this.purchaseInvoiceRepo.update(updated);
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
