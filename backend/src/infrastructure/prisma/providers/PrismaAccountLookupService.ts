/**
 * PrismaAccountLookupService
 * 
 * Prisma-based implementation of IAccountLookupService.
 * Efficient bulk account loading from PostgreSQL via Prisma.
 * Uses batched queries to avoid N+1 queries.
 */
import { PrismaClient } from '@prisma/client';
import { IAccountLookupService, AccountWithAccess } from '../../../domain/accounting/services/IAccountLookupService';

export class PrismaAccountLookupService implements IAccountLookupService {
  constructor(private prisma: PrismaClient) {}

  async getAccountsByIds(
    companyId: string,
    accountIds: string[]
  ): Promise<Map<string, AccountWithAccess>> {
    const accountMap = new Map<string, AccountWithAccess>();

    if (accountIds.length === 0) {
      return accountMap;
    }

    try {
      // Prisma 'in' query can handle more than 10 items, but we still batch for safety
      const batchSize = 10;
      const batches: string[][] = [];
      
      for (let i = 0; i < accountIds.length; i += batchSize) {
        batches.push(accountIds.slice(i, i + batchSize));
      }

      // Execute all batches in parallel
      const allResults = await Promise.all(
        batches.map(batch =>
          (this.prisma as any).account.findMany({
            where: {
              companyId,
              id: { in: batch },
            },
          })
        )
      );

      // Merge results
      for (const records of allResults) {
        if (!records) continue;
        for (const record of records) {
          const data = record as any;
          accountMap.set(record.id, {
            id: record.id,
            code: data.userCode || record.id,
            name: data.name || 'Unknown',
            type: data.classification || 'other',
            ownerUnitIds: data.ownerUnitIds,
            ownerScope: data.ownerScope
          });
        }
      }

      return accountMap;
    } catch (error) {
      console.error(`Failed to load accounts for company ${companyId}:`, error);
      // Return empty map on error (policy will fail safely)
      return accountMap;
    }
  }
}
