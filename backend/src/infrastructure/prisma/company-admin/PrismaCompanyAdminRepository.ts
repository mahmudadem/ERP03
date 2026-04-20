/**
 * PrismaCompanyAdminRepository
 * Prisma (SQL) implementation of ICompanyAdminRepository
 */

import { ICompanyAdminRepository, UserInvitation, Invitation } from '../../../repository/interfaces/company-admin/ICompanyAdminRepository';
import { Company } from '../../../domain/core/entities/Company';
import { CompanyUser } from '../../../domain/rbac/CompanyUser';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';
import { PrismaClient, Prisma } from '@prisma/client';

export class PrismaCompanyAdminRepository implements ICompanyAdminRepository {
  
  constructor(private prisma: PrismaClient) {}
  
  // ============================================================================
  // PROFILE MANAGEMENT
  // ============================================================================
  
  async updateProfile(companyId: string, updates: Partial<Company>): Promise<Company> {
    const data: any = { ...updates };
    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: data as any
    });

    return new Company(
      updated.id,
      updated.name,
      updated.ownerId,
      updated.createdAt,
      updated.updatedAt,
      updated.baseCurrency,
      updated.fiscalYearStart,
      updated.fiscalYearEnd,
      updated.modules as any,
      (updated as any).features || [],
      updated.taxId,
      (updated as any).subscriptionPlan || undefined,
      updated.address || undefined,
      (updated as any).country || undefined,
      (updated as any).logoUrl || undefined,
      (updated as any).contactInfo || undefined
    );
  }
  
  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================
  
  async getCompanyUsers(companyId: string): Promise<CompanyUser[]> {
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
    } as CompanyUser));
  }
  
  async inviteUser(companyId: string, invitation: UserInvitation): Promise<Invitation> {
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
  
  async updateUserRole(companyId: string, userId: string, roleId: string): Promise<CompanyUser> {
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
    } as CompanyUser;
  }
  
  async disableUser(companyId: string, userId: string): Promise<void> {
    await this.prisma.companyUser.update({
      where: { userId_companyId: { userId, companyId } },
      data: { isDisabled: true }
    });
  }
  
  async enableUser(companyId: string, userId: string): Promise<void> {
    await this.prisma.companyUser.update({
      where: { userId_companyId: { userId, companyId } },
      data: { isDisabled: false }
    });
  }
  
  // ============================================================================
  // ROLE MANAGEMENT
  // ============================================================================
  
  async getRoles(companyId: string): Promise<CompanyRole[]> {
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
    } as unknown as CompanyRole));
  }
  
  async createRole(role: CompanyRole): Promise<CompanyRole> {
    await this.prisma.companyRole.create({
      data: {
        id: (role as any).id,
        companyId: (role as any).companyId,
        name: (role as any).name,
        moduleBundles: (role as any).moduleBundles || [],
        resolvedPermissions: (role as any).resolvedPermissions || [],
        permissions: (role as any).explicitPermissions || []
      }
    });

    return role;
  }
  
  async updateRole(companyId: string, roleId: string, updates: Partial<CompanyRole>): Promise<CompanyRole> {
    const data: Prisma.CompanyRoleUpdateInput = {};
    if ((updates as any).name !== undefined) data.name = (updates as any).name;
    if ((updates as any).moduleBundles !== undefined) data.moduleBundles = (updates as any).moduleBundles as any;
    if ((updates as any).resolvedPermissions !== undefined) data.resolvedPermissions = (updates as any).resolvedPermissions as any;
    if ((updates as any).explicitPermissions !== undefined) data.permissions = (updates as any).explicitPermissions as any;

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
    } as unknown as CompanyRole;
  }
  
  async deleteRole(companyId: string, roleId: string): Promise<void> {
    await this.prisma.companyRole.delete({
      where: { id: roleId, companyId }
    });
  }
  
  // ============================================================================
  // MODULE MANAGEMENT
  // ============================================================================
  
  async getAvailableModules(bundleId: string): Promise<string[]> {
    const bundle = await this.prisma.bundleRegistry.findUnique({
      where: { code: bundleId }
    });

    if (!bundle) return [];
    return (bundle.modules as string[]) || [];
  }
  
  async enableModule(companyId: string, moduleName: string): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error('Company not found');

    const modules = [...((company.modules as any[]) || [])];
    if (!modules.includes(moduleName)) {
      modules.push(moduleName);
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { modules: modules as any }
    });
  }
  
  async disableModule(companyId: string, moduleName: string): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return;

    const modules = ((company.modules as any[]) || []).filter((m: string) => m !== moduleName);
    await this.prisma.company.update({
      where: { id: companyId },
      data: { modules: modules as any }
    });
  }
  
  // ============================================================================
  // BUNDLE MANAGEMENT
  // ============================================================================
  
  async upgradeBundle(companyId: string, bundleId: string): Promise<Company> {
    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: { subscriptionPlan: bundleId } as any
    });

    return new Company(
      updated.id,
      updated.name,
      updated.ownerId,
      updated.createdAt,
      updated.updatedAt,
      updated.baseCurrency,
      updated.fiscalYearStart,
      updated.fiscalYearEnd,
      updated.modules as any,
      (updated as any).features || [],
      updated.taxId,
      (updated as any).subscriptionPlan || undefined,
      updated.address || undefined,
      (updated as any).country || undefined,
      (updated as any).logoUrl || undefined,
      (updated as any).contactInfo || undefined
    );
  }
  
  // ============================================================================
  // FEATURE FLAG MANAGEMENT
  // ============================================================================
  
  async getAvailableFeatures(bundleId: string): Promise<string[]> {
    const bundle = await this.prisma.bundleRegistry.findUnique({
      where: { code: bundleId }
    });

    if (!bundle) return [];
    return (bundle as any).features || [];
  }
  
  async toggleFeature(companyId: string, featureName: string, enabled: boolean): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error('Company not found');

    const features = [...((company as any).features || [])];
    const idx = features.indexOf(featureName);

    if (enabled && idx === -1) {
      features.push(featureName);
    } else if (!enabled && idx !== -1) {
      features.splice(idx, 1);
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { features: features as any }
    });
  }
}
