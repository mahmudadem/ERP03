
export enum CostCenterStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

export class CostCenter {
  constructor(
    public id: string,
    public companyId: string,
    public name: string,
    public code: string,
    public description: string | null = null,
    public parentId: string | null = null,
    public status: CostCenterStatus = CostCenterStatus.ACTIVE,
    public createdAt: Date = new Date(),
    public createdBy: string = '',
    public updatedAt: Date = new Date(),
    public updatedBy: string = ''
  ) {}

  validate(): string[] {
    const errors: string[] = [];
    if (!this.code || this.code.trim().length === 0) errors.push('Code is required');
    if (!this.name || this.name.trim().length === 0) errors.push('Name is required');
    if (this.code && this.code.length > 20) errors.push('Code must be 20 characters or less');
    return errors;
  }

  isActive(): boolean {
    return this.status === CostCenterStatus.ACTIVE;
  }

  deactivate(updatedBy: string): void {
    this.status = CostCenterStatus.INACTIVE;
    this.updatedBy = updatedBy;
    this.updatedAt = new Date();
  }

  activate(updatedBy: string): void {
    this.status = CostCenterStatus.ACTIVE;
    this.updatedBy = updatedBy;
    this.updatedAt = new Date();
  }
}
