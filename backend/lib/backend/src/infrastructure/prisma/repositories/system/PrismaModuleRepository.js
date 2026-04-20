"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaModuleRepository = void 0;
const Module_1 = require("../../../../domain/system/entities/Module");
class PrismaModuleRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return new Module_1.Module(data.id, data.name, data.enabled);
    }
    async findAll() {
        const data = await this.prisma.module.findMany({
            orderBy: { name: 'asc' },
        });
        return data.map((d) => this.toDomain(d));
    }
    async getEnabledModules(companyId) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { modules: true },
        });
        if (!company)
            return [];
        const enabledModuleCodes = company.modules || [];
        const data = await this.prisma.module.findMany({
            where: {
                code: { in: enabledModuleCodes },
                enabled: true,
            },
            orderBy: { name: 'asc' },
        });
        return data.map((d) => this.toDomain(d));
    }
    async enableModule(companyId, moduleName) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { modules: true },
        });
        if (!company)
            return;
        const modules = [...(company.modules || [])];
        if (!modules.includes(moduleName)) {
            modules.push(moduleName);
        }
        await this.prisma.company.update({
            where: { id: companyId },
            data: { modules: modules },
        });
    }
    async disableModule(companyId, moduleName) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { modules: true },
        });
        if (!company)
            return;
        const modules = (company.modules || []).filter((m) => m !== moduleName);
        await this.prisma.company.update({
            where: { id: companyId },
            data: { modules: modules },
        });
    }
}
exports.PrismaModuleRepository = PrismaModuleRepository;
//# sourceMappingURL=PrismaModuleRepository.js.map