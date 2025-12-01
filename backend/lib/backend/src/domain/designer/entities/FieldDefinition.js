"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldDefinition = void 0;
class FieldDefinition {
    constructor(id, name, label, type, required, readOnly, visibilityRules = [], validationRules = [], defaultValue) {
        this.id = id;
        this.name = name;
        this.label = label;
        this.type = type;
        this.required = required;
        this.readOnly = readOnly;
        this.visibilityRules = visibilityRules;
        this.validationRules = validationRules;
        this.defaultValue = defaultValue;
    }
}
exports.FieldDefinition = FieldDefinition;
//# sourceMappingURL=FieldDefinition.js.map