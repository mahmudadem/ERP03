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
        const fiscalYearStart = new Date(company.fiscalYearStart);
        const fiscalYearEnd = new Date(company.fiscalYearEnd);
        await this.prisma.company.upsert({
            where: { id: company.id },
            create: {
                id: company.id,
                name: company.name,
                ownerId: company.ownerId,
                taxId: company.taxId,
                address: company.address || null,
                baseCurrency: company.baseCurrency,
                fiscalYearStart: fiscalYearStart,
                fiscalYearEnd: fiscalYearEnd,
                modules: company.modules,
                createdAt: company.createdAt,
                updatedAt: company.updatedAt,
            },
            update: {
                name: company.name,
                address: company.address || null,
                baseCurrency: company.baseCurrency,
                fiscalYearStart: fiscalYearStart,
                fiscalYearEnd: fiscalYearEnd,
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
        return new Company_1.Company(data.id, data.name, data.ownerId, data.createdAt, data.updatedAt, data.baseCurrency, data.fiscalYearStart, data.fiscalYearEnd, data.modules, data.features || [], data.taxId, data.subscriptionPlan || undefined, data.address || undefined);
    }
    async findByTaxId(taxId) {
        const data = await this.prisma.company.findUnique({
            where: { taxId },
        });
        if (!data)
            return null;
        return new Company_1.Company(data.id, data.name, data.ownerId, data.createdAt, data.updatedAt, data.baseCurrency, data.fiscalYearStart, data.fiscalYearEnd, data.modules, data.features || [], data.taxId, data.subscriptionPlan || undefined, data.address || undefined);
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
        return companies.map((data) => new Company_1.Company(data.id, data.name, data.ownerId, data.createdAt, data.updatedAt, data.baseCurrency, data.fiscalYearStart, data.fiscalYearEnd, data.modules, data.features || [], data.taxId, data.subscriptionPlan || undefined, data.address || undefined));
    }
    async enableModule(companyId, moduleName) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
        });
        if (!company) {
            throw new Error('Company not found');
        }
        const modules = [...(company.modules || [])];
        if (!modules.includes(moduleName)) {
            modules.push(moduleName);
        }
        await this.prisma.company.update({
            where: { id: companyId },
            data: { modules: modules },
        });
    }
    async update(companyId, updates) {
        const data = Object.assign({}, updates);
        const updated = await this.prisma.company.update({
            where: { id: companyId },
            data: data,
        });
        return new Company_1.Company(updated.id, updated.name, updated.ownerId, updated.createdAt, updated.updatedAt, updated.baseCurrency, updated.fiscalYearStart, updated.fiscalYearEnd, updated.modules, updated.features || [], updated.taxId, updated.subscriptionPlan || undefined, updated.address || undefined);
    }
    async disableModule(companyId, moduleName) {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company)
            return;
        const modules = (company.modules || []).filter((m) => m !== moduleName);
        await this.prisma.company.update({ where: { id: companyId }, data: { modules: modules } });
    }
    async updateBundle(companyId, bundleId) {
        const updated = await this.prisma.company.update({
            where: { id: companyId },
            data: { subscriptionPlan: bundleId },
        });
        return new Company_1.Company(updated.id, updated.name, updated.ownerId, updated.createdAt, updated.updatedAt, updated.baseCurrency, updated.fiscalYearStart, updated.fiscalYearEnd, updated.modules, updated.features || [], updated.taxId, updated.subscriptionPlan || undefined, updated.address || undefined);
    }
    async updateFeatures(companyId, features) {
        await this.prisma.company.update({
            where: { id: companyId },
            data: { features },
        });
    }
    async listAll() {
        const companies = await this.prisma.company.findMany();
        return companies.map((data) => new Company_1.Company(data.id, data.name, data.ownerId, data.createdAt, data.updatedAt, data.baseCurrency, data.fiscalYearStart, data.fiscalYearEnd, data.modules, data.features || [], data.taxId, data.subscriptionPlan || undefined, data.address || undefined));
    }
}
exports.PrismaCompanyRepository = PrismaCompanyRepository;
//# sourceMappingURL=PrismaCompanyRepository.js.map