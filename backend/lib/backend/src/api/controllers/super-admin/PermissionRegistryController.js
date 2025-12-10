"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionRegistryController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListPermissionsUseCase_1 = require("../../../application/super-admin/use-cases/ListPermissionsUseCase");
const CreatePermissionUseCase_1 = require("../../../application/super-admin/use-cases/CreatePermissionUseCase");
const UpdatePermissionUseCase_1 = require("../../../application/super-admin/use-cases/UpdatePermissionUseCase");
const DeletePermissionUseCase_1 = require("../../../application/super-admin/use-cases/DeletePermissionUseCase");
class PermissionRegistryController {
    static async list(req, res, next) {
        try {
            const useCase = new ListPermissionsUseCase_1.ListPermissionsUseCase(bindRepositories_1.diContainer.permissionRegistryRepository);
            const permissions = await useCase.execute();
            res.json({ success: true, data: permissions });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const useCase = new CreatePermissionUseCase_1.CreatePermissionUseCase(bindRepositories_1.diContainer.permissionRegistryRepository);
            await useCase.execute(req.body);
            res.status(201).json({ success: true, message: 'Permission created successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const useCase = new UpdatePermissionUseCase_1.UpdatePermissionUseCase(bindRepositories_1.diContainer.permissionRegistryRepository);
            await useCase.execute(Object.assign({ id: req.params.id }, req.body));
            res.json({ success: true, message: 'Permission updated successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const useCase = new DeletePermissionUseCase_1.DeletePermissionUseCase(bindRepositories_1.diContainer.permissionRegistryRepository);
            await useCase.execute(req.params.id);
            res.json({ success: true, message: 'Permission deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PermissionRegistryController = PermissionRegistryController;
//# sourceMappingURL=PermissionRegistryController.js.map