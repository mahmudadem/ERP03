"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaFormDefinitionRepository = void 0;
const FormDefinition_1 = require("../../../../domain/designer/entities/FormDefinition");
class PrismaFormDefinitionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createFormDefinition(def) {
        await this.prisma.formDefinition.create({
            data: {
                id: def.id,
                companyId: 'GLOBAL',
                name: def.name,
                module: def.module,
                type: def.type,
                fields: def.fields,
                sections: def.sections,
            },
        });
    }
    async updateFormDefinition(id, data) {
        await this.prisma.formDefinition.update({
            where: { id },
            data: {
                name: data.name,
                module: data.module,
                type: data.type,
                fields: data.fields,
                sections: data.sections,
            },
        });
    }
    async getFormDefinition(id) {
        const record = await this.prisma.formDefinition.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getDefinitionsForModule(module) {
        const records = await this.prisma.formDefinition.findMany({
            where: { module },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        return new FormDefinition_1.FormDefinition(record.id, record.name, record.module, record.type, record.fields || [], record.sections || []);
    }
}
exports.PrismaFormDefinitionRepository = PrismaFormDefinitionRepository;
//# sourceMappingURL=PrismaFormDefinitionRepository.js.map