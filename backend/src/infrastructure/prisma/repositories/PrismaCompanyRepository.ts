/**
 * PrismaCompanyRepository.ts
 * 
 * SQL implementation of ICompanyRepository using Prisma
 */

import { PrismaClient } from '@prisma/client';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { Company } from '../../../domain/core/entities/Company';

export class PrismaCompanyRepository implements ICompanyRepository {
    constructor(private prisma: PrismaClient) { }

    async save(company: Company): Promise<void> {
        const fiscalYearStart = new Date(company.fiscalYearStart as any);
        const fiscalYearEnd = new Date(company.fiscalYearEnd as any);
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
                modules: company.modules as any,
                createdAt: company.createdAt,
                updatedAt: company.updatedAt,
            },
            update: {
                name: company.name,
                address: company.address || null,
                baseCurrency: company.baseCurrency,
                fiscalYearStart: fiscalYearStart,
                fiscalYearEnd: fiscalYearEnd,
                modules: company.modules as any,
                updatedAt: company.updatedAt,
            },
        });
    }

    async findById(id: string): Promise<Company | null> {
        const data = await this.prisma.company.findUnique({
            where: { id },
        });

        if (!data) return null;

        return new Company(
            data.id,
            data.name,
            data.ownerId,
            data.createdAt,
            data.updatedAt,
            data.baseCurrency,
            data.fiscalYearStart,
            data.fiscalYearEnd,
            data.modules as any,
            (data as any).features || [],
            data.taxId,
            (data as any).subscriptionPlan || undefined,
            data.address || undefined
        );
    }

    async findByTaxId(taxId: string): Promise<Company | null> {
        const data = await this.prisma.company.findUnique({
            where: { taxId },
        });

        if (!data) return null;

        return new Company(
            data.id,
            data.name,
            data.ownerId,
            data.createdAt,
            data.updatedAt,
            data.baseCurrency,
            data.fiscalYearStart,
            data.fiscalYearEnd,
            data.modules as any,
            (data as any).features || [],
            data.taxId,
            (data as any).subscriptionPlan || undefined,
            data.address || undefined
        );
    }

    async findByNameAndOwner(name: string, ownerId: string): Promise<Company | null> {
        const data = await this.prisma.company.findFirst({
            where: {
                name,
                ownerId,
            },
        });

        if (!data) return null;

        return new Company(
            data.id,
            data.name,
            data.ownerId,
            data.createdAt,
            data.updatedAt,
            data.baseCurrency,
            data.fiscalYearStart,
            data.fiscalYearEnd,
            data.modules as any,
            (data as any).features || [],
            data.taxId,
            (data as any).subscriptionPlan || undefined,
            data.address || undefined
        );
    }

    async getUserCompanies(userId: string): Promise<Company[]> {
        const companies = await this.prisma.company.findMany({
            where: {
                users: {
                    some: {
                        userId: userId,
                    },
                },
            },
        });

        return companies.map(
            (data) =>
                new Company(
                    data.id,
                    data.name,
                    data.ownerId,
                    data.createdAt,
                    data.updatedAt,
                    data.baseCurrency,
                    data.fiscalYearStart,
                    data.fiscalYearEnd,
                    data.modules as any,
                    (data as any).features || [],
                    data.taxId,
                    (data as any).subscriptionPlan || undefined,
                    data.address || undefined
                )
        );
    }

    async enableModule(companyId: string, moduleName: string): Promise<void> {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
        });

        if (!company) {
            throw new Error('Company not found');
        }

        const modules = [...((company.modules as any[]) || [])];
        if (!modules.includes(moduleName)) {
            modules.push(moduleName);
        }

        await this.prisma.company.update({
            where: { id: companyId },
            data: { modules: modules as any },
        });
    }

    async update(companyId: string, updates: Partial<Company>): Promise<Company> {
        const data: any = { ...updates };
        const updated = await this.prisma.company.update({
            where: { id: companyId },
            data: data as any,
        });
        return new Company(
            updated.id,
            updated.name,
            updated.ownerId,
            updated.createdAt,
            updated.updatedAt,
            updated.baseCurrency,
            updated.fiscalYearStart,
            updated.fiscalYearEnd,
            updated.modules as any,
            (updated as any).features || [],
            updated.taxId,
            (updated as any).subscriptionPlan || undefined,
            updated.address || undefined
        );
    }

    async disableModule(companyId: string, moduleName: string): Promise<void> {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company) return;
        const modules = ((company.modules as any[]) || []).filter((m) => m !== moduleName);
        await this.prisma.company.update({ where: { id: companyId }, data: { modules: modules as any } });
    }

    async updateBundle(companyId: string, bundleId: string): Promise<Company> {
        const updated = await this.prisma.company.update({
            where: { id: companyId },
            data: { subscriptionPlan: bundleId } as any,
        });
        return new Company(
            updated.id,
            updated.name,
            updated.ownerId,
            updated.createdAt,
            updated.updatedAt,
            updated.baseCurrency,
            updated.fiscalYearStart,
            updated.fiscalYearEnd,
            updated.modules as any,
            (updated as any).features || [],
            updated.taxId,
            (updated as any).subscriptionPlan || undefined,
            updated.address || undefined
        );
    }

    async updateFeatures(companyId: string, features: string[]): Promise<void> {
        await this.prisma.company.update({
            where: { id: companyId },
            data: { features } as any,
        });
    }

    async listAll(): Promise<Company[]> {
        const companies = await this.prisma.company.findMany();
        return companies.map(
            (data) =>
                new Company(
                    data.id,
                    data.name,
                    data.ownerId,
                    data.createdAt,
                    data.updatedAt,
                    data.baseCurrency,
                    data.fiscalYearStart,
                    data.fiscalYearEnd,
                    data.modules as any,
                    (data as any).features || [],
                    data.taxId,
                    (data as any).subscriptionPlan || undefined,
                    data.address || undefined
                )
        );
    }

    async delete(companyId: string): Promise<void> {
        await this.prisma.company.delete({
            where: { id: companyId },
        });
    }
}
