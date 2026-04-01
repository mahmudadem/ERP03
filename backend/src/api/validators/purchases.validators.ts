import { GRNStatus } from '../../domain/purchases/entities/GoodsReceipt';
import { PaymentStatus, PIStatus } from '../../domain/purchases/entities/PurchaseInvoice';
import { POStatus } from '../../domain/purchases/entities/PurchaseOrder';
import { PRStatus } from '../../domain/purchases/entities/PurchaseReturn';
import { ApiError } from '../errors/ApiError';

const PO_STATUSES: POStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'CLOSED',
  'CANCELLED',
];

const GRN_STATUSES: GRNStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PI_STATUSES: PIStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PR_STATUSES: PRStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
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

const validatePOLine = (line: any, index: number) => {
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

const validateGRNLine = (line: any, index: number) => {
  if (line.itemId !== undefined) ensureOptionalString(line.itemId, `lines[${index}].itemId`);
  if (line.poLineId !== undefined) ensureOptionalString(line.poLineId, `lines[${index}].poLineId`);
  if (!line.itemId && !line.poLineId) {
    throw ApiError.badRequest(`lines[${index}] must include itemId or poLineId`);
  }

  ensurePositiveNumber(line.receivedQty, `lines[${index}].receivedQty`);

  if (line.lineNo !== undefined) ensurePositiveNumber(line.lineNo, `lines[${index}].lineNo`);
  if (line.uom !== undefined) ensureOptionalString(line.uom, `lines[${index}].uom`);
  if (line.unitCostDoc !== undefined) ensureNonNegativeNumber(line.unitCostDoc, `lines[${index}].unitCostDoc`);
  if (line.moveCurrency !== undefined) ensureOptionalString(line.moveCurrency, `lines[${index}].moveCurrency`);
  if (line.fxRateMovToBase !== undefined) ensurePositiveNumber(line.fxRateMovToBase, `lines[${index}].fxRateMovToBase`);
  if (line.fxRateCCYToBase !== undefined) ensurePositiveNumber(line.fxRateCCYToBase, `lines[${index}].fxRateCCYToBase`);
  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

const validatePILine = (line: any, index: number) => {
  if (line.itemId !== undefined) ensureOptionalString(line.itemId, `lines[${index}].itemId`);
  if (line.poLineId !== undefined) ensureOptionalString(line.poLineId, `lines[${index}].poLineId`);
  if (!line.itemId && !line.poLineId) {
    throw ApiError.badRequest(`lines[${index}] must include itemId or poLineId`);
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

const validatePRLine = (line: any, index: number) => {
  if (line.lineNo !== undefined) ensurePositiveNumber(line.lineNo, `lines[${index}].lineNo`);
  if (line.piLineId !== undefined) ensureOptionalString(line.piLineId, `lines[${index}].piLineId`);
  if (line.grnLineId !== undefined) ensureOptionalString(line.grnLineId, `lines[${index}].grnLineId`);
  if (line.poLineId !== undefined) ensureOptionalString(line.poLineId, `lines[${index}].poLineId`);
  if (line.itemId !== undefined) ensureOptionalString(line.itemId, `lines[${index}].itemId`);
  if (line.returnQty !== undefined) ensurePositiveNumber(line.returnQty, `lines[${index}].returnQty`);
  if (
    line.piLineId === undefined
    && line.grnLineId === undefined
    && line.itemId === undefined
  ) {
    throw ApiError.badRequest(`lines[${index}] must include piLineId or grnLineId or itemId`);
  }
  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

export const validateInitializePurchasesInput = (body: any) => {
  ensureRequiredString(body.defaultAPAccountId, 'defaultAPAccountId');
  ensureControlMode(body.procurementControlMode, 'procurementControlMode');

  if (body.requirePOForStockItems !== undefined) ensureBoolean(body.requirePOForStockItems, 'requirePOForStockItems');
  if (body.allowOverDelivery !== undefined) ensureBoolean(body.allowOverDelivery, 'allowOverDelivery');
  if (body.overDeliveryTolerancePct !== undefined) ensureNonNegativeNumber(body.overDeliveryTolerancePct, 'overDeliveryTolerancePct');
  if (body.overInvoiceTolerancePct !== undefined) ensureNonNegativeNumber(body.overInvoiceTolerancePct, 'overInvoiceTolerancePct');
  if (body.defaultPaymentTermsDays !== undefined) ensureNonNegativeNumber(body.defaultPaymentTermsDays, 'defaultPaymentTermsDays');

  ensureOptionalString(body.defaultPurchaseExpenseAccountId, 'defaultPurchaseExpenseAccountId');
  ensureOptionalString(body.purchaseVoucherTypeId, 'purchaseVoucherTypeId');
  ensureOptionalString(body.defaultWarehouseId, 'defaultWarehouseId');
  ensureOptionalString(body.poNumberPrefix, 'poNumberPrefix');
  ensureOptionalString(body.grnNumberPrefix, 'grnNumberPrefix');
  ensureOptionalString(body.piNumberPrefix, 'piNumberPrefix');
  ensureOptionalString(body.prNumberPrefix, 'prNumberPrefix');

  ensureOptionalNumber(body.poNumberNextSeq, 'poNumberNextSeq');
  ensureOptionalNumber(body.grnNumberNextSeq, 'grnNumberNextSeq');
  ensureOptionalNumber(body.piNumberNextSeq, 'piNumberNextSeq');
  ensureOptionalNumber(body.prNumberNextSeq, 'prNumberNextSeq');
};

export const validateUpdatePurchaseSettingsInput = (body: any) => {
  if (body.procurementControlMode !== undefined) ensureControlMode(body.procurementControlMode, 'procurementControlMode');
  if (body.requirePOForStockItems !== undefined) ensureBoolean(body.requirePOForStockItems, 'requirePOForStockItems');
  if (body.defaultAPAccountId !== undefined) ensureRequiredString(body.defaultAPAccountId, 'defaultAPAccountId');
  if (body.defaultPurchaseExpenseAccountId !== undefined) ensureOptionalString(body.defaultPurchaseExpenseAccountId, 'defaultPurchaseExpenseAccountId');
  if (body.allowOverDelivery !== undefined) ensureBoolean(body.allowOverDelivery, 'allowOverDelivery');
  if (body.overDeliveryTolerancePct !== undefined) ensureNonNegativeNumber(body.overDeliveryTolerancePct, 'overDeliveryTolerancePct');
  if (body.overInvoiceTolerancePct !== undefined) ensureNonNegativeNumber(body.overInvoiceTolerancePct, 'overInvoiceTolerancePct');
  if (body.defaultPaymentTermsDays !== undefined) ensureNonNegativeNumber(body.defaultPaymentTermsDays, 'defaultPaymentTermsDays');
  if (body.purchaseVoucherTypeId !== undefined) ensureOptionalString(body.purchaseVoucherTypeId, 'purchaseVoucherTypeId');
  if (body.defaultWarehouseId !== undefined) ensureOptionalString(body.defaultWarehouseId, 'defaultWarehouseId');
  if (body.poNumberPrefix !== undefined) ensureOptionalString(body.poNumberPrefix, 'poNumberPrefix');
  if (body.grnNumberPrefix !== undefined) ensureOptionalString(body.grnNumberPrefix, 'grnNumberPrefix');
  if (body.piNumberPrefix !== undefined) ensureOptionalString(body.piNumberPrefix, 'piNumberPrefix');
  if (body.prNumberPrefix !== undefined) ensureOptionalString(body.prNumberPrefix, 'prNumberPrefix');
  if (body.poNumberNextSeq !== undefined) ensurePositiveNumber(body.poNumberNextSeq, 'poNumberNextSeq');
  if (body.grnNumberNextSeq !== undefined) ensurePositiveNumber(body.grnNumberNextSeq, 'grnNumberNextSeq');
  if (body.piNumberNextSeq !== undefined) ensurePositiveNumber(body.piNumberNextSeq, 'piNumberNextSeq');
  if (body.prNumberNextSeq !== undefined) ensurePositiveNumber(body.prNumberNextSeq, 'prNumberNextSeq');
};

export const validateCreatePurchaseOrderInput = (body: any) => {
  ensureRequiredString(body.vendorId, 'vendorId');
  ensureIsoDate(body.orderDate, 'orderDate');
  ensureRequiredString(body.currency, 'currency');
  ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw ApiError.badRequest('lines must be a non-empty array');
  }

  body.lines.forEach((line: any, index: number) => validatePOLine(line, index));
};

export const validateUpdatePurchaseOrderInput = (body: any) => {
  if (body.vendorId !== undefined) ensureRequiredString(body.vendorId, 'vendorId');
  if (body.orderDate !== undefined) ensureIsoDate(body.orderDate, 'orderDate');
  if (body.expectedDeliveryDate !== undefined) ensureIsoDate(body.expectedDeliveryDate, 'expectedDeliveryDate');
  if (body.currency !== undefined) ensureRequiredString(body.currency, 'currency');
  if (body.exchangeRate !== undefined) ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array');
    }
    body.lines.forEach((line: any, index: number) => validatePOLine(line, index));
  }
};

export const validateListPurchaseOrdersQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as POStatus;
    if (!PO_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${PO_STATUSES.join(', ')}`);
    }
  }

  if (query.vendorId !== undefined && typeof query.vendorId !== 'string') {
    throw ApiError.badRequest('vendorId must be a string');
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

export const validateCreateGoodsReceiptInput = (body: any) => {
  if (body.purchaseOrderId !== undefined) ensureOptionalString(body.purchaseOrderId, 'purchaseOrderId');
  if (body.vendorId !== undefined) ensureOptionalString(body.vendorId, 'vendorId');
  ensureIsoDate(body.receiptDate, 'receiptDate');
  ensureRequiredString(body.warehouseId, 'warehouseId');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateGRNLine(line, index));
  }
};

export const validateListGoodsReceiptsQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as GRNStatus;
    if (!GRN_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${GRN_STATUSES.join(', ')}`);
    }
  }

  if (query.purchaseOrderId !== undefined && typeof query.purchaseOrderId !== 'string') {
    throw ApiError.badRequest('purchaseOrderId must be a string');
  }

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (Number.isNaN(limit) || limit <= 0) {
      throw ApiError.badRequest('limit must be a positive number');
    }
  }
};

export const validateCreatePurchaseInvoiceInput = (body: any) => {
  if (body.purchaseOrderId !== undefined) ensureOptionalString(body.purchaseOrderId, 'purchaseOrderId');
  if (!body.purchaseOrderId) ensureRequiredString(body.vendorId, 'vendorId');
  if (body.vendorId !== undefined) ensureOptionalString(body.vendorId, 'vendorId');

  ensureIsoDate(body.invoiceDate, 'invoiceDate');
  if (body.dueDate !== undefined) ensureIsoDate(body.dueDate, 'dueDate');
  if (body.vendorInvoiceNumber !== undefined) ensureOptionalString(body.vendorInvoiceNumber, 'vendorInvoiceNumber');
  if (body.currency !== undefined) ensureOptionalString(body.currency, 'currency');
  if (body.exchangeRate !== undefined) ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validatePILine(line, index));
  }
};

export const validateUpdatePurchaseInvoiceInput = (body: any) => {
  if (body.vendorId !== undefined) ensureOptionalString(body.vendorId, 'vendorId');
  if (body.vendorInvoiceNumber !== undefined) ensureOptionalString(body.vendorInvoiceNumber, 'vendorInvoiceNumber');
  if (body.invoiceDate !== undefined) ensureIsoDate(body.invoiceDate, 'invoiceDate');
  if (body.dueDate !== undefined) ensureIsoDate(body.dueDate, 'dueDate');
  if (body.currency !== undefined) ensureOptionalString(body.currency, 'currency');
  if (body.exchangeRate !== undefined) ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validatePILine(line, index));
  }
};

export const validateListPurchaseInvoicesQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as PIStatus;
    if (!PI_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${PI_STATUSES.join(', ')}`);
    }
  }

  if (query.paymentStatus !== undefined) {
    const paymentStatus = String(query.paymentStatus).toUpperCase() as PaymentStatus;
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      throw ApiError.badRequest(`paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`);
    }
  }

  if (query.vendorId !== undefined && typeof query.vendorId !== 'string') {
    throw ApiError.badRequest('vendorId must be a string');
  }
  if (query.purchaseOrderId !== undefined && typeof query.purchaseOrderId !== 'string') {
    throw ApiError.badRequest('purchaseOrderId must be a string');
  }

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (Number.isNaN(limit) || limit <= 0) {
      throw ApiError.badRequest('limit must be a positive number');
    }
  }
};

export const validateCreatePurchaseReturnInput = (body: any) => {
  if (body.purchaseInvoiceId !== undefined) ensureOptionalString(body.purchaseInvoiceId, 'purchaseInvoiceId');
  if (body.goodsReceiptId !== undefined) ensureOptionalString(body.goodsReceiptId, 'goodsReceiptId');
  if (!body.purchaseInvoiceId && !body.goodsReceiptId) {
    throw ApiError.badRequest('purchaseInvoiceId or goodsReceiptId is required');
  }

  if (body.purchaseOrderId !== undefined) ensureOptionalString(body.purchaseOrderId, 'purchaseOrderId');
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
    body.lines.forEach((line: any, index: number) => validatePRLine(line, index));
  }
};

export const validateListPurchaseReturnsQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as PRStatus;
    if (!PR_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${PR_STATUSES.join(', ')}`);
    }
  }

  if (query.vendorId !== undefined && typeof query.vendorId !== 'string') {
    throw ApiError.badRequest('vendorId must be a string');
  }
  if (query.purchaseInvoiceId !== undefined && typeof query.purchaseInvoiceId !== 'string') {
    throw ApiError.badRequest('purchaseInvoiceId must be a string');
  }
  if (query.goodsReceiptId !== undefined && typeof query.goodsReceiptId !== 'string') {
    throw ApiError.badRequest('goodsReceiptId must be a string');
  }
};

export const validateUpdateInvoicePaymentStatusInput = (body: any) => {
  ensureNumber(body.paymentAmountBase, 'paymentAmountBase');
};
