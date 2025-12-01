"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRolePermissionsUseCase = exports.CreateRoleUseCase = void 0;
const Role_1 = require("../../../domain/system/entities/Role");
class CreateRoleUseCase {
    constructor(roleRepository) {
        this.roleRepository = roleRepository;
    }
    async execute(companyId, name, permissions) {
        const roleId = `role_${Date.now()}`;
        const role = new Role_1.Role(roleId, name, permissions);
        await this.roleRepository.createRole(companyId, role);
    }
}
exports.CreateRoleUseCase = CreateRoleUseCase;
class UpdateRolePermissionsUseCase {
    constructor(roleRepository, permissionRepository) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
    }
    async execute(roleId, permissions) {
        const role = await this.roleRepository.getRole(roleId);
        if (!role)
            throw new Error('Role not found');
        // Domain entity update
        role.permissions = permissions;
        // Persist
        await this.roleRepository.updateRole(roleId, { permissions });
        // If permission repo needs specific linking
        await this.permissionRepository.assignPermissions(roleId, permissions);
    }
}
exports.UpdateRolePermissionsUseCase = UpdateRolePermissionsUseCase;
//# sourceMappingURL=RoleUseCases.js.map