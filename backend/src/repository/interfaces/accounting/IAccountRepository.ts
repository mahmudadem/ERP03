import { Account } from '../../../domain/accounting/models/Account';

export interface NewAccountInput {
  code: string;
  name: string;
  type: string;
  parentId?: string | null;
  currency?: string | null;
}

export interface UpdateAccountInput {
  code?: string;
  name?: string;
  type?: string;
  parentId?: string | null;
  isActive?: boolean;
  currency?: string | null;
}

export interface IAccountRepository {
  list(companyId: string): Promise<Account[]>;
  getById(companyId: string, accountId: string): Promise<Account | null>;
  getByCode(companyId: string, code: string): Promise<Account | null>;
  create(companyId: string, data: NewAccountInput): Promise<Account>;
  update(companyId: string, accountId: string, data: UpdateAccountInput): Promise<Account>;
  deactivate(companyId: string, accountId: string): Promise<void>;
  hasChildren(companyId: string, accountId: string): Promise<boolean>;
}
