
export class CompanySettings {
  constructor(
    public companyId: string,
    public strictApprovalMode: boolean,
    public uiMode?: 'classic' | 'windows',
    public timezone?: string,
    public dateFormat?: string,
    public language: string = 'en'
  ) {}

  // Factory method for default settings
  static default(companyId: string): CompanySettings {
    return new CompanySettings(companyId, true, 'windows', 'UTC', 'YYYY-MM-DD', 'en');
  }
}
