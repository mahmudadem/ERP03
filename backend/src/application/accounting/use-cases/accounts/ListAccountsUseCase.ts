import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { Account } from '../../../domain/accounting/models/Account';

export class ListAccountsUseCase {
    constructor(private accountRepo: IAccountRepository) { }

    async execute(companyId: string): Promise<Account[]> {
        return await this.accountRepo.list(companyId);
    }
}
