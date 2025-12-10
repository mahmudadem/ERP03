"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePermissionUseCase = void 0;
class CreatePermissionUseCase {
    constructor(permissionRepo) {
        this.permissionRepo = permissionRepo;
    }
    async execute(input) {
        const permission = Object.assign(Object.assign({}, input), { createdAt: new Date(), updatedAt: new Date() });
        await this.permissionRepo.create(permission);
    }
}
exports.CreatePermissionUseCase = CreatePermissionUseCase;
//# sourceMappingURL=CreatePermissionUseCase.js.map