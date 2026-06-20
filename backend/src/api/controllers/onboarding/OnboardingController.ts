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
import { SimpleTradingCompanyInitializer } from '../../../application/onboarding/use-cases/SimpleTradingCompanyInitializer';
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
      const bundles = await diContainer.bundleRegistryRepository.getReady();
      
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

      const {
        companyName,
        description,
        country,
        email,
        bundleId,
        logoData,
        currency,
        language,
        timezone,
        dateFormat,
        autoInitializeModules,
        starterTemplateId,
        accountingMode,
        coaTemplate,
        costingBasis,
        defaultWarehouseCode,
        defaultWarehouseName,
        salesWorkflowMode,
        purchaseWorkflowMode,
      } = req.body;
      const normalizedCurrency = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
      const normalizedAccountingMode =
        accountingMode === 'PERIODIC' || accountingMode === 'INVOICE_DRIVEN' || accountingMode === 'PERPETUAL'
          ? accountingMode
          : undefined;
      const normalizedCoaTemplate =
        coaTemplate === 'periodic_trading' || coaTemplate === 'standard' ? coaTemplate : undefined;
      const normalizedCostingBasis =
        costingBasis === 'GLOBAL' || costingBasis === 'WAREHOUSE' ? costingBasis : undefined;
      const normalizedSalesWorkflowMode =
        salesWorkflowMode === 'SIMPLE' || salesWorkflowMode === 'OPERATIONAL' ? salesWorkflowMode : undefined;
      const normalizedPurchaseWorkflowMode =
        purchaseWorkflowMode === 'SIMPLE' || purchaseWorkflowMode === 'OPERATIONAL' ? purchaseWorkflowMode : undefined;

      if (autoInitializeModules && !normalizedCurrency) {
        return next(ApiError.badRequest('Base currency is required before auto-initializing the Simple Trading Company template.'));
      }
      if (autoInitializeModules && accountingMode && !normalizedAccountingMode) {
        return next(ApiError.badRequest('accountingMode must be PERIODIC, INVOICE_DRIVEN, or PERPETUAL.'));
      }
      if (autoInitializeModules && coaTemplate !== undefined && !normalizedCoaTemplate) {
        return next(ApiError.badRequest('coaTemplate must be "periodic_trading" or "standard".'));
      }
      if (autoInitializeModules && costingBasis !== undefined && !normalizedCostingBasis) {
        return next(ApiError.badRequest('costingBasis must be "GLOBAL" or "WAREHOUSE".'));
      }
      if (autoInitializeModules && salesWorkflowMode !== undefined && !normalizedSalesWorkflowMode) {
        return next(ApiError.badRequest('salesWorkflowMode must be "SIMPLE" or "OPERATIONAL".'));
      }
      if (autoInitializeModules && purchaseWorkflowMode !== undefined && !normalizedPurchaseWorkflowMode) {
        return next(ApiError.badRequest('purchaseWorkflowMode must be "SIMPLE" or "OPERATIONAL".'));
      }
      if (autoInitializeModules && defaultWarehouseCode !== undefined && (typeof defaultWarehouseCode !== 'string' || !defaultWarehouseCode.trim())) {
        return next(ApiError.badRequest('defaultWarehouseCode must be a non-empty string.'));
      }
      if (autoInitializeModules && defaultWarehouseName !== undefined && (typeof defaultWarehouseName !== 'string' || !defaultWarehouseName.trim())) {
        return next(ApiError.badRequest('defaultWarehouseName must be a non-empty string.'));
      }

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
        diContainer.bundleRegistryRepository as any,
        diContainer.companyModuleRepository,
        diContainer.companySettingsRepository,
        diContainer.companyEntitlementRepository
      );

      const result = await useCase.execute({
        userId,
        companyName,
        description,
        country,
        email,
        bundleId,
        logoData,
        currency: normalizedCurrency || currency,
        language,
        timezone,
        dateFormat,
        autoInitializeModules,
        starterTemplateId,
        accountingMode: normalizedAccountingMode,
      });

      let starterPolicySummary = null;
      if (autoInitializeModules) {
        const selectedTemplateId = starterTemplateId || 'simple-trading-company';
        if (selectedTemplateId !== 'simple-trading-company') {
          return next(ApiError.badRequest(`Unsupported starter template: ${selectedTemplateId}`));
        }

        const initializer = new SimpleTradingCompanyInitializer({
          companyRepo: diContainer.companyRepository,
          companyModuleRepo: diContainer.companyModuleRepository,
          accountRepo: diContainer.accountRepository,
          systemMetadataRepo: diContainer.systemMetadataRepository,
          companyModuleSettingsRepo: diContainer.companyModuleSettingsRepository,
          companySettingsRepo: diContainer.companySettingsRepository,
          currencyRepo: diContainer.currencyRepository,
          fiscalYearRepo: diContainer.fiscalYearRepository,
          voucherTypeRepo: diContainer.voucherTypeDefinitionRepository,
          voucherFormRepo: diContainer.voucherFormRepository,
          inventorySettingsRepo: diContainer.inventorySettingsRepository,
          warehouseRepo: diContainer.warehouseRepository,
          uomRepo: diContainer.uomRepository,
          salesSettingsRepo: diContainer.salesSettingsRepository,
          purchaseSettingsRepo: diContainer.purchaseSettingsRepository,
        });

        starterPolicySummary = await initializer.execute({
          companyId: result.companyId,
          userId,
          baseCurrency: normalizedCurrency,
          accountingMode: normalizedAccountingMode,
          coaTemplate: normalizedCoaTemplate,
          costingBasis: normalizedCostingBasis,
          defaultWarehouseCode: typeof defaultWarehouseCode === 'string' ? defaultWarehouseCode : undefined,
          defaultWarehouseName: typeof defaultWarehouseName === 'string' ? defaultWarehouseName : undefined,
          salesWorkflowMode: normalizedSalesWorkflowMode,
          purchaseWorkflowMode: normalizedPurchaseWorkflowMode,
        });
      }

      res.json({
        success: true,
        data: {
          ...result,
          starterPolicySummary,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
