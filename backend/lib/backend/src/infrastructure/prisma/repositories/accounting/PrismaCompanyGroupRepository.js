"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyGroupRepository = void 0;
const CompanyGroup_1 = require("../../../../domain/accounting/entities/CompanyGroup");
class PrismaCompanyGroupRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(group) {
        const record = await this.prisma.companyGroup.create({
            data: {
                id: group.id,
                name: group.name,
                members: group.members,
                reportingCurrency: group.reportingCurrency,
                createdBy: group.createdBy,
                createdAt: group.createdAt,
                updatedAt: new Date(),
            },
        });
        return this.toDomain(record);
    }
    async update(group) {
        const record = await this.prisma.companyGroup.update({
            where: { id: group.id },
            data: {
                name: group.name,
                members: group.members,
                reportingCurrency: group.reportingCurrency,
                updatedAt: new Date(),
            },
        });
        return this.toDomain(record);
    }
    async list(companyId) {
        const records = await this.prisma.companyGroup.findMany({
            where: {
                OR: [
                    { companyId },
                ],
            },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async findById(id) {
        const record = await this.prisma.companyGroup.findUnique({
            where: { id },
        });
        return record ? this.toDomain(record) : null;
    }
    toDomain(record) {
        var _a, _b, _c;
        const members = (_a = record.members) !== null && _a !== void 0 ? _a : [];
        return new CompanyGroup_1.CompanyGroup(record.id, record.name, (_b = record.reportingCurrency) !== null && _b !== void 0 ? _b : 'USD', members, record.createdAt, (_c = record.createdBy) !== null && _c !== void 0 ? _c : '');
    }
}
exports.PrismaCompanyGroupRepository = PrismaCompanyGroupRepository;
//# sourceMappingURL=PrismaCompanyGroupRepository.js.map