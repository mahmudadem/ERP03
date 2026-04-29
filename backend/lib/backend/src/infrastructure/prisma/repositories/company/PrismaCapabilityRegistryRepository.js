"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCapabilityRegistryRepository = void 0;
class PrismaCapabilityRegistryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAll() {
        const records = await this.prisma.moduleCapabilityRegistry.findMany({
            orderBy: { name: 'asc' },
        });
        return records.map(r => this.toDomain(r));
    }
    async getById(id) {
        const record = await this.prisma.moduleCapabilityRegistry.findUnique({
            where: { id },
        });
        return record ? this.toDomain(record) : null;
    }
    async getByCode(code) {
        const record = await this.prisma.moduleCapabilityRegistry.findUnique({
            where: { code },
        });
        return record ? this.toDomain(record) : null;
    }
    async getByModuleId(moduleId) {
        const records = await this.prisma.moduleCapabilityRegistry.findMany({
            where: { moduleId },
            orderBy: { name: 'asc' },
        });
        return records.map(r => this.toDomain(r));
    }
    async getReady(moduleId) {
        const where = { lifecycleStatus: 'ready' };
        if (moduleId)
            where.moduleId = moduleId;
        const records = await this.prisma.moduleCapabilityRegistry.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        return records.map(r => this.toDomain(r));
    }
    async create(capability) {
        await this.prisma.moduleCapabilityRegistry.create({
            data: {
                id: capability.id,
                code: capability.code,
                moduleId: capability.moduleId,
                name: capability.name,
                description: capability.description,
                lifecycleStatus: capability.lifecycleStatus,
                runtimeStatus: capability.runtimeStatus,
                implementationStatus: capability.implementationStatus,
                implementationError: capability.implementationError,
                implementationCheckedAt: capability.implementationCheckedAt,
                enablementPolicy: capability.enablementPolicy,
                requiresMigration: capability.requiresMigration,
                createdAt: capability.createdAt,
                updatedAt: capability.updatedAt,
            },
        });
    }
    async update(id, updates) {
        const data = { updatedAt: new Date() };
        if (updates.name !== undefined)
            data.name = updates.name;
        if (updates.description !== undefined)
            data.description = updates.description;
        if (updates.lifecycleStatus !== undefined)
            data.lifecycleStatus = updates.lifecycleStatus;
        if (updates.runtimeStatus !== undefined)
            data.runtimeStatus = updates.runtimeStatus;
        if (updates.implementationStatus !== undefined)
            data.implementationStatus = updates.implementationStatus;
        if (updates.implementationError !== undefined)
            data.implementationError = updates.implementationError;
        if (updates.enablementPolicy !== undefined)
            data.enablementPolicy = updates.enablementPolicy;
        await this.prisma.moduleCapabilityRegistry.update({
            where: { id },
            data,
        });
    }
    async delete(id) {
        await this.prisma.moduleCapabilityRegistry.delete({
            where: { id },
        });
    }
    async getByCompanyId(companyId) {
        const records = await this.prisma.companyCapability.findMany({
            where: { companyId },
            orderBy: { capabilityId: 'asc' },
        });
        return records.map(r => this.toCompanyDomain(r));
    }
    async getByCompanyAndCapability(companyId, capabilityId) {
        const record = await this.prisma.companyCapability.findUnique({
            where: { companyId_capabilityId: { companyId, capabilityId } },
        });
        return record ? this.toCompanyDomain(record) : null;
    }
    async setEnabled(companyId, capabilityId, isEnabled) {
        const existing = await this.prisma.companyCapability.findUnique({
            where: { companyId_capabilityId: { companyId, capabilityId } },
        });
        if (existing) {
            await this.prisma.companyCapability.update({
                where: { companyId_capabilityId: { companyId, capabilityId } },
                data: {
                    isEnabled,
                    enabledAt: isEnabled ? new Date() : undefined,
                    disabledAt: !isEnabled ? new Date() : undefined,
                    updatedAt: new Date(),
                },
            });
        }
        else if (isEnabled) {
            await this.prisma.companyCapability.create({
                data: {
                    companyId,
                    capabilityId,
                    isEnabled: true,
                    enabledAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        }
    }
    async setConfig(companyId, capabilityId, config) {
        const existing = await this.prisma.companyCapability.findUnique({
            where: { companyId_capabilityId: { companyId, capabilityId } },
        });
        if (existing) {
            await this.prisma.companyCapability.update({
                where: { companyId_capabilityId: { companyId, capabilityId } },
                data: {
                    config: config,
                    updatedAt: new Date(),
                },
            });
        }
    }
    toDomain(record) {
        var _a, _b, _c;
        return {
            id: record.id,
            code: record.code,
            moduleId: record.moduleId,
            name: record.name,
            description: (_a = record.description) !== null && _a !== void 0 ? _a : undefined,
            lifecycleStatus: record.lifecycleStatus,
            runtimeStatus: record.runtimeStatus,
            implementationStatus: record.implementationStatus,
            implementationError: (_b = record.implementationError) !== null && _b !== void 0 ? _b : undefined,
            implementationCheckedAt: (_c = record.implementationCheckedAt) !== null && _c !== void 0 ? _c : undefined,
            enablementPolicy: record.enablementPolicy,
            requiresMigration: record.requiresMigration,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
    toCompanyDomain(record) {
        var _a, _b, _c;
        return {
            companyId: record.companyId,
            capabilityId: record.capabilityId,
            isEnabled: record.isEnabled,
            config: record.config || {},
            enabledAt: (_a = record.enabledAt) !== null && _a !== void 0 ? _a : undefined,
            disabledAt: (_b = record.disabledAt) !== null && _b !== void 0 ? _b : undefined,
            createdAt: record.createdAt,
            updatedAt: (_c = record.updatedAt) !== null && _c !== void 0 ? _c : undefined,
        };
    }
}
exports.PrismaCapabilityRegistryRepository = PrismaCapabilityRegistryRepository;
//# sourceMappingURL=PrismaCapabilityRegistryRepository.js.map