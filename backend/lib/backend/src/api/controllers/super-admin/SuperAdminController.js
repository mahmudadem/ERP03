"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const PromoteUserToSuperAdminUseCase_1 = require("../../../application/super-admin/use-cases/PromoteUserToSuperAdminUseCase");
const DemoteSuperAdminUseCase_1 = require("../../../application/super-admin/use-cases/DemoteSuperAdminUseCase");
const ListAllUsersUseCase_1 = require("../../../application/super-admin/use-cases/ListAllUsersUseCase");
const ListAllCompaniesUseCase_1 = require("../../../application/super-admin/use-cases/ListAllCompaniesUseCase");
const GetSystemOverviewUseCase_1 = require("../../../application/super-admin/use-cases/GetSystemOverviewUseCase");
class SuperAdminController {
    static async listAllUsers(req, res, next) {
        try {
            const actorId = req.user.uid;
            const useCase = new ListAllUsersUseCase_1.ListAllUsersUseCase(bindRepositories_1.diContainer.userRepository);
            const users = await useCase.execute(actorId);
            res.json({ success: true, data: users });
        }
        catch (error) {
            next(error);
        }
    }
    static async promoteUser(req, res, next) {
        try {
            const actorId = req.user.uid;
            const { userId } = req.params;
            const useCase = new PromoteUserToSuperAdminUseCase_1.PromoteUserToSuperAdminUseCase(bindRepositories_1.diContainer.userRepository);
            await useCase.execute(userId, actorId);
            res.json({ success: true, message: 'User promoted to SUPER_ADMIN' });
        }
        catch (error) {
            next(error);
        }
    }
    static async demoteUser(req, res, next) {
        try {
            const actorId = req.user.uid;
            const { userId } = req.params;
            const useCase = new DemoteSuperAdminUseCase_1.DemoteSuperAdminUseCase(bindRepositories_1.diContainer.userRepository);
            await useCase.execute(userId, actorId);
            res.json({ success: true, message: 'User demoted to USER' });
        }
        catch (error) {
            next(error);
        }
    }
    static async listAllCompanies(req, res, next) {
        try {
            const actorId = req.user.uid;
            const useCase = new ListAllCompaniesUseCase_1.ListAllCompaniesUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.companyRepository);
            const companies = await useCase.execute(actorId);
            res.json({ success: true, data: companies });
        }
        catch (error) {
            next(error);
        }
    }
    static async getSystemOverview(req, res, next) {
        try {
            const actorId = req.user.uid;
            const useCase = new GetSystemOverviewUseCase_1.GetSystemOverviewUseCase(bindRepositories_1.diContainer.userRepository);
            const overview = await useCase.execute(actorId);
            res.json({ success: true, data: overview });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SuperAdminController = SuperAdminController;
//# sourceMappingURL=SuperAdminController.js.map