import { Request, Response } from 'express';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ApiError } from '../../errors/ApiError';

/**
 * Controller for CompanyModule operations
 */
export class CompanyModulesController {
  constructor(private companyModuleRepo: ICompanyModuleRepository) {}

  /**
   * GET /company-modules/:companyId
   * List all installed modules for a company
   */
  async listModules(req: Request, res: Response) {
    try {
      const { companyId } = req.params;
      const modules = await this.companyModuleRepo.listByCompany(companyId);
      res.json({ modules });
    } catch (error) {
      console.error('Error listing company modules:', error);
      res.status(500).json({ error: 'Failed to list modules' });
    }
  }

  /**
   * GET /company-modules/:companyId/:moduleCode
   * Get a specific module installation record
   */
  async getModule(req: Request, res: Response) {
    try {
      const { companyId, moduleCode } = req.params;
      const module = await this.companyModuleRepo.get(companyId, moduleCode);
      
      if (!module) {
        throw ApiError.notFound('Module installation not found');
      }

      res.json(module);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error('Error getting company module:', error);
        res.status(500).json({ error: 'Failed to get module' });
      }
    }
  }

  /**
   * PATCH /company-modules/:companyId/:moduleCode/initialize
   * Mark a module as initialized with optional config
   */
  async initializeModule(req: Request, res: Response) {
    try {
      const { companyId, moduleCode } = req.params;
      const { config = {} } = req.body;

      // Check if module exists
      const module = await this.companyModuleRepo.get(companyId, moduleCode);
      if (!module) {
        throw ApiError.notFound('Module installation not found');
      }

      // Update module state
      await this.companyModuleRepo.update(companyId, moduleCode, {
        initialized: true,
        initializationStatus: 'complete',
        config,
        updatedAt: new Date()
      });

      res.json({ 
        success: true, 
        message: `Module ${moduleCode} initialized successfully` 
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error('Error initializing module:', error);
        res.status(500).json({ error: 'Failed to initialize module' });
      }
    }
  }

  /**
   * POST /company-modules/:companyId/:moduleCode/start-initialization
   * Mark initialization as in-progress
   */
  async startInitialization(req: Request, res: Response) {
    try {
      const { companyId, moduleCode } = req.params;

      await this.companyModuleRepo.update(companyId, moduleCode, {
        initializationStatus: 'in_progress',
        updatedAt: new Date()
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error starting initialization:', error);
      res.status(500).json({ error: 'Failed to start initialization' });
    }
  }
}
