
/**
 * inventory.validators.ts
 */
import { ApiError } from '../errors/ApiError';

const ensureRequiredString = (value: any, fieldName: string) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw ApiError.badRequest(`${fieldName} is required`);
  }
};

const ensurePositiveNumber = (value: any, fieldName: string) => {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    throw ApiError.badRequest(`${fieldName} must be a positive number`);
  }
};

const ensureIsoDate = (value: any, fieldName: string) => {
  if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw ApiError.badRequest(`${fieldName} must be in YYYY-MM-DD format`);
  }
};

export const validateInitializeInventoryInput = (body: any) => {
  if (body.defaultWarehouseCode && typeof body.defaultWarehouseCode !== 'string') {
    throw ApiError.badRequest('defaultWarehouseCode must be a string');
  }

  if (body.defaultWarehouseName && typeof body.defaultWarehouseName !== 'string') {
    throw ApiError.badRequest('defaultWarehouseName must be a string');
  }

  if (body.defaultCostCurrency !== undefined && typeof body.defaultCostCurrency !== 'string') {
    throw ApiError.badRequest('defaultCostCurrency must be a string');
  }

  if (body.allowNegativeStock !== undefined && typeof body.allowNegativeStock !== 'boolean') {
    throw ApiError.badRequest('allowNegativeStock must be boolean');
  }

  if (body.autoGenerateItemCode !== undefined && typeof body.autoGenerateItemCode !== 'boolean') {
    throw ApiError.badRequest('autoGenerateItemCode must be boolean');
  }

  if (body.itemCodePrefix !== undefined && typeof body.itemCodePrefix !== 'string') {
    throw ApiError.badRequest('itemCodePrefix must be a string');
  }

  if (body.itemCodeNextSeq !== undefined) {
    if (typeof body.itemCodeNextSeq !== 'number' || Number.isNaN(body.itemCodeNextSeq) || body.itemCodeNextSeq <= 0) {
      throw ApiError.badRequest('itemCodeNextSeq must be a positive number');
    }
  }
};

export const validateCreateItemInput = (body: any) => {
  ensureRequiredString(body.code, 'code');
  ensureRequiredString(body.name, 'name');
  ensureRequiredString(body.type, 'type');
  ensureRequiredString(body.baseUom, 'baseUom');
  ensureRequiredString(body.costCurrency, 'costCurrency');

  if (typeof body.trackInventory !== 'boolean') {
    throw ApiError.badRequest('trackInventory must be boolean');
  }
};

export const validateUpdateItemInput = (body: any) => {
  if (body.code !== undefined) ensureRequiredString(body.code, 'code');
  if (body.name !== undefined) ensureRequiredString(body.name, 'name');
  if (body.costCurrency !== undefined) ensureRequiredString(body.costCurrency, 'costCurrency');
};

export const validateCreateCategoryInput = (body: any) => {
  ensureRequiredString(body.name, 'name');
};

export const validateUpdateCategoryInput = (body: any) => {
  if (body.name !== undefined) ensureRequiredString(body.name, 'name');
};

export const validateCreateWarehouseInput = (body: any) => {
  ensureRequiredString(body.name, 'name');
  ensureRequiredString(body.code, 'code');
};

export const validateUpdateWarehouseInput = (body: any) => {
  if (body.name !== undefined) ensureRequiredString(body.name, 'name');
  if (body.code !== undefined) ensureRequiredString(body.code, 'code');
};

export const validateCreateUomConversionInput = (body: any) => {
  ensureRequiredString(body.itemId, 'itemId');
  ensureRequiredString(body.fromUom, 'fromUom');
  ensureRequiredString(body.toUom, 'toUom');
  ensurePositiveNumber(body.factor, 'factor');
};

export const validateOpeningMovementInput = (body: any) => {
  ensureRequiredString(body.itemId, 'itemId');
  ensureRequiredString(body.warehouseId, 'warehouseId');
  ensureIsoDate(body.date, 'date');
  ensurePositiveNumber(body.qty, 'qty');
  ensurePositiveNumber(body.unitCostInMoveCurrency, 'unitCostInMoveCurrency');
  ensureRequiredString(body.moveCurrency, 'moveCurrency');

  if (typeof body.fxRateMovToBase !== 'number' || Number.isNaN(body.fxRateMovToBase)) {
    throw ApiError.badRequest('fxRateMovToBase must be a number');
  }

  if (typeof body.fxRateCCYToBase !== 'number' || Number.isNaN(body.fxRateCCYToBase)) {
    throw ApiError.badRequest('fxRateCCYToBase must be a number');
  }
};

export const validateCreateStockAdjustmentInput = (body: any) => {
  ensureRequiredString(body.warehouseId, 'warehouseId');
  ensureIsoDate(body.date, 'date');
  ensureRequiredString(body.reason, 'reason');

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw ApiError.badRequest('lines must be a non-empty array');
  }

  body.lines.forEach((line: any, index: number) => {
    ensureRequiredString(line.itemId, `lines[${index}].itemId`);
    if (typeof line.currentQty !== 'number' || Number.isNaN(line.currentQty)) {
      throw ApiError.badRequest(`lines[${index}].currentQty must be a number`);
    }
    if (typeof line.newQty !== 'number' || Number.isNaN(line.newQty)) {
      throw ApiError.badRequest(`lines[${index}].newQty must be a number`);
    }
    if (typeof line.unitCostBase !== 'number' || Number.isNaN(line.unitCostBase)) {
      throw ApiError.badRequest(`lines[${index}].unitCostBase must be a number`);
    }
    if (typeof line.unitCostCCY !== 'number' || Number.isNaN(line.unitCostCCY)) {
      throw ApiError.badRequest(`lines[${index}].unitCostCCY must be a number`);
    }
  });
};

export const validateCreateStockTransferInput = (body: any) => {
  ensureRequiredString(body.sourceWarehouseId, 'sourceWarehouseId');
  ensureRequiredString(body.destinationWarehouseId, 'destinationWarehouseId');
  ensureIsoDate(body.date, 'date');

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw ApiError.badRequest('lines must be a non-empty array');
  }

  body.lines.forEach((line: any, index: number) => {
    ensureRequiredString(line.itemId, `lines[${index}].itemId`);
    ensurePositiveNumber(line.qty, `lines[${index}].qty`);
  });
};

export const validateProcessReturnInput = (body: any) => {
  ensureRequiredString(body.itemId, 'itemId');
  ensureRequiredString(body.warehouseId, 'warehouseId');
  ensureIsoDate(body.date, 'date');
  ensurePositiveNumber(body.qty, 'qty');
  ensureRequiredString(body.returnType, 'returnType');
  ensureRequiredString(body.originalMovementId, 'originalMovementId');
  ensureRequiredString(body.moveCurrency, 'moveCurrency');

  if (body.returnType !== 'SALES_RETURN' && body.returnType !== 'PURCHASE_RETURN') {
    throw ApiError.badRequest('returnType must be SALES_RETURN or PURCHASE_RETURN');
  }

  if (typeof body.fxRateMovToBase !== 'number' || Number.isNaN(body.fxRateMovToBase)) {
    throw ApiError.badRequest('fxRateMovToBase must be a number');
  }

  if (typeof body.fxRateCCYToBase !== 'number' || Number.isNaN(body.fxRateCCYToBase)) {
    throw ApiError.badRequest('fxRateCCYToBase must be a number');
  }
};

export const validateCreateSnapshotInput = (body: any) => {
  ensureRequiredString(body.periodKey, 'periodKey');
  if (!/^\d{4}-\d{2}$/.test(body.periodKey)) {
    throw ApiError.badRequest('periodKey must be in YYYY-MM format');
  }
};

export const validateCreateStockReservationInput = (body: any) => {
  ensureRequiredString(body.itemId, 'itemId');
  ensureRequiredString(body.warehouseId, 'warehouseId');
  ensurePositiveNumber(body.qty, 'qty');
};

export const validateMovementByReferenceQuery = (query: any) => {
  ensureRequiredString(query.referenceType, 'referenceType');
  ensureRequiredString(query.referenceId, 'referenceId');
};

export const validateUpdateSettingsInput = (body: any) => {
  if (body.defaultCostCurrency !== undefined) ensureRequiredString(body.defaultCostCurrency, 'defaultCostCurrency');
  if (body.defaultWarehouseId !== undefined) ensureRequiredString(body.defaultWarehouseId, 'defaultWarehouseId');
  if (body.itemCodePrefix !== undefined && typeof body.itemCodePrefix !== 'string') {
    throw ApiError.badRequest('itemCodePrefix must be a string');
  }
};
