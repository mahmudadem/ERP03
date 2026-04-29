"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleRegistryController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListModulesUseCase_1 = require("../../../application/super-admin/use-cases/ListModulesUseCase");
const CreateModuleUseCase_1 = require("../../../application/super-admin/use-cases/CreateModuleUseCase");
const UpdateModuleUseCase_1 = require("../../../application/super-admin/use-cases/UpdateModuleUseCase");
const DeleteModuleUseCase_1 = require("../../../application/super-admin/use-cases/DeleteModuleUseCase");
const ModuleAvailabilityService_1 = require("../../../application/platform/ModuleAvailabilityService");
class ModuleRegistryController {
    static async list(req, res, next) {
        try {
            const useCase = new ListModulesUseCase_1.ListModulesUseCase(bindRepositories_1.diContainer.moduleRegistryRepository);
            const modules = await useCase.execute();
            res.json({ success: true, data: modules });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const useCase = new CreateModuleUseCase_1.CreateModuleUseCase(bindRepositories_1.diContainer.moduleRegistryRepository);
            await useCase.execute(req.body);
            const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
            if (service.isInitialized()) {
                await service.rebuildAvailabilityMap();
            }
            res.status(201).json({ success: true, message: 'Module created successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        var _a;
        try {
            const useCase = new UpdateModuleUseCase_1.UpdateModuleUseCase(bindRepositories_1.diContainer.moduleRegistryRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyModuleRepository, bindRepositories_1.diContainer.companyEntitlementRepository, bindRepositories_1.diContainer.bundleRegistryRepository, bindRepositories_1.diContainer.roleTemplateRegistryRepository, bindRepositories_1.diContainer.companyRoleRepository, bindRepositories_1.diContainer.auditLogRepository);
            await useCase.execute(Object.assign(Object.assign({}, req.body), { id: req.params.id, requestedBy: (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid }));
            const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
            if (service.isInitialized()) {
                await service.rebuildAvailabilityMap();
            }
            res.json({ success: true, message: 'Module updated successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const useCase = new DeleteModuleUseCase_1.DeleteModuleUseCase(bindRepositories_1.diContainer.moduleRegistryRepository);
            await useCase.execute(req.params.id);
            const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
            if (service.isInitialized()) {
                await service.rebuildAvailabilityMap();
            }
            res.json({ success: true, message: 'Module deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ModuleRegistryController = ModuleRegistryController;
//# sourceMappingURL=ModuleRegistryController.js.map