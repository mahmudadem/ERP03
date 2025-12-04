"use strict";
/**
 * PrismaCompanyRepository.ts
 *
 * SQL implementation of ICompanyRepository using Prisma
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyRepository = void 0;
const Company_1 = require("../../../domain/core/entities/Company");
class PrismaCompanyRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(company) {
        await this.prisma.company.upsert({
            where: { id: company.id },
            create: {
                id: company.id,
                name: company.name,
                ownerId: company.ownerId,
                taxId: company.taxId,
                address: company.address || null,
                baseCurrency: company.baseCurrency,
                fiscalYearStart: company.fiscalYearStart,
                fiscalYearEnd: company.fiscalYearEnd,
                modules: company.modules,
                createdAt: company.createdAt,
                updatedAt: company.updatedAt,
            },
            update: {
                name: company.name,
                address: company.address || null,
                baseCurrency: company.baseCurrency,
                fiscalYearStart: company.fiscalYearStart,
                fiscalYearEnd: company.fiscalYearEnd,
                modules: company.modules,
                updatedAt: company.updatedAt,
            },
        });
    }
    async findById(id) {
        const data = await this.prisma.company.findUnique({
            where: { id },
        });
        if (!data)
            return null;
        return new Company_1.Company(data.id, data.name, data.ownerId, data.createdAt, data.updatedAt, data.baseCurrency, data.fiscalYearStart, data.fiscalYearEnd, data.modules, data.taxId, data.address || undefined);
    }
    async findByTaxId(taxId) {
        const data = await this.prisma.company.findUnique({
            where: { taxId },
        });
        if (!data)
            return null;
        return new Company_1.Company(data.id, data.name, data.ownerId, data.createdAt, data.updatedAt, data.baseCurrency, data.fiscalYearStart, data.fiscalYearEnd, data.modules, data.taxId, data.address || undefined);
    }
    async getUserCompanies(userId) {
        const companies = await this.prisma.company.findMany({
            where: {
                users: {
                    some: {
                        userId: userId,
                    },
                },
            },
        });
        return companies.map((data) => new Company_1.Company(data.id, data.name, data.ownerId, data.createdAt, data.updatedAt, data.baseCurrency, data.fiscalYearStart, data.fiscalYearEnd, data.modules, data.taxId, data.address || undefined));
    }
    async enableModule(companyId, moduleName) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
        });
        if (!company) {
            throw new Error('Company not found');
        }
        const modules = [...company.modules];
        if (!modules.includes(moduleName)) {
            modules.push(moduleName);
        }
        await this.prisma.company.update({
            where: { id: companyId },
            data: { modules },
        });
    }
}
exports.PrismaCompanyRepository = PrismaCompanyRepository;
//# sourceMappingURL=PrismaCompanyRepository.js.map