"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaInventoryTemplateRepository = void 0;
class PrismaInventoryTemplateRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listInventoryTemplates() {
        const records = await this.prisma.inventoryTemplate.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });
        return records;
    }
}
exports.PrismaInventoryTemplateRepository = PrismaInventoryTemplateRepository;
//# sourceMappingURL=PrismaInventoryTemplateRepository.js.map