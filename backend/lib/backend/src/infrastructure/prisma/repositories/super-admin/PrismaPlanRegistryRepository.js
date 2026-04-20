"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPlanRegistryRepository = void 0;
class PrismaPlanRegistryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAll() {
        const records = await this.prisma.planRegistry.findMany({
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getById(id) {
        const record = await this.prisma.planRegistry.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async create(plan) {
        await this.prisma.planRegistry.create({
            data: {
                id: plan.id,
                code: plan.id,
                name: plan.name,
                description: plan.description,
                pricing: { price: plan.price },
                limits: plan.limits,
                createdAt: plan.createdAt,
                updatedAt: plan.updatedAt,
            },
        });
    }
    async update(id, plan) {
        const updateData = {};
        if (plan.name !== undefined)
            updateData.name = plan.name;
        if (plan.description !== undefined)
            updateData.description = plan.description;
        if (plan.price !== undefined)
            updateData.pricing = { price: plan.price };
        if (plan.limits !== undefined)
            updateData.limits = plan.limits;
        if (plan.status !== undefined)
            updateData.features = { status: plan.status };
        updateData.updatedAt = new Date();
        await this.prisma.planRegistry.update({
            where: { id },
            data: updateData,
        });
    }
    async delete(id) {
        await this.prisma.planRegistry.delete({
            where: { id },
        });
    }
    toDomain(record) {
        var _a, _b;
        const pricing = record.pricing;
        const limits = record.limits;
        return {
            id: record.id,
            name: record.name,
            description: (_a = record.description) !== null && _a !== void 0 ? _a : '',
            price: (_b = pricing === null || pricing === void 0 ? void 0 : pricing.price) !== null && _b !== void 0 ? _b : 0,
            status: 'active',
            limits: limits !== null && limits !== void 0 ? limits : {
                maxCompanies: 0,
                maxUsersPerCompany: 0,
                maxModulesAllowed: 0,
                maxStorageMB: 0,
                maxTransactionsPerMonth: 0,
            },
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaPlanRegistryRepository = PrismaPlanRegistryRepository;
//# sourceMappingURL=PrismaPlanRegistryRepository.js.map