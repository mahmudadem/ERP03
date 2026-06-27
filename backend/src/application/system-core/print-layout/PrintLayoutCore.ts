import {
  IPrintLayoutCore,
  PrintDataSchema,
  PrintDocumentType,
  PrintLayoutComponent,
  PrintLayoutSchema,
  PrintPaperProfile,
} from '../contracts/IPrintLayoutCore';

const PAPER_PRESETS: Record<string, PrintPaperProfile> = {
  A4: { type: 'A4', width: 210, height: 297, unit: 'mm', marginTop: 12, marginRight: 12, marginBottom: 12, marginLeft: 12, orientation: 'portrait' },
  A5: { type: 'A5', width: 148, height: 210, unit: 'mm', marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10, orientation: 'portrait' },
  RECEIPT_80: { type: 'RECEIPT_80', width: 80, height: 220, unit: 'mm', marginTop: 3, marginRight: 3, marginBottom: 3, marginLeft: 3 },
  RECEIPT_58: { type: 'RECEIPT_58', width: 58, height: 220, unit: 'mm', marginTop: 3, marginRight: 3, marginBottom: 3, marginLeft: 3 },
};

const POS_RECEIPT_SCHEMA: PrintDataSchema = {
  documentType: 'POS_RECEIPT',
  requiredFields: ['receipt.number', 'receipt.date', 'totals.grandTotal'],
  fields: [
    { path: 'company.name', label: 'Company Name', type: 'text', required: true },
    { path: 'company.taxNumber', label: 'Tax Number', type: 'text' },
    { path: 'receipt.number', label: 'Receipt Number', type: 'text', required: true },
    { path: 'receipt.date', label: 'Receipt Date', type: 'date', required: true },
    { path: 'receipt.cashierName', label: 'Cashier', type: 'text' },
    { path: 'receipt.registerName', label: 'Register', type: 'text' },
    { path: 'customer.name', label: 'Customer', type: 'text' },
    { path: 'totals.subtotal', label: 'Subtotal', type: 'money' },
    { path: 'totals.discountTotal', label: 'Discount Total', type: 'money' },
    { path: 'totals.taxTotal', label: 'Tax Total', type: 'money' },
    { path: 'totals.grandTotal', label: 'Grand Total', type: 'money', required: true },
    { path: 'payments.summary', label: 'Payment Summary', type: 'text' },
  ],
  tables: [{
    path: 'lines',
    label: 'Receipt Lines',
    columns: [
      { path: 'itemName', label: 'Item', type: 'text', required: true },
      { path: 'qty', label: 'Qty', type: 'number', required: true },
      { path: 'unitPrice', label: 'Price', type: 'money' },
      { path: 'discount', label: 'Discount', type: 'money' },
      { path: 'tax', label: 'Tax', type: 'money' },
      { path: 'lineTotal', label: 'Total', type: 'money', required: true },
    ],
  }],
};

const SALES_INVOICE_SCHEMA: PrintDataSchema = {
  documentType: 'SALES_INVOICE',
  requiredFields: ['invoice.number', 'invoice.date', 'totals.grandTotal'],
  fields: [
    { path: 'company.name', label: 'Company Name', type: 'text', required: true },
    { path: 'invoice.number', label: 'Invoice Number', type: 'text', required: true },
    { path: 'invoice.date', label: 'Invoice Date', type: 'date', required: true },
    { path: 'invoice.dueDate', label: 'Due Date', type: 'date' },
    { path: 'customer.name', label: 'Customer', type: 'text', required: true },
    { path: 'customer.taxNumber', label: 'Customer Tax Number', type: 'text' },
    { path: 'totals.subtotal', label: 'Subtotal', type: 'money' },
    { path: 'totals.discountTotal', label: 'Discount Total', type: 'money' },
    { path: 'totals.taxTotal', label: 'Tax Total', type: 'money' },
    { path: 'totals.grandTotal', label: 'Grand Total', type: 'money', required: true },
  ],
  tables: [{
    path: 'lines',
    label: 'Invoice Lines',
    columns: [
      { path: 'itemCode', label: 'Code', type: 'text' },
      { path: 'description', label: 'Description', type: 'text', required: true },
      { path: 'qty', label: 'Qty', type: 'number', required: true },
      { path: 'unitPrice', label: 'Price', type: 'money' },
      { path: 'discount', label: 'Discount', type: 'money' },
      { path: 'tax', label: 'Tax', type: 'money' },
      { path: 'lineTotal', label: 'Total', type: 'money', required: true },
    ],
  }],
};

const PURCHASE_INVOICE_SCHEMA: PrintDataSchema = {
  documentType: 'PURCHASE_INVOICE',
  requiredFields: ['invoice.number', 'invoice.date', 'totals.grandTotal'],
  fields: [
    { path: 'company.name', label: 'Company Name', type: 'text', required: true },
    { path: 'invoice.number', label: 'Invoice Number', type: 'text', required: true },
    { path: 'invoice.vendorReference', label: 'Vendor Invoice / Ref', type: 'text' },
    { path: 'invoice.date', label: 'Invoice Date', type: 'date', required: true },
    { path: 'invoice.dueDate', label: 'Due Date', type: 'date' },
    { path: 'vendor.name', label: 'Vendor', type: 'text', required: true },
    { path: 'vendor.taxNumber', label: 'Vendor Tax Number', type: 'text' },
    { path: 'totals.subtotal', label: 'Subtotal', type: 'money' },
    { path: 'totals.discountTotal', label: 'Discount Total', type: 'money' },
    { path: 'totals.taxTotal', label: 'Tax Total', type: 'money' },
    { path: 'totals.grandTotal', label: 'Grand Total', type: 'money', required: true },
    { path: 'totals.outstanding', label: 'Outstanding', type: 'money' },
  ],
  tables: [{
    path: 'lines',
    label: 'Purchase Invoice Lines',
    columns: [
      { path: 'itemCode', label: 'Code', type: 'text' },
      { path: 'description', label: 'Description', type: 'text', required: true },
      { path: 'qty', label: 'Qty', type: 'number', required: true },
      { path: 'uom', label: 'UOM', type: 'text' },
      { path: 'unitPrice', label: 'Cost', type: 'money' },
      { path: 'discount', label: 'Discount', type: 'money' },
      { path: 'tax', label: 'Tax', type: 'money' },
      { path: 'warehouse', label: 'Warehouse', type: 'text' },
      { path: 'lineTotal', label: 'Total', type: 'money', required: true },
    ],
  }],
};

export class PrintLayoutCore implements IPrintLayoutCore {
  getDataSchema(documentType: PrintDocumentType): PrintDataSchema {
    if (documentType === 'SALES_INVOICE') return SALES_INVOICE_SCHEMA;
    if (documentType === 'PURCHASE_INVOICE') return PURCHASE_INVOICE_SCHEMA;
    return POS_RECEIPT_SCHEMA;
  }

  createDefaultLayout(documentType: PrintDocumentType): PrintLayoutSchema {
    const paper = documentType === 'POS_RECEIPT' ? PAPER_PRESETS.RECEIPT_80 : PAPER_PRESETS.A4;
    const isInvoice = documentType === 'SALES_INVOICE' || documentType === 'PURCHASE_INVOICE';
    const components: PrintLayoutComponent[] = [
      { id: 'title', type: 'field', fieldPath: 'company.name', x: 8, y: 8, width: paper.width - 16, height: 10, style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' } },
      { id: 'doc_no', type: 'field', fieldPath: isInvoice ? 'invoice.number' : 'receipt.number', label: 'Document No', x: 8, y: 24, width: paper.width - 16, height: 8, style: { fontSize: 10, fontWeight: 'bold' } },
      { id: 'doc_date', type: 'field', fieldPath: isInvoice ? 'invoice.date' : 'receipt.date', label: 'Date', x: 8, y: 34, width: paper.width - 16, height: 8, style: { fontSize: 10 } },
      {
        id: 'lines',
        type: 'table',
        tablePath: 'lines',
        x: 8,
        y: 48,
        width: paper.width - 16,
        height: documentType === 'POS_RECEIPT' ? 86 : 120,
        columns: this.getDataSchema(documentType).tables[0].columns.slice(0, documentType === 'POS_RECEIPT' ? 4 : 6).map((column, index) => ({
          id: column.path,
          label: column.label,
          fieldPath: column.path,
          width: index === 0 ? 42 : 18,
        })),
        tableOptions: {
          headerBackgroundColor: '#E4E4E7',
          headerTextColor: '#18181B',
          rowHeight: documentType === 'POS_RECEIPT' ? 6 : 8,
          overflowMode: 'continue',
          repeatHeaderOnPageBreak: true,
          maxPreviewRows: 12,
        },
        style: { fontSize: 9, borderColor: '#D4D4D8', borderWidth: 1 },
      },
      { id: 'grand_total', type: 'field', fieldPath: 'totals.grandTotal', label: 'Total', x: 8, y: documentType === 'POS_RECEIPT' ? 142 : 178, width: paper.width - 16, height: 10, style: { fontSize: 13, fontWeight: 'bold', textAlign: 'right' } },
    ];

    return { version: 1, paper, components };
  }

  validateLayout(layout: PrintLayoutSchema, dataSchema?: PrintDataSchema): void {
    if (!layout || layout.version !== 1) throw new Error('Print layout version 1 is required.');
    if (!layout.paper || layout.paper.width <= 0 || layout.paper.height <= 0) throw new Error('Print layout paper size is invalid.');
    if (!Array.isArray(layout.components)) throw new Error('Print layout components must be an array.');

    const fieldPaths = new Set(dataSchema?.fields.map((f) => f.path) || []);
    const tables = new Map((dataSchema?.tables || []).map((t) => [t.path, new Set(t.columns.map((c) => c.path))]));

    for (const component of layout.components) {
      if (!component.id?.trim()) throw new Error('Print layout component id is required.');
      if (component.x < 0 || component.y < 0 || component.width <= 0 || component.height <= 0) {
        throw new Error(`Print layout component ${component.id} has invalid bounds.`);
      }
      if (component.x + component.width > layout.paper.width || component.y + component.height > layout.paper.height) {
        throw new Error(`Print layout component ${component.id} is outside the paper area.`);
      }
      if (component.type === 'field' && dataSchema && component.fieldPath && !fieldPaths.has(component.fieldPath)) {
        throw new Error(`Unknown print field: ${component.fieldPath}`);
      }
      if (component.type === 'table' && dataSchema) {
        const tableColumns = component.tablePath ? tables.get(component.tablePath) : undefined;
        if (!tableColumns) throw new Error(`Unknown print table: ${component.tablePath}`);
        if (component.tableOptions) {
          const options = component.tableOptions;
          if (options.rowHeight !== undefined && (options.rowHeight < 3 || options.rowHeight > 40)) {
            throw new Error(`Print table ${component.id} row height must be between 3 and 40.`);
          }
          if (options.maxPreviewRows !== undefined && (options.maxPreviewRows < 1 || options.maxPreviewRows > 200)) {
            throw new Error(`Print table ${component.id} preview rows must be between 1 and 200.`);
          }
          if (options.overflowMode && !['continue', 'clip', 'shrink'].includes(options.overflowMode)) {
            throw new Error(`Print table ${component.id} has an invalid overflow mode.`);
          }
        }
        for (const column of component.columns || []) {
          if (!tableColumns.has(column.fieldPath)) throw new Error(`Unknown print table column: ${column.fieldPath}`);
        }
      }
    }
  }
}
