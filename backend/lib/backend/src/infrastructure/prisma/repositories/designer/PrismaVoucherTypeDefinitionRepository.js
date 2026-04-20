"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaVoucherTypeDefinitionRepository = void 0;
const VoucherTypeDefinition_1 = require("../../../../domain/designer/entities/VoucherTypeDefinition");
class PrismaVoucherTypeDefinitionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createVoucherType(def) {
        var _a, _b;
        await this.prisma.voucherTypeDefinition.create({
            data: {
                id: def.id,
                companyId: def.companyId,
                name: def.name,
                code: def.code,
                module: def.module,
                headerFields: def.headerFields,
                tableColumns: def.tableColumns,
                layout: def.layout,
                schemaVersion: def.schemaVersion,
                requiredPostingRoles: (def.requiredPostingRoles || []),
                workflow: def.workflow,
                uiModeOverrides: def.uiModeOverrides,
                isMultiLine: (_a = def.isMultiLine) !== null && _a !== void 0 ? _a : true,
                rules: def.rules,
                actions: def.actions,
                defaultCurrency: (_b = def.defaultCurrency) !== null && _b !== void 0 ? _b : 'USD',
            },
        });
    }
    async updateVoucherType(companyId, id, data) {
        await this.prisma.voucherTypeDefinition.update({
            where: { id, companyId },
            data: {
                name: data.name,
                code: data.code,
                module: data.module,
                headerFields: data.headerFields,
                tableColumns: data.tableColumns,
                layout: data.layout,
                schemaVersion: data.schemaVersion,
                requiredPostingRoles: data.requiredPostingRoles,
                workflow: data.workflow,
                uiModeOverrides: data.uiModeOverrides,
                isMultiLine: data.isMultiLine,
                rules: data.rules,
                actions: data.actions,
                defaultCurrency: data.defaultCurrency,
            },
        });
    }
    async getVoucherType(companyId, id) {
        const record = await this.prisma.voucherTypeDefinition.findFirst({
            where: { id, companyId },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getVoucherTypesForModule(companyId, module) {
        const records = await this.prisma.voucherTypeDefinition.findMany({
            where: { companyId, module },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getByCompanyId(companyId) {
        const records = await this.prisma.voucherTypeDefinition.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getByCode(companyId, code) {
        const record = await this.prisma.voucherTypeDefinition.findFirst({
            where: { companyId, code },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async updateLayout(companyId, code, layout) {
        await this.prisma.voucherTypeDefinition.updateMany({
            where: { companyId, code },
            data: { layout: layout },
        });
    }
    async getSystemTemplates() {
        const records = await this.prisma.voucherTypeDefinition.findMany({
            where: { companyId: 'SYSTEM' },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async deleteVoucherType(companyId, id) {
        await this.prisma.voucherTypeDefinition.delete({
            where: { id, companyId },
        });
    }
    toDomain(record) {
        return new VoucherTypeDefinition_1.VoucherTypeDefinition(record.id, record.companyId, record.name, record.code, record.module, record.headerFields || [], record.tableColumns || [], record.layout || {}, record.schemaVersion, record.requiredPostingRoles || [], record.workflow, record.uiModeOverrides, record.isMultiLine, record.rules || [], record.actions || [], record.defaultCurrency);
    }
}
exports.PrismaVoucherTypeDefinitionRepository = PrismaVoucherTypeDefinitionRepository;
//# sourceMappingURL=PrismaVoucherTypeDefinitionRepository.js.map