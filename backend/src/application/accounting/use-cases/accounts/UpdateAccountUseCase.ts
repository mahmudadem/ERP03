import { IAccountRepository, UpdateAccountInput } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { Account } from '../../../../domain/accounting/models/Account';

export class UpdateAccountUseCase {
    constructor(private accountRepo: IAccountRepository) { }

    async execute(companyId: string, accountId: string, data: UpdateAccountInput): Promise<Account> {
        // Get existing account
        const existing = await this.accountRepo.getById(companyId, accountId);
        if (!existing) {
            throw new Error('Account not found');
        }

        // Check if protected
        if (existing.isProtected && (data.type || data.parentId !== undefined)) {
            throw new Error('Cannot change type or parent of a protected account');
        }

        // If changing code, check uniqueness
        if (data.code && data.code !== existing.code) {
            const duplicate = await this.accountRepo.getByCode(companyId, data.code);
            if (duplicate) {
                throw new Error(`Account with code ${data.code} already exists`);
            }
        }

        // If changing type or parent, check for children
        if ((data.type && data.type !== existing.type) || (data.parentId !== undefined && data.parentId !== existing.parentId)) {
            const hasChildren = await this.accountRepo.hasChildren(companyId, accountId);
            if (hasChildren) {
                throw new Error('Cannot change type or parent of an account with children');
            }
        }

        return await this.accountRepo.update(companyId, accountId, data);
    }
}
