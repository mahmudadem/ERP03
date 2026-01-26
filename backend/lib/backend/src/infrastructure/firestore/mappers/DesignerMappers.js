"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherTypeDefinitionMapper = exports.FormDefinitionMapper = void 0;
const FormDefinition_1 = require("../../../domain/designer/entities/FormDefinition");
const VoucherTypeDefinition_1 = require("../../../domain/designer/entities/VoucherTypeDefinition");
class FormDefinitionMapper {
    static toDomain(data) {
        // Assuming simple JSON storage for complex nested objects
        return new FormDefinition_1.FormDefinition(data.id, data.name || 'Untitled Form', data.module, data.type, data.fields || [], data.sections || []);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            name: entity.name,
            module: entity.module,
            type: entity.type,
            fields: entity.fields,
            sections: entity.sections
        };
    }
}
exports.FormDefinitionMapper = FormDefinitionMapper;
class VoucherTypeDefinitionMapper {
    static toDomain(data) {
        var _a;
        return new VoucherTypeDefinition_1.VoucherTypeDefinition(data.id, data.companyId || '', data.name, data.code || 'UNKNOWN', data.module, data.headerFields || [], data.tableColumns || [], data.layout || {}, data.schemaVersion || 1, data.requiredPostingRoles || [], data.workflow || null, data.uiModeOverrides || null, (_a = data.isMultiLine) !== null && _a !== void 0 ? _a : true, data.rules || [], data.actions || [], data.defaultCurrency || '');
    }
    static toPersistence(entity) {
        var _a;
        return {
            id: entity.id,
            companyId: entity.companyId,
            name: entity.name,
            code: entity.code,
            module: entity.module,
            headerFields: (entity.headerFields || []).map(f => (Object.assign({}, f))),
            tableColumns: entity.tableColumns || [],
            layout: entity.layout || {},
            schemaVersion: entity.schemaVersion || 2,
            workflow: entity.workflow || null,
            uiModeOverrides: entity.uiModeOverrides || null,
            isMultiLine: (_a = entity.isMultiLine) !== null && _a !== void 0 ? _a : true,
            rules: entity.rules || [],
            actions: entity.actions || [],
            defaultCurrency: entity.defaultCurrency || ''
        };
    }
}
exports.VoucherTypeDefinitionMapper = VoucherTypeDefinitionMapper;
//# sourceMappingURL=DesignerMappers.js.map