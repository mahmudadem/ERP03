"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyModuleRepository = void 0;
class PrismaCompanyModuleRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(companyId, moduleCode) {
        const record = await this.prisma.companyModule.findUnique({
            where: { companyId_moduleCode: { companyId, moduleCode } },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async listByCompany(companyId) {
        const records = await this.prisma.companyModule.findMany({
            where: { companyId },
            orderBy: { moduleCode: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async create(module) {
        var _a;
        await this.prisma.companyModule.create({
            data: {
                companyId: module.companyId,
                moduleCode: module.moduleCode,
                isEnabled: (_a = module.isEnabled) !== null && _a !== void 0 ? _a : true,
                installedAt: module.installedAt,
                initialized: module.initialized,
                initializationStatus: module.initializationStatus,
                config: module.config,
            },
        });
    }
    async update(companyId, moduleCode, updates) {
        const data = {};
        if (updates.isEnabled !== undefined)
            data.isEnabled = updates.isEnabled;
        if (updates.initialized !== undefined)
            data.initialized = updates.initialized;
        if (updates.initializationStatus !== undefined)
            data.initializationStatus = updates.initializationStatus;
        if (updates.config !== undefined)
            data.config = updates.config;
        if (updates.installedAt !== undefined)
            data.installedAt = updates.installedAt;
        data.updatedAt = new Date();
        await this.prisma.companyModule.update({
            where: { companyId_moduleCode: { companyId, moduleCode } },
            data,
        });
    }
    async delete(companyId, moduleCode) {
        await this.prisma.companyModule.delete({
            where: { companyId_moduleCode: { companyId, moduleCode } },
        });
    }
    async batchCreate(modules) {
        await this.prisma.$transaction(modules.map((m) => {
            var _a;
            return this.prisma.companyModule.create({
                data: {
                    companyId: m.companyId,
                    moduleCode: m.moduleCode,
                    isEnabled: (_a = m.isEnabled) !== null && _a !== void 0 ? _a : true,
                    installedAt: m.installedAt,
                    initialized: m.initialized,
                    initializationStatus: m.initializationStatus,
                    config: m.config,
                },
            });
        }));
    }
    toDomain(record) {
        var _a, _b;
        return {
            companyId: record.companyId,
            moduleCode: record.moduleCode,
            isEnabled: (_a = record.isEnabled) !== null && _a !== void 0 ? _a : true,
            installedAt: record.installedAt,
            initialized: record.initialized,
            initializationStatus: record.initializationStatus,
            config: record.config || {},
            updatedAt: (_b = record.updatedAt) !== null && _b !== void 0 ? _b : undefined,
        };
    }
}
exports.PrismaCompanyModuleRepository = PrismaCompanyModuleRepository;
//# sourceMappingURL=PrismaCompanyModuleRepository.js.map