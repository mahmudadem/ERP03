/**
 * CompanyWizardController.ts (Relocated to Core)
 * 
 * Handles company creation wizard - now owned by the user, not super admin.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GetAvailableCompanyModelsUseCase } from '../../../application/company-wizard/use-cases/GetAvailableCompanyModelsUseCase';
import { GetWizardStepsForModelUseCase } from '../../../application/company-wizard/use-cases/GetWizardStepsForModelUseCase';
import { StartCompanyCreationWizardUseCase } from '../../../application/company-wizard/use-cases/StartCompanyCreationWizardUseCase';
import { GetNextWizardStepUseCase } from '../../../application/company-wizard/use-cases/GetNextWizardStepUseCase';
import { SubmitWizardStepUseCase } from '../../../application/company-wizard/use-cases/SubmitWizardStepUseCase';
import { GetOptionsForFieldUseCase } from '../../../application/company-wizard/use-cases/GetOptionsForFieldUseCase';
import { CompleteCompanyCreationUseCase } from '../../../application/company-wizard/use-cases/CompleteCompanyCreationUseCase';
import { CompanyRolePermissionResolver } from '../../../application/rbac/CompanyRolePermissionResolver';
import { ApiError } from '../../errors/ApiError';

const resolver = new CompanyRolePermissionResolver(
    diContainer.modulePermissionsDefinitionRepository,
    diContainer.companyRoleRepository
);

export class CompanyWizardController {
    static async getModels(req: Request, res: Response, next: NextFunction) {
        try {
            const useCase = new GetAvailableCompanyModelsUseCase();
            const models = await useCase.execute();
            res.json({ success: true, data: models });
        } catch (error) {
            next(error);
        }
    }

    static async getSteps(req: Request, res: Response, next: NextFunction) {
        try {
            const model = String(req.query.model || '');
            const useCase = new GetWizardStepsForModelUseCase(diContainer.companyWizardTemplateRepository);
            const steps = await useCase.execute({ model });
            res.json({ success: true, data: steps });
        } catch (error) {
            next(error);
        }
    }

    static async start(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.uid;
            const { companyName, model } = req.body;
            if (!userId) {
                throw new Error('Unauthorized');
            }
            const useCase = new StartCompanyCreationWizardUseCase(
                diContainer.userRepository,
                diContainer.companyWizardTemplateRepository,
                diContainer.companyCreationSessionRepository,
                diContainer.companyRepository
            );
            const result = await useCase.execute({ userId, companyName, model });
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getStep(req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = String(req.query.sessionId || '');
            const userId = (req as any).user.uid;
            if (!sessionId) {
                throw ApiError.badRequest('sessionId is required');
            }
            const useCase = new GetNextWizardStepUseCase(
                diContainer.companyCreationSessionRepository,
                diContainer.companyWizardTemplateRepository
            );
            const step = await useCase.execute({ sessionId, userId });
            res.json({ success: true, data: step });
        } catch (error) {
            next(error);
        }
    }

    static async submitStep(req: Request, res: Response, next: NextFunction) {
        try {
            const { sessionId, stepId, values } = req.body;
            const userId = (req as any).user.uid;
            const useCase = new SubmitWizardStepUseCase(
                diContainer.companyCreationSessionRepository,
                diContainer.companyWizardTemplateRepository
            );
            const result = await useCase.execute({ sessionId, stepId, values, userId });
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getOptions(req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = String(req.query.sessionId || '');
            const fieldId = String(req.query.fieldId || '');

            const session = await diContainer.companyCreationSessionRepository.getById(sessionId);
            if (!session) throw new Error('Session not found');
            const userId = (req as any).user.uid;
            if (session.userId !== userId) throw new Error('Forbidden');

            const template = await diContainer.companyWizardTemplateRepository.getById(session.templateId);
            if (!template) throw new Error('Template not found');

            const steps = template.steps
                .filter((s) => !s.modelKey || s.modelKey === session.model)
                .sort((a, b) => a.order - b.order);

            const field = steps.reduce((acc: any[], s) => acc.concat(s.fields), []).find((f: any) => f.id === fieldId);
            if (!field) throw new Error('Field not found');

            const useCase = new GetOptionsForFieldUseCase(
                diContainer.chartOfAccountsTemplateRepository,
                diContainer.currencyRepository,
                diContainer.inventoryTemplateRepository
            );
            const options = await useCase.execute(field);

            res.json({ success: true, data: options });
        } catch (error) {
            next(error);
        }
    }

    static async complete(req: Request, res: Response, next: NextFunction) {
        try {
            const { sessionId } = req.body;
            const userId = (req as any).user.uid;
            const useCase = new CompleteCompanyCreationUseCase(
                diContainer.companyCreationSessionRepository,
                diContainer.companyWizardTemplateRepository,
                diContainer.companyRepository,
                diContainer.userRepository,
                diContainer.rbacCompanyUserRepository,
                diContainer.companyRoleRepository,
                resolver
            );
            const result = await useCase.execute({ sessionId, userId });
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
}
