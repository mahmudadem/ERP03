"use strict";
/**
 * PrismaAccountRepository
 *
 * SQL implementation of IAccountRepository using Prisma.
 * Handles Chart of Accounts operations including system code generation,
 * USED detection, hierarchy management, and audit event recording.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaAccountRepository = void 0;
const Account_1 = require("../../../../domain/accounting/models/Account");
class PrismaAccountRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // =========================================================================
    // MAPPING HELPERS
    // =========================================================================
    toDomain(record) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const account = new Account_1.Account({
            id: record.id,
            systemCode: record.systemCode,
            companyId: record.companyId,
            userCode: record.userCode,
            name: record.name,
            description: (_a = record.description) !== null && _a !== void 0 ? _a : null,
            accountRole: record.accountRole,
            classification: record.classification,
            balanceNature: record.balanceNature,
            balanceEnforcement: record.balanceEnforcement,
            parentId: (_b = record.parentId) !== null && _b !== void 0 ? _b : null,
            currencyPolicy: record.currencyPolicy,
            fixedCurrencyCode: (_c = record.fixedCurrencyCode) !== null && _c !== void 0 ? _c : null,
            allowedCurrencyCodes: (_d = record.allowedCurrencyCodes) !== null && _d !== void 0 ? _d : [],
            status: record.status,
            isProtected: (_e = record.isProtected) !== null && _e !== void 0 ? _e : false,
            replacedByAccountId: (_f = record.replacedByAccountId) !== null && _f !== void 0 ? _f : null,
            cashFlowCategory: record.cashFlowCategory,
            plSubgroup: record.plSubgroup,
            equitySubgroup: record.equitySubgroup,
            createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt),
            createdBy: (_g = record.createdBy) !== null && _g !== void 0 ? _g : 'SYSTEM',
            updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt),
            updatedBy: (_h = record.updatedBy) !== null && _h !== void 0 ? _h : 'SYSTEM',
            requiresApproval: (_j = record.requiresApproval) !== null && _j !== void 0 ? _j : false,
            requiresCustodyConfirmation: (_k = record.requiresCustodyConfirmation) !== null && _k !== void 0 ? _k : false,
            custodianUserId: (_l = record.custodianUserId) !== null && _l !== void 0 ? _l : null,
        });
        if ((_m = record._count) === null || _m === void 0 ? void 0 : _m.children) {
            account.setHasChildren(record._count.children > 0);
        }
        return account;
    }
    // =========================================================================
    // QUERY METHODS
    // =========================================================================
    async list(companyId) {
        const records = await this.prisma.account.findMany({
            where: { companyId },
            orderBy: { systemCode: 'asc' },
            include: { _count: { select: { children: true } } },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getById(companyId, accountId, transaction) {
        const tx = transaction || this.prisma;
        const record = await tx.account.findFirst({
            where: { id: accountId, companyId },
            include: { _count: { select: { children: true } } },
        });
        return record ? this.toDomain(record) : null;
    }
    async getByUserCode(companyId, userCode) {
        const record = await this.prisma.account.findFirst({
            where: { companyId, userCode },
            include: { _count: { select: { children: true } } },
        });
        return record ? this.toDomain(record) : null;
    }
    async getByCode(companyId, code) {
        return this.getByUserCode(companyId, code);
    }
    async getAccounts(companyId) {
        return this.list(companyId);
    }
    // =========================================================================
    // MUTATION METHODS
    // =========================================================================
    async create(companyId, data) {
        var _a, _b, _c;
        const systemCode = await this.generateNextSystemCode(companyId);
        const userCode = data.userCode || data.code || '';
        const classification = (data.classification || data.type || 'ASSET');
        const balanceNature = data.balanceNature || this.getDefaultBalanceNature(classification);
        const accountRole = data.accountRole || 'POSTING';
        const balanceEnforcement = data.balanceEnforcement || 'WARN_ABNORMAL';
        const currencyPolicy = data.currencyPolicy || 'INHERIT';
        const fixedCurrencyCode = data.fixedCurrencyCode || data.currency || null;
        const allowedCurrencyCodes = data.allowedCurrencyCodes || [];
        const isProtected = (_a = data.isProtected) !== null && _a !== void 0 ? _a : false;
        const parentId = data.parentId || null;
        const cashFlowCategory = data.cashFlowCategory || null;
        const plSubgroup = data.plSubgroup || null;
        const equitySubgroup = data.equitySubgroup || null;
        const requiresApproval = (_b = data.requiresApproval) !== null && _b !== void 0 ? _b : false;
        const requiresCustodyConfirmation = (_c = data.requiresCustodyConfirmation) !== null && _c !== void 0 ? _c : false;
        const custodianUserId = data.custodianUserId || null;
        const description = data.description || null;
        const createdBy = data.createdBy || 'SYSTEM';
        const record = await this.prisma.account.create({
            data: {
                id: data.id || crypto.randomUUID(),
                company: { connect: { id: companyId } },
                systemCode,
                userCode,
                name: data.name,
                description,
                accountRole,
                classification,
                balanceNature,
                balanceEnforcement,
                parentId,
                currencyPolicy,
                fixedCurrencyCode,
                allowedCurrencyCodes,
                status: 'ACTIVE',
                isProtected,
                replacedByAccountId: null,
                cashFlowCategory,
                plSubgroup,
                equitySubgroup,
                requiresApproval,
                requiresCustodyConfirmation,
                custodianUserId,
                createdBy,
                updatedBy: createdBy,
            },
        });
        return this.toDomain(record);
    }
    async update(companyId, accountId, data) {
        const updateData = {};
        if (data.userCode !== undefined || data.code !== undefined) {
            updateData.userCode = data.userCode || data.code;
        }
        if (data.name !== undefined) {
            updateData.name = data.name;
        }
        if (data.description !== undefined) {
            updateData.description = data.description;
        }
        if (data.status !== undefined) {
            updateData.status = data.status;
        }
        if (data.replacedByAccountId !== undefined) {
            updateData.replacedByAccountId = data.replacedByAccountId;
        }
        if (data.accountRole !== undefined) {
            updateData.accountRole = data.accountRole;
        }
        if (data.classification !== undefined || data.type !== undefined) {
            updateData.classification = data.classification || data.type;
        }
        if (data.balanceNature !== undefined) {
            updateData.balanceNature = data.balanceNature;
        }
        if (data.balanceEnforcement !== undefined) {
            updateData.balanceEnforcement = data.balanceEnforcement;
        }
        if (data.currencyPolicy !== undefined) {
            updateData.currencyPolicy = data.currencyPolicy;
        }
        if (data.fixedCurrencyCode !== undefined || data.currency !== undefined) {
            updateData.fixedCurrencyCode = data.fixedCurrencyCode || data.currency;
        }
        if (data.allowedCurrencyCodes !== undefined) {
            updateData.allowedCurrencyCodes = data.allowedCurrencyCodes;
        }
        if (data.parentId !== undefined) {
            updateData.parentId = data.parentId;
        }
        if (data.isProtected !== undefined) {
            updateData.isProtected = data.isProtected;
        }
        if (data.cashFlowCategory !== undefined) {
            updateData.cashFlowCategory = data.cashFlowCategory;
        }
        if (data.plSubgroup !== undefined) {
            updateData.plSubgroup = data.plSubgroup;
        }
        if (data.equitySubgroup !== undefined) {
            updateData.equitySubgroup = data.equitySubgroup;
        }
        if (data.requiresApproval !== undefined) {
            updateData.requiresApproval = data.requiresApproval;
        }
        if (data.requiresCustodyConfirmation !== undefined) {
            updateData.requiresCustodyConfirmation = data.requiresCustodyConfirmation;
        }
        if (data.custodianUserId !== undefined) {
            updateData.custodianUserId = data.custodianUserId;
        }
        updateData.updatedBy = data.updatedBy || 'SYSTEM';
        const record = await this.prisma.account.update({
            where: { id: accountId, companyId },
            data: updateData,
            include: { _count: { select: { children: true } } },
        });
        return this.toDomain(record);
    }
    async delete(companyId, accountId) {
        await this.prisma.account.delete({
            where: { id: accountId, companyId },
        });
    }
    async deactivate(companyId, accountId) {
        await this.prisma.account.update({
            where: { id: accountId, companyId },
            data: { status: 'INACTIVE', updatedBy: 'SYSTEM' },
        });
    }
    // =========================================================================
    // VALIDATION/CHECK METHODS
    // =========================================================================
    async isUsed(companyId, accountId) {
        const [ledgerCount, voucherLineCount] = await Promise.all([
            this.prisma.ledgerEntry.count({
                where: { companyId, accountId },
            }),
            this.prisma.voucherLine.count({
                where: { accountId },
            }),
        ]);
        return ledgerCount > 0 || voucherLineCount > 0;
    }
    async hasChildren(companyId, accountId) {
        const count = await this.prisma.account.count({
            where: { companyId, parentId: accountId },
        });
        return count > 0;
    }
    async countChildren(companyId, accountId) {
        return this.prisma.account.count({
            where: { companyId, parentId: accountId },
        });
    }
    async existsByUserCode(companyId, userCode, excludeAccountId) {
        const where = { companyId, userCode };
        if (excludeAccountId) {
            where.id = { not: excludeAccountId };
        }
        const count = await this.prisma.account.count({ where });
        return count > 0;
    }
    async generateNextSystemCode(companyId) {
        const counter = await this.prisma.account.count({
            where: { companyId },
        });
        const nextNumber = counter + 1;
        return `ACC-${String(nextNumber).padStart(6, '0')}`;
    }
    async countByCurrency(companyId, currencyCode) {
        return this.prisma.account.count({
            where: {
                companyId,
                fixedCurrencyCode: currencyCode.toUpperCase(),
            },
        });
    }
    // =========================================================================
    // AUDIT METHODS
    // =========================================================================
    async recordAuditEvent(companyId, accountId, event) {
        await this.prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                company: { connect: { id: companyId } },
                entityType: 'Account',
                entityId: accountId,
                action: event.type,
                fieldName: event.field,
                oldValue: event.oldValue,
                newValue: event.newValue,
                performedBy: event.changedBy,
                performedAt: event.changedAt,
            },
        });
    }
    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================
    getDefaultBalanceNature(classification) {
        switch (classification) {
            case 'ASSET':
            case 'EXPENSE':
                return 'DEBIT';
            case 'LIABILITY':
            case 'EQUITY':
            case 'REVENUE':
                return 'CREDIT';
            default:
                return 'DEBIT';
        }
    }
}
exports.PrismaAccountRepository = PrismaAccountRepository;
//# sourceMappingURL=PrismaAccountRepository.js.map