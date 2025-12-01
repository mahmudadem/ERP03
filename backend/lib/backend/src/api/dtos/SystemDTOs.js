"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemDTOMapper = void 0;
class SystemDTOMapper {
    static toRoleDTO(role) {
        return {
            id: role.id,
            name: role.name,
            permissions: role.permissions,
        };
    }
    static toModuleDTO(module) {
        return {
            id: module.id,
            name: module.name,
            enabled: module.enabled,
        };
    }
}
exports.SystemDTOMapper = SystemDTOMapper;
//# sourceMappingURL=SystemDTOs.js.map