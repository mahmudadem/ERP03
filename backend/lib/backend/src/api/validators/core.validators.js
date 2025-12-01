"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCreateCompanyInput = void 0;
/**
 * core.validators.ts
 * Purpose: Validates input payloads for Core API endpoints.
 */
const ApiError_1 = require("../errors/ApiError");
const validateCreateCompanyInput = (body) => {
    const { name, taxId } = body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw ApiError_1.ApiError.badRequest('Company name is required and must be a string.');
    }
    if (!taxId || typeof taxId !== 'string' || taxId.trim().length === 0) {
        throw ApiError_1.ApiError.badRequest('Tax ID is required.');
    }
    // Optional fields validation if needed
    if (body.address && typeof body.address !== 'string') {
        throw ApiError_1.ApiError.badRequest('Address must be a string.');
    }
};
exports.validateCreateCompanyInput = validateCreateCompanyInput;
//# sourceMappingURL=core.validators.js.map