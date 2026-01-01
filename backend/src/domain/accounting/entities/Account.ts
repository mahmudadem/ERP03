
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export class Account {
  public isActive: boolean;
  public isParent: boolean = false;  // Set by repository when account has children
  public hasChildren: boolean = false;  // Same as isParent, for compatibility

  constructor(
    public companyId: string,
    public id: string,          // id = code (for business operations)
    public code: string,        // Account code (same as id)
    public name: string,
    public type: AccountType,
    public currency: string,
    public isProtected: boolean, // System accounts that cannot be deleted
    public active: boolean,
    public uuid?: string,        // System UUID for error tracing/logs
    public parentId?: string | null,
    public createdAt?: Date,
    public updatedAt?: Date,
    // Approval Policy V1 fields
    public requiresApproval: boolean = false,           // Triggers FA gate when voucher touches this account
    public requiresCustodyConfirmation: boolean = false, // Triggers CC gate when voucher touches this account
    public custodianUserId?: string | null              // User who must confirm custody (when CC is required)
  ) {
    this.isActive = active;
  }

  /** Mark this account as a parent account (has children) */
  setAsParent(hasChildren: boolean): void {
    this.isParent = hasChildren;
    this.hasChildren = hasChildren;
  }
}
