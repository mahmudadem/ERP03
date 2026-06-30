/**
 * PrismaSystemMetadataRepository
 * Prisma (SQL) implementation of ISystemMetadataRepository
 */

import { PrismaClient } from '@prisma/client';
import { ISystemMetadataRepository } from '../../../repositories/FirestoreSystemMetadataRepository';
import { normalizeClassification } from '../../../../domain/accounting/models/Account';

export class PrismaSystemMetadataRepository implements ISystemMetadataRepository {
  constructor(private prisma: PrismaClient) {}

  async getMetadata(key: string): Promise<any> {
    if (key === 'coa_templates') {
      return this.getCoaTemplates();
    }

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

  private async getCoaTemplates(): Promise<any[]> {
    const [metadataRecord, templates] = await Promise.all([
      this.prisma.systemMetadata.findUnique({
        where: { key: 'coa_templates' },
      }),
      this.prisma.chartOfAccountsTemplate.findMany({
        select: {
          code: true,
          name: true,
          industry: true,
          accounts: true,
          isDefault: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const manifests = Array.isArray(metadataRecord?.value) ? (metadataRecord.value as unknown as Array<Record<string, unknown>>) : [];
    const manifestById = new Map(
      manifests
        .filter((manifest) => manifest && typeof manifest.id === 'string')
        .map((manifest) => [manifest.id, manifest])
    );

    return templates
      .filter((template) => !!template.code)
      .map((template) => {
        const id = template.code as string;
        const manifest: Record<string, unknown> = manifestById.get(id) ?? {};
        const rawAccounts = Array.isArray(template.accounts) ? template.accounts : [];
        const accounts = rawAccounts.map((account: any) => {
          const normalizedClassification = normalizeClassification(account.classification || account.type || 'ASSET');
          return {
            ...account,
            type: normalizedClassification,
            classification: normalizedClassification,
          };
        });

        return {
          ...manifest,
          id,
          code: id,
          name: template.name,
          industry: template.industry ?? manifest.industry,
          isDefault: template.isDefault,
          accountCount: accounts.length,
          accounts,
        };
      });
  }
}
