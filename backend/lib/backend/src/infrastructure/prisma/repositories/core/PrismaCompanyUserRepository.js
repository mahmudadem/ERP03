"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyUserRepository = void 0;
const CompanyUser_1 = require("../../../../domain/core/entities/CompanyUser");
class PrismaCompanyUserRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return new CompanyUser_1.CompanyUser(`${data.userId}_${data.companyId}`, data.userId, data.companyId, data.role || '', data.permissions || [], data.isDisabled || false);
    }
    async assignUserToCompany(userId, companyId, role) {
        await this.prisma.companyUser.upsert({
            where: {
                userId_companyId: { userId, companyId },
            },
            create: {
                userId,
                companyId,
                role,
                permissions: [],
                isDisabled: false,
            },
            update: {
                role,
            },
        });
    }
    async getCompanyUsers(companyId) {
        const data = await this.prisma.companyUser.findMany({
            where: { companyId },
        });
        return data.map((d) => this.toDomain(d));
    }
    async getUserMembership(userId, companyId) {
        const data = await this.prisma.companyUser.findUnique({
            where: {
                userId_companyId: { userId, companyId },
            },
        });
        if (!data)
            return null;
        return this.toDomain(data);
    }
}
exports.PrismaCompanyUserRepository = PrismaCompanyUserRepository;
//# sourceMappingURL=PrismaCompanyUserRepository.js.map