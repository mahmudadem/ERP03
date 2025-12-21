"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldDefinition = void 0;
/**
 * FieldDefinition
 *
 * Defines a single field in a voucher type.
 * Schema Version 2: Includes explicit posting classification.
 */
class FieldDefinition {
    constructor(id, name, label, type, required, readOnly, isPosting, postingRole, schemaVersion = 2, visibilityRules = [], validationRules = [], defaultValue) {
        this.id = id;
        this.name = name;
        this.label = label;
        this.type = type;
        this.required = required;
        this.readOnly = readOnly;
        this.isPosting = isPosting;
        this.postingRole = postingRole;
        this.schemaVersion = schemaVersion;
        this.visibilityRules = visibilityRules;
        this.validationRules = validationRules;
        this.defaultValue = defaultValue;
    }
}
exports.FieldDefinition = FieldDefinition;
//# sourceMappingURL=FieldDefinition.js.map