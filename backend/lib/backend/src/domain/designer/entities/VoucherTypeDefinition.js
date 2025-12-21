"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherTypeDefinition = void 0;
/**
 * VoucherTypeDefinition
 *
 * Defines a voucher type with explicit field classification.
 * Schema Version 2: All fields must be classified as posting or non-posting.
 */
class VoucherTypeDefinition {
    constructor(id, companyId, name, code, module, headerFields, tableColumns, layout, // JSON layout config
    schemaVersion = 2, requiredPostingRoles, workflow // Workflow metadata
    ) {
        this.id = id;
        this.companyId = companyId;
        this.name = name;
        this.code = code;
        this.module = module;
        this.headerFields = headerFields;
        this.tableColumns = tableColumns;
        this.layout = layout;
        this.schemaVersion = schemaVersion;
        this.requiredPostingRoles = requiredPostingRoles;
        this.workflow = workflow;
    }
}
exports.VoucherTypeDefinition = VoucherTypeDefinition;
//# sourceMappingURL=VoucherTypeDefinition.js.map