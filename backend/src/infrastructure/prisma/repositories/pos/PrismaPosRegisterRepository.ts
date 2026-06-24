import { PrismaClient, Prisma } from '@prisma/client';
import { PosRegister } from '../../../../domain/pos/entities/PosRegister';
import { IPosRegisterRepository } from '../../../../repository/interfaces/pos/IPosRegisterRepository';

export class PrismaPosRegisterRepository implements IPosRegisterRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(register: PosRegister, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posRegister.create({
      data: {
        id: register.id,
        companyId: register.companyId,
        code: register.code,
        name: register.name,
        branchId: register.branchId || null,
        warehouseId: register.warehouseId,
        cashDrawerAccountId: register.cashDrawerAccountId,
        settlementAccountIds: register.settlementAccountIds as any,
        keyboardShortcuts: register.keyboardShortcuts as any,
        status: register.status,
        createdAt: register.createdAt,
        updatedAt: register.updatedAt,
      },
    });
  }

  async update(register: PosRegister, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posRegister.update({
      where: { id: register.id },
      data: {
        code: register.code,
        name: register.name,
        branchId: register.branchId || null,
        warehouseId: register.warehouseId,
        cashDrawerAccountId: register.cashDrawerAccountId,
        settlementAccountIds: register.settlementAccountIds as any,
        keyboardShortcuts: register.keyboardShortcuts as any,
        status: register.status,
        updatedAt: new Date(),
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PosRegister | null> {
    const record = await this.prisma.posRegister.findFirst({ where: { id, companyId } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string): Promise<PosRegister[]> {
    const records = await this.prisma.posRegister.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): PosRegister {
    return PosRegister.fromJSON({
      id: record.id,
      companyId: record.companyId,
      code: record.code,
      name: record.name,
      branchId: record.branchId || undefined,
      warehouseId: record.warehouseId,
      cashDrawerAccountId: record.cashDrawerAccountId,
      settlementAccountIds: record.settlementAccountIds || undefined,
      keyboardShortcuts: record.keyboardShortcuts || undefined,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
