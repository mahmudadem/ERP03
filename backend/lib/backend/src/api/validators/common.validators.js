"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIdParam = void 0;
/**
 * common.validators.ts
 */
const ApiError_1 = require("../errors/ApiError");
const validateIdParam = (req) => {
    if (!req.params.id) {
        throw ApiError_1.ApiError.badRequest('ID parameter is required');
    }
};
exports.validateIdParam = validateIdParam;
//# sourceMappingURL=common.validators.js.map