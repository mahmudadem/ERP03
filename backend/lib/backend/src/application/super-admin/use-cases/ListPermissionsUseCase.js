"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPermissionsUseCase = void 0;
class ListPermissionsUseCase {
    constructor(permissionRepo) {
        this.permissionRepo = permissionRepo;
    }
    async execute() {
        return await this.permissionRepo.getAll();
    }
}
exports.ListPermissionsUseCase = ListPermissionsUseCase;
//# sourceMappingURL=ListPermissionsUseCase.js.map