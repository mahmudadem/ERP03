import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPrintLayoutTemplateRepository } from '../../../repository/interfaces/print-layout/IPrintLayoutTemplateRepository';
import { IPrintLayoutCore, PrintLayoutSchema } from '../../system-core/contracts/IPrintLayoutCore';

export interface PurchaseInvoicePrintTemplateResult {
  id?: string;
  name: string;
  documentType: 'PURCHASE_INVOICE';
  isDefault: boolean;
  source: 'SAVED_TEMPLATE' | 'GENERATED_DEFAULT';
  layout: PrintLayoutSchema;
}

export interface PurchaseInvoicePrintPayload {
  company: {
    name: string;
    taxNumber?: string;
  };
  invoice: {
    number: string;
    vendorReference?: string;
    date: string;
    dueDate?: string;
    status: string;
    currency: string;
  };
  vendor: {
    id: string;
    name: string;
    taxNumber?: string;
  };
  lines: Array<{
    itemCode: string;
    description: string;
    qty: number;
    uom: string;
    unitPrice: number;
    discount: number;
    tax: number;
    warehouse: string;
    lineTotal: number;
  }>;
  totals: {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
    paid: number;
    outstanding: number;
    currency: string;
  };
  notes?: string;
}

export interface PrintPurchaseInvoiceResult {
  payload: PurchaseInvoicePrintPayload;
  printTemplate: PurchaseInvoicePrintTemplateResult;
}

export class PrintPurchaseInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: IPurchaseInvoiceRepository,
    private readonly printLayoutTemplateRepo: IPrintLayoutTemplateRepository,
    private readonly printLayoutCore: IPrintLayoutCore
  ) {}

  async execute(
    companyId: string,
    invoiceId: string,
    company: { name?: string; taxNumber?: string } = {}
  ): Promise<PrintPurchaseInvoiceResult> {
    const invoice = await this.invoiceRepo.getById(companyId, invoiceId);
    if (!invoice) throw new Error('Purchase invoice not found');

    return {
      payload: toPrintPayload(invoice, company),
      printTemplate: await resolvePurchaseInvoicePrintTemplate(companyId, this.printLayoutTemplateRepo, this.printLayoutCore),
    };
  }
}

async function resolvePurchaseInvoicePrintTemplate(
  companyId: string,
  printLayoutTemplateRepo: IPrintLayoutTemplateRepository,
  printLayoutCore: IPrintLayoutCore
): Promise<PurchaseInvoicePrintTemplateResult> {
  const saved = await printLayoutTemplateRepo.getDefault(companyId, 'PURCHASE_INVOICE');
  if (saved) {
    return {
      id: saved.id,
      name: saved.name,
      documentType: 'PURCHASE_INVOICE',
      isDefault: saved.isDefault,
      source: 'SAVED_TEMPLATE',
      layout: saved.layout,
    };
  }

  return {
    name: 'PURCHASE INVOICE Default',
    documentType: 'PURCHASE_INVOICE',
    isDefault: true,
    source: 'GENERATED_DEFAULT',
    layout: printLayoutCore.createDefaultLayout('PURCHASE_INVOICE'),
  };
}

function toPrintPayload(invoice: PurchaseInvoice, company: { name?: string; taxNumber?: string }): PurchaseInvoicePrintPayload {
  return {
    company: {
      name: company.name || 'Company',
      taxNumber: company.taxNumber,
    },
    invoice: {
      number: invoice.invoiceNumber,
      vendorReference: invoice.vendorInvoiceNumber,
      date: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      currency: invoice.currency,
    },
    vendor: {
      id: invoice.vendorId,
      name: invoice.vendorName,
    },
    lines: invoice.lines.map((line) => ({
      itemCode: line.itemCode || '',
      description: line.description || line.itemName || line.itemCode || '',
      qty: line.invoicedQty,
      uom: line.uom || '',
      unitPrice: line.unitPriceDoc,
      discount: line.discountAmountDoc || 0,
      tax: line.taxAmountDoc || 0,
      warehouse: line.warehouseId || '',
      lineTotal: (line.lineTotalDoc || 0) + (line.taxAmountDoc || 0),
    })),
    totals: {
      subtotal: invoice.subtotalDoc,
      discountTotal: invoice.lines.reduce((sum, line) => sum + (line.discountAmountDoc || 0), 0),
      taxTotal: invoice.taxTotalDoc,
      grandTotal: invoice.grandTotalDoc,
      paid: invoice.paidAmountBase,
      outstanding: invoice.outstandingAmountBase,
      currency: invoice.currency,
    },
    notes: invoice.notes,
  };
}
