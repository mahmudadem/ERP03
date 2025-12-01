"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCompanyDetailsUseCase = exports.EnableModuleForCompanyUseCase = exports.UpdateCompanySettingsUseCase = void 0;
class UpdateCompanySettingsUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute(companyId, data) {
        const company = await this.companyRepository.findById(companyId);
        if (!company)
            throw new Error('Company not found');
        if (data.name)
            company.name = data.name;
        if (data.address)
            company.address = data.address;
        if (data.fiscalYearStart)
            company.fiscalYearStart = data.fiscalYearStart;
        if (data.fiscalYearEnd)
            company.fiscalYearEnd = data.fiscalYearEnd;
        await this.companyRepository.save(company);
    }
}
exports.UpdateCompanySettingsUseCase = UpdateCompanySettingsUseCase;
class EnableModuleForCompanyUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute(companyId, moduleName) {
        const company = await this.companyRepository.findById(companyId);
        if (!company)
            throw new Error('Company not found');
        if (company.isModuleEnabled(moduleName))
            return;
        await this.companyRepository.enableModule(companyId, moduleName);
    }
}
exports.EnableModuleForCompanyUseCase = EnableModuleForCompanyUseCase;
class GetCompanyDetailsUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute(companyId) {
        const company = await this.companyRepository.findById(companyId);
        if (!company)
            throw new Error('Company not found');
        return company;
    }
}
exports.GetCompanyDetailsUseCase = GetCompanyDetailsUseCase;
//# sourceMappingURL=CompanyUseCases.js.map