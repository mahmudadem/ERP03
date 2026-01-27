
export class CompanySettings {
  constructor(
    public companyId: string,
    public strictApprovalMode: boolean,
    public uiMode?: 'classic' | 'windows',
    public timezone?: string,
    public dateFormat?: string,
    public language: string = 'en',
    public baseCurrency?: string,
    public fiscalYearStart?: string, // Month-Day string (e.g. "01-01")
    public fiscalYearEnd?: string    // Month-Day string (e.g. "12-31")
  ) {}

  // Factory method for default settings
  static default(companyId: string): CompanySettings {
    return new CompanySettings(companyId, false, 'windows', 'UTC', 'YYYY-MM-DD', 'en', undefined, '01-01', '12-31');
  }
}
