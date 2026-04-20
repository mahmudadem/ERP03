"use strict";
/**
 * PrismaRbacCompanyUserRepository
 * Prisma (SQL) implementation of ICompanyUserRepository for RBAC module
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaRbacCompanyUserRepository = void 0;
class PrismaRbacCompanyUserRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(companyId, userId) {
        const record = await this.prisma.companyUser.findUnique({
            where: { userId_companyId: { userId, companyId } }
        });
        if (!record)
            return null;
        return {
            userId: record.userId,
            companyId: record.companyId,
            roleId: record.roleId || '',
            isOwner: record.isOwner,
            createdAt: record.createdAt,
            isDisabled: record.isDisabled || false
        };
    }
    async getByUserAndCompany(userId, companyId) {
        return this.get(companyId, userId);
    }
    async getByCompany(companyId) {
        const records = await this.prisma.companyUser.findMany({
            where: { companyId }
        });
        return records.map(r => ({
            userId: r.userId,
            companyId: r.companyId,
            roleId: r.roleId || '',
            isOwner: r.isOwner,
            createdAt: r.createdAt,
            isDisabled: r.isDisabled || false
        }));
    }
    async getByRole(companyId, roleId) {
        const records = await this.prisma.companyUser.findMany({
            where: { companyId, roleId }
        });
        return records.map(r => ({
            userId: r.userId,
            companyId: r.companyId,
            roleId: r.roleId || '',
            isOwner: r.isOwner,
            createdAt: r.createdAt,
            isDisabled: r.isDisabled || false
        }));
    }
    async getMembershipsByUser(userId) {
        const records = await this.prisma.companyUser.findMany({
            where: { userId }
        });
        return records.map(r => ({
            userId: r.userId,
            companyId: r.companyId,
            roleId: r.roleId || '',
            isOwner: r.isOwner,
            createdAt: r.createdAt,
            isDisabled: r.isDisabled || false
        }));
    }
    async assignRole(companyUser) {
        await this.prisma.companyUser.upsert({
            where: {
                userId_companyId: {
                    userId: companyUser.userId,
                    companyId: companyUser.companyId
                }
            },
            create: {
                userId: companyUser.userId,
                companyId: companyUser.companyId,
                roleId: companyUser.roleId,
                isOwner: companyUser.isOwner || false
            },
            update: {
                roleId: companyUser.roleId
            }
        });
    }
    async removeRole(userId, companyId) {
        await this.prisma.companyUser.delete({
            where: { userId_companyId: { userId, companyId } }
        });
    }
    async create(companyUser) {
        await this.prisma.companyUser.create({
            data: {
                userId: companyUser.userId,
                companyId: companyUser.companyId,
                roleId: companyUser.roleId,
                isOwner: companyUser.isOwner || false
            }
        });
    }
    async update(userId, companyId, updates) {
        const data = {};
        if (updates.roleId !== undefined)
            data.roleId = updates.roleId;
        if (updates.isOwner !== undefined)
            data.isOwner = updates.isOwner;
        if (updates.isDisabled !== undefined)
            data.isDisabled = updates.isDisabled;
        await this.prisma.companyUser.update({
            where: { userId_companyId: { userId, companyId } },
            data
        });
    }
    async delete(companyId, userId) {
        await this.prisma.companyUser.delete({
            where: { userId_companyId: { userId, companyId } }
        });
    }
}
exports.PrismaRbacCompanyUserRepository = PrismaRbacCompanyUserRepository;
//# sourceMappingURL=PrismaRbacCompanyUserRepository.js.map