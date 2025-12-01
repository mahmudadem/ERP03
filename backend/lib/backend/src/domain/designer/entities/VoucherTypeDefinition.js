"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherTypeDefinition = void 0;
class VoucherTypeDefinition {
    constructor(id, name, code, module, headerFields, tableColumns, layout // JSON layout config
    ) {
        this.id = id;
        this.name = name;
        this.code = code;
        this.module = module;
        this.headerFields = headerFields;
        this.tableColumns = tableColumns;
        this.layout = layout;
    }
}
exports.VoucherTypeDefinition = VoucherTypeDefinition;
//# sourceMappingURL=VoucherTypeDefinition.js.map