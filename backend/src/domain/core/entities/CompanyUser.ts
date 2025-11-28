
export class CompanyUser {
  constructor(
    public id: string,
    public userId: string,
    public companyId: string,
    public role: string, // e.g., 'MANAGER', 'ACCOUNTANT'
    public permissions: string[]
  ) {}

  public hasPermission(permissionCode: string): boolean {
    return this.permissions.includes(permissionCode);
  }
}
