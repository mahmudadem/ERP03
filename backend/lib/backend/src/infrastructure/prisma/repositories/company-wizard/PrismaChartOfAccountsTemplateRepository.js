"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaChartOfAccountsTemplateRepository = void 0;
class PrismaChartOfAccountsTemplateRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listChartOfAccountsTemplates() {
        const records = await this.prisma.chartOfAccountsTemplate.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });
        return records;
    }
}
exports.PrismaChartOfAccountsTemplateRepository = PrismaChartOfAccountsTemplateRepository;
//# sourceMappingURL=PrismaChartOfAccountsTemplateRepository.js.map