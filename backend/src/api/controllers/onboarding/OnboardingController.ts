/**
 * OnboardingController.ts
 * 
 * Purpose: Handles onboarding-related HTTP requests.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { SignupUseCase } from '../../../application/auth/use-cases/SignupUseCase';
import { SelectPlanUseCase } from '../../../application/auth/use-cases/SelectPlanUseCase';
import { GetOnboardingStatusUseCase } from '../../../application/auth/use-cases/GetOnboardingStatusUseCase';
import { CreateCompanyUseCase } from '../../../application/onboarding/use-cases/CreateCompanyUseCase';
import { CompanyRolePermissionResolver } from '../../../application/rbac/CompanyRolePermissionResolver';
import { ApiError } from '../../errors/ApiError';

export class OnboardingController {
  /**
   * POST /auth/signup
   * Creates a new user account
   */
  static async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, firstName, lastName } = req.body;

      const useCase = new SignupUseCase(diContainer.userRepository);
      const result = await useCase.execute({
        email,
        password,
        firstName,
        lastName,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/onboarding-status
   * Returns user's onboarding status (requires auth)
   */
  static async getOnboardingStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.uid;
      if (!userId) {
        return next(ApiError.unauthorized('Authentication required'));
      }

      const useCase = new GetOnboardingStatusUseCase(
        diContainer.userRepository,
        diContainer.rbacCompanyUserRepository
      );
      const status = await useCase.execute(userId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/select-plan
   * Saves user's plan selection (requires auth)
   */
  static async selectPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.uid;
      if (!userId) {
        return next(ApiError.unauthorized('Authentication required'));
      }

      const { planId } = req.body;
      if (!planId) {
        return next(ApiError.badRequest('planId is required'));
      }

      const useCase = new SelectPlanUseCase(
        diContainer.userRepository,
        diContainer.planRegistryRepository
      );
      const result = await useCase.execute({ userId, planId });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /plans
   * Returns all active plans (public endpoint for plan selection page)
   */
  static async listPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await diContainer.planRegistryRepository.getAll();
      
      // Filter to only active plans and format for frontend
      const activePlans = plans
        .filter(p => p.status === 'active')
        .map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          limits: p.limits,
        }));

      res.json({
        success: true,
        data: activePlans,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /bundles
   * Returns all active bundles (for company wizard)
   */
  static async listBundles(req: Request, res: Response, next: NextFunction) {
    try {
      const bundles = await diContainer.bundleRegistryRepository.getAll();
      
      // Format for frontend
      const formattedBundles = bundles.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        modules: b.modulesIncluded,
        recommended: false, // Could be based on user's business domain in future
      }));

      res.json({
        success: true,
        data: formattedBundles,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * POST /create-company
   * Creates a new company directly (fast wizard)
   */
  static async createCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.uid;
      if (!userId) {
        return next(ApiError.unauthorized('Authentication required'));
      }

      const { companyName, description, country, email, bundleId } = req.body;

      // We need a resolver instance
      const resolver = new CompanyRolePermissionResolver(
        diContainer.modulePermissionsDefinitionRepository,
        diContainer.companyRoleRepository
      );

      const useCase = new CreateCompanyUseCase(
        diContainer.companyRepository,
        diContainer.userRepository,
        diContainer.rbacCompanyUserRepository,
        diContainer.companyRoleRepository,
        resolver,
        diContainer.bundleRegistryRepository,
        diContainer.companyModuleRepository
      );

      const result = await useCase.execute({
        userId,
        companyName,
        description,
        country,
        email,
        bundleId
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
