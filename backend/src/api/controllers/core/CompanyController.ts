/**
 * CompanyController.ts
 * Layer: API
 * Purpose: Handles HTTP requests for Company operations.
 */
import { Request, Response, NextFunction } from 'express';
import { CreateCompanyUseCase } from '../../../application/core/use-cases/CreateCompany';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { CoreDTOMapper } from '../../dtos/CoreDTOs';
import { validateCreateCompanyInput } from '../../validators/core.validators';

export class CompanyController {
  
  static async createCompany(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Validate Input
      validateCreateCompanyInput((req as any).body);

      // 2. Prepare UseCase
      const useCase = new CreateCompanyUseCase(diContainer.companyRepository);

      // 3. Execute
      const { name, taxId, address } = (req as any).body;
      const result = await useCase.execute({ name, taxId, address });

      // 4. Return DTO
      (res as any).status(201).json({
        success: true,
        data: CoreDTOMapper.toCompanyDTO(result),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      // Mock implementation until GetUserCompaniesUseCase is fully generated
      // const userId = req.user!.uid;
      // const useCase = new GetUserCompaniesUseCase(diContainer.companyRepository);
      // const companies = await useCase.execute({ userId });
      
      (res as any).status(200).json({
        success: true,
        data: [], // Placeholder
      });
    } catch (error) {
      next(error);
    }
  }
}