"use strict";
/**
 * PrismaSystemMetadataRepository
 * Prisma (SQL) implementation of ISystemMetadataRepository
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaSystemMetadataRepository = void 0;
class PrismaSystemMetadataRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMetadata(key) {
        const record = await this.prisma.systemMetadata.findUnique({
            where: { key }
        });
        if (!record)
            return null;
        return record.value;
    }
    async setMetadata(key, value) {
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
exports.PrismaSystemMetadataRepository = PrismaSystemMetadataRepository;
//# sourceMappingURL=PrismaSystemMetadataRepository.js.map