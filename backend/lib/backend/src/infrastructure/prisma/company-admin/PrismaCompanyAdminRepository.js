"use strict";
/**
 * PrismaCompanyAdminRepository
 * Prisma (SQL) implementation of ICompanyAdminRepository
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyAdminRepository = void 0;
const Company_1 = require("../../../domain/core/entities/Company");
class PrismaCompanyAdminRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ============================================================================
    // PROFILE MANAGEMENT
    // ============================================================================
    async updateProfile(companyId, updates) {
        const data = Object.assign({}, updates);
        const updated = await this.prisma.company.update({
            where: { id: companyId },
            data: data
        });
        return new Company_1.Company(updated.id, updated.name, updated.ownerId, updated.createdAt, updated.updatedAt, updated.baseCurrency, updated.fiscalYearStart, updated.fiscalYearEnd, updated.modules, updated.features || [], updated.taxId, updated.subscriptionPlan || undefined, updated.address || undefined, updated.country || undefined, updated.logoUrl || undefined, updated.contactInfo || undefined);
    }
    // ============================================================================
    // USER MANAGEMENT
    // ============================================================================
    async getCompanyUsers(companyId) {
        const records = await this.prisma.companyUser.findMany({
            where: { companyId },
            include: { user: true }
        });
        return records.map(r => ({
            userId: r.userId,
            companyId,
            roleId: r.roleId || '',
            isOwner: r.isOwner,
            createdAt: r.createdAt,
            isDisabled: r.isDisabled || false
        }));
    }
    async inviteUser(companyId, invitation) {
        const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        return {
            invitationId,
            email: invitation.email,
            roleId: invitation.roleId,
            status: 'pending',
            invitedAt: new Date(),
            expiresAt
        };
    }
    async updateUserRole(companyId, userId, roleId) {
        const updated = await this.prisma.companyUser.update({
            where: { userId_companyId: { userId, companyId } },
            data: { roleId }
        });
        return {
            userId: updated.userId,
            companyId,
            roleId: updated.roleId || '',
            isOwner: updated.isOwner,
            createdAt: updated.createdAt,
            isDisabled: updated.isDisabled || false
        };
    }
    async disableUser(companyId, userId) {
        await this.prisma.companyUser.update({
            where: { userId_companyId: { userId, companyId } },
            data: { isDisabled: true }
        });
    }
    async enableUser(companyId, userId) {
        await this.prisma.companyUser.update({
            where: { userId_companyId: { userId, companyId } },
            data: { isDisabled: false }
        });
    }
    // ============================================================================
    // ROLE MANAGEMENT
    // ============================================================================
    async getRoles(companyId) {
        const records = await this.prisma.companyRole.findMany({
            where: { companyId },
            orderBy: { name: 'asc' }
        });
        return records.map(r => ({
            id: r.id,
            companyId,
            name: r.name,
            moduleBundles: r.moduleBundles || [],
            resolvedPermissions: r.resolvedPermissions || [],
            explicitPermissions: r.permissions || [],
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }));
    }
    async createRole(role) {
        await this.prisma.companyRole.create({
            data: {
                id: role.id,
                companyId: role.companyId,
                name: role.name,
                moduleBundles: role.moduleBundles || [],
                resolvedPermissions: role.resolvedPermissions || [],
                permissions: role.explicitPermissions || []
            }
        });
        return role;
    }
    async updateRole(companyId, roleId, updates) {
        const data = {};
        if (updates.name !== undefined)
            data.name = updates.name;
        if (updates.moduleBundles !== undefined)
            data.moduleBundles = updates.moduleBundles;
        if (updates.resolvedPermissions !== undefined)
            data.resolvedPermissions = updates.resolvedPermissions;
        if (updates.explicitPermissions !== undefined)
            data.permissions = updates.explicitPermissions;
        const updated = await this.prisma.companyRole.update({
            where: { id: roleId },
            data
        });
        return {
            id: updated.id,
            companyId,
            name: updated.name,
            moduleBundles: updated.moduleBundles || [],
            resolvedPermissions: updated.resolvedPermissions || [],
            explicitPermissions: updated.permissions || [],
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt
        };
    }
    async deleteRole(companyId, roleId) {
        await this.prisma.companyRole.delete({
            where: { id: roleId, companyId }
        });
    }
    // ============================================================================
    // MODULE MANAGEMENT
    // ============================================================================
    async getAvailableModules(bundleId) {
        const bundle = await this.prisma.bundleRegistry.findUnique({
            where: { code: bundleId }
        });
        if (!bundle)
            return [];
        return bundle.modules || [];
    }
    async enableModule(companyId, moduleName) {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company)
            throw new Error('Company not found');
        const modules = [...(company.modules || [])];
        if (!modules.includes(moduleName)) {
            modules.push(moduleName);
        }
        await this.prisma.company.update({
            where: { id: companyId },
            data: { modules: modules }
        });
    }
    async disableModule(companyId, moduleName) {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company)
            return;
        const modules = (company.modules || []).filter((m) => m !== moduleName);
        await this.prisma.company.update({
            where: { id: companyId },
            data: { modules: modules }
        });
    }
    // ============================================================================
    // BUNDLE MANAGEMENT
    // ============================================================================
    async upgradeBundle(companyId, bundleId) {
        const updated = await this.prisma.company.update({
            where: { id: companyId },
            data: { subscriptionPlan: bundleId }
        });
        return new Company_1.Company(updated.id, updated.name, updated.ownerId, updated.createdAt, updated.updatedAt, updated.baseCurrency, updated.fiscalYearStart, updated.fiscalYearEnd, updated.modules, updated.features || [], updated.taxId, updated.subscriptionPlan || undefined, updated.address || undefined, updated.country || undefined, updated.logoUrl || undefined, updated.contactInfo || undefined);
    }
    // ============================================================================
    // FEATURE FLAG MANAGEMENT
    // ============================================================================
    async getAvailableFeatures(bundleId) {
        const bundle = await this.prisma.bundleRegistry.findUnique({
            where: { code: bundleId }
        });
        if (!bundle)
            return [];
        return bundle.features || [];
    }
    async toggleFeature(companyId, featureName, enabled) {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company)
            throw new Error('Company not found');
        const features = [...(company.features || [])];
        const idx = features.indexOf(featureName);
        if (enabled && idx === -1) {
            features.push(featureName);
        }
        else if (!enabled && idx !== -1) {
            features.splice(idx, 1);
        }
        await this.prisma.company.update({
            where: { id: companyId },
            data: { features: features }
        });
    }
}
exports.PrismaCompanyAdminRepository = PrismaCompanyAdminRepository;
//# sourceMappingURL=PrismaCompanyAdminRepository.js.map