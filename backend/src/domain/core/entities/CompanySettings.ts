
export class CompanySettings {
  constructor(
    public companyId: string,
    public strictApprovalMode: boolean
  ) {}

  // Factory method for default settings
  static default(companyId: string): CompanySettings {
    return new CompanySettings(companyId, true);
  }
}
