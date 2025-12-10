"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeletePermissionUseCase = void 0;
class DeletePermissionUseCase {
    constructor(permissionRepo) {
        this.permissionRepo = permissionRepo;
    }
    async execute(id) {
        await this.permissionRepo.delete(id);
    }
}
exports.DeletePermissionUseCase = DeletePermissionUseCase;
//# sourceMappingURL=DeletePermissionUseCase.js.map