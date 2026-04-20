import { PrismaClient } from '@prisma/client';
import { IUserRepository } from '../../../../repository/interfaces/core/IUserRepository';
import { User, UserRole } from '../../../../domain/core/entities/User';

export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): User {
    return new User(
      data.id,
      data.email,
      data.name || '',
      data.globalRole as UserRole,
      data.createdAt,
      data.pictureUrl || undefined,
      data.planId || undefined,
      data.activeCompanyId || undefined
    );
  }

  async getUserById(userId: string): Promise<User | null> {
    const data = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async createUser(user: User): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
        pictureUrl: user.pictureUrl || null,
        planId: user.planId || null,
        activeCompanyId: user.activeCompanyId || null,
      },
    });
  }

  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.pictureUrl !== undefined) updateData.pictureUrl = data.pictureUrl;
    if (data.planId !== undefined) updateData.planId = data.planId;
    if (data.activeCompanyId !== undefined) updateData.activeCompanyId = data.activeCompanyId;
    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async updateGlobalRole(userId: string, newRole: UserRole): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { globalRole: newRole },
    });
  }

  async updateActiveCompany(userId: string, companyId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeCompanyId: companyId },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const data = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async getUserActiveCompany(userId: string): Promise<string | null> {
    const data = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeCompanyId: true },
    });
    return data?.activeCompanyId || null;
  }

  async listAll(): Promise<User[]> {
    const data = await this.prisma.user.findMany();
    return data.map((d) => this.toDomain(d));
  }

  async updatePlan(userId: string, planId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { planId },
    });
  }
}
