import { IAccountRepository, NewAccountInput } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { Account } from '../../../../domain/accounting/models/Account';

export class CreateAccountUseCase {
  constructor(private accountRepo: IAccountRepository) { }

  async execute(companyId: string, data: NewAccountInput): Promise<Account> {
    // Check if account code already exists
    const existing = await this.accountRepo.getByCode(companyId, data.code);
    if (existing) {
      const err: any = new Error(`Account with code ${data.code} already exists`);
      (err as any).statusCode = 409;
      throw err;
    }

    const sanitized: NewAccountInput = {
      code: data.code,
      name: data.name,
      type: (data.type || 'ASSET').toUpperCase() as any,
      parentId: data.parentId ? data.parentId : null,
      currency: data.currency || null
    };

    return await this.accountRepo.create(companyId, sanitized);
  }
}
