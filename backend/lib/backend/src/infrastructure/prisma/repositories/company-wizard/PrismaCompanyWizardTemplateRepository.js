"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyWizardTemplateRepository = void 0;
class PrismaCompanyWizardTemplateRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDefaultTemplateForModel(model) {
        const record = await this.prisma.companyWizardTemplate.findFirst({
            where: {
                isDefault: true,
                models: { has: model },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getById(id) {
        const record = await this.prisma.companyWizardTemplate.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async listAll() {
        const records = await this.prisma.companyWizardTemplate.findMany({
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        return {
            id: record.id,
            name: record.name,
            models: record.models,
            steps: record.steps,
            isDefault: record.isDefault,
        };
    }
}
exports.PrismaCompanyWizardTemplateRepository = PrismaCompanyWizardTemplateRepository;
//# sourceMappingURL=PrismaCompanyWizardTemplateRepository.js.map