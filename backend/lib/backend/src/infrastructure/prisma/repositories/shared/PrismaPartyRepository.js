"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPartyRepository = void 0;
const Party_1 = require("../../../../domain/shared/entities/Party");
class PrismaPartyRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(party) {
        await this.prisma.party.create({
            data: {
                id: party.id,
                companyId: party.companyId,
                code: party.code,
                legalName: party.legalName,
                displayName: party.displayName,
                roles: party.roles,
                contactPerson: party.contactPerson,
                phone: party.phone,
                email: party.email,
                address: party.address,
                taxId: party.taxId,
                paymentTermsDays: party.paymentTermsDays,
                defaultCurrency: party.defaultCurrency,
                defaultAPAccountId: party.defaultAPAccountId,
                defaultARAccountId: party.defaultARAccountId,
                active: party.active,
                createdBy: party.createdBy,
                createdAt: party.createdAt,
                updatedAt: party.updatedAt,
            },
        });
    }
    async update(party) {
        await this.prisma.party.update({
            where: { id: party.id },
            data: {
                code: party.code,
                legalName: party.legalName,
                displayName: party.displayName,
                roles: party.roles,
                contactPerson: party.contactPerson,
                phone: party.phone,
                email: party.email,
                address: party.address,
                taxId: party.taxId,
                paymentTermsDays: party.paymentTermsDays,
                defaultCurrency: party.defaultCurrency,
                defaultAPAccountId: party.defaultAPAccountId,
                defaultARAccountId: party.defaultARAccountId,
                active: party.active,
                updatedAt: party.updatedAt,
            },
        });
    }
    async getById(companyId, id) {
        const record = await this.prisma.party.findFirst({
            where: { id, companyId },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getByCode(companyId, code) {
        const record = await this.prisma.party.findFirst({
            where: { companyId, code },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async list(companyId, opts) {
        const where = { companyId };
        if (opts === null || opts === void 0 ? void 0 : opts.role) {
            where.roles = { has: opts.role };
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        const records = await this.prisma.party.findMany({
            where,
            orderBy: { displayName: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async delete(companyId, id) {
        await this.prisma.party.delete({
            where: { id, companyId },
        });
    }
    toDomain(record) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return new Party_1.Party({
            id: record.id,
            companyId: record.companyId,
            code: record.code,
            legalName: record.legalName,
            displayName: record.displayName,
            roles: record.roles,
            contactPerson: (_a = record.contactPerson) !== null && _a !== void 0 ? _a : undefined,
            phone: (_b = record.phone) !== null && _b !== void 0 ? _b : undefined,
            email: (_c = record.email) !== null && _c !== void 0 ? _c : undefined,
            address: (_d = record.address) !== null && _d !== void 0 ? _d : undefined,
            taxId: (_e = record.taxId) !== null && _e !== void 0 ? _e : undefined,
            paymentTermsDays: (_f = record.paymentTermsDays) !== null && _f !== void 0 ? _f : undefined,
            defaultCurrency: (_g = record.defaultCurrency) !== null && _g !== void 0 ? _g : undefined,
            defaultAPAccountId: (_h = record.defaultAPAccountId) !== null && _h !== void 0 ? _h : undefined,
            defaultARAccountId: (_j = record.defaultARAccountId) !== null && _j !== void 0 ? _j : undefined,
            active: record.active,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        });
    }
}
exports.PrismaPartyRepository = PrismaPartyRepository;
//# sourceMappingURL=PrismaPartyRepository.js.map