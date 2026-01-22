"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreDTOMapper = void 0;
class CoreDTOMapper {
    static toCompanyDTO(company) {
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
    static toUserDTO(user) {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.globalRole || user.role || 'USER',
        };
    }
}
exports.CoreDTOMapper = CoreDTOMapper;
//# sourceMappingURL=CoreDTOs.js.map