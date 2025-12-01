"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignerDTOMapper = void 0;
class DesignerDTOMapper {
    static toFormDefinitionDTO(form) {
        return {
            id: form.id,
            name: form.name,
            module: form.module,
            type: form.type,
            fieldCount: form.fields.length,
        };
    }
    static toVoucherTypeDTO(def) {
        return {
            id: def.id,
            name: def.name,
            code: def.code,
            module: def.module,
        };
    }
}
exports.DesignerDTOMapper = DesignerDTOMapper;
//# sourceMappingURL=DesignerDTOs.js.map