import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { Account } from '../../../../domain/accounting/models/Account';

export class GetAccountUseCase {
    constructor(private accountRepo: IAccountRepository) { }

    async execute(companyId: string, accountId: string): Promise<Account | null> {
        return await this.accountRepo.getById(companyId, accountId);
    }
}
