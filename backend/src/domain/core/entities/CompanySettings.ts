
export class CompanySettings {
  constructor(
    public companyId: string,
    public strictApprovalMode: boolean,
    public uiMode?: 'classic' | 'windows',
    public timezone?: string,
    public dateFormat?: string
  ) {}

  // Factory method for default settings
  static default(companyId: string): CompanySettings {
    return new CompanySettings(companyId, true);
  }
}
