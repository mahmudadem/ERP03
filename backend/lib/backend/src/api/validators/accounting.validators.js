"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCreateVoucherInput = exports.validateCreateAccountInput = void 0;
/**
 * accounting.validators.ts
 */
const ApiError_1 = require("../errors/ApiError");
const validateCreateAccountInput = (body) => {
    if (!body.code || !body.name || !body.type || !body.currency) {
        throw ApiError_1.ApiError.badRequest('Missing required fields for Account creation');
    }
};
exports.validateCreateAccountInput = validateCreateAccountInput;
const validateCreateVoucherInput = (body) => {
    if (!body.type || !body.currency || !body.companyId) {
        throw ApiError_1.ApiError.badRequest('Missing required fields (type, currency, companyId)');
    }
    if (!body.date) {
        throw ApiError_1.ApiError.badRequest('Date is required');
    }
    if (!Array.isArray(body.lines)) {
        throw ApiError_1.ApiError.badRequest('Lines must be an array');
    }
    // Basic line validation
    body.lines.forEach((line, idx) => {
        if (!line.accountId)
            throw ApiError_1.ApiError.badRequest(`Line ${idx + 1} missing accountId`);
        if (typeof line.fxAmount !== 'number')
            throw ApiError_1.ApiError.badRequest(`Line ${idx + 1} invalid amount`);
    });
};
exports.validateCreateVoucherInput = validateCreateVoucherInput;
//# sourceMappingURL=accounting.validators.js.map