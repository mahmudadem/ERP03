"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaUserRepository = void 0;
const User_1 = require("../../../../domain/core/entities/User");
class PrismaUserRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return new User_1.User(data.id, data.email, data.name || '', data.globalRole, data.createdAt, data.pictureUrl || undefined, data.planId || undefined, data.activeCompanyId || undefined);
    }
    async getUserById(userId) {
        const data = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!data)
            return null;
        return this.toDomain(data);
    }
    async createUser(user) {
        await this.prisma.user.create({
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                globalRole: user.globalRole,
                pictureUrl: user.pictureUrl || null,
                planId: user.planId || null,
                activeCompanyId: user.activeCompanyId || null,
            },
        });
    }
    async updateUser(userId, data) {
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.pictureUrl !== undefined)
            updateData.pictureUrl = data.pictureUrl;
        if (data.planId !== undefined)
            updateData.planId = data.planId;
        if (data.activeCompanyId !== undefined)
            updateData.activeCompanyId = data.activeCompanyId;
        await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
        });
    }
    async updateGlobalRole(userId, newRole) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { globalRole: newRole },
        });
    }
    async updateActiveCompany(userId, companyId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { activeCompanyId: companyId },
        });
    }
    async findByEmail(email) {
        const data = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!data)
            return null;
        return this.toDomain(data);
    }
    async getUserActiveCompany(userId) {
        const data = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { activeCompanyId: true },
        });
        return (data === null || data === void 0 ? void 0 : data.activeCompanyId) || null;
    }
    async listAll() {
        const data = await this.prisma.user.findMany();
        return data.map((d) => this.toDomain(d));
    }
    async updatePlan(userId, planId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { planId },
        });
    }
}
exports.PrismaUserRepository = PrismaUserRepository;
//# sourceMappingURL=PrismaUserRepository.js.map