import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListCompanyModulesUseCase } from '../../../application/company-admin/use-cases/ListCompanyModulesUseCase';
import { ListActiveCompanyModulesUseCase } from '../../../application/company-admin/use-cases/ListActiveCompanyModulesUseCase';
import { EnableModuleForCompanyUseCase } from '../../../application/company-admin/use-cases/EnableModuleForCompanyUseCase';
import { DisableModuleForCompanyUseCase } from '../../../application/company-admin/use-cases/DisableModuleForCompanyUseCase';
import { EnableCapabilityForCompanyUseCase } from '../../../application/company-admin/use-cases/EnableCapabilityForCompanyUseCase';
import { DisableCapabilityForCompanyUseCase } from '../../../application/company-admin/use-cases/DisableCapabilityForCompanyUseCase';
import {
  filterRuntimeAvailableModules,
  resolveCompanyEnabledModules
} from '../../../application/company-admin/services/CompanyModuleAccessResolver';
import { resolveCompanyCapabilityAccess } from '../../../application/company-admin/services/CompanyCapabilityAccessResolver';

/**
 * CompanyModulesController
 * Handles company module activation/deactivation
 */
export class CompanyModulesController {

  /**
   * GET /company-admin/modules
   * List available modules
   */
  static async listModules(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new ListCompanyModulesUseCase(
        diContainer.companyRepository,
        diContainer.companyModuleRepository
      );
      const result = await useCase.execute({ companyId });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /company-admin/modules/active
   * List active modules
   */
  static async listActiveModules(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new ListActiveCompanyModulesUseCase(
        diContainer.companyRepository,
        diContainer.companyModuleRepository
      );
      const result = await useCase.execute({ companyId });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/modules/enable
   * Enable module
   */
  static async enableModule(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { moduleName } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!moduleName) {
        res.status(400).json({ success: false, error: 'Module name required' });
        return;
      }

      const useCase = new EnableModuleForCompanyUseCase(
        diContainer.companyRepository,
        diContainer.companyModuleRepository,
        diContainer.companyEntitlementRepository,
        diContainer.voucherTypeDefinitionRepository,
        diContainer.voucherFormRepository
      );
      const result = await useCase.execute({ companyId, moduleName });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/modules/disable
   * Disable module
   */
  static async disableModule(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { moduleName } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!moduleName) {
        res.status(400).json({ success: false, error: 'Module name required' });
        return;
      }

      const useCase = new DisableModuleForCompanyUseCase(
        diContainer.companyRepository,
        diContainer.companyModuleRepository
      );
      const result = await useCase.execute({ companyId, moduleName });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /company-admin/capabilities
   * List available capabilities for company
   */
  static async listCapabilities(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const company = await diContainer.companyRepository.findById(companyId);
      if (!company) {
        res.status(404).json({ success: false, error: 'Company not found' });
        return;
      }

      const companyModules = await diContainer.companyModuleRepository.listByCompany(companyId);
      const entitledModules = await diContainer.entitlementService.getEntitledModules(companyId);
      const companyEnabledModules = resolveCompanyEnabledModules({
        companyModules,
        legacyModules: (company.modules || []) as string[],
        entitledModules,
      });
      const availableParentModules = await filterRuntimeAvailableModules(companyId, companyEnabledModules);
      const result = await resolveCompanyCapabilityAccess({
        companyId,
        accessibleModules: availableParentModules,
        capabilityRepository: diContainer.capabilityRegistryRepository,
        entitlementRepository: diContainer.companyEntitlementRepository,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/capabilities/enable
   * Enable a capability
   */
  static async enableCapability(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { capabilityCode } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!capabilityCode) {
        res.status(400).json({ success: false, error: 'Capability code required' });
        return;
      }

      const useCase = new EnableCapabilityForCompanyUseCase(
        diContainer.companyRepository,
        diContainer.capabilityRegistryRepository,
        diContainer.companyEntitlementRepository,
        diContainer.companyModuleRepository
      );
      const result = await useCase.execute({ companyId, capabilityCode });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/capabilities/disable
   * Disable a capability
   */
  static async disableCapability(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { capabilityCode } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!capabilityCode) {
        res.status(400).json({ success: false, error: 'Capability code required' });
        return;
      }

      const useCase = new DisableCapabilityForCompanyUseCase(
        diContainer.companyRepository,
        diContainer.capabilityRegistryRepository
      );
      const result = await useCase.execute({ companyId, capabilityCode });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
