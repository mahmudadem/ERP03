"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormDefinition = void 0;
class FormDefinition {
    constructor(id, name, module, type, // e.g. 'INVOICE_FORM'
    fields, sections) {
        this.id = id;
        this.name = name;
        this.module = module;
        this.type = type;
        this.fields = fields;
        this.sections = sections;
    }
}
exports.FormDefinition = FormDefinition;
//# sourceMappingURL=FormDefinition.js.map