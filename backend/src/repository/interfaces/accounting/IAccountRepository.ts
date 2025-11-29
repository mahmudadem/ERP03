
import { Account } from '../../../domain/accounting/entities/Account';

export interface IAccountRepository {
  createAccount(account: Account, companyId?: string): Promise<void>;
  updateAccount(id: string, data: Partial<Account>, companyId?: string): Promise<void>;
  deactivateAccount(id: string, companyId?: string): Promise<void>;
  getAccount(id: string, companyId?: string): Promise<Account | null>;
  getAccounts(companyId: string): Promise<Account[]>;
  getByCode?(companyId: string, code: string): Promise<Account | null>;
  list?(companyId: string): Promise<Account[]>;
}
