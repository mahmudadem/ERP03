import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { UpdateCompanyProfileUseCase } from '../../../application/company-admin/use-cases/UpdateCompanyProfileUseCase';
import { CoreDTOMapper } from '../../dtos/CoreDTOs';

/**
 * CompanyProfileController
 * Handles company profile management operations
 */
export class CompanyProfileController {
  
  /**
   * GET /company-admin/profile
   * Get company profile
   */
  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      // Get company ID from tenant context
      const tenantContext = (req as any).tenantContext;
      if (!tenantContext || !tenantContext.companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company context not found'
        });
      }

      const companyId = tenantContext.companyId;

      // Load company
      const company = await diContainer.companyRepository.findById(companyId);
      
      if (!company) {
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }

      // Return company profile
      res.status(200).json({
        success: true,
        data: CoreDTOMapper.toCompanyDTO(company)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/profile/update
   * Update company profile
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      // Get company ID from tenant context
      const tenantContext = (req as any).tenantContext;
      if (!tenantContext || !tenantContext.companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company context not found'
        });
      }

      const companyId = tenantContext.companyId;
      const updates = req.body;

      // Execute use case
      const useCase = new UpdateCompanyProfileUseCase(diContainer.companyRepository);
      const updatedCompany = await useCase.execute({
        companyId,
        updates
      });

      // Return updated profile
      res.status(200).json({
        success: true,
        data: CoreDTOMapper.toCompanyDTO(updatedCompany)
      });
    } catch (error) {
      next(error);
    }
  }
}
