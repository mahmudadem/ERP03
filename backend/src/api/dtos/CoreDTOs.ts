
/**
 * CoreDTOs.ts
 * Purpose: Defines the shape of data sent to/from the API for Core entities.
 */
import { Company } from '../../domain/core/entities/Company';
import { User } from '../../domain/core/entities/User';

export interface CompanyDTO {
  id: string;
  name: string;
  taxId: string;
  address?: string;
  baseCurrency: string;
  fiscalYearStart: number;
  fiscalYearEnd: number;
  subscriptionPlan?: string;
  logoUrl?: string;
  modules: string[];
  features: string[];
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: string;
}

export class CoreDTOMapper {
  static toCompanyDTO(company: Company): CompanyDTO {
    return {
      id: company.id,
      name: company.name,
      taxId: company.taxId,
      address: company.address,
      baseCurrency: company.baseCurrency,
      fiscalYearStart: typeof company.fiscalYearStart === 'number' ? company.fiscalYearStart : 1,
      fiscalYearEnd: typeof company.fiscalYearEnd === 'number' ? company.fiscalYearEnd : 12,
      subscriptionPlan: company.subscriptionPlan,
      logoUrl: company.logoUrl,
      modules: company.modules,
      features: company.features,
    };
  }

  static toUserDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: (user as any).globalRole || (user as any).role || 'USER',
    };
  }
}
