"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaAccountLookupService = void 0;
class PrismaAccountLookupService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAccountsByIds(companyId, accountIds) {
        const accountMap = new Map();
        if (accountIds.length === 0) {
            return accountMap;
        }
        try {
            // Prisma 'in' query can handle more than 10 items, but we still batch for safety
            const batchSize = 10;
            const batches = [];
            for (let i = 0; i < accountIds.length; i += batchSize) {
                batches.push(accountIds.slice(i, i + batchSize));
            }
            // Execute all batches in parallel
            const allResults = await Promise.all(batches.map(batch => this.prisma.account.findMany({
                where: {
                    companyId,
                    id: { in: batch },
                },
            })));
            // Merge results
            for (const records of allResults) {
                if (!records)
                    continue;
                for (const record of records) {
                    const data = record;
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
        }
        catch (error) {
            console.error(`Failed to load accounts for company ${companyId}:`, error);
            // Return empty map on error (policy will fail safely)
            return accountMap;
        }
    }
}
exports.PrismaAccountLookupService = PrismaAccountLookupService;
//# sourceMappingURL=PrismaAccountLookupService.js.map