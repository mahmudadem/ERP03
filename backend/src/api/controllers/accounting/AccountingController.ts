
/**
 * AccountingController.ts
 */
import { Request, Response, NextFunction } from 'express';
import { CreateAccountUseCase } from '../../../application/accounting/use-cases/AccountUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { AccountingDTOMapper } from '../../dtos/AccountingDTOs';
import { validateCreateAccountInput } from '../../validators/accounting.validators';

export class AccountingController {
  static async createAccount(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateAccountInput((req as any).body);
      
      const useCase = new CreateAccountUseCase(diContainer.accountRepository);
      const account = await useCase.execute((req as any).body);

      (res as any).status(201).json({
        success: true,
        data: AccountingDTOMapper.toAccountDTO(account)
      });
    } catch (error) {
      next(error);
    }
  }
}
