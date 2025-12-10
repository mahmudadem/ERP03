"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanRegistryController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListPlansUseCase_1 = require("../../../application/super-admin/use-cases/ListPlansUseCase");
const CreatePlanUseCase_1 = require("../../../application/super-admin/use-cases/CreatePlanUseCase");
const UpdatePlanUseCase_1 = require("../../../application/super-admin/use-cases/UpdatePlanUseCase");
const DeletePlanUseCase_1 = require("../../../application/super-admin/use-cases/DeletePlanUseCase");
class PlanRegistryController {
    static async list(req, res, next) {
        try {
            const useCase = new ListPlansUseCase_1.ListPlansUseCase(bindRepositories_1.diContainer.planRegistryRepository);
            const plans = await useCase.execute();
            res.json({ success: true, data: plans });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const useCase = new CreatePlanUseCase_1.CreatePlanUseCase(bindRepositories_1.diContainer.planRegistryRepository);
            await useCase.execute(req.body);
            res.status(201).json({ success: true, message: 'Plan created successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const useCase = new UpdatePlanUseCase_1.UpdatePlanUseCase(bindRepositories_1.diContainer.planRegistryRepository);
            await useCase.execute(Object.assign({ id: req.params.id }, req.body));
            res.json({ success: true, message: 'Plan updated successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const useCase = new DeletePlanUseCase_1.DeletePlanUseCase(bindRepositories_1.diContainer.planRegistryRepository);
            await useCase.execute(req.params.id);
            res.json({ success: true, message: 'Plan deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PlanRegistryController = PlanRegistryController;
//# sourceMappingURL=PlanRegistryController.js.map