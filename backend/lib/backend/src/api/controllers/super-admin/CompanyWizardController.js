"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyWizardController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const GetAvailableCompanyModelsUseCase_1 = require("../../../application/company-wizard/use-cases/GetAvailableCompanyModelsUseCase");
const GetWizardStepsForModelUseCase_1 = require("../../../application/company-wizard/use-cases/GetWizardStepsForModelUseCase");
const StartCompanyCreationWizardUseCase_1 = require("../../../application/company-wizard/use-cases/StartCompanyCreationWizardUseCase");
const GetNextWizardStepUseCase_1 = require("../../../application/company-wizard/use-cases/GetNextWizardStepUseCase");
const SubmitWizardStepUseCase_1 = require("../../../application/company-wizard/use-cases/SubmitWizardStepUseCase");
const GetOptionsForFieldUseCase_1 = require("../../../application/company-wizard/use-cases/GetOptionsForFieldUseCase");
const CompleteCompanyCreationUseCase_1 = require("../../../application/company-wizard/use-cases/CompleteCompanyCreationUseCase");
const CompanyRolePermissionResolver_1 = require("../../../application/rbac/CompanyRolePermissionResolver");
const ApiError_1 = require("../../errors/ApiError");
const resolver = new CompanyRolePermissionResolver_1.CompanyRolePermissionResolver(bindRepositories_1.diContainer.modulePermissionsDefinitionRepository, bindRepositories_1.diContainer.companyRoleRepository);
class CompanyWizardController {
    static async getModels(req, res, next) {
        try {
            const useCase = new GetAvailableCompanyModelsUseCase_1.GetAvailableCompanyModelsUseCase();
            const models = await useCase.execute();
            res.json({ success: true, data: models });
        }
        catch (error) {
            next(error);
        }
    }
    static async getSteps(req, res, next) {
        try {
            const model = String(req.query.model || '');
            const useCase = new GetWizardStepsForModelUseCase_1.GetWizardStepsForModelUseCase(bindRepositories_1.diContainer.companyWizardTemplateRepository);
            const steps = await useCase.execute({ model });
            res.json({ success: true, data: steps });
        }
        catch (error) {
            next(error);
        }
    }
    static async start(req, res, next) {
        try {
            const userId = req.user.uid;
            const { companyName, model } = req.body;
            if (!userId) {
                throw new Error('Unauthorized');
            }
            const useCase = new StartCompanyCreationWizardUseCase_1.StartCompanyCreationWizardUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.companyWizardTemplateRepository, bindRepositories_1.diContainer.companyCreationSessionRepository, bindRepositories_1.diContainer.companyRepository);
            const result = await useCase.execute({ userId, companyName, model });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    static async getStep(req, res, next) {
        try {
            const sessionId = String(req.query.sessionId || '');
            const userId = req.user.uid;
            if (!sessionId) {
                throw ApiError_1.ApiError.badRequest('sessionId is required');
            }
            const useCase = new GetNextWizardStepUseCase_1.GetNextWizardStepUseCase(bindRepositories_1.diContainer.companyCreationSessionRepository, bindRepositories_1.diContainer.companyWizardTemplateRepository);
            const step = await useCase.execute({ sessionId, userId });
            res.json({ success: true, data: step });
        }
        catch (error) {
            next(error);
        }
    }
    static async submitStep(req, res, next) {
        try {
            const { sessionId, stepId, values } = req.body;
            const userId = req.user.uid;
            const useCase = new SubmitWizardStepUseCase_1.SubmitWizardStepUseCase(bindRepositories_1.diContainer.companyCreationSessionRepository, bindRepositories_1.diContainer.companyWizardTemplateRepository);
            const result = await useCase.execute({ sessionId, stepId, values, userId });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    static async getOptions(req, res, next) {
        try {
            const sessionId = String(req.query.sessionId || '');
            const fieldId = String(req.query.fieldId || '');
            const session = await bindRepositories_1.diContainer.companyCreationSessionRepository.getById(sessionId);
            if (!session)
                throw new Error('Session not found');
            const userId = req.user.uid;
            if (session.userId !== userId)
                throw new Error('Forbidden');
            const template = await bindRepositories_1.diContainer.companyWizardTemplateRepository.getById(session.templateId);
            if (!template)
                throw new Error('Template not found');
            const steps = template.steps
                .filter((s) => !s.modelKey || s.modelKey === session.model)
                .sort((a, b) => a.order - b.order);
            const field = steps.reduce((acc, s) => acc.concat(s.fields), []).find((f) => f.id === fieldId);
            if (!field)
                throw new Error('Field not found');
            const useCase = new GetOptionsForFieldUseCase_1.GetOptionsForFieldUseCase(bindRepositories_1.diContainer.chartOfAccountsTemplateRepository, bindRepositories_1.diContainer.currencyRepository, bindRepositories_1.diContainer.inventoryTemplateRepository);
            const options = await useCase.execute(field);
            res.json({ success: true, data: options });
        }
        catch (error) {
            next(error);
        }
    }
    static async complete(req, res, next) {
        try {
            const { sessionId } = req.body;
            const userId = req.user.uid;
            const useCase = new CompleteCompanyCreationUseCase_1.CompleteCompanyCreationUseCase(bindRepositories_1.diContainer.companyCreationSessionRepository, bindRepositories_1.diContainer.companyWizardTemplateRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository, resolver);
            const result = await useCase.execute({ sessionId, userId });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CompanyWizardController = CompanyWizardController;
//# sourceMappingURL=CompanyWizardController.js.map