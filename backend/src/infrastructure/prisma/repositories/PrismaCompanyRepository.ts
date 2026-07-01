/**
 * PrismaCompanyRepository.ts
 * 
 * SQL implementation of ICompanyRepository using Prisma
 */

/**
 * SQL MIGRATION STATUS: NOT IMPLEMENTED
 * 
 * This repository is part of the SQL/PostgreSQL migration path.
 * Current production uses Firestore via the corresponding Firestore repository.
 * 
 * To activate: Set DB_TYPE=sql in .env and verify all repository methods against domain behavior.
 * See: backend/src/infrastructure/di/bindRepositories.ts for the toggling mechanism.
 */

import { PrismaClient } from '@prisma/client';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { Company } from '../../../domain/core/entities/Company';

export class PrismaCompanyRepository implements ICompanyRepository {
    constructor(private prisma: PrismaClient) { }

    async save(company: Company): Promise<void> {
        const fiscalYearStart = new Date(company.fiscalYearStart);
        const fiscalYearEnd = new Date(company.fiscalYearEnd);
        await this.prisma.company.upsert({
            where: { id: company.id },
            create: {
                id: company.id,
                name: company.name,
                ownerId: company.ownerId,
                // Empty tax IDs must be stored as NULL: taxId is @unique, and Postgres
                // allows multiple NULLs but only one '' — see CompleteCompanyCreationUseCase.
                taxId: company.taxId || null,
                address: company.address || null,
                country: company.country || null,
                logoUrl: company.logoUrl || null,
                subscriptionPlan: company.subscriptionPlan || null,
                contactInfo: company.contactInfo || null,
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
                country: company.country || null,
                logoUrl: company.logoUrl || null,
                subscriptionPlan: company.subscriptionPlan || null,
                contactInfo: company.contactInfo || null,
                baseCurrency: company.baseCurrency,
                fiscalYearStart: fiscalYearStart,
                fiscalYearEnd: fiscalYearEnd,
                modules: company.modules,
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
            data.modules,
            (data).features || [],
            data.taxId,
            (data).subscriptionPlan || undefined,
            data.address || undefined,
            (data).country || undefined,
            (data).logoUrl || undefined,
            (data).contactInfo || undefined
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
            data.modules,
            (data).features || [],
            data.taxId,
            (data).subscriptionPlan || undefined,
            data.address || undefined,
            (data).country || undefined,
            (data).logoUrl || undefined,
            (data).contactInfo || undefined
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
            data.modules,
            (data).features || [],
            data.taxId,
            (data).subscriptionPlan || undefined,
            data.address || undefined,
            (data).country || undefined,
            (data).logoUrl || undefined,
            (data).contactInfo || undefined
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
                    data.modules,
                    (data).features || [],
                    data.taxId,
                    (data).subscriptionPlan || undefined,
                    data.address || undefined,
                    (data).country || undefined,
                    (data).logoUrl || undefined,
                    (data).contactInfo || undefined
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

        const modules = [...((company.modules as unknown as string[]) || [])];
        if (!modules.includes(moduleName)) {
            modules.push(moduleName);
        }

        await this.prisma.company.update({
            where: { id: companyId },
            data: { modules: modules },
        });
    }

    async update(companyId: string, updates: Partial<Company>): Promise<Company> {
        const data: any = { ...updates };
        const updated = await this.prisma.company.update({
            where: { id: companyId },
            data: data,
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
            updated.modules,
            (updated).features || [],
            updated.taxId,
            (updated).subscriptionPlan || undefined,
            updated.address || undefined,
            (updated).country || undefined,
            (updated).logoUrl || undefined,
            (updated).contactInfo || undefined
        );
    }

    async disableModule(companyId: string, moduleName: string): Promise<void> {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company) return;
        const modules = ((company.modules as unknown as string[]) || []).filter((m) => m !== moduleName);
        await this.prisma.company.update({ where: { id: companyId }, data: { modules: modules } });
    }

    async updateBundle(companyId: string, bundleId: string): Promise<Company> {
        const updated = await this.prisma.company.update({
            where: { id: companyId },
            data: { subscriptionPlan: bundleId },
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
            updated.modules,
            (updated).features || [],
            updated.taxId,
            (updated).subscriptionPlan || undefined,
            updated.address || undefined,
            (updated).country || undefined,
            (updated).logoUrl || undefined,
            (updated).contactInfo || undefined
        );
    }

    async updateFeatures(companyId: string, features: string[]): Promise<void> {
        await this.prisma.company.update({
            where: { id: companyId },
            data: { features },
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
                    data.modules,
                    (data).features || [],
                    data.taxId,
                    (data).subscriptionPlan || undefined,
                    data.address || undefined,
                    (data).country || undefined,
                    (data).logoUrl || undefined,
                    (data).contactInfo || undefined
                )
        );
    }

    async delete(companyId: string): Promise<void> {
        await this.prisma.company.delete({
            where: { id: companyId },
        });
    }
}
