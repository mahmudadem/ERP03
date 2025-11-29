import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';

export class DeactivateAccountUseCase {
    constructor(private accountRepo: IAccountRepository) { }

    async execute(companyId: string, accountId: string): Promise<void> {
        const account = await this.accountRepo.getById(companyId, accountId);

        if (!account) {
            throw new Error('Account not found');
        }

        if (account.isProtected) {
            throw new Error('Cannot deactivate a protected account');
        }

        const hasChildren = await this.accountRepo.hasChildren(companyId, accountId);
        if (hasChildren) {
            throw new Error('Cannot deactivate an account with children');
        }

        await this.accountRepo.deactivate(companyId, accountId);
    }
}
