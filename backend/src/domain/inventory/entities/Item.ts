
export class Item {
  constructor(
    public id: string,
    public companyId: string,
    public name: string,
    public code: string,
    public unit: string,
    public categoryId: string,
    public active: boolean,
    public price?: number,
    public cost?: number
  ) {}
}
