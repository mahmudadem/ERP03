import { DNStatus } from '../../domain/sales/entities/DeliveryNote';
import { PaymentStatus, SIStatus } from '../../domain/sales/entities/SalesInvoice';
import { SOStatus } from '../../domain/sales/entities/SalesOrder';
import { SRStatus } from '../../domain/sales/entities/SalesReturn';
import { ApiError } from '../errors/ApiError';

const SO_STATUSES: SOStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_DELIVERED',
  'FULLY_DELIVERED',
  'CLOSED',
  'CANCELLED',
];

const DN_STATUSES: DNStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const SI_STATUSES: SIStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const SR_STATUSES: SRStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];

const ensureRequiredString = (value: any, fieldName: string) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw ApiError.badRequest(`${fieldName} is required`);
  }
};

const ensureNumber = (value: any, fieldName: string) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw ApiError.badRequest(`${fieldName} must be a number`);
  }
};

const ensurePositiveNumber = (value: any, fieldName: string) => {
  ensureNumber(value, fieldName);
  if (value <= 0) {
    throw ApiError.badRequest(`${fieldName} must be a positive number`);
  }
};

const ensureNonNegativeNumber = (value: any, fieldName: string) => {
  ensureNumber(value, fieldName);
  if (value < 0) {
    throw ApiError.badRequest(`${fieldName} must be greater than or equal to 0`);
  }
};

const ensureBoolean = (value: any, fieldName: string) => {
  if (typeof value !== 'boolean') {
    throw ApiError.badRequest(`${fieldName} must be boolean`);
  }
};

const ensureIsoDate = (value: any, fieldName: string) => {
  if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw ApiError.badRequest(`${fieldName} must be in YYYY-MM-DD format`);
  }
};

const ensureControlMode = (value: any, fieldName: string) => {
  if (value !== 'SIMPLE' && value !== 'CONTROLLED') {
    throw ApiError.badRequest(`${fieldName} must be SIMPLE or CONTROLLED`);
  }
};

const ensureOptionalNumber = (value: any, fieldName: string) => {
  if (value === undefined) return;
  ensureNumber(value, fieldName);
};

const ensureOptionalString = (value: any, fieldName: string) => {
  if (value === undefined) return;
  ensureRequiredString(value, fieldName);
};

const validateSOLine = (line: any, index: number) => {
  ensureRequiredString(line.itemId, `lines[${index}].itemId`);
  ensurePositiveNumber(line.orderedQty, `lines[${index}].orderedQty`);
  ensureNonNegativeNumber(line.unitPriceDoc, `lines[${index}].unitPriceDoc`);

  if (line.lineNo !== undefined) {
    ensurePositiveNumber(line.lineNo, `lines[${index}].lineNo`);
  }

  if (line.taxCodeId !== undefined) {
    ensureOptionalString(line.taxCodeId, `lines[${index}].taxCodeId`);
  }

  if (line.uom !== undefined) {
    ensureOptionalString(line.uom, `lines[${index}].uom`);
  }

  if (line.warehouseId !== undefined) {
    ensureOptionalString(line.warehouseId, `lines[${index}].warehouseId`);
  }

  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

const validateDNLine = (line: any, index: number) => {
  if (line.itemId !== undefined) ensureOptionalString(line.itemId, `lines[${index}].itemId`);
  if (line.soLineId !== undefined) ensureOptionalString(line.soLineId, `lines[${index}].soLineId`);
  if (!line.itemId && !line.soLineId) {
    throw ApiError.badRequest(`lines[${index}] must include itemId or soLineId`);
  }

  ensurePositiveNumber(line.deliveredQty, `lines[${index}].deliveredQty`);

  if (line.lineNo !== undefined) ensurePositiveNumber(line.lineNo, `lines[${index}].lineNo`);
  if (line.uom !== undefined) ensureOptionalString(line.uom, `lines[${index}].uom`);
  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

const validateSILine = (line: any, index: number) => {
  if (line.itemId !== undefined) ensureOptionalString(line.itemId, `lines[${index}].itemId`);
  if (line.soLineId !== undefined) ensureOptionalString(line.soLineId, `lines[${index}].soLineId`);
  if (!line.itemId && !line.soLineId) {
    throw ApiError.badRequest(`lines[${index}] must include itemId or soLineId`);
  }

  ensurePositiveNumber(line.invoicedQty, `lines[${index}].invoicedQty`);

  if (line.lineNo !== undefined) ensurePositiveNumber(line.lineNo, `lines[${index}].lineNo`);
  if (line.uom !== undefined) ensureOptionalString(line.uom, `lines[${index}].uom`);
  if (line.unitPriceDoc !== undefined) ensureNonNegativeNumber(line.unitPriceDoc, `lines[${index}].unitPriceDoc`);
  if (line.taxCodeId !== undefined) ensureOptionalString(line.taxCodeId, `lines[${index}].taxCodeId`);
  if (line.warehouseId !== undefined) ensureOptionalString(line.warehouseId, `lines[${index}].warehouseId`);
  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

const validateSRLine = (line: any, index: number) => {
  if (line.siLineId !== undefined) ensureOptionalString(line.siLineId, `lines[${index}].siLineId`);
  if (line.dnLineId !== undefined) ensureOptionalString(line.dnLineId, `lines[${index}].dnLineId`);
  if (line.soLineId !== undefined) ensureOptionalString(line.soLineId, `lines[${index}].soLineId`);
  if (line.itemId !== undefined) ensureOptionalString(line.itemId, `lines[${index}].itemId`);
  if (line.returnQty !== undefined) ensurePositiveNumber(line.returnQty, `lines[${index}].returnQty`);
  if (line.uom !== undefined) ensureOptionalString(line.uom, `lines[${index}].uom`);
  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

export const validateInitializeSalesInput = (body: any) => {
  ensureRequiredString(body.defaultARAccountId, 'defaultARAccountId');
  ensureRequiredString(body.defaultRevenueAccountId, 'defaultRevenueAccountId');
  ensureControlMode(body.salesControlMode, 'salesControlMode');

  if (body.requireSOForStockItems !== undefined) ensureBoolean(body.requireSOForStockItems, 'requireSOForStockItems');
  if (body.allowOverDelivery !== undefined) ensureBoolean(body.allowOverDelivery, 'allowOverDelivery');
  if (body.overDeliveryTolerancePct !== undefined) ensureNonNegativeNumber(body.overDeliveryTolerancePct, 'overDeliveryTolerancePct');
  if (body.overInvoiceTolerancePct !== undefined) ensureNonNegativeNumber(body.overInvoiceTolerancePct, 'overInvoiceTolerancePct');
  if (body.defaultPaymentTermsDays !== undefined) ensureNonNegativeNumber(body.defaultPaymentTermsDays, 'defaultPaymentTermsDays');

  ensureOptionalString(body.defaultCOGSAccountId, 'defaultCOGSAccountId');
  ensureOptionalString(body.defaultSalesExpenseAccountId, 'defaultSalesExpenseAccountId');
  ensureOptionalString(body.salesVoucherTypeId, 'salesVoucherTypeId');
  ensureOptionalString(body.defaultWarehouseId, 'defaultWarehouseId');
  ensureOptionalString(body.soNumberPrefix, 'soNumberPrefix');
  ensureOptionalString(body.dnNumberPrefix, 'dnNumberPrefix');
  ensureOptionalString(body.siNumberPrefix, 'siNumberPrefix');
  ensureOptionalString(body.srNumberPrefix, 'srNumberPrefix');

  ensureOptionalNumber(body.soNumberNextSeq, 'soNumberNextSeq');
  ensureOptionalNumber(body.dnNumberNextSeq, 'dnNumberNextSeq');
  ensureOptionalNumber(body.siNumberNextSeq, 'siNumberNextSeq');
  ensureOptionalNumber(body.srNumberNextSeq, 'srNumberNextSeq');
};

export const validateUpdateSalesSettingsInput = (body: any) => {
  if (body.salesControlMode !== undefined) ensureControlMode(body.salesControlMode, 'salesControlMode');
  if (body.requireSOForStockItems !== undefined) ensureBoolean(body.requireSOForStockItems, 'requireSOForStockItems');
  if (body.defaultARAccountId !== undefined) ensureRequiredString(body.defaultARAccountId, 'defaultARAccountId');
  if (body.defaultRevenueAccountId !== undefined) ensureRequiredString(body.defaultRevenueAccountId, 'defaultRevenueAccountId');
  if (body.defaultCOGSAccountId !== undefined) ensureOptionalString(body.defaultCOGSAccountId, 'defaultCOGSAccountId');
  if (body.defaultSalesExpenseAccountId !== undefined) ensureOptionalString(body.defaultSalesExpenseAccountId, 'defaultSalesExpenseAccountId');
  if (body.allowOverDelivery !== undefined) ensureBoolean(body.allowOverDelivery, 'allowOverDelivery');
  if (body.overDeliveryTolerancePct !== undefined) ensureNonNegativeNumber(body.overDeliveryTolerancePct, 'overDeliveryTolerancePct');
  if (body.overInvoiceTolerancePct !== undefined) ensureNonNegativeNumber(body.overInvoiceTolerancePct, 'overInvoiceTolerancePct');
  if (body.defaultPaymentTermsDays !== undefined) ensureNonNegativeNumber(body.defaultPaymentTermsDays, 'defaultPaymentTermsDays');
  if (body.salesVoucherTypeId !== undefined) ensureOptionalString(body.salesVoucherTypeId, 'salesVoucherTypeId');
  if (body.defaultWarehouseId !== undefined) ensureOptionalString(body.defaultWarehouseId, 'defaultWarehouseId');
  if (body.soNumberPrefix !== undefined) ensureOptionalString(body.soNumberPrefix, 'soNumberPrefix');
  if (body.dnNumberPrefix !== undefined) ensureOptionalString(body.dnNumberPrefix, 'dnNumberPrefix');
  if (body.siNumberPrefix !== undefined) ensureOptionalString(body.siNumberPrefix, 'siNumberPrefix');
  if (body.srNumberPrefix !== undefined) ensureOptionalString(body.srNumberPrefix, 'srNumberPrefix');
  if (body.soNumberNextSeq !== undefined) ensurePositiveNumber(body.soNumberNextSeq, 'soNumberNextSeq');
  if (body.dnNumberNextSeq !== undefined) ensurePositiveNumber(body.dnNumberNextSeq, 'dnNumberNextSeq');
  if (body.siNumberNextSeq !== undefined) ensurePositiveNumber(body.siNumberNextSeq, 'siNumberNextSeq');
  if (body.srNumberNextSeq !== undefined) ensurePositiveNumber(body.srNumberNextSeq, 'srNumberNextSeq');
};

export const validateCreateSalesOrderInput = (body: any) => {
  ensureRequiredString(body.customerId, 'customerId');
  ensureIsoDate(body.orderDate, 'orderDate');
  ensureRequiredString(body.currency, 'currency');
  ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw ApiError.badRequest('lines must be a non-empty array');
  }

  body.lines.forEach((line: any, index: number) => validateSOLine(line, index));
};

export const validateUpdateSalesOrderInput = (body: any) => {
  if (body.customerId !== undefined) ensureRequiredString(body.customerId, 'customerId');
  if (body.orderDate !== undefined) ensureIsoDate(body.orderDate, 'orderDate');
  if (body.expectedDeliveryDate !== undefined) ensureIsoDate(body.expectedDeliveryDate, 'expectedDeliveryDate');
  if (body.currency !== undefined) ensureRequiredString(body.currency, 'currency');
  if (body.exchangeRate !== undefined) ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array');
    }
    body.lines.forEach((line: any, index: number) => validateSOLine(line, index));
  }
};

export const validateListSalesOrdersQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as SOStatus;
    if (!SO_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${SO_STATUSES.join(', ')}`);
    }
  }

  if (query.customerId !== undefined && typeof query.customerId !== 'string') {
    throw ApiError.badRequest('customerId must be a string');
  }

  if (query.dateFrom !== undefined) ensureIsoDate(query.dateFrom, 'dateFrom');
  if (query.dateTo !== undefined) ensureIsoDate(query.dateTo, 'dateTo');

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (Number.isNaN(limit) || limit <= 0) {
      throw ApiError.badRequest('limit must be a positive number');
    }
  }

  if (query.offset !== undefined) {
    const offset = Number(query.offset);
    if (Number.isNaN(offset) || offset < 0) {
      throw ApiError.badRequest('offset must be a number greater than or equal to 0');
    }
  }
};

export const validateCreateDeliveryNoteInput = (body: any) => {
  if (body.salesOrderId !== undefined) ensureOptionalString(body.salesOrderId, 'salesOrderId');
  if (body.customerId !== undefined) ensureOptionalString(body.customerId, 'customerId');
  ensureIsoDate(body.deliveryDate, 'deliveryDate');
  ensureRequiredString(body.warehouseId, 'warehouseId');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateDNLine(line, index));
  }
};

export const validateListDeliveryNotesQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as DNStatus;
    if (!DN_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${DN_STATUSES.join(', ')}`);
    }
  }

  if (query.salesOrderId !== undefined && typeof query.salesOrderId !== 'string') {
    throw ApiError.badRequest('salesOrderId must be a string');
  }

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (Number.isNaN(limit) || limit <= 0) {
      throw ApiError.badRequest('limit must be a positive number');
    }
  }
};

export const validateCreateSalesInvoiceInput = (body: any) => {
  if (body.salesOrderId !== undefined) ensureOptionalString(body.salesOrderId, 'salesOrderId');
  ensureRequiredString(body.customerId, 'customerId');
  ensureIsoDate(body.invoiceDate, 'invoiceDate');
  if (body.dueDate !== undefined) ensureIsoDate(body.dueDate, 'dueDate');
  if (body.customerInvoiceNumber !== undefined) ensureOptionalString(body.customerInvoiceNumber, 'customerInvoiceNumber');
  if (body.currency !== undefined) ensureOptionalString(body.currency, 'currency');
  if (body.exchangeRate !== undefined) ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateSILine(line, index));
  }
};

export const validateUpdateSalesInvoiceInput = (body: any) => {
  if (body.customerId !== undefined) ensureOptionalString(body.customerId, 'customerId');
  if (body.customerInvoiceNumber !== undefined) ensureOptionalString(body.customerInvoiceNumber, 'customerInvoiceNumber');
  if (body.invoiceDate !== undefined) ensureIsoDate(body.invoiceDate, 'invoiceDate');
  if (body.dueDate !== undefined) ensureIsoDate(body.dueDate, 'dueDate');
  if (body.currency !== undefined) ensureOptionalString(body.currency, 'currency');
  if (body.exchangeRate !== undefined) ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateSILine(line, index));
  }
};

export const validateListSalesInvoicesQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as SIStatus;
    if (!SI_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${SI_STATUSES.join(', ')}`);
    }
  }

  if (query.paymentStatus !== undefined) {
    const paymentStatus = String(query.paymentStatus).toUpperCase() as PaymentStatus;
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      throw ApiError.badRequest(`paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`);
    }
  }

  if (query.customerId !== undefined && typeof query.customerId !== 'string') {
    throw ApiError.badRequest('customerId must be a string');
  }

  if (query.salesOrderId !== undefined && typeof query.salesOrderId !== 'string') {
    throw ApiError.badRequest('salesOrderId must be a string');
  }

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (Number.isNaN(limit) || limit <= 0) {
      throw ApiError.badRequest('limit must be a positive number');
    }
  }
};

export const validateCreateSalesReturnInput = (body: any) => {
  if (!body.salesInvoiceId && !body.deliveryNoteId) {
    throw ApiError.badRequest('salesInvoiceId or deliveryNoteId is required');
  }
  if (body.salesInvoiceId !== undefined) ensureOptionalString(body.salesInvoiceId, 'salesInvoiceId');
  if (body.deliveryNoteId !== undefined) ensureOptionalString(body.deliveryNoteId, 'deliveryNoteId');
  if (body.salesOrderId !== undefined) ensureOptionalString(body.salesOrderId, 'salesOrderId');
  ensureIsoDate(body.returnDate, 'returnDate');
  if (body.warehouseId !== undefined) ensureOptionalString(body.warehouseId, 'warehouseId');
  ensureRequiredString(body.reason, 'reason');
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    throw ApiError.badRequest('notes must be a string');
  }

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateSRLine(line, index));
  }
};

export const validateListSalesReturnsQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as SRStatus;
    if (!SR_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${SR_STATUSES.join(', ')}`);
    }
  }

  if (query.customerId !== undefined && typeof query.customerId !== 'string') {
    throw ApiError.badRequest('customerId must be a string');
  }
  if (query.salesInvoiceId !== undefined && typeof query.salesInvoiceId !== 'string') {
    throw ApiError.badRequest('salesInvoiceId must be a string');
  }
  if (query.deliveryNoteId !== undefined && typeof query.deliveryNoteId !== 'string') {
    throw ApiError.badRequest('deliveryNoteId must be a string');
  }
};

export const validateUpdateSalesInvoicePaymentStatusInput = (body: any) => {
  ensureNumber(body.paidAmountBase, 'paidAmountBase');
};
