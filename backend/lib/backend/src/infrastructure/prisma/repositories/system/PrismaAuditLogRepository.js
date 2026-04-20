"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaAuditLogRepository = void 0;
const AuditLog_1 = require("../../../../domain/system/entities/AuditLog");
class PrismaAuditLogRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return new AuditLog_1.AuditLog(data.id, data.action, data.entityType, data.entityId, data.userId, data.timestamp, data.meta || undefined);
    }
    async log(entry) {
        await this.prisma.auditLog.create({
            data: {
                id: entry.id,
                action: entry.action,
                entityType: entry.entityType,
                entityId: entry.entityId,
                userId: entry.userId,
                timestamp: entry.timestamp,
                meta: entry.meta,
            },
        });
    }
    async getLogs(companyId, filters) {
        const where = { companyId };
        if (filters) {
            if (filters.userId) {
                where.userId = filters.userId;
            }
            if (filters.action) {
                where.action = filters.action;
            }
            if (filters.entityType) {
                where.entityType = filters.entityType;
            }
            if (filters.entityId) {
                where.entityId = filters.entityId;
            }
            if (filters.startDate) {
                where.timestamp = Object.assign(Object.assign({}, where.timestamp), { gte: new Date(filters.startDate) });
            }
            if (filters.endDate) {
                where.timestamp = Object.assign(Object.assign({}, where.timestamp), { lte: new Date(filters.endDate) });
            }
        }
        const orderBy = { timestamp: 'desc' };
        if (filters === null || filters === void 0 ? void 0 : filters.orderBy) {
            orderBy.timestamp = filters.orderBy === 'asc' ? 'asc' : 'desc';
        }
        const data = await this.prisma.auditLog.findMany({
            where,
            orderBy,
            take: (filters === null || filters === void 0 ? void 0 : filters.limit) ? parseInt(filters.limit, 10) : undefined,
            skip: (filters === null || filters === void 0 ? void 0 : filters.offset) ? parseInt(filters.offset, 10) : undefined,
        });
        return data.map((d) => this.toDomain(d));
    }
}
exports.PrismaAuditLogRepository = PrismaAuditLogRepository;
//# sourceMappingURL=PrismaAuditLogRepository.js.map