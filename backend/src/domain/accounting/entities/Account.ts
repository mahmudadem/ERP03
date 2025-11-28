
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export class Account {
  constructor(
    public id: string,
    public code: string,
    public name: string,
    public type: AccountType,
    public currency: string,
    public isProtected: boolean, // System accounts that cannot be deleted
    public active: boolean,
    public parentId?: string
  ) {}
}
