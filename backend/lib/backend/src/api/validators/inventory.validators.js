"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCreateItemInput = void 0;
/**
 * inventory.validators.ts
 */
const ApiError_1 = require("../errors/ApiError");
const validateCreateItemInput = (body) => {
    if (!body.name || !body.code || !body.unit) {
        throw ApiError_1.ApiError.badRequest('Missing required fields for Item creation');
    }
};
exports.validateCreateItemInput = validateCreateItemInput;
//# sourceMappingURL=inventory.validators.js.map