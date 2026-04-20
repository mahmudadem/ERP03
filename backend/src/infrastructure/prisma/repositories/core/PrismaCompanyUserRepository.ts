import { PrismaClient } from '@prisma/client';
import { ICompanyUserRepository } from '../../../../repository/interfaces/core/ICompanyUserRepository';
import { CompanyUser } from '../../../../domain/core/entities/CompanyUser';

export class PrismaCompanyUserRepository implements ICompanyUserRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): CompanyUser {
    return new CompanyUser(
      `${data.userId}_${data.companyId}`,
      data.userId,
      data.companyId,
      data.role || '',
      (data.permissions as string[]) || [],
      data.isDisabled || false
    );
  }

  async assignUserToCompany(userId: string, companyId: string, role: string): Promise<void> {
    await this.prisma.companyUser.upsert({
      where: {
        userId_companyId: { userId, companyId },
      },
      create: {
        userId,
        companyId,
        role,
        permissions: [],
        isDisabled: false,
      },
      update: {
        role,
      },
    });
  }

  async getCompanyUsers(companyId: string): Promise<CompanyUser[]> {
    const data = await this.prisma.companyUser.findMany({
      where: { companyId },
    });
    return data.map((d) => this.toDomain(d));
  }

  async getUserMembership(userId: string, companyId: string): Promise<CompanyUser | null> {
    const data = await this.prisma.companyUser.findUnique({
      where: {
        userId_companyId: { userId, companyId },
      },
    });
    if (!data) return null;
    return this.toDomain(data);
  }
}
