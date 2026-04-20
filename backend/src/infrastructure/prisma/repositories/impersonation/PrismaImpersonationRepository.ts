import { PrismaClient } from '@prisma/client';
import { IImpersonationRepository } from '../../../../repository/interfaces/impersonation/IImpersonationRepository';
import { ImpersonationSession } from '../../../../domain/impersonation/ImpersonationSession';

export class PrismaImpersonationRepository implements IImpersonationRepository {
  constructor(private prisma: PrismaClient) {}

  async startSession(superAdminId: string, companyId: string): Promise<ImpersonationSession> {
    const record = await this.prisma.impersonationSession.create({
      data: {
        id: crypto.randomUUID(),
        superAdminId,
        companyId,
        active: true,
        createdAt: new Date(),
      },
    });
    return this.toDomain(record);
  }

  async getSession(sessionId: string): Promise<ImpersonationSession | null> {
    const record = await this.prisma.impersonationSession.findUnique({
      where: { id: sessionId },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async endSession(sessionId: string): Promise<void> {
    await this.prisma.impersonationSession.update({
      where: { id: sessionId },
      data: {
        active: false,
        endedAt: new Date(),
      },
    });
  }

  async getActiveSessionBySuperAdmin(superAdminId: string): Promise<ImpersonationSession | null> {
    const record = await this.prisma.impersonationSession.findFirst({
      where: {
        superAdminId,
        active: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  private toDomain(record: any): ImpersonationSession {
    return new ImpersonationSession(
      record.id,
      record.superAdminId,
      record.companyId,
      record.active,
      record.createdAt,
      record.endedAt ?? undefined
    );
  }
}
