import { IAccountRepository, NewAccountInput } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { Account } from '../../../domain/accounting/models/Account';

export class CreateAccountUseCase {
    constructor(private accountRepo: IAccountRepository) { }

    async execute(companyId: string, data: NewAccountInput): Promise<Account> {
        // Check if account code already exists
        const existing = await this.accountRepo.getByCode(companyId, data.code);
        if (existing) {
            throw new Error(`Account with code ${data.code} already exists`);
        }

        return await this.accountRepo.create(companyId, data);
    }
}
