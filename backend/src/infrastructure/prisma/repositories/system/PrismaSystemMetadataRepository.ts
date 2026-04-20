/**
 * PrismaSystemMetadataRepository
 * Prisma (SQL) implementation of ISystemMetadataRepository
 */

import { PrismaClient } from '@prisma/client';
import { ISystemMetadataRepository } from '../../../repositories/FirestoreSystemMetadataRepository';

export class PrismaSystemMetadataRepository implements ISystemMetadataRepository {
  constructor(private prisma: PrismaClient) {}

  async getMetadata(key: string): Promise<any> {
    const record = await this.prisma.systemMetadata.findUnique({
      where: { key }
    });

    if (!record) return null;
    return record.value;
  }

  async setMetadata(key: string, value: any): Promise<void> {
    await this.prisma.systemMetadata.upsert({
      where: { key },
      create: {
        key,
        value
      },
      update: {
        value
      }
    });
  }
}
