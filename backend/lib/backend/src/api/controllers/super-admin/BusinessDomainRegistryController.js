"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessDomainRegistryController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListBusinessDomainsUseCase_1 = require("../../../application/super-admin/use-cases/ListBusinessDomainsUseCase");
const CreateBusinessDomainUseCase_1 = require("../../../application/super-admin/use-cases/CreateBusinessDomainUseCase");
const UpdateBusinessDomainUseCase_1 = require("../../../application/super-admin/use-cases/UpdateBusinessDomainUseCase");
const DeleteBusinessDomainUseCase_1 = require("../../../application/super-admin/use-cases/DeleteBusinessDomainUseCase");
class BusinessDomainRegistryController {
    static async list(req, res, next) {
        try {
            const useCase = new ListBusinessDomainsUseCase_1.ListBusinessDomainsUseCase(bindRepositories_1.diContainer.businessDomainRepository);
            const domains = await useCase.execute();
            res.json({ success: true, data: domains });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const useCase = new CreateBusinessDomainUseCase_1.CreateBusinessDomainUseCase(bindRepositories_1.diContainer.businessDomainRepository);
            await useCase.execute(req.body);
            res.status(201).json({ success: true, message: 'Business domain created successfully' });
        }
        catch (error) {
            console.error('[BusinessDomainRegistryController] Create error:', error);
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const useCase = new UpdateBusinessDomainUseCase_1.UpdateBusinessDomainUseCase(bindRepositories_1.diContainer.businessDomainRepository);
            await useCase.execute(Object.assign({ id: req.params.id }, req.body));
            res.json({ success: true, message: 'Business domain updated successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const useCase = new DeleteBusinessDomainUseCase_1.DeleteBusinessDomainUseCase(bindRepositories_1.diContainer.businessDomainRepository);
            await useCase.execute(req.params.id);
            res.json({ success: true, message: 'Business domain deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.BusinessDomainRegistryController = BusinessDomainRegistryController;
//# sourceMappingURL=BusinessDomainRegistryController.js.map