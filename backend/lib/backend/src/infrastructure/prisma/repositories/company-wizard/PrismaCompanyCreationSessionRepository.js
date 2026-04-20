"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyCreationSessionRepository = void 0;
class PrismaCompanyCreationSessionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(session) {
        await this.prisma.companyCreationSession.create({
            data: {
                id: session.id,
                userId: session.userId,
                status: 'IN_PROGRESS',
                data: session.data,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            },
        });
    }
    async update(session) {
        await this.prisma.companyCreationSession.update({
            where: { id: session.id },
            data: {
                status: 'IN_PROGRESS',
                data: session.data,
                updatedAt: session.updatedAt,
            },
        });
    }
    async getById(id) {
        const record = await this.prisma.companyCreationSession.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async delete(id) {
        await this.prisma.companyCreationSession.delete({
            where: { id },
        });
    }
    toDomain(record) {
        var _a, _b, _c;
        const data = record.data;
        return {
            id: record.id,
            userId: record.userId,
            model: (_a = data.model) !== null && _a !== void 0 ? _a : '',
            templateId: (_b = data.templateId) !== null && _b !== void 0 ? _b : '',
            currentStepId: (_c = data.currentStepId) !== null && _c !== void 0 ? _c : '',
            data,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaCompanyCreationSessionRepository = PrismaCompanyCreationSessionRepository;
//# sourceMappingURL=PrismaCompanyCreationSessionRepository.js.map