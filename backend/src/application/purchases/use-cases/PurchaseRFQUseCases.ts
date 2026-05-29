import { randomUUID } from 'crypto';
import { PurchaseRFQ, PurchaseRFQLine } from '../../../domain/purchases/entities/PurchaseRFQ';
import { IPurchaseRFQRepository } from '../../../repository/interfaces/purchases/IPurchaseRFQRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { CreatePurchaseOrderUseCase, CreatePurchaseOrderInput } from './PurchaseOrderUseCases';
import { CreatePurchaseInvoiceUseCase, CreatePurchaseInvoiceInput } from './PurchaseInvoiceUseCases';

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export interface PurchaseRFQLineInput {
  lineId?: string;
  lineNo?: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  quotedQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  discountAmountDoc?: number;
  taxCodeId?: string;
  taxRate?: number;
  description?: string;
}

export interface CreatePurchaseRFQInput {
  companyId: string;
  vendorId: string;
  rfqDate: string;
  validUntil?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseRFQLineInput[];
  notes?: string;
  createdBy: string;
}

export interface UpdatePurchaseRFQInput {
  companyId: string;
  id: string;
  vendorId?: string;
  rfqDate?: string;
  validUntil?: string;
  currency?: string;
  exchangeRate?: number;
  lines?: PurchaseRFQLineInput[];
  notes?: string;
}

export interface ListPurchaseRFQsFilters {
  status?: string;
  vendorId?: string;
  limit?: number;
  offset?: number;
}

// Calculations helper functions
export function calculateRFQLineAmounts(input: {
  quotedQty: number;
  unitPriceDoc: number;
  exchangeRate: number;
  taxRate: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  discountAmountDoc?: number;
}) {
  const quotedQty = input.quotedQty;
  const unitPriceDoc = input.unitPriceDoc;
  const exchangeRate = input.exchangeRate;
  const taxRate = input.taxRate;

  let discountAmountDoc = 0;
  if (input.discountType === 'PERCENT') {
    discountAmountDoc = roundMoney((quotedQty * unitPriceDoc * (input.discountValue ?? 0)) / 100);
  } else if (input.discountType === 'AMOUNT') {
    discountAmountDoc = roundMoney(input.discountValue ?? 0);
  } else if (input.discountAmountDoc !== undefined) {
    discountAmountDoc = input.discountAmountDoc;
  }

  const grossLineTotalDoc = roundMoney(quotedQty * unitPriceDoc);
  const lineTotalDoc = roundMoney(grossLineTotalDoc - discountAmountDoc);
  const unitPriceBase = roundMoney(unitPriceDoc * exchangeRate);
  const lineTotalBase = roundMoney(lineTotalDoc * exchangeRate);
  const discountAmountBase = roundMoney(discountAmountDoc * exchangeRate);
  const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
  const taxAmountBase = roundMoney(lineTotalBase * taxRate);

  return {
    discountAmountDoc,
    discountAmountBase,
    grossLineTotalDoc,
    lineTotalDoc,
    unitPriceBase,
    lineTotalBase,
    taxAmountDoc,
    taxAmountBase,
  };
}

export function calculateRFQTotals(lines: {
  lineTotalDoc: number;
  lineTotalBase: number;
  taxAmountDoc: number;
  taxAmountBase: number;
}[]) {
  const subtotalDoc = roundMoney(lines.reduce((sum, l) => sum + l.lineTotalDoc, 0));
  const subtotalBase = roundMoney(lines.reduce((sum, l) => sum + l.lineTotalBase, 0));
  const taxTotalDoc = roundMoney(lines.reduce((sum, l) => sum + l.taxAmountDoc, 0));
  const taxTotalBase = roundMoney(lines.reduce((sum, l) => sum + l.taxAmountBase, 0));
  const grandTotalDoc = roundMoney(subtotalDoc + taxTotalDoc);
  const grandTotalBase = roundMoney(subtotalBase + taxTotalBase);

  return {
    subtotalDoc,
    subtotalBase,
    taxTotalDoc,
    taxTotalBase,
    grandTotalDoc,
    grandTotalBase,
  };
}

async function generateRFQNumber(companyId: string, rfqRepo: IPurchaseRFQRepository): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `RFQ-${dateStr}-`;
  const all = await rfqRepo.list(companyId);
  const todayCount = all.filter((r) => r.rfqNumber.startsWith(prefix)).length;
  return `${prefix}${String(todayCount + 1).padStart(3, '0')}`;
}

function buildRFQLine(input: PurchaseRFQLineInput, index: number, exchangeRate: number): PurchaseRFQLine {
  const taxRate = input.taxRate ?? 0;
  const calc = calculateRFQLineAmounts({
    quotedQty: input.quotedQty,
    unitPriceDoc: input.unitPriceDoc,
    exchangeRate,
    taxRate,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountAmountDoc: input.discountAmountDoc,
  });

  return {
    lineId: input.lineId || randomUUID(),
    lineNo: input.lineNo ?? index + 1,
    itemId: input.itemId,
    itemCode: input.itemCode,
    itemName: input.itemName,
    quotedQty: input.quotedQty,
    uomId: input.uomId,
    uom: input.uom,
    unitPriceDoc: input.unitPriceDoc,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountAmountDoc: calc.discountAmountDoc,
    taxCodeId: input.taxCodeId,
    taxRate,
    taxAmountDoc: calc.taxAmountDoc,
    taxAmountBase: calc.taxAmountBase,
    grossLineTotalDoc: calc.grossLineTotalDoc,
    discountAmountBase: calc.discountAmountBase,
    lineTotalDoc: calc.lineTotalDoc,
    unitPriceBase: calc.unitPriceBase,
    lineTotalBase: calc.lineTotalBase,
    description: input.description,
  };
}

// CreatePurchaseRFQUseCase
export class CreatePurchaseRFQUseCase {
  constructor(
    private readonly rfqRepo: IPurchaseRFQRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository
  ) {}

  async execute(input: CreatePurchaseRFQInput): Promise<PurchaseRFQ> {
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error('Purchase RFQ must contain at least one line');
    }

    const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
    if (!vendor) throw new Error(`Vendor not found: ${input.vendorId}`);
    if (!vendor.roles.includes('VENDOR')) {
      throw new Error(`Party is not a vendor: ${input.vendorId}`);
    }

    const currencyEnabled = await this.companyCurrencyRepo.isEnabled(input.companyId, input.currency);
    if (!currencyEnabled) {
      throw new Error(`Currency is not enabled for company: ${input.currency}`);
    }

    const lines = input.lines.map((l, i) => buildRFQLine(l, i, input.exchangeRate));
    const totals = calculateRFQTotals(
      lines.map((l) => ({
        lineTotalDoc: l.lineTotalDoc,
        lineTotalBase: l.lineTotalBase,
        taxAmountDoc: l.taxAmountDoc,
        taxAmountBase: l.taxAmountBase,
      }))
    );

    const rfqNumber = await generateRFQNumber(input.companyId, this.rfqRepo);
    const now = new Date();

    const rfq = new PurchaseRFQ({
      id: randomUUID(),
      companyId: input.companyId,
      rfqNumber,
      vendorId: input.vendorId,
      vendorName: vendor.displayName,
      status: 'DRAFT',
      version: 1,
      originRfqId: undefined,
      rfqDate: input.rfqDate,
      validUntil: input.validUntil,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      lines,
      subtotalDoc: totals.subtotalDoc,
      taxTotalDoc: totals.taxTotalDoc,
      grandTotalDoc: totals.grandTotalDoc,
      subtotalBase: totals.subtotalBase,
      taxTotalBase: totals.taxTotalBase,
      grandTotalBase: totals.grandTotalBase,
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.rfqRepo.create(rfq);
    return rfq;
  }
}

// UpdatePurchaseRFQUseCase
export class UpdatePurchaseRFQUseCase {
  constructor(
    private readonly rfqRepo: IPurchaseRFQRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(input: UpdatePurchaseRFQInput): Promise<PurchaseRFQ> {
    const current = await this.rfqRepo.getById(input.companyId, input.id);
    if (!current) throw new Error(`Purchase RFQ not found: ${input.id}`);
    if (current.status !== 'DRAFT') {
      throw new Error('Only DRAFT RFQs can be updated');
    }

    const vendorId = input.vendorId ?? current.vendorId;
    const vendor = await this.partyRepo.getById(input.companyId, vendorId);
    if (!vendor) throw new Error(`Vendor not found: ${vendorId}`);
    if (!vendor.roles.includes('VENDOR')) {
      throw new Error(`Party is not a vendor: ${vendorId}`);
    }

    const exchangeRate = input.exchangeRate ?? current.exchangeRate;
    const rawLines: PurchaseRFQLineInput[] = input.lines
      ? input.lines
      : current.lines.map((l) => ({
          lineId: l.lineId,
          lineNo: l.lineNo,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          quotedQty: l.quotedQty,
          uomId: l.uomId,
          uom: l.uom,
          unitPriceDoc: l.unitPriceDoc,
          discountType: l.discountType,
          discountValue: l.discountValue,
          discountAmountDoc: l.discountAmountDoc,
          taxCodeId: l.taxCodeId,
          taxRate: l.taxRate,
          description: l.description,
        }));

    const lines = rawLines.map((l, i) => buildRFQLine(l, i, exchangeRate));
    const totals = calculateRFQTotals(
      lines.map((l) => ({
        lineTotalDoc: l.lineTotalDoc,
        lineTotalBase: l.lineTotalBase,
        taxAmountDoc: l.taxAmountDoc,
        taxAmountBase: l.taxAmountBase,
      }))
    );

    const updated = new PurchaseRFQ({
      id: current.id,
      companyId: current.companyId,
      rfqNumber: current.rfqNumber,
      vendorId,
      vendorName: vendor.displayName,
      status: current.status,
      version: current.version,
      originRfqId: current.originRfqId,
      rfqDate: input.rfqDate ?? current.rfqDate,
      validUntil: input.validUntil ?? current.validUntil,
      currency: input.currency ?? current.currency,
      exchangeRate,
      lines,
      subtotalDoc: totals.subtotalDoc,
      taxTotalDoc: totals.taxTotalDoc,
      grandTotalDoc: totals.grandTotalDoc,
      subtotalBase: totals.subtotalBase,
      taxTotalBase: totals.taxTotalBase,
      grandTotalBase: totals.grandTotalBase,
      notes: input.notes ?? current.notes,
      convertedToType: current.convertedToType,
      convertedToId: current.convertedToId,
      createdBy: current.createdBy,
      createdAt: current.createdAt,
      updatedAt: new Date(),
    });

    await this.rfqRepo.update(updated);
    return updated;
  }
}

// GetPurchaseRFQUseCase
export class GetPurchaseRFQUseCase {
  constructor(private readonly rfqRepo: IPurchaseRFQRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseRFQ> {
    const rfq = await this.rfqRepo.getById(companyId, id);
    if (!rfq) throw new Error(`Purchase RFQ not found: ${id}`);
    return rfq;
  }
}

// ListPurchaseRFQsUseCase
export class ListPurchaseRFQsUseCase {
  constructor(private readonly rfqRepo: IPurchaseRFQRepository) {}

  async execute(companyId: string, filters: ListPurchaseRFQsFilters = {}): Promise<PurchaseRFQ[]> {
    return this.rfqRepo.list(companyId, {
      status: filters.status,
      vendorId: filters.vendorId,
      limit: filters.limit,
      offset: filters.offset,
    });
  }
}

// DeletePurchaseRFQUseCase
export class DeletePurchaseRFQUseCase {
  constructor(private readonly rfqRepo: IPurchaseRFQRepository) {}

  async execute(companyId: string, id: string): Promise<void> {
    const rfq = await this.rfqRepo.getById(companyId, id);
    if (!rfq) throw new Error(`Purchase RFQ not found: ${id}`);
    if (rfq.status !== 'DRAFT') {
      throw new Error('Only DRAFT RFQs can be deleted');
    }
    await this.rfqRepo.delete(companyId, id);
  }
}

// SendPurchaseRFQUseCase
export class SendPurchaseRFQUseCase {
  constructor(private readonly rfqRepo: IPurchaseRFQRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseRFQ> {
    const rfq = await this.rfqRepo.getById(companyId, id);
    if (!rfq) throw new Error(`Purchase RFQ not found: ${id}`);
    rfq.markSent();
    await this.rfqRepo.update(rfq);
    return rfq;
  }
}

// AcceptPurchaseRFQUseCase
export class AcceptPurchaseRFQUseCase {
  constructor(private readonly rfqRepo: IPurchaseRFQRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseRFQ> {
    const rfq = await this.rfqRepo.getById(companyId, id);
    if (!rfq) throw new Error(`Purchase RFQ not found: ${id}`);
    rfq.markAccepted();
    await this.rfqRepo.update(rfq);
    return rfq;
  }
}

// RejectPurchaseRFQUseCase
export class RejectPurchaseRFQUseCase {
  constructor(private readonly rfqRepo: IPurchaseRFQRepository) {}

  async execute(companyId: string, id: string): Promise<PurchaseRFQ> {
    const rfq = await this.rfqRepo.getById(companyId, id);
    if (!rfq) throw new Error(`Purchase RFQ not found: ${id}`);
    rfq.markRejected();
    await this.rfqRepo.update(rfq);
    return rfq;
  }
}

// ConvertPurchaseRFQToOrderUseCase
export class ConvertPurchaseRFQToOrderUseCase {
  constructor(
    private readonly rfqRepo: IPurchaseRFQRepository,
    private readonly createPurchaseOrderUseCase: CreatePurchaseOrderUseCase
  ) {}

  async execute(companyId: string, id: string, createdBy: string): Promise<{ rfq: PurchaseRFQ; purchaseOrderId: string }> {
    const rfq = await this.rfqRepo.getById(companyId, id);
    if (!rfq) throw new Error(`Purchase RFQ not found: ${id}`);
    if (rfq.status !== 'ACCEPTED') {
      throw new Error(`Purchase RFQ must be ACCEPTED to convert to a Purchase Order (current: ${rfq.status})`);
    }

    const poInput: CreatePurchaseOrderInput = {
      companyId: rfq.companyId,
      vendorId: rfq.vendorId,
      orderDate: rfq.rfqDate,
      currency: rfq.currency,
      exchangeRate: rfq.exchangeRate,
      lines: rfq.lines.map((l) => ({
        lineId: randomUUID(),
        itemId: l.itemId,
        orderedQty: l.quotedQty,
        uomId: l.uomId,
        uom: l.uom,
        unitPriceDoc: l.unitPriceDoc,
        taxCodeId: l.taxCodeId,
        description: l.description,
      })),
      notes: rfq.notes,
      createdBy,
    };

    const po = await this.createPurchaseOrderUseCase.execute(poInput);

    rfq.markConverted('PURCHASE_ORDER', po.id);
    await this.rfqRepo.update(rfq);

    return { rfq, purchaseOrderId: po.id };
  }
}

// ConvertPurchaseRFQToInvoiceUseCase
export class ConvertPurchaseRFQToInvoiceUseCase {
  constructor(
    private readonly rfqRepo: IPurchaseRFQRepository,
    private readonly createPurchaseInvoiceUseCase: CreatePurchaseInvoiceUseCase
  ) {}

  async execute(companyId: string, id: string, createdBy: string): Promise<{ rfq: PurchaseRFQ; purchaseInvoiceId: string }> {
    const rfq = await this.rfqRepo.getById(companyId, id);
    if (!rfq) throw new Error(`Purchase RFQ not found: ${id}`);
    if (rfq.status !== 'ACCEPTED') {
      throw new Error(`Purchase RFQ must be ACCEPTED to convert to a Purchase Invoice (current: ${rfq.status})`);
    }

    const piInput: CreatePurchaseInvoiceInput = {
      companyId: rfq.companyId,
      persona: 'direct',
      vendorId: rfq.vendorId,
      invoiceDate: rfq.rfqDate,
      currency: rfq.currency,
      exchangeRate: rfq.exchangeRate,
      lines: rfq.lines.map((l) => ({
        lineId: randomUUID(),
        itemId: l.itemId,
        invoicedQty: l.quotedQty,
        uomId: l.uomId,
        uom: l.uom,
        unitPriceDoc: l.unitPriceDoc,
        taxCodeId: l.taxCodeId,
        description: l.description,
      })),
      notes: rfq.notes,
      createdBy,
    };

    const pi = await this.createPurchaseInvoiceUseCase.execute(piInput);

    rfq.markConverted('PURCHASE_INVOICE', pi.id);
    await this.rfqRepo.update(rfq);

    return { rfq, purchaseInvoiceId: pi.id };
  }
}
