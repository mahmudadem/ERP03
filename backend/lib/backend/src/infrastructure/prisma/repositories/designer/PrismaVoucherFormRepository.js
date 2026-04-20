"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaVoucherFormRepository = void 0;
class PrismaVoucherFormRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(form) {
        const record = await this.prisma.voucherForm.create({
            data: {
                id: form.id,
                companyId: form.companyId,
                voucherTypeId: form.typeId,
                formDefinitionId: form.id,
                createdAt: form.createdAt,
                updatedAt: form.updatedAt,
            },
        });
        return this.toDomain(record, form);
    }
    async getById(companyId, formId) {
        const record = await this.prisma.voucherForm.findFirst({
            where: { id: formId, companyId },
        });
        if (!record)
            return null;
        const fullForm = await this.getStoredDefinition(formId);
        if (!fullForm)
            return null;
        return this.toDomain(record, fullForm);
    }
    async getByTypeId(companyId, typeId) {
        const records = await this.prisma.voucherForm.findMany({
            where: { companyId, voucherTypeId: typeId },
            orderBy: { createdAt: 'asc' },
        });
        return records.map((r) => {
            const fullForm = this.getStoredDefinition(r.id);
            return fullForm.then((f) => this.toDomain(r, f));
        }).reduce(async (acc, p) => {
            const results = await acc;
            results.push(await p);
            return results;
        }, Promise.resolve([]));
    }
    async getDefaultForType(companyId, typeId) {
        const record = await this.prisma.voucherForm.findFirst({
            where: { companyId, voucherTypeId: typeId },
            orderBy: { createdAt: 'asc' },
        });
        if (!record)
            return null;
        const fullForm = await this.getStoredDefinition(record.id);
        if (!fullForm)
            return null;
        return this.toDomain(record, fullForm);
    }
    async getAllByCompany(companyId) {
        const records = await this.prisma.voucherForm.findMany({
            where: { companyId },
            orderBy: { createdAt: 'asc' },
        });
        const results = [];
        for (const r of records) {
            const fullForm = await this.getStoredDefinition(r.id);
            if (fullForm) {
                results.push(this.toDomain(r, fullForm));
            }
        }
        return results;
    }
    async update(companyId, formId, updates) {
        await this.prisma.voucherForm.update({
            where: { id: formId, companyId },
            data: {
                updatedAt: new Date(),
            },
        });
    }
    async delete(companyId, formId) {
        await this.prisma.voucherForm.delete({
            where: { id: formId, companyId },
        });
    }
    async getStoredDefinition(formId) {
        const stored = await this.prisma.voucherForm.findUnique({
            where: { id: formId },
        });
        if (!stored)
            return null;
        return {
            id: stored.id,
            companyId: stored.companyId,
            typeId: stored.voucherTypeId,
            module: undefined,
            name: '',
            code: '',
            isDefault: false,
            isSystemGenerated: false,
            isLocked: false,
            enabled: true,
            headerFields: [],
            tableColumns: [],
            layout: {},
            createdAt: stored.createdAt,
            updatedAt: stored.updatedAt,
        };
    }
    toDomain(record, form) {
        return Object.assign(Object.assign({}, form), { id: record.id, companyId: record.companyId, typeId: record.voucherTypeId, createdAt: record.createdAt, updatedAt: record.updatedAt });
    }
}
exports.PrismaVoucherFormRepository = PrismaVoucherFormRepository;
//# sourceMappingURL=PrismaVoucherFormRepository.js.map