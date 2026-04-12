import { randomUUID } from 'crypto';
import { Item } from '../../../domain/inventory/entities/Item';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import { POStatus, PurchaseOrder, PurchaseOrderLine } from '../../../domain/purchases/entities/PurchaseOrder';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const generateDocumentNumber = (
  settings: PurchaseSettings,
  docType: 'PO' | 'GRN' | 'PI' | 'PR'
): string => {
  let prefix = '';
  let seq = 1;

  if (docType === 'PO') {
    prefix = settings.poNumberPrefix;
    seq = settings.poNumberNextSeq;
    settings.poNumberNextSeq += 1;
  } else if (docType === 'GRN') {
    prefix = settings.grnNumberPrefix;
    seq = settings.grnNumberNextSeq;
    settings.grnNumberNextSeq += 1;
  } else if (docType === 'PI') {
    prefix = settings.piNumberPrefix;
    seq = settings.piNumberNextSeq;
    settings.piNumberNextSeq += 1;
  } else {
    prefix = settings.prNumberPrefix;
    seq = settings.prNumberNextSeq;
    settings.prNumberNextSeq += 1;
  }

  const padded = String(seq).padStart(5, '0');
  return `${prefix}-${padded}`;
};

export interface PurchaseOrderLineInput {
  lineId?: string;
  lineNo?: number;
  itemId: string;
  orderedQty: number;
  uom?: string;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

export interface CreatePurchaseOrderInput {
  companyId: string;
  vendorId: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseOrderLineInput[];
  notes?: string;
  internalNotes?: string;
  createdBy: string;
}

export interface UpdatePurchaseOrderInput {
  companyId: string;
  id: string;
  vendorId?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseOrderLineInput[];
  notes?: string;
  internalNotes?: string;
}

export interface ListPurchaseOrdersFilters {
  status?: POStatus;
  vendorId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository
  ) {}

  async execute(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) {
      throw new Error('Purchases module is not initialized');
    }

    const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
    this.assertVendor(vendor, input.vendorId);

    const currencyEnabled = await this.companyCurrencyRepo.isEnabled(input.companyId, input.currency);
    if (!currencyEnabled) {
      throw new Error(`Currency is not enabled for company: ${input.currency}`);
    }

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error('Purchase order must contain at least one line');
    }

    const lines: PurchaseOrderLine[] = [];
    for (let i = 0; i < input.lines.length; i++) {
      const line = await this.buildLine(
        input.companyId,
        input.lines[i],
        i,
        input.exchangeRate
      );
      lines.push(line);
    }

    const orderNumber = await this.reserveUniqueOrderNumber(input.companyId, settings);
    const now = new Date();
    const po = new PurchaseOrder({
      id: randomUUID(),
      companyId: input.companyId,
      orderNumber,
      vendorId: vendor!.id,
      vendorName: vendor!.displayName,
      orderDate: input.orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate,
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

    await this.purchaseOrderRepo.create(po);
    await this.settingsRepo.saveSettings(settings);
    return po;
  }

  private async reserveUniqueOrderNumber(companyId: string, settings: PurchaseSettings): Promise<string> {
    const MAX_ATTEMPTS = 100;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const candidate = generateDocumentNumber(settings, 'PO');
      const existing = await this.purchaseOrderRepo.getByNumber(companyId, candidate);
      if (!existing) return candidate;
    }

    throw new Error('Failed to generate a unique purchase order number. Please retry.');
  }

  private assertVendor(vendor: Party | null, vendorId: string): void {
    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    if (!vendor.roles.includes('VENDOR')) {
      throw new Error(`Party is not a vendor: ${vendorId}`);
    }
  }

  private async buildLine(
    companyId: string,
    lineInput: PurchaseOrderLineInput,
    index: number,
    exchangeRate: number
  ): Promise<PurchaseOrderLine> {
    const item = await this.itemRepo.getItem(lineInput.itemId);
    if (!item) {
      throw new Error(`Item not found: ${lineInput.itemId}`);
    }

    let taxCodeId = lineInput.taxCodeId;
    let taxRate = 0;

    if (!taxCodeId && item.defaultPurchaseTaxCodeId) {
      const defaultTaxCode = await this.taxCodeRepo.getById(companyId, item.defaultPurchaseTaxCodeId);
      if (defaultTaxCode && defaultTaxCode.active && (defaultTaxCode.scope === 'PURCHASE' || defaultTaxCode.scope === 'BOTH')) {
        taxCodeId = defaultTaxCode.id;
        taxRate = defaultTaxCode.rate;
      }
    } else if (taxCodeId) {
      const selectedTaxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
      if (!selectedTaxCode) {
        throw new Error(`Tax code not found: ${taxCodeId}`);
      }
      if (!selectedTaxCode.active || (selectedTaxCode.scope !== 'PURCHASE' && selectedTaxCode.scope !== 'BOTH')) {
        throw new Error(`Tax code is not valid for purchase: ${taxCodeId}`);
      }
      taxRate = selectedTaxCode.rate;
    }

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
      uom: lineInput.uom || item.purchaseUom || item.baseUom,
      receivedQty: 0,
      invoicedQty: 0,
      returnedQty: 0,
      unitPriceDoc: lineInput.unitPriceDoc,
      lineTotalDoc,
      unitPriceBase,
      lineTotalBase,
      taxCodeId,
      taxRate,
      taxAmountDoc,
      taxAmountBase,
      warehouseId: lineInput.warehouseId,
      description: lineInput.description,
    };
  }
}

export class UpdatePurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository,
    private readonly taxCodeRepo: ITaxCodeRepository
  ) {}

  async execute(input: UpdatePurchaseOrderInput): Promise<PurchaseOrder> {
    const current = await this.purchaseOrderRepo.getById(input.companyId, input.id);
    if (!current) {
      throw new Error(`Purchase order not found: ${input.id}`);
    }
    if (current.status !== 'DRAFT') {
      throw new Error('Only draft purchase orders can be updated');
    }

    let vendor = await this.partyRepo.getById(input.companyId, input.vendorId || current.vendorId);
    if (!vendor) {
      throw new Error(`Vendor not found: ${input.vendorId || current.vendorId}`);
    }
    if (!vendor.roles.includes('VENDOR')) {
      throw new Error(`Party is not a vendor: ${vendor.id}`);
    }

    const exchangeRate = input.exchangeRate ?? current.exchangeRate;
    const rawLines: PurchaseOrderLineInput[] = input.lines
      ? input.lines
      : current.lines.map((line) => ({
          lineId: line.lineId,
          lineNo: line.lineNo,
          itemId: line.itemId,
          orderedQty: line.orderedQty,
          uom: line.uom,
          unitPriceDoc: line.unitPriceDoc,
          taxCodeId: line.taxCodeId,
          warehouseId: line.warehouseId,
          description: line.description,
        }));
    const currentLineById = new Map(current.lines.map((line) => [line.lineId, line]));
    const lines: PurchaseOrderLine[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i];
      const currentLine = raw.lineId ? currentLineById.get(raw.lineId) : undefined;
      const line = await this.buildLine(input.companyId, raw, i, exchangeRate, currentLine);
      lines.push(line);
    }

    const updated = new PurchaseOrder({
      id: current.id,
      companyId: current.companyId,
      orderNumber: current.orderNumber,
      vendorId: vendor.id,
      vendorName: vendor.displayName,
      orderDate: input.orderDate ?? current.orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate ?? current.expectedDeliveryDate,
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

    await this.purchaseOrderRepo.update(updated);
    return updated;
  }

  private async buildLine(
    companyId: string,
    lineInput: PurchaseOrderLineInput,
    index: number,
    exchangeRate: number,
    currentLine?: PurchaseOrderLine
  ): Promise<PurchaseOrderLine> {
    const item = await this.itemRepo.getItem(lineInput.itemId);
    if (!item) {
      throw new Error(`Item not found: ${lineInput.itemId}`);
    }

    let taxRate = 0;
    if (lineInput.taxCodeId) {
      const taxCode = await this.taxCodeRepo.getById(companyId, lineInput.taxCodeId);
      if (!taxCode) {
        throw new Error(`Tax code not found: ${lineInput.taxCodeId}`);
      }
      taxRate = taxCode.rate;
    }

    const lineTotalDoc = roundMoney(lineInput.orderedQty * lineInput.unitPriceDoc);
    const unitPriceBase = roundMoney(lineInput.unitPriceDoc * exchangeRate);
    const lineTotalBase = roundMoney(lineTotalDoc * exchangeRate);
    const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
    const taxAmountBase = roundMoney(lineTotalBase * taxRate);

    return {
      lineId: lineInput.lineId || currentLine?.lineId || randomUUID(),
      lineNo: lineInput.lineNo ?? currentLine?.lineNo ?? index + 1,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      itemType: item.type,
      trackInventory: item.trackInventory,
      orderedQty: lineInput.orderedQty,
      uom: lineInput.uom || item.purchaseUom || item.baseUom,
      receivedQty: currentLine?.receivedQty ?? 0,
      invoicedQty: currentLine?.invoicedQty ?? 0,
      returnedQty: currentLine?.returnedQty ?? 0,
      unitPriceDoc: lineInput.unitPriceDoc,
      lineTotalDoc,
      unitPriceBase,
      lineTotalBase,
      taxCodeId: lineInput.taxCodeId,
      taxRate,
      taxAmountDoc,
      taxAmountBase,
      warehouseId: lineInput.warehouseId,
      description: lineInput.description,
    };
  }
}

export class ConfirmPurchaseOrderUseCase {
  constructor(private readonly purchaseOrderRepo: IPurchaseOrderRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.purchaseOrderRepo.getById(companyId, id);
    if (!po) throw new Error(`Purchase order not found: ${id}`);
    if (po.status !== 'DRAFT') throw new Error('Only draft purchase orders can be confirmed');
    if (!po.lines.length) throw new Error('Purchase order must contain at least one line');

    po.status = 'CONFIRMED';
    po.confirmedAt = new Date();
    po.updatedAt = new Date();

    await this.purchaseOrderRepo.update(po);
    return po;
  }
}

export class CancelPurchaseOrderUseCase {
  constructor(private readonly purchaseOrderRepo: IPurchaseOrderRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.purchaseOrderRepo.getById(companyId, id);
    if (!po) throw new Error(`Purchase order not found: ${id}`);
    if (!['DRAFT', 'CONFIRMED'].includes(po.status)) {
      throw new Error('Only draft or confirmed purchase orders can be cancelled');
    }

    const hasLinkedActivity = po.lines.some((line) => line.receivedQty > 0 || line.invoicedQty > 0);
    if (hasLinkedActivity) {
      throw new Error('Cannot cancel purchase order with received or invoiced quantities');
    }

    po.status = 'CANCELLED';
    po.updatedAt = new Date();
    await this.purchaseOrderRepo.update(po);
    return po;
  }
}

export class ClosePurchaseOrderUseCase {
  constructor(private readonly purchaseOrderRepo: IPurchaseOrderRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.purchaseOrderRepo.getById(companyId, id);
    if (!po) throw new Error(`Purchase order not found: ${id}`);
    if (!['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(po.status)) {
      throw new Error('Only confirmed or received purchase orders can be closed');
    }

    po.status = 'CLOSED';
    po.closedAt = new Date();
    po.updatedAt = new Date();
    await this.purchaseOrderRepo.update(po);
    return po;
  }
}

export class GetPurchaseOrderUseCase {
  constructor(private readonly purchaseOrderRepo: IPurchaseOrderRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.purchaseOrderRepo.getById(companyId, id);
    if (!po) throw new Error(`Purchase order not found: ${id}`);
    return po;
  }
}

export class ListPurchaseOrdersUseCase {
  constructor(private readonly purchaseOrderRepo: IPurchaseOrderRepository) {}

  async execute(companyId: string, filters: ListPurchaseOrdersFilters = {}): Promise<PurchaseOrder[]> {
    const usesDateFilter = Boolean(filters.dateFrom || filters.dateTo);
    const orders = await this.purchaseOrderRepo.list(companyId, {
      status: filters.status,
      vendorId: filters.vendorId,
      limit: usesDateFilter ? undefined : filters.limit,
      offset: usesDateFilter ? undefined : filters.offset,
    });

    if (!usesDateFilter) {
      return orders;
    }

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
