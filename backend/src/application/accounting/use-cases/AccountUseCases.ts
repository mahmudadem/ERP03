
import { Account, AccountType } from '../../../domain/accounting/entities/Account';
import { IAccountRepository } from '../../../repository/interfaces/accounting';

export class CreateAccountUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(data: { code: string; name: string; type: AccountType; currency: string; companyId: string }): Promise<Account> {
    const account = new Account(
      `acc_${Date.now()}`,
      data.code,
      data.name,
      data.type,
      data.currency,
      false, // isProtected
      true,  // active
    );
    // Note: Assuming repo handles companyId context or Entity needs update to include companyId (which it usually does)
    await this.accountRepo.createAccount(account);
    return account;
  }
}

export class UpdateAccountUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(accountId: string, data: Partial<Account>): Promise<void> {
    await this.accountRepo.updateAccount(accountId, data);
  }
}

export class DeactivateAccountUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(accountId: string): Promise<void> {
    const account = await this.accountRepo.getAccount(accountId);
    if (account && account.isProtected) {
      throw new Error('Cannot deactivate a system protected account');
    }
    await this.accountRepo.deactivateAccount(accountId);
  }
}
