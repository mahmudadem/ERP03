"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaImpersonationRepository = void 0;
const ImpersonationSession_1 = require("../../../../domain/impersonation/ImpersonationSession");
class PrismaImpersonationRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async startSession(superAdminId, companyId) {
        const record = await this.prisma.impersonationSession.create({
            data: {
                id: crypto.randomUUID(),
                superAdminId,
                companyId,
                active: true,
                createdAt: new Date(),
            },
        });
        return this.toDomain(record);
    }
    async getSession(sessionId) {
        const record = await this.prisma.impersonationSession.findUnique({
            where: { id: sessionId },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async endSession(sessionId) {
        await this.prisma.impersonationSession.update({
            where: { id: sessionId },
            data: {
                active: false,
                endedAt: new Date(),
            },
        });
    }
    async getActiveSessionBySuperAdmin(superAdminId) {
        const record = await this.prisma.impersonationSession.findFirst({
            where: {
                superAdminId,
                active: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    toDomain(record) {
        var _a;
        return new ImpersonationSession_1.ImpersonationSession(record.id, record.superAdminId, record.companyId, record.active, record.createdAt, (_a = record.endedAt) !== null && _a !== void 0 ? _a : undefined);
    }
}
exports.PrismaImpersonationRepository = PrismaImpersonationRepository;
//# sourceMappingURL=PrismaImpersonationRepository.js.map