import { PrismaClient } from '@prisma/client';
import { IPartyRepository, PartyListOptions } from '../../../../repository/interfaces/shared/IPartyRepository';
import { Party, PartyRole } from '../../../../domain/shared/entities/Party';

export class PrismaPartyRepository implements IPartyRepository {
  constructor(private prisma: PrismaClient) {}

  async create(party: Party): Promise<void> {
    await this.prisma.party.create({
      data: {
        id: party.id,
        companyId: party.companyId,
        code: party.code,
        legalName: party.legalName,
        displayName: party.displayName,
        roles: party.roles,
        contactPerson: party.contactPerson,
        phone: party.phone,
        email: party.email,
        address: party.address,
        taxId: party.taxId,
        paymentTermsDays: party.paymentTermsDays,
        defaultCurrency: party.defaultCurrency,
        defaultAPAccountId: party.defaultAPAccountId,
        defaultARAccountId: party.defaultARAccountId,
        active: party.active,
        createdBy: party.createdBy,
        createdAt: party.createdAt,
        updatedAt: party.updatedAt,
      },
    });
  }

  async update(party: Party): Promise<void> {
    await this.prisma.party.update({
      where: { id: party.id },
      data: {
        code: party.code,
        legalName: party.legalName,
        displayName: party.displayName,
        roles: party.roles,
        contactPerson: party.contactPerson,
        phone: party.phone,
        email: party.email,
        address: party.address,
        taxId: party.taxId,
        paymentTermsDays: party.paymentTermsDays,
        defaultCurrency: party.defaultCurrency,
        defaultAPAccountId: party.defaultAPAccountId,
        defaultARAccountId: party.defaultARAccountId,
        active: party.active,
        updatedAt: party.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<Party | null> {
    const record = await this.prisma.party.findFirst({
      where: { id, companyId },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getByCode(companyId: string, code: string): Promise<Party | null> {
    const record = await this.prisma.party.findFirst({
      where: { companyId, code },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, opts?: PartyListOptions): Promise<Party[]> {
    const where: any = { companyId };
    if (opts?.role) {
      where.roles = { has: opts.role };
    }
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }

    const records = await this.prisma.party.findMany({
      where,
      orderBy: { displayName: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });

    return records.map((r) => this.toDomain(r));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.prisma.party.delete({
      where: { id, companyId },
    });
  }

  private toDomain(record: any): Party {
    return new Party({
      id: record.id,
      companyId: record.companyId,
      code: record.code,
      legalName: record.legalName,
      displayName: record.displayName,
      roles: record.roles as PartyRole[],
      contactPerson: record.contactPerson ?? undefined,
      phone: record.phone ?? undefined,
      email: record.email ?? undefined,
      address: record.address ?? undefined,
      taxId: record.taxId ?? undefined,
      paymentTermsDays: record.paymentTermsDays ?? undefined,
      defaultCurrency: record.defaultCurrency ?? undefined,
      defaultAPAccountId: record.defaultAPAccountId ?? undefined,
      defaultARAccountId: record.defaultARAccountId ?? undefined,
      active: record.active,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
