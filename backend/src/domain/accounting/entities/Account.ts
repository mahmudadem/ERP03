
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export class Account {
  constructor(
    public companyId: string,
    public id: string,
    public code: string,
    public name: string,
    public type: AccountType,
    public currency: string,
    public isProtected: boolean, // System accounts that cannot be deleted
    public active: boolean,
    public parentId?: string,
    public createdAt?: Date,
    public updatedAt?: Date
  ) {
    this.isActive = active;
  }

  public isActive: boolean;
}
