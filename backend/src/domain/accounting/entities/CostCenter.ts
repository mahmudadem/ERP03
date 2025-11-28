
export class CostCenter {
  constructor(
    public id: string,
    public companyId: string,
    public name: string,
    public code: string,
    public parentId?: string
  ) {}
}
