/**
 * PrismaRbacCompanyUserRepository
 * Prisma (SQL) implementation of ICompanyUserRepository for RBAC module
 */

import { PrismaClient } from '@prisma/client';
import { ICompanyUserRepository } from '../../../../repository/interfaces/rbac/ICompanyUserRepository';
import { CompanyUser } from '../../../../domain/rbac/CompanyUser';

export class PrismaRbacCompanyUserRepository implements ICompanyUserRepository {
  constructor(private prisma: PrismaClient) {}

  async get(companyId: string, userId: string): Promise<CompanyUser | null> {
    const record = await this.prisma.companyUser.findUnique({
      where: { userId_companyId: { userId, companyId } }
    });

    if (!record) return null;

    return {
      userId: record.userId,
      companyId: record.companyId,
      roleId: record.roleId || '',
      isOwner: record.isOwner,
      createdAt: record.createdAt,
      isDisabled: record.isDisabled || false
    } as CompanyUser;
  }

  async getByUserAndCompany(userId: string, companyId: string): Promise<CompanyUser | null> {
    return this.get(companyId, userId);
  }

  async getByCompany(companyId: string): Promise<CompanyUser[]> {
    const records = await this.prisma.companyUser.findMany({
      where: { companyId }
    });

    return records.map(r => ({
      userId: r.userId,
      companyId: r.companyId,
      roleId: r.roleId || '',
      isOwner: r.isOwner,
      createdAt: r.createdAt,
      isDisabled: r.isDisabled || false
    } as CompanyUser));
  }

  async getByRole(companyId: string, roleId: string): Promise<CompanyUser[]> {
    const records = await this.prisma.companyUser.findMany({
      where: { companyId, roleId }
    });

    return records.map(r => ({
      userId: r.userId,
      companyId: r.companyId,
      roleId: r.roleId || '',
      isOwner: r.isOwner,
      createdAt: r.createdAt,
      isDisabled: r.isDisabled || false
    } as CompanyUser));
  }

  async getMembershipsByUser(userId: string): Promise<Array<CompanyUser & { companyId: string }>> {
    const records = await this.prisma.companyUser.findMany({
      where: { userId }
    });

    return records.map(r => ({
      userId: r.userId,
      companyId: r.companyId,
      roleId: r.roleId || '',
      isOwner: r.isOwner,
      createdAt: r.createdAt,
      isDisabled: r.isDisabled || false
    } as CompanyUser & { companyId: string }));
  }

  async assignRole(companyUser: CompanyUser): Promise<void> {
    await this.prisma.companyUser.upsert({
      where: {
        userId_companyId: {
          userId: companyUser.userId,
          companyId: companyUser.companyId
        }
      },
      create: {
        userId: companyUser.userId,
        companyId: companyUser.companyId,
        roleId: companyUser.roleId,
        isOwner: companyUser.isOwner || false
      },
      update: {
        roleId: companyUser.roleId
      }
    });
  }

  async removeRole(userId: string, companyId: string): Promise<void> {
    await this.prisma.companyUser.delete({
      where: { userId_companyId: { userId, companyId } }
    });
  }

  async create(companyUser: CompanyUser): Promise<void> {
    await this.prisma.companyUser.create({
      data: {
        userId: companyUser.userId,
        companyId: companyUser.companyId,
        roleId: companyUser.roleId,
        isOwner: companyUser.isOwner || false
      }
    });
  }

  async update(userId: string, companyId: string, updates: Partial<CompanyUser>): Promise<void> {
    const data: any = {};
    if (updates.roleId !== undefined) data.roleId = updates.roleId;
    if (updates.isOwner !== undefined) data.isOwner = updates.isOwner;
    if (updates.isDisabled !== undefined) data.isDisabled = updates.isDisabled;

    await this.prisma.companyUser.update({
      where: { userId_companyId: { userId, companyId } },
      data
    });
  }

  async delete(companyId: string, userId: string): Promise<void> {
    await this.prisma.companyUser.delete({
      where: { userId_companyId: { userId, companyId } }
    });
  }
}
