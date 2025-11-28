
export class Employee {
  constructor(
    public id: string,
    public companyId: string,
    public name: string,
    public phone: string,
    public departmentId: string,
    public active: boolean,
    public position?: string,
    public email?: string
  ) {}
}
