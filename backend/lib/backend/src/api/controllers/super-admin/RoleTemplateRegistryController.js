"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleTemplateRegistryController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListRoleTemplatesUseCase_1 = require("../../../application/super-admin/use-cases/ListRoleTemplatesUseCase");
const CreateRoleTemplateUseCase_1 = require("../../../application/super-admin/use-cases/CreateRoleTemplateUseCase");
const UpdateRoleTemplateUseCase_1 = require("../../../application/super-admin/use-cases/UpdateRoleTemplateUseCase");
const DeleteRoleTemplateUseCase_1 = require("../../../application/super-admin/use-cases/DeleteRoleTemplateUseCase");
class RoleTemplateRegistryController {
    static async list(req, res, next) {
        try {
            const useCase = new ListRoleTemplatesUseCase_1.ListRoleTemplatesUseCase(bindRepositories_1.diContainer.roleTemplateRegistryRepository);
            const roleTemplates = await useCase.execute();
            res.json({ success: true, data: roleTemplates });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const { GetRoleTemplateByIdUseCase } = require('../../../application/super-admin/use-cases/GetRoleTemplateByIdUseCase');
            const useCase = new GetRoleTemplateByIdUseCase(bindRepositories_1.diContainer.roleTemplateRegistryRepository);
            const roleTemplate = await useCase.execute(req.params.id);
            if (!roleTemplate) {
                res.status(404).json({ success: false, message: 'Role template not found' });
                return;
            }
            res.json({ success: true, data: roleTemplate });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const useCase = new CreateRoleTemplateUseCase_1.CreateRoleTemplateUseCase(bindRepositories_1.diContainer.roleTemplateRegistryRepository);
            await useCase.execute(req.body);
            res.status(201).json({ success: true, message: 'Role template created successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const useCase = new UpdateRoleTemplateUseCase_1.UpdateRoleTemplateUseCase(bindRepositories_1.diContainer.roleTemplateRegistryRepository);
            await useCase.execute(Object.assign({ id: req.params.id }, req.body));
            res.json({ success: true, message: 'Role template updated successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const useCase = new DeleteRoleTemplateUseCase_1.DeleteRoleTemplateUseCase(bindRepositories_1.diContainer.roleTemplateRegistryRepository);
            await useCase.execute(req.params.id);
            res.json({ success: true, message: 'Role template deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.RoleTemplateRegistryController = RoleTemplateRegistryController;
//# sourceMappingURL=RoleTemplateRegistryController.js.map