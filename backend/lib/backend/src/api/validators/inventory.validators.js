"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateSettingsInput = exports.validateMovementByReferenceQuery = exports.validateCreateStockReservationInput = exports.validateCreateSnapshotInput = exports.validateProcessReturnInput = exports.validateCreateStockTransferInput = exports.validateCreateStockAdjustmentInput = exports.validateOpeningMovementInput = exports.validateCreateUomConversionInput = exports.validateUpdateWarehouseInput = exports.validateCreateWarehouseInput = exports.validateUpdateCategoryInput = exports.validateCreateCategoryInput = exports.validateUpdateItemInput = exports.validateCreateItemInput = exports.validateInitializeInventoryInput = void 0;
/**
 * inventory.validators.ts
 */
const ApiError_1 = require("../errors/ApiError");
const ensureRequiredString = (value, fieldName) => {
    if (!value || typeof value !== 'string' || !value.trim()) {
        throw ApiError_1.ApiError.badRequest(`${fieldName} is required`);
    }
};
const ensurePositiveNumber = (value, fieldName) => {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
        throw ApiError_1.ApiError.badRequest(`${fieldName} must be a positive number`);
    }
};
const ensureIsoDate = (value, fieldName) => {
    if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw ApiError_1.ApiError.badRequest(`${fieldName} must be in YYYY-MM-DD format`);
    }
};
const validateInitializeInventoryInput = (body) => {
    if (body.defaultWarehouseCode && typeof body.defaultWarehouseCode !== 'string') {
        throw ApiError_1.ApiError.badRequest('defaultWarehouseCode must be a string');
    }
    if (body.defaultWarehouseName && typeof body.defaultWarehouseName !== 'string') {
        throw ApiError_1.ApiError.badRequest('defaultWarehouseName must be a string');
    }
    if (body.defaultCostCurrency !== undefined && typeof body.defaultCostCurrency !== 'string') {
        throw ApiError_1.ApiError.badRequest('defaultCostCurrency must be a string');
    }
    if (body.allowNegativeStock !== undefined && typeof body.allowNegativeStock !== 'boolean') {
        throw ApiError_1.ApiError.badRequest('allowNegativeStock must be boolean');
    }
    if (body.autoGenerateItemCode !== undefined && typeof body.autoGenerateItemCode !== 'boolean') {
        throw ApiError_1.ApiError.badRequest('autoGenerateItemCode must be boolean');
    }
    if (body.itemCodePrefix !== undefined && typeof body.itemCodePrefix !== 'string') {
        throw ApiError_1.ApiError.badRequest('itemCodePrefix must be a string');
    }
    if (body.itemCodeNextSeq !== undefined) {
        if (typeof body.itemCodeNextSeq !== 'number' || Number.isNaN(body.itemCodeNextSeq) || body.itemCodeNextSeq <= 0) {
            throw ApiError_1.ApiError.badRequest('itemCodeNextSeq must be a positive number');
        }
    }
};
exports.validateInitializeInventoryInput = validateInitializeInventoryInput;
const validateCreateItemInput = (body) => {
    ensureRequiredString(body.code, 'code');
    ensureRequiredString(body.name, 'name');
    ensureRequiredString(body.type, 'type');
    ensureRequiredString(body.baseUom, 'baseUom');
    ensureRequiredString(body.costCurrency, 'costCurrency');
    if (typeof body.trackInventory !== 'boolean') {
        throw ApiError_1.ApiError.badRequest('trackInventory must be boolean');
    }
};
exports.validateCreateItemInput = validateCreateItemInput;
const validateUpdateItemInput = (body) => {
    if (body.code !== undefined)
        ensureRequiredString(body.code, 'code');
    if (body.name !== undefined)
        ensureRequiredString(body.name, 'name');
    if (body.costCurrency !== undefined)
        ensureRequiredString(body.costCurrency, 'costCurrency');
};
exports.validateUpdateItemInput = validateUpdateItemInput;
const validateCreateCategoryInput = (body) => {
    ensureRequiredString(body.name, 'name');
};
exports.validateCreateCategoryInput = validateCreateCategoryInput;
const validateUpdateCategoryInput = (body) => {
    if (body.name !== undefined)
        ensureRequiredString(body.name, 'name');
};
exports.validateUpdateCategoryInput = validateUpdateCategoryInput;
const validateCreateWarehouseInput = (body) => {
    ensureRequiredString(body.name, 'name');
    ensureRequiredString(body.code, 'code');
};
exports.validateCreateWarehouseInput = validateCreateWarehouseInput;
const validateUpdateWarehouseInput = (body) => {
    if (body.name !== undefined)
        ensureRequiredString(body.name, 'name');
    if (body.code !== undefined)
        ensureRequiredString(body.code, 'code');
};
exports.validateUpdateWarehouseInput = validateUpdateWarehouseInput;
const validateCreateUomConversionInput = (body) => {
    ensureRequiredString(body.itemId, 'itemId');
    ensureRequiredString(body.fromUom, 'fromUom');
    ensureRequiredString(body.toUom, 'toUom');
    ensurePositiveNumber(body.factor, 'factor');
};
exports.validateCreateUomConversionInput = validateCreateUomConversionInput;
const validateOpeningMovementInput = (body) => {
    ensureRequiredString(body.itemId, 'itemId');
    ensureRequiredString(body.warehouseId, 'warehouseId');
    ensureIsoDate(body.date, 'date');
    ensurePositiveNumber(body.qty, 'qty');
    ensurePositiveNumber(body.unitCostInMoveCurrency, 'unitCostInMoveCurrency');
    ensureRequiredString(body.moveCurrency, 'moveCurrency');
    if (typeof body.fxRateMovToBase !== 'number' || Number.isNaN(body.fxRateMovToBase)) {
        throw ApiError_1.ApiError.badRequest('fxRateMovToBase must be a number');
    }
    if (typeof body.fxRateCCYToBase !== 'number' || Number.isNaN(body.fxRateCCYToBase)) {
        throw ApiError_1.ApiError.badRequest('fxRateCCYToBase must be a number');
    }
};
exports.validateOpeningMovementInput = validateOpeningMovementInput;
const validateCreateStockAdjustmentInput = (body) => {
    ensureRequiredString(body.warehouseId, 'warehouseId');
    ensureIsoDate(body.date, 'date');
    ensureRequiredString(body.reason, 'reason');
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
        throw ApiError_1.ApiError.badRequest('lines must be a non-empty array');
    }
    body.lines.forEach((line, index) => {
        ensureRequiredString(line.itemId, `lines[${index}].itemId`);
        if (typeof line.currentQty !== 'number' || Number.isNaN(line.currentQty)) {
            throw ApiError_1.ApiError.badRequest(`lines[${index}].currentQty must be a number`);
        }
        if (typeof line.newQty !== 'number' || Number.isNaN(line.newQty)) {
            throw ApiError_1.ApiError.badRequest(`lines[${index}].newQty must be a number`);
        }
        if (typeof line.unitCostBase !== 'number' || Number.isNaN(line.unitCostBase)) {
            throw ApiError_1.ApiError.badRequest(`lines[${index}].unitCostBase must be a number`);
        }
        if (typeof line.unitCostCCY !== 'number' || Number.isNaN(line.unitCostCCY)) {
            throw ApiError_1.ApiError.badRequest(`lines[${index}].unitCostCCY must be a number`);
        }
    });
};
exports.validateCreateStockAdjustmentInput = validateCreateStockAdjustmentInput;
const validateCreateStockTransferInput = (body) => {
    ensureRequiredString(body.sourceWarehouseId, 'sourceWarehouseId');
    ensureRequiredString(body.destinationWarehouseId, 'destinationWarehouseId');
    ensureIsoDate(body.date, 'date');
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
        throw ApiError_1.ApiError.badRequest('lines must be a non-empty array');
    }
    body.lines.forEach((line, index) => {
        ensureRequiredString(line.itemId, `lines[${index}].itemId`);
        ensurePositiveNumber(line.qty, `lines[${index}].qty`);
    });
};
exports.validateCreateStockTransferInput = validateCreateStockTransferInput;
const validateProcessReturnInput = (body) => {
    ensureRequiredString(body.itemId, 'itemId');
    ensureRequiredString(body.warehouseId, 'warehouseId');
    ensureIsoDate(body.date, 'date');
    ensurePositiveNumber(body.qty, 'qty');
    ensureRequiredString(body.returnType, 'returnType');
    ensureRequiredString(body.originalMovementId, 'originalMovementId');
    ensureRequiredString(body.moveCurrency, 'moveCurrency');
    if (body.returnType !== 'SALES_RETURN' && body.returnType !== 'PURCHASE_RETURN') {
        throw ApiError_1.ApiError.badRequest('returnType must be SALES_RETURN or PURCHASE_RETURN');
    }
    if (typeof body.fxRateMovToBase !== 'number' || Number.isNaN(body.fxRateMovToBase)) {
        throw ApiError_1.ApiError.badRequest('fxRateMovToBase must be a number');
    }
    if (typeof body.fxRateCCYToBase !== 'number' || Number.isNaN(body.fxRateCCYToBase)) {
        throw ApiError_1.ApiError.badRequest('fxRateCCYToBase must be a number');
    }
};
exports.validateProcessReturnInput = validateProcessReturnInput;
const validateCreateSnapshotInput = (body) => {
    ensureRequiredString(body.periodKey, 'periodKey');
    if (!/^\d{4}-\d{2}$/.test(body.periodKey)) {
        throw ApiError_1.ApiError.badRequest('periodKey must be in YYYY-MM format');
    }
};
exports.validateCreateSnapshotInput = validateCreateSnapshotInput;
const validateCreateStockReservationInput = (body) => {
    ensureRequiredString(body.itemId, 'itemId');
    ensureRequiredString(body.warehouseId, 'warehouseId');
    ensurePositiveNumber(body.qty, 'qty');
};
exports.validateCreateStockReservationInput = validateCreateStockReservationInput;
const validateMovementByReferenceQuery = (query) => {
    ensureRequiredString(query.referenceType, 'referenceType');
    ensureRequiredString(query.referenceId, 'referenceId');
};
exports.validateMovementByReferenceQuery = validateMovementByReferenceQuery;
const validateUpdateSettingsInput = (body) => {
    if (body.defaultCostCurrency !== undefined)
        ensureRequiredString(body.defaultCostCurrency, 'defaultCostCurrency');
    if (body.defaultWarehouseId !== undefined)
        ensureRequiredString(body.defaultWarehouseId, 'defaultWarehouseId');
    if (body.itemCodePrefix !== undefined && typeof body.itemCodePrefix !== 'string') {
        throw ApiError_1.ApiError.badRequest('itemCodePrefix must be a string');
    }
};
exports.validateUpdateSettingsInput = validateUpdateSettingsInput;
//# sourceMappingURL=inventory.validators.js.map