"use strict";
/**
 * PrismaModuleSettingsDefinitionRepository
 * Prisma (SQL) implementation of IModuleSettingsDefinitionRepository
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaModuleSettingsDefinitionRepository = void 0;
class PrismaModuleSettingsDefinitionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listDefinitions() {
        const records = await this.prisma.moduleSettingsDefinition.findMany();
        return records.map(r => {
            var _a;
            return ({
                moduleId: r.moduleId,
                fields: ((_a = r.settingsSchema) === null || _a === void 0 ? void 0 : _a.fields) || [],
                createdBy: 'system',
                updatedAt: r.updatedAt,
                autoAttachToRoles: []
            });
        });
    }
    async getDefinition(moduleId) {
        var _a;
        const record = await this.prisma.moduleSettingsDefinition.findUnique({
            where: { moduleId }
        });
        if (!record)
            return null;
        return {
            moduleId: record.moduleId,
            fields: ((_a = record.settingsSchema) === null || _a === void 0 ? void 0 : _a.fields) || [],
            createdBy: 'system',
            updatedAt: record.updatedAt,
            autoAttachToRoles: []
        };
    }
    async createDefinition(def) {
        await this.prisma.moduleSettingsDefinition.create({
            data: {
                moduleId: def.moduleId,
                settingsSchema: { fields: def.fields || [] }
            }
        });
    }
    async updateDefinition(moduleId, def) {
        const data = {};
        if (def.fields !== undefined) {
            data.settingsSchema = { fields: def.fields };
        }
        await this.prisma.moduleSettingsDefinition.update({
            where: { moduleId },
            data
        });
    }
    async deleteDefinition(moduleId) {
        await this.prisma.moduleSettingsDefinition.delete({
            where: { moduleId }
        });
    }
}
exports.PrismaModuleSettingsDefinitionRepository = PrismaModuleSettingsDefinitionRepository;
//# sourceMappingURL=PrismaModuleSettingsDefinitionRepository.js.map