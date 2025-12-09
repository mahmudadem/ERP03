"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherTypeDefinition = void 0;
class VoucherTypeDefinition {
    constructor(id, companyId, name, code, module, headerFields, tableColumns, layout, // JSON layout config
    workflow // Workflow metadata
    ) {
        this.id = id;
        this.companyId = companyId;
        this.name = name;
        this.code = code;
        this.module = module;
        this.headerFields = headerFields;
        this.tableColumns = tableColumns;
        this.layout = layout;
        this.workflow = workflow;
    }
}
exports.VoucherTypeDefinition = VoucherTypeDefinition;
//# sourceMappingURL=VoucherTypeDefinition.js.map