export interface CompanyGroupMember {
  companyId: string;
  weight?: number; // future use
}

export class CompanyGroup {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly reportingCurrency: string,
    public readonly members: CompanyGroupMember[],
    public readonly createdAt: Date,
    public readonly createdBy: string
  ) {
    if (!members || members.length < 2) {
      throw new Error('Company group must have at least two companies');
    }
  }
}
