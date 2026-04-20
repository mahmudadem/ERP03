"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateOpeningStockDocumentInput = exports.validateCreateOpeningStockDocumentInput = exports.validateUpdateSettingsInput = exports.validateMovementByReferenceQuery = exports.validateCreateStockReservationInput = exports.validateCreateSnapshotInput = exports.validateProcessReturnInput = exports.validateCreateStockTransferInput = exports.validateCreateStockAdjustmentInput = exports.validateOpeningMovementInput = exports.validateApplyUomConversionCorrectionInput = exports.validateUomConversionImpactQuery = exports.validateUpdateUomConversionInput = exports.validateCreateUomConversionInput = exports.validateUpdateWarehouseInput = exports.validateCreateWarehouseInput = exports.validateUpdateUomInput = exports.validateCreateUomInput = exports.validateUpdateCategoryInput = exports.validateCreateCategoryInput = exports.validateUpdateItemInput = exports.validateCreateItemInput = exports.validateInitializeInventoryInput = void 0;
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
const ensureNonNegativeNumber = (value, fieldName) => {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
        throw ApiError_1.ApiError.badRequest(`${fieldName} must be a non-negative number`);
    }
};
const ensureIsoDate = (value, fieldName) => {
    if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw ApiError_1.ApiError.badRequest(`${fieldName} must be in YYYY-MM-DD format`);
    }
};
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ensureUuid = (value, fieldName) => {
    ensureRequiredString(value, fieldName);
};
const ensureOptionalString = (value, fieldName) => {
    if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
        throw ApiError_1.ApiError.badRequest(`${fieldName} must be a non-empty string`);
    }
};
const ensureBoolean = (value, fieldName) => {
    if (typeof value !== 'boolean') {
        throw ApiError_1.ApiError.badRequest(`${fieldName} must be boolean`);
    }
};
const ensureUomDimension = (value, fieldName) => {
    ensureRequiredString(value, fieldName);
    const allowed = ['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'TIME', 'OTHER'];
    if (!allowed.includes(value)) {
        throw ApiError_1.ApiError.badRequest(`${fieldName} must be one of ${allowed.join(', ')}`);
    }
};
const ensureInventoryAccountingMethod = (value, fieldName) => {
    ensureRequiredString(value, fieldName);
    if (value !== 'PERIODIC' && value !== 'PERPETUAL') {
        throw ApiError_1.ApiError.badRequest(`${fieldName} must be PERIODIC or PERPETUAL`);
    }
};
const ensureAccountingMode = (value, fieldName) => {
    ensureRequiredString(value, fieldName);
    if (value !== 'INVOICE_DRIVEN' && value !== 'PERPETUAL') {
        throw ApiError_1.ApiError.badRequest(`${fieldName} must be INVOICE_DRIVEN or PERPETUAL`);
    }
};
const validateInitializeInventoryInput = (body) => {
    if (body.accountingMode !== undefined) {
        ensureAccountingMode(body.accountingMode, 'accountingMode');
    }
    if (body.inventoryAccountingMethod !== undefined) {
        ensureInventoryAccountingMethod(body.inventoryAccountingMethod, 'inventoryAccountingMethod');
    }
    const effectiveAccountingMode = body.accountingMode
        || (body.inventoryAccountingMethod === 'PERPETUAL' ? 'PERPETUAL' : 'INVOICE_DRIVEN');
    if (effectiveAccountingMode === 'PERPETUAL') {
        ensureUuid(body.defaultInventoryAssetAccountId, 'defaultInventoryAssetAccountId');
    }
    if (body.defaultCOGSAccountId !== undefined) {
        ensureUuid(body.defaultCOGSAccountId, 'defaultCOGSAccountId');
    }
    if (body.defaultWarehouseCode && typeof body.defaultWarehouseCode !== 'string') {
        throw ApiError_1.ApiError.badRequest('defaultWarehouseCode must be a string');
    }
    if (body.defaultWarehouseName && typeof body.defaultWarehouseName !== 'string') {
        throw ApiError_1.ApiError.badRequest('defaultWarehouseName must be a string');
    }
    if (body.defaultCostCurrency !== undefined && typeof body.defaultCostCurrency !== 'string') {
        throw ApiError_1.ApiError.badRequest('defaultCostCurrency must be a string');
    }
    if (body.allowNegativeStock !== undefined)
        ensureBoolean(body.allowNegativeStock, 'allowNegativeStock');
    if (body.autoGenerateItemCode !== undefined)
        ensureBoolean(body.autoGenerateItemCode, 'autoGenerateItemCode');
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
    if (body.baseUomId === undefined && body.baseUom === undefined) {
        throw ApiError_1.ApiError.badRequest('baseUom or baseUomId is required');
    }
    if (body.baseUom !== undefined)
        ensureRequiredString(body.baseUom, 'baseUom');
    if (body.baseUomId !== undefined)
        ensureRequiredString(body.baseUomId, 'baseUomId');
    ensureOptionalString(body.purchaseUom, 'purchaseUom');
    ensureOptionalString(body.purchaseUomId, 'purchaseUomId');
    ensureOptionalString(body.salesUom, 'salesUom');
    ensureOptionalString(body.salesUomId, 'salesUomId');
    ensureRequiredString(body.costCurrency, 'costCurrency');
    ensureBoolean(body.trackInventory, 'trackInventory');
};
exports.validateCreateItemInput = validateCreateItemInput;
const validateUpdateItemInput = (body) => {
    if (body.code !== undefined)
        ensureRequiredString(body.code, 'code');
    if (body.name !== undefined)
        ensureRequiredString(body.name, 'name');
    if (body.baseUom !== undefined)
        ensureRequiredString(body.baseUom, 'baseUom');
    if (body.baseUomId !== undefined)
        ensureRequiredString(body.baseUomId, 'baseUomId');
    ensureOptionalString(body.purchaseUom, 'purchaseUom');
    ensureOptionalString(body.purchaseUomId, 'purchaseUomId');
    ensureOptionalString(body.salesUom, 'salesUom');
    ensureOptionalString(body.salesUomId, 'salesUomId');
    if (body.costCurrency !== undefined)
        ensureRequiredString(body.costCurrency, 'costCurrency');
    if (body.trackInventory !== undefined)
        ensureBoolean(body.trackInventory, 'trackInventory');
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
const validateCreateUomInput = (body) => {
    ensureRequiredString(body.code, 'code');
    ensureRequiredString(body.name, 'name');
    ensureUomDimension(body.dimension, 'dimension');
    if (body.decimalPlaces !== undefined) {
        if (!Number.isInteger(body.decimalPlaces) || body.decimalPlaces < 0 || body.decimalPlaces > 6) {
            throw ApiError_1.ApiError.badRequest('decimalPlaces must be an integer between 0 and 6');
        }
    }
    if (body.active !== undefined)
        ensureBoolean(body.active, 'active');
};
exports.validateCreateUomInput = validateCreateUomInput;
const validateUpdateUomInput = (body) => {
    if (body.code !== undefined)
        ensureRequiredString(body.code, 'code');
    if (body.name !== undefined)
        ensureRequiredString(body.name, 'name');
    if (body.dimension !== undefined)
        ensureUomDimension(body.dimension, 'dimension');
    if (body.decimalPlaces !== undefined) {
        if (!Number.isInteger(body.decimalPlaces) || body.decimalPlaces < 0 || body.decimalPlaces > 6) {
            throw ApiError_1.ApiError.badRequest('decimalPlaces must be an integer between 0 and 6');
        }
    }
    if (body.active !== undefined)
        ensureBoolean(body.active, 'active');
};
exports.validateUpdateUomInput = validateUpdateUomInput;
const validateCreateWarehouseInput = (body) => {
    ensureRequiredString(body.name, 'name');
    ensureRequiredString(body.code, 'code');
    if (body.parentId !== undefined && body.parentId !== null) {
        ensureRequiredString(body.parentId, 'parentId');
    }
};
exports.validateCreateWarehouseInput = validateCreateWarehouseInput;
const validateUpdateWarehouseInput = (body) => {
    if (body.name !== undefined)
        ensureRequiredString(body.name, 'name');
    if (body.code !== undefined)
        ensureRequiredString(body.code, 'code');
    if (body.parentId !== undefined && body.parentId !== null)
        ensureRequiredString(body.parentId, 'parentId');
};
exports.validateUpdateWarehouseInput = validateUpdateWarehouseInput;
const validateCreateUomConversionInput = (body) => {
    ensureRequiredString(body.itemId, 'itemId');
    if (body.fromUomId === undefined && body.fromUom === undefined) {
        throw ApiError_1.ApiError.badRequest('fromUom or fromUomId is required');
    }
    if (body.toUomId === undefined && body.toUom === undefined) {
        throw ApiError_1.ApiError.badRequest('toUom or toUomId is required');
    }
    if (body.fromUom !== undefined)
        ensureRequiredString(body.fromUom, 'fromUom');
    if (body.fromUomId !== undefined)
        ensureRequiredString(body.fromUomId, 'fromUomId');
    if (body.toUom !== undefined)
        ensureRequiredString(body.toUom, 'toUom');
    if (body.toUomId !== undefined)
        ensureRequiredString(body.toUomId, 'toUomId');
    ensurePositiveNumber(body.factor, 'factor');
};
exports.validateCreateUomConversionInput = validateCreateUomConversionInput;
const validateUpdateUomConversionInput = (body) => {
    if (body.itemId !== undefined)
        ensureRequiredString(body.itemId, 'itemId');
    if (body.fromUom !== undefined)
        ensureRequiredString(body.fromUom, 'fromUom');
    if (body.fromUomId !== undefined)
        ensureRequiredString(body.fromUomId, 'fromUomId');
    if (body.toUom !== undefined)
        ensureRequiredString(body.toUom, 'toUom');
    if (body.toUomId !== undefined)
        ensureRequiredString(body.toUomId, 'toUomId');
    if (body.factor !== undefined)
        ensurePositiveNumber(body.factor, 'factor');
    if (body.active !== undefined)
        ensureBoolean(body.active, 'active');
};
exports.validateUpdateUomConversionInput = validateUpdateUomConversionInput;
const validateUomConversionImpactQuery = (query) => {
    if (query.proposedFactor === undefined)
        return;
    const proposedFactor = Number(query.proposedFactor);
    if (!Number.isFinite(proposedFactor) || proposedFactor <= 0) {
        throw ApiError_1.ApiError.badRequest('proposedFactor must be a positive number');
    }
};
exports.validateUomConversionImpactQuery = validateUomConversionImpactQuery;
const validateApplyUomConversionCorrectionInput = (body) => {
    const newFactor = Number(body.newFactor);
    if (!Number.isFinite(newFactor) || newFactor <= 0) {
        throw ApiError_1.ApiError.badRequest('newFactor must be a positive number');
    }
};
exports.validateApplyUomConversionCorrectionInput = validateApplyUomConversionCorrectionInput;
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
    if (body.accountingMode !== undefined) {
        ensureAccountingMode(body.accountingMode, 'accountingMode');
    }
    if (body.inventoryAccountingMethod !== undefined) {
        ensureInventoryAccountingMethod(body.inventoryAccountingMethod, 'inventoryAccountingMethod');
    }
    if (body.defaultCostCurrency !== undefined)
        ensureRequiredString(body.defaultCostCurrency, 'defaultCostCurrency');
    if (body.defaultInventoryAssetAccountId !== undefined)
        ensureUuid(body.defaultInventoryAssetAccountId, 'defaultInventoryAssetAccountId');
    if (body.defaultWarehouseId !== undefined)
        ensureRequiredString(body.defaultWarehouseId, 'defaultWarehouseId');
    if (body.itemCodePrefix !== undefined && typeof body.itemCodePrefix !== 'string') {
        throw ApiError_1.ApiError.badRequest('itemCodePrefix must be a string');
    }
    if (body.defaultCOGSAccountId !== undefined) {
        ensureUuid(body.defaultCOGSAccountId, 'defaultCOGSAccountId');
    }
};
exports.validateUpdateSettingsInput = validateUpdateSettingsInput;
const validateCreateOpeningStockDocumentInput = (body) => {
    ensureRequiredString(body.warehouseId, 'warehouseId');
    ensureIsoDate(body.date, 'date');
    if (body.notes !== undefined && typeof body.notes !== 'string') {
        throw ApiError_1.ApiError.badRequest('notes must be a string');
    }
    if (body.createAccountingEffect !== undefined)
        ensureBoolean(body.createAccountingEffect, 'createAccountingEffect');
    if (body.createAccountingEffect === true) {
        ensureRequiredString(body.openingBalanceAccountId, 'openingBalanceAccountId');
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
        throw ApiError_1.ApiError.badRequest('lines must be a non-empty array');
    }
    body.lines.forEach((line, index) => {
        ensureRequiredString(line.itemId, `lines[${index}].itemId`);
        ensurePositiveNumber(line.quantity, `lines[${index}].quantity`);
        ensureNonNegativeNumber(line.unitCostInMoveCurrency, `lines[${index}].unitCostInMoveCurrency`);
        ensureRequiredString(line.moveCurrency, `lines[${index}].moveCurrency`);
        ensurePositiveNumber(line.fxRateMovToBase, `lines[${index}].fxRateMovToBase`);
        ensurePositiveNumber(line.fxRateCCYToBase, `lines[${index}].fxRateCCYToBase`);
    });
};
exports.validateCreateOpeningStockDocumentInput = validateCreateOpeningStockDocumentInput;
const validateUpdateOpeningStockDocumentInput = (body) => {
    (0, exports.validateCreateOpeningStockDocumentInput)(body);
};
exports.validateUpdateOpeningStockDocumentInput = validateUpdateOpeningStockDocumentInput;
//# sourceMappingURL=inventory.validators.js.map