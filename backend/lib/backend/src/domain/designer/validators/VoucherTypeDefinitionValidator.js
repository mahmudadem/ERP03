"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherTypeDefinitionValidator = void 0;
const FieldDefinitionValidator_1 = require("./FieldDefinitionValidator");
/**
 * VoucherTypeDefinitionValidator
 *
 * Validates that VoucherTypeDefinition complies with Schema Version 2 requirements.
 * Ensures all fields are properly classified and required posting roles are present.
 */
class VoucherTypeDefinitionValidator {
    /**
     * Validates a VoucherTypeDefinition
     * @throws Error with specific validation message
     */
    static validate(definition) {
        // V6: schemaVersion must exist
        if (typeof definition.schemaVersion !== 'number') {
            throw new Error('VoucherTypeDefinition missing schemaVersion');
        }
        // V7: schemaVersion must be >= 2
        if (definition.schemaVersion < 2) {
            throw new Error(`Legacy definition (schemaVersion ${definition.schemaVersion}) not supported`);
        }
        // V8: Validate all header fields
        try {
            FieldDefinitionValidator_1.FieldDefinitionValidator.validateAll(definition.headerFields);
        }
        catch (error) {
            throw new Error(`Header field validation failed: ${error.message}`);
        }
        // V9: Check required posting roles (if specified)
        if (definition.requiredPostingRoles && definition.requiredPostingRoles.length > 0) {
            this.validateRequiredPostingRoles(definition);
        }
    }
    /**
     * Validates that all required posting roles are present in header fields
     */
    static validateRequiredPostingRoles(definition) {
        const presentRoles = new Set();
        for (const field of definition.headerFields) {
            if (field.isPosting && field.postingRole) {
                presentRoles.add(field.postingRole);
            }
        }
        for (const requiredRole of definition.requiredPostingRoles || []) {
            if (!presentRoles.has(requiredRole)) {
                throw new Error(`Missing required posting role: ${requiredRole}`);
            }
        }
    }
}
exports.VoucherTypeDefinitionValidator = VoucherTypeDefinitionValidator;
//# sourceMappingURL=VoucherTypeDefinitionValidator.js.map