"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCompanyUseCase = void 0;
const Company_1 = require("../../../domain/core/entities/Company");
class CreateCompanyUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute(dto) {
        const existing = await this.companyRepository.findByTaxId(dto.taxId);
        if (existing) {
            throw new Error('Company with this Tax ID already exists.');
        }
        const id = `cmp_${Date.now()}`; // Simplified ID generation for MVP
        const now = new Date();
        const currentYear = now.getFullYear();
        const newCompany = new Company_1.Company(id, dto.name, 'temp_owner_id', // Placeholder for MVP as ownerId is not yet in DTO
        now, now, '', // No Default Base Currency
        new Date(currentYear, 0, 1), // Default Fiscal Year Start (Jan 1)
        new Date(currentYear, 11, 31), // Default Fiscal Year End (Dec 31)
        ['CORE'], // Default Modules
        [], // features
        dto.taxId, undefined, dto.address, undefined, // country
        undefined, // logoUrl
        undefined // contactInfo
        );
        if (!newCompany.isValid()) {
            throw new Error('Invalid company data.');
        }
        await this.companyRepository.save(newCompany);
        return newCompany;
    }
}
exports.CreateCompanyUseCase = CreateCompanyUseCase;
//# sourceMappingURL=CreateCompany.js.map