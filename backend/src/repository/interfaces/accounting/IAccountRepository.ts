
import { Account } from '../../../domain/accounting/entities/Account';

/**
 * Interface for Chart of Accounts access.
 */
export interface IAccountRepository {
  createAccount(account: Account): Promise<void>;
  updateAccount(id: string, data: Partial<Account>): Promise<void>;
  deactivateAccount(id: string): Promise<void>;
  getAccount(id: string): Promise<Account | null>;
  getAccounts(companyId: string): Promise<Account[]>;
}
