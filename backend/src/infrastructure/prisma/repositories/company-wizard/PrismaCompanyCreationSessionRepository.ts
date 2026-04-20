import { PrismaClient } from '@prisma/client';
import { ICompanyCreationSessionRepository } from '../../../../repository/interfaces/company-wizard/ICompanyCreationSessionRepository';
import { CompanyCreationSession } from '../../../../domain/company-wizard';

export class PrismaCompanyCreationSessionRepository implements ICompanyCreationSessionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(session: CompanyCreationSession): Promise<void> {
    await this.prisma.companyCreationSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        status: 'IN_PROGRESS',
        data: session.data as any,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  }

  async update(session: CompanyCreationSession): Promise<void> {
    await this.prisma.companyCreationSession.update({
      where: { id: session.id },
      data: {
        status: 'IN_PROGRESS',
        data: session.data as any,
        updatedAt: session.updatedAt,
      },
    });
  }

  async getById(id: string): Promise<CompanyCreationSession | null> {
    const record = await this.prisma.companyCreationSession.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyCreationSession.delete({
      where: { id },
    });
  }

  private toDomain(record: any): CompanyCreationSession {
    const data = record.data as Record<string, any>;
    return {
      id: record.id,
      userId: record.userId,
      model: data.model ?? '',
      templateId: data.templateId ?? '',
      currentStepId: data.currentStepId ?? '',
      data,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
