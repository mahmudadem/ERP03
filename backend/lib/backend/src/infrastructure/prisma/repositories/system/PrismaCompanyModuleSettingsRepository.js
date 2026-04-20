"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyModuleSettingsRepository = void 0;
class PrismaCompanyModuleSettingsRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByCompanyId(companyId) {
        const data = await this.prisma.companyModuleSettings.findMany({
            where: { companyId },
        });
        return data.map((d) => ({
            id: d.id,
            companyId: d.companyId,
            moduleId: d.moduleId,
            settings: d.settings,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        }));
    }
    async create(settings) {
        await this.prisma.companyModuleSettings.create({
            data: {
                id: settings.id,
                companyId: settings.companyId,
                moduleId: settings.moduleId,
                settings: settings.settings,
            },
        });
    }
    async update(companyId, moduleId, settings) {
        await this.prisma.companyModuleSettings.update({
            where: { companyId_moduleId: { companyId, moduleId } },
            data: { settings: settings },
        });
    }
    async getSettings(companyId, moduleId) {
        const data = await this.prisma.companyModuleSettings.findUnique({
            where: { companyId_moduleId: { companyId, moduleId } },
        });
        if (!data)
            return null;
        return data.settings;
    }
    async saveSettings(companyId, moduleId, settings, userId) {
        await this.prisma.companyModuleSettings.upsert({
            where: { companyId_moduleId: { companyId, moduleId } },
            create: {
                companyId,
                moduleId,
                settings: settings,
            },
            update: {
                settings: settings,
            },
        });
    }
    async ensureModuleIsActivated(companyId, moduleId) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { modules: true },
        });
        if (!company)
            return;
        const modules = [...(company.modules || [])];
        if (!modules.includes(moduleId)) {
            modules.push(moduleId);
            await this.prisma.company.update({
                where: { id: companyId },
                data: { modules: modules },
            });
        }
    }
}
exports.PrismaCompanyModuleSettingsRepository = PrismaCompanyModuleSettingsRepository;
//# sourceMappingURL=PrismaCompanyModuleSettingsRepository.js.map