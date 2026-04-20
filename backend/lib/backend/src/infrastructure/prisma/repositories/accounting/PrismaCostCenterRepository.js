"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCostCenterRepository = void 0;
const CostCenter_1 = require("../../../../domain/accounting/entities/CostCenter");
class PrismaCostCenterRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(companyId) {
        const records = await this.prisma.costCenter.findMany({
            where: { companyId },
            orderBy: { code: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async findById(companyId, id) {
        const record = await this.prisma.costCenter.findFirst({
            where: { id, companyId },
        });
        return record ? this.toDomain(record) : null;
    }
    async findByCode(companyId, code) {
        const record = await this.prisma.costCenter.findFirst({
            where: { companyId, code },
        });
        return record ? this.toDomain(record) : null;
    }
    async create(costCenter) {
        const record = await this.prisma.costCenter.create({
            data: {
                id: costCenter.id,
                companyId: costCenter.companyId,
                code: costCenter.code,
                name: costCenter.name,
                description: costCenter.description,
                parentId: costCenter.parentId,
                status: costCenter.status,
                createdBy: costCenter.createdBy,
                updatedBy: costCenter.updatedBy,
                createdAt: costCenter.createdAt,
                updatedAt: costCenter.updatedAt,
            },
        });
        return this.toDomain(record);
    }
    async update(costCenter) {
        const record = await this.prisma.costCenter.update({
            where: { id: costCenter.id },
            data: {
                code: costCenter.code,
                name: costCenter.name,
                description: costCenter.description,
                parentId: costCenter.parentId,
                status: costCenter.status,
                updatedBy: costCenter.updatedBy,
                updatedAt: costCenter.updatedAt,
            },
        });
        return this.toDomain(record);
    }
    async delete(companyId, id) {
        await this.prisma.costCenter.delete({
            where: { id, companyId },
        });
    }
    toDomain(record) {
        var _a, _b, _c, _d, _e;
        return new CostCenter_1.CostCenter(record.id, record.companyId, record.name, record.code, (_a = record.description) !== null && _a !== void 0 ? _a : null, (_b = record.parentId) !== null && _b !== void 0 ? _b : null, (_c = record.status) !== null && _c !== void 0 ? _c : CostCenter_1.CostCenterStatus.ACTIVE, record.createdAt, (_d = record.createdBy) !== null && _d !== void 0 ? _d : '', record.updatedAt, (_e = record.updatedBy) !== null && _e !== void 0 ? _e : '');
    }
}
exports.PrismaCostCenterRepository = PrismaCostCenterRepository;
//# sourceMappingURL=PrismaCostCenterRepository.js.map