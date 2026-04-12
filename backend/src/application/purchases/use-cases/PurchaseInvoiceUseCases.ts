import { randomUUID } from 'crypto';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { Item } from '../../../domain/inventory/entities/Item';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import {
  PaymentStatus,
  PurchaseInvoice,
  PurchaseInvoiceLine,
} from '../../../domain/purchases/entities/PurchaseInvoice';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { IPurchasesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
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
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
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
    private readonly inventoryService: IPurchasesInventoryService,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    accountRepo: IAccountRepository | undefined,
    private readonly transactionManager: ITransactionManager
  ) {
    this.accountRepo = accountRepo;
  }

  async execute(companyId: string, id: string): Promise<PurchaseInvoice> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Purchases module is not initialized');
    const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
    const isPerpetual = invSettings?.inventoryAccountingMethod === 'PERPETUAL';

    const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!pi) throw new Error(`Purchase invoice not found: ${id}`);
    if (pi.status !== 'DRAFT') throw new Error('Only DRAFT purchase invoices can be posted');

    const vendor = await this.partyRepo.getById(companyId, pi.vendorId);
    if (!vendor) throw new Error(`Vendor not found: ${pi.vendorId}`);

    const isPOLinked = !!pi.purchaseOrderId;
    let po: PurchaseOrder | null = null;
    if (isPOLinked) {
      po = await this.purchaseOrderRepo.getById(companyId, pi.purchaseOrderId as string);
    }

    const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || pi.currency;
    const voucherLines: VoucherAccumulatedLine[] = [];
    const apAccountId = this.resolveAPAccount(vendor, settings);

    // PHASE 1: PRE-FETCH (Safety first!)
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

    // PHASE 2: ATOMIC POSTING
    await this.transactionManager.runTransaction(async (transaction) => {
      for (const line of pi.lines) {
        const item = itemsMap.get(line.itemId);
        if (!item) throw new Error(`Item not found: ${line.itemId}`);
        line.trackInventory = item.trackInventory;

        const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
        this.validatePostingQuantity(line, poLine, settings.allowDirectInvoicing, settings.overInvoiceTolerancePct, isPOLinked);

        const taxCode = line.taxCodeId ? taxCodesMap.get(line.taxCodeId) : null;
        this.freezeTaxSnapshotSync(line, pi.exchangeRate, taxCode || undefined);

        line.accountId = this.resolveDebitAccountSync(companyId, item, isPerpetual, categoriesMap, settings.defaultPurchaseExpenseAccountId, invSettings?.defaultInventoryAssetAccountId);

        if (settings.allowDirectInvoicing && item.trackInventory && !hasGRNForThisLine(line)) {
          const warehouseId = line.warehouseId || settings.defaultWarehouseId;
          const warehouse = warehouseId ? warehousesMap.get(warehouseId) : null;
          if (!warehouse) throw new Error(`Warehouse required for ${item.name}`);

          const qtyInBaseUom = await this.convertToBaseUom(companyId, line.invoicedQty, line.uom, item.baseUom, item.id, item.code);
          const fxRateCCYToBase = await this.resolveCCYToBaseRate(companyId, item.costCurrency, baseCurrency, pi.currency, pi.exchangeRate, pi.invoiceDate);

          const movement = await this.inventoryService.processIN({
            companyId, itemId: line.itemId, warehouseId, qty: qtyInBaseUom, date: pi.invoiceDate,
            movementType: 'PURCHASE_RECEIPT',
            refs: { type: 'PURCHASE_INVOICE', docId: pi.id, lineId: line.lineId },
            currentUser: pi.createdBy, unitCostInMoveCurrency: line.unitPriceDoc,
            moveCurrency: pi.currency, fxRateMovToBase: pi.exchangeRate, fxRateCCYToBase,
            transaction,
          } as any);

          line.stockMovementId = movement.id;
          line.warehouseId = warehouseId;
        }

        // DEBIT RECORDING (UUID Normalization)
        const resolvedDebitId = await this.resolveAccountId(companyId, line.accountId);
        voucherLines.push({
          accountId: resolvedDebitId, side: 'Debit',
          baseAmount: line.lineTotalBase, docAmount: line.lineTotalDoc,
          notes: `${line.itemName} x ${line.invoicedQty}`,
          metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, lineId: line.lineId, itemId: line.itemId }
        });

        if (line.taxAmountBase > 0 && line.taxCodeId) {
          const pTaxCode = taxCodesMap.get(line.taxCodeId);
          if (pTaxCode?.purchaseTaxAccountId) {
            const resolvedTaxId = await this.resolveAccountId(companyId, pTaxCode.purchaseTaxAccountId);
            voucherLines.push({
              accountId: resolvedTaxId, side: 'Debit',
              baseAmount: line.taxAmountBase, docAmount: line.taxAmountDoc,
              notes: `Tax: ${line.taxCode || line.taxCodeId} on ${line.itemName}`,
              metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, lineId: line.lineId, taxCodeId: line.taxCodeId }
            });
          }
        }

        if (poLine) poLine.invoicedQty = roundMoney(poLine.invoicedQty + line.invoicedQty);
      }

      this.recalcInvoiceTotals(pi);

      // CREDIT RECORDING (UUID Normalization)
      const resolvedAPId = await this.resolveAccountId(companyId, apAccountId);
      voucherLines.push({
        accountId: resolvedAPId, side: 'Credit',
        baseAmount: pi.grandTotalBase,
        docAmount: pi.grandTotalDoc,
        notes: `AP - ${pi.vendorName} - ${pi.invoiceNumber}`,
        metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, vendorId: pi.vendorId }
      });

      const voucher = await this.accountingPostingService.postInTransaction(
        {
          companyId,
          voucherType: VoucherType.PURCHASE_INVOICE,
          voucherNo: `PI-${pi.invoiceNumber}`,
          date: pi.invoiceDate,
          description: `PI ${pi.invoiceNumber} - ${pi.vendorName}`,
          currency: pi.currency,
          exchangeRate: pi.exchangeRate,
          lines: voucherLines,
          metadata: {
            sourceModule: 'purchases',
            sourceType: 'PURCHASE_INVOICE',
            sourceId: pi.id,
          },
          createdBy: pi.createdBy,
          postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
          reference: pi.invoiceNumber,
        },
        transaction
      );

      pi.voucherId = voucher.id;
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
    line.lineTotalDoc = roundMoney(line.invoicedQty * line.unitPriceDoc);
    line.unitPriceBase = roundMoney(line.unitPriceDoc * rate);
    line.lineTotalBase = roundMoney(line.lineTotalDoc * rate);
    line.taxCode = tax?.code;
    line.taxRate = tax?.rate || 0;
    line.taxAmountDoc = roundMoney(line.lineTotalDoc * line.taxRate);
    line.taxAmountBase = roundMoney(line.lineTotalBase * line.taxRate);
  }

  private recalcInvoiceTotals(pi: PurchaseInvoice): void {
    pi.subtotalDoc = roundMoney(pi.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
    pi.taxTotalDoc = roundMoney(pi.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    pi.grandTotalDoc = roundMoney(pi.subtotalDoc + pi.taxTotalDoc);

    pi.subtotalBase = roundMoney(pi.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
    pi.taxTotalBase = roundMoney(pi.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    pi.grandTotalBase = roundMoney(pi.subtotalBase + pi.taxTotalBase);

    pi.outstandingAmountBase = roundMoney(Math.max(pi.grandTotalBase - (pi.paidAmountBase || 0), 0));
  }

  private resolveDebitAccountSync(companyId: string, item: Item, isPerpetual: boolean, cats: Map<string, any>, dExp?: string, dInv?: string): string {
    if (item.trackInventory) {
      if (!isPerpetual) return dExp || '';
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

  private async convertToBaseUom(cid: string, qty: number, uom: string, base: string, itemId: string, itemCode: string): Promise<number> {
    if (uom.toUpperCase() === base.toUpperCase()) return qty;
    const convs = await this.uomConversionRepo.getConversionsForItem(cid, itemId, { active: true });
    const d = convs.find(c => c.fromUom.toUpperCase() === uom.toUpperCase() && c.toUom.toUpperCase() === base.toUpperCase());
    if (d) return roundMoney(qty * d.factor);
    const r = convs.find(c => c.fromUom.toUpperCase() === base.toUpperCase() && c.toUom.toUpperCase() === uom.toUpperCase());
    if (r) return roundMoney(qty / r.factor);
    throw new Error(`No UOM conversion for ${itemCode}`);
  }

  private async resolveCCYToBaseRate(cid: string, cost: string, base: string, move: string, rate: number, date: string): Promise<number> {
    if (cost.toUpperCase() === base.toUpperCase()) return 1;
    if (cost.toUpperCase() === move.toUpperCase()) return rate;
    const r = await this.exchangeRateRepo.getMostRecentRateBeforeDate(cid, cost, base, new Date(date));
    return r ? r.rate : rate;
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

export class UnpostPurchaseInvoiceUseCase {
  constructor(
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly inventoryService: IPurchasesInventoryService,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string, currentUser: string): Promise<PurchaseInvoice> {
    const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!pi) throw new Error(`Purchase invoice not found: ${id}`);
    if (pi.status !== 'POSTED') throw new Error('Only POSTED purchase invoices can be unposted');

    if (pi.paidAmountBase > 0) {
      throw new Error('Cannot unpost an invoice that has payments applied. Reverse the payments first.');
    }

    let po: PurchaseOrder | null = null;
    if (pi.purchaseOrderId) {
      po = await this.purchaseOrderRepo.getById(companyId, pi.purchaseOrderId);
    }

    await this.transactionManager.runTransaction(async (transaction) => {
      // 1. Reverse accounting voucher and ledger
      if (pi.voucherId) {
        await this.accountingPostingService.deleteVoucherInTransaction(companyId, pi.voucherId, transaction);
        pi.voucherId = null;
      }

      // 2. Reverse inventory movements (direct invoicing lines)
      for (const line of pi.lines) {
        if (line.stockMovementId) {
          await this.inventoryService.deleteMovement(companyId, line.stockMovementId, transaction);
          line.stockMovementId = null;
        }

        // 3. Reverse PO invoicedQty
        if (po) {
          const poLine = findPOLine(po, line.poLineId, line.itemId);
          if (poLine) {
            poLine.invoicedQty = roundMoney(Math.max(0, poLine.invoicedQty - line.invoicedQty));
          }
        }
      }

      // 4. Update PO status
      if (po) {
        po.status = updatePOStatus(po);
        po.updatedAt = new Date();
        await this.purchaseOrderRepo.update(po, transaction);
      }

      // 5. Revert PI to DRAFT
      pi.status = 'DRAFT';
      pi.postedAt = undefined;
      pi.updatedAt = new Date();
      await this.purchaseInvoiceRepo.update(pi, transaction);
    });

    const unposted = await this.purchaseInvoiceRepo.getById(companyId, id);
    if (!unposted) throw new Error('Failed to retrieve invoice after unposting');
    return unposted;
  }
}
