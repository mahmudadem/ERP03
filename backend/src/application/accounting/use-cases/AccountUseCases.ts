
import { randomUUID } from 'crypto';
import { Account, AccountType } from '../../../domain/accounting/entities/Account';
import { IAccountRepository } from '../../../repository/interfaces/accounting';

export class CreateAccountUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(data: { code: string; name: string; type: AccountType; currency: string; companyId: string }): Promise<Account> {
    const account = new Account(
      data.companyId,
      randomUUID(),
      data.code,
      data.name,
      data.type,
      data.currency,
      false, // isProtected
      true,  // active
      undefined,
      undefined
    );
    await this.accountRepo.create(data.companyId, {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      currency: account.currency,
      parentId: account.parentId || null
    });
    return account;
  }
}

export class UpdateAccountUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(accountId: string, data: Partial<Account>): Promise<void> {
    if (!data.companyId) {
      throw new Error('companyId is required for update');
    }
    await this.accountRepo.update(data.companyId, accountId, {
      code: data.code,
      name: data.name,
      type: data.type as any,
      parentId: data.parentId,
      isActive: data.isActive,
      currency: data.currency
    });
  }
}

export class DeactivateAccountUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(accountId: string, companyId: string): Promise<void> {
    const account = await this.accountRepo.getById(companyId, accountId);
    if (account && account.isProtected) {
      throw new Error('Cannot deactivate a system protected account');
    }
    await this.accountRepo.deactivate(companyId, accountId);
  }
}
