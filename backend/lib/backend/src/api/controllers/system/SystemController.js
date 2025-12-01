"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemController = void 0;
const RoleUseCases_1 = require("../../../application/system/use-cases/RoleUseCases");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ApiError_1 = require("../../errors/ApiError");
class SystemController {
    static async createRole(req, res, next) {
        try {
            const { companyId, name, permissions } = req.body;
            if (!companyId || !name)
                throw ApiError_1.ApiError.badRequest('CompanyID and Name required');
            const useCase = new RoleUseCases_1.CreateRoleUseCase(bindRepositories_1.diContainer.roleRepository);
            await useCase.execute(companyId, name, permissions || []);
            res.status(201).json({ success: true, message: 'Role created' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SystemController = SystemController;
//# sourceMappingURL=SystemController.js.map