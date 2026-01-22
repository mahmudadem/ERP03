"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyPgMapper = void 0;
/**
 * CorePgMapper.ts
 *
 * Purpose:
 * Skeleton for mapping SQL ResultSets to Domain Entities.
 *
 * Future Implementation:
 * Will convert snake_case SQL columns to camelCase Domain properties.
 */
const Company_1 = require("../../../domain/core/entities/Company");
class CompanyPgMapper {
    static toDomain(row) {
        // TODO: Implement actual mapping logic
        // const modules = row.modules ? JSON.parse(row.modules) : [];
        return new Company_1.Company(row.id, row.name, row.owner_id, new Date(row.created_at), new Date(row.updated_at), row.base_currency, new Date(row.fiscal_year_start), new Date(row.fiscal_year_end), [], // row.modules
        [], // row.features
        row.tax_id, row.subscriptionPlan, row.address, row.country, row.logoUrl, row.contactInfo);
    }
    static toPersistence(company) {
        // TODO: Return array of values for parameterized query
        return [
            company.id,
            company.name,
            company.taxId
        ];
    }
}
exports.CompanyPgMapper = CompanyPgMapper;
//# sourceMappingURL=CorePgMapper.js.map