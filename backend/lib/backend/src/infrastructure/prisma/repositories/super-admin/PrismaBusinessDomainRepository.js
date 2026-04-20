"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaBusinessDomainRepository = void 0;
class PrismaBusinessDomainRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAll() {
        const records = await this.prisma.businessDomain.findMany({
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getById(id) {
        const record = await this.prisma.businessDomain.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async create(domain) {
        await this.prisma.businessDomain.create({
            data: {
                id: domain.id,
                code: domain.id,
                name: domain.name,
                description: domain.description,
                createdAt: domain.createdAt,
                updatedAt: domain.updatedAt,
            },
        });
    }
    async update(id, domain) {
        await this.prisma.businessDomain.update({
            where: { id },
            data: {
                name: domain.name,
                description: domain.description,
                updatedAt: new Date(),
            },
        });
    }
    async delete(id) {
        await this.prisma.businessDomain.delete({
            where: { id },
        });
    }
    toDomain(record) {
        var _a;
        return {
            id: record.id,
            name: record.name,
            description: (_a = record.description) !== null && _a !== void 0 ? _a : '',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaBusinessDomainRepository = PrismaBusinessDomainRepository;
//# sourceMappingURL=PrismaBusinessDomainRepository.js.map