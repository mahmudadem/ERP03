"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyController = void 0;
const CreateCompany_1 = require("../../../application/core/use-cases/CreateCompany");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const CoreDTOs_1 = require("../../dtos/CoreDTOs");
const core_validators_1 = require("../../validators/core.validators");
class CompanyController {
    static async createCompany(req, res, next) {
        try {
            // 1. Validate Input
            (0, core_validators_1.validateCreateCompanyInput)(req.body);
            // 2. Prepare UseCase
            const useCase = new CreateCompany_1.CreateCompanyUseCase(bindRepositories_1.diContainer.companyRepository);
            // 3. Execute
            const { name, taxId, address } = req.body;
            const result = await useCase.execute({ name, taxId, address });
            // 4. Return DTO
            res.status(201).json({
                success: true,
                data: CoreDTOs_1.CoreDTOMapper.toCompanyDTO(result),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getUserCompanies(req, res, next) {
        try {
            // Mock implementation until GetUserCompaniesUseCase is fully generated
            // const userId = req.user!.uid;
            // const useCase = new GetUserCompaniesUseCase(diContainer.companyRepository);
            // const companies = await useCase.execute({ userId });
            res.status(200).json({
                success: true,
                data: [], // Placeholder
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CompanyController = CompanyController;
//# sourceMappingURL=CompanyController.js.map