/**
 * CorePgMapper.ts
 * 
 * Purpose:
 * Skeleton for mapping SQL ResultSets to Domain Entities.
 * 
 * Future Implementation:
 * Will convert snake_case SQL columns to camelCase Domain properties.
 */
import { Company } from '../../../domain/core/entities/Company';

export class CompanyPgMapper {
  static toDomain(row: any): Company {
    // TODO: Implement actual mapping logic
    // const modules = row.modules ? JSON.parse(row.modules) : [];
    return new Company(
      row.id,
      row.name,
      row.owner_id,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.base_currency,
      new Date(row.fiscal_year_start),
      new Date(row.fiscal_year_end),
      [], // row.modules
      [], // row.features
      row.tax_id,
      row.subscriptionPlan,
      row.address,
      row.country,
      row.logoUrl,
      row.contactInfo
    );
  }

  static toPersistence(company: Company): any {
    // TODO: Return array of values for parameterized query
    return [
      company.id,
      company.name,
      company.taxId
    ];
  }
}