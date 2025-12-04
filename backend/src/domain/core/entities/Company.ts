
import { ICompany } from '../../../../../shared/types';

export class Company implements ICompany {
  constructor(
    public id: string,
    public name: string,
    public ownerId: string,
    public createdAt: Date,
    public updatedAt: Date,
    public baseCurrency: string,
    public fiscalYearStart: Date,
    public fiscalYearEnd: Date,
    public modules: string[],
    // Legacy support for MVP
    public taxId: string,
    public subscriptionPlan?: string,
    public address?: string
  ) { }

  public isModuleEnabled(moduleName: string): boolean {
    return this.modules.includes(moduleName);
  }

  public isValid(): boolean {
    return this.name.length > 0 && this.ownerId.length > 0;
  }
}
