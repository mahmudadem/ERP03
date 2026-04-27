/**
 * CreateCompanyUseCase.ts
 * 
 * Purpose: Handling direct company creation from the fast onboarding wizard.
 * Bypasses the session-based multi-step wizard logic.
 */

import { Company } from '../../../domain/core/entities/Company';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { ICompanyUserRepository as IRbacCompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRolePermissionResolver } from '../../rbac/CompanyRolePermissionResolver';
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { CompanyModuleEntity } from '../../../domain/company/entities/CompanyModule';
import { ApiError } from '../../../api/errors/ApiError';
import { ICompanySettingsRepository } from '../../../repository/interfaces/core/ICompanySettingsRepository';
import { ICompanyEntitlementRepository, IBundleItemRepository } from '../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { CompanyEntitlement, CompanyEntitlementItem } from '../../../domain/super-admin/EntitlementDefinition';

interface Input {
  userId: string;
  companyName: string;
  description?: string;
  country: string;
  email: string;
  bundleId: string;
  logoData?: string;
  timezone?: string;
  currency?: string;
  language?: string;
  dateFormat?: string;
}

export class CreateCompanyUseCase {
  constructor(
    private companyRepo: ICompanyRepository,
    private userRepo: IUserRepository,
    private rbacCompanyUserRepo: IRbacCompanyUserRepository,
    private rbacCompanyRoleRepo: ICompanyRoleRepository,
    private rolePermissionResolver: CompanyRolePermissionResolver,
    private bundleRepo: IBundleRegistryRepository,
    private bundleItemRepo: IBundleItemRepository,
    private companyModuleRepo: ICompanyModuleRepository,
    private companySettingsRepo: ICompanySettingsRepository,
    private entitlementRepo: ICompanyEntitlementRepository
  ) { }

  private generateId(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async execute(input: Input): Promise<{ companyId: string }> {
    const user = await this.userRepo.getUserById(input.userId);
    if (!user) throw ApiError.unauthorized('User not found');

    // Check for duplicates
    const existing = await this.companyRepo.findByNameAndOwner(input.companyName, input.userId);
    if (existing) {
      throw ApiError.conflict(`You already have a company named "${input.companyName}". Please choose a different name.`);
    }

    const bundle = await this.bundleRepo.getById(input.bundleId);
    if (!bundle) throw ApiError.badRequest('Invalid bundle selected');

    if (bundle.lifecycleStatus !== 'ready') {
      throw ApiError.badRequest(`Bundle '${bundle.name}' is not available. Please select a ready bundle.`);
    }

    const bundleItems = await this.bundleItemRepo.getByBundleId(input.bundleId);
    const bundleModules = bundleItems.filter(i => i.itemType === 'module').map(i => i.itemKey);
    const bundleCapabilities = bundleItems.filter(i => i.itemType === 'capability').map(i => i.itemKey);

    const now = new Date();
    const fiscalYearStart = new Date(now.getFullYear(), 0, 1);
    const fiscalYearEnd = new Date(now.getFullYear(), 11, 31);

    const company = new Company(
      this.generateId('cmp'),
      input.companyName,
      input.userId,
      now,
      now,
      input.currency || '',
      fiscalYearStart,
      fiscalYearEnd,
      bundleModules,
      [],
      '',
      input.bundleId,
      undefined,
      input.country,
      input.logoData,
      { email: input.email }
    );

    // Track what we've created for rollback purposes
    let companyCreated = false;
    let rolesCreated = false;
    let userRoleAssigned = false;
    let modulesCreated = false;
    let entitlementCreated = false;

    try {
      // Step 1: Save company
      console.log('[CreateCompanyUseCase] Saving company:', company.id);
      await this.companyRepo.save(company);
      companyCreated = true;
      console.log('[CreateCompanyUseCase] Company saved successfully');

      // Step 2: Create entitlement from normalized BundleItem
      console.log('[CreateCompanyUseCase] Creating entitlement from bundle:', input.bundleId);
      
      const entitlementItems: CompanyEntitlementItem[] = [
        ...bundleModules.map((moduleCode) => ({
          id: `item_${company.id}_${moduleCode}`,
          entitlementId: `ent_${company.id}`,
          itemType: 'module' as const,
          itemKey: moduleCode,
          createdAt: now,
        })),
        ...bundleCapabilities.map((capabilityCode) => ({
          id: `item_${company.id}_${capabilityCode}`,
          entitlementId: `ent_${company.id}`,
          itemType: 'capability' as const,
          itemKey: capabilityCode,
          createdAt: now,
        })),
      ];

      const entitlement: CompanyEntitlement = {
        id: `ent_${company.id}`,
        companyId: company.id,
        sourceType: 'bundle',
        sourceId: input.bundleId,
        validFrom: now,
        isActive: true,
        items: entitlementItems,
        createdAt: now,
        updatedAt: now,
      };

      await this.entitlementRepo.createEntitlement(entitlement);
      entitlementCreated = true;
      console.log('[CreateCompanyUseCase] Entitlement created with items:', entitlementItems.length);

      // Get effective modules for roles (excluding platform modules)
      const effectiveModules = await this.entitlementRepo.getEffectiveModules(company.id);
      const finalModules = effectiveModules;

      console.log('[CreateCompanyUseCase] Effective modules for roles:', finalModules);

      // Initialize company settings with defaults from wizard
      await this.companySettingsRepo.updateSettings(company.id, {
        timezone: input.timezone || 'UTC',
        dateFormat: input.dateFormat || 'MM/DD/YYYY',
        language: input.language || 'en',
        baseCurrency: input.currency || '',
        uiMode: 'windows'
      });

      // Initialize Roles (OWNER, ADMIN, MEMBER)
      const rolesToCreate = [
        { id: 'OWNER', name: 'Owner', system: true, modules: finalModules, permissions: ['*'] },
        { id: 'ADMIN', name: 'Administrator', system: true, modules: finalModules, permissions: [] },
        { id: 'MEMBER', name: 'Member', system: false, modules: [], permissions: [] }
      ];

      console.log('[CreateCompanyUseCase] Creating roles');
      for (const roleDef of rolesToCreate) {
         let role = await this.rbacCompanyRoleRepo.getById(company.id, roleDef.id);
         if (!role) {
            await this.rbacCompanyRoleRepo.create({
              id: roleDef.id,
              name: roleDef.name,
              isSystem: roleDef.system,
              permissions: [], // Base permissions field (legacy?) 
              moduleBundles: roleDef.modules,
              companyId: company.id,
              createdAt: now,
              updatedAt: now,
              explicitPermissions: roleDef.permissions,
              resolvedPermissions: []
            });
         } else {
            console.log(`[CreateCompanyUseCase] Role ${roleDef.id} already exists for company ${company.id}, skipping creation.`);
         }
      }
      rolesCreated = true;
      console.log('[CreateCompanyUseCase] Roles created successfully');

      // Resolve OWNER and ADMIN role permissions
      await this.rolePermissionResolver.resolveRoleById(company.id, 'OWNER');
      await this.rolePermissionResolver.resolveRoleById(company.id, 'ADMIN');

      // Assign OWNER role to user
      console.log('[CreateCompanyUseCase] Assigning OWNER role to user');
      await this.rbacCompanyUserRepo.assignRole({
        userId: input.userId,
        companyId: company.id,
        roleId: 'OWNER',
        isOwner: true,
        createdAt: now
      });
      userRoleAssigned = true;
      console.log('[CreateCompanyUseCase] User role assigned successfully');

      // Set as active company for user
      await this.userRepo.updateActiveCompany(input.userId, company.id);

      // Persist CompanyModule records for all installed modules
      console.log('[CreateCompanyUseCase] Creating module records for:', finalModules);
      const moduleRecords = finalModules.map(moduleCode => {
        console.log('[CreateCompanyUseCase] Creating module entity:', { companyId: company.id, moduleCode });
        return CompanyModuleEntity.create(company.id, moduleCode);
      });
      console.log('[CreateCompanyUseCase] Module records created:', moduleRecords.length);
      
      await this.companyModuleRepo.batchCreate(moduleRecords);
      modulesCreated = true;
      console.log('[CreateCompanyUseCase] Module records persisted successfully');

      console.log('[CreateCompanyUseCase] Company creation completed successfully');
      return { companyId: company.id };

    } catch (error: any) {
      console.error('[CreateCompanyUseCase] Company creation failed, initiating rollback...', error);

      // ROLLBACK: Clean up in reverse order
      try {
        if (modulesCreated) {
          console.log('[CreateCompanyUseCase] Rollback: Deleting module records');
          const finalModules = Array.from(new Set([...bundle.modulesIncluded, 'companyAdmin']));
          for (const moduleCode of finalModules) {
            try {
              await this.companyModuleRepo.delete(company.id, moduleCode);
            } catch (err) {
              console.error(`[CreateCompanyUseCase] Rollback failed for module ${moduleCode}:`, err);
            }
          }
        }

        if (userRoleAssigned) {
          console.log('[CreateCompanyUseCase] Rollback: Removing user role assignment');
          // TODO: Implement removeRole method in repository
          console.warn('[CreateCompanyUseCase] User role removal not implemented - manual cleanup may be needed');
          // try {
          //   await this.rbacCompanyUserRepo.removeRole(input.userId, company.id);
          // } catch (err) {
          //   console.error('[CreateCompanyUseCase] Rollback failed for user role:', err);
          // }
        }

        if (rolesCreated) {
          console.log('[CreateCompanyUseCase] Rollback: Deleting roles');
          const rolesToDelete = ['OWNER', 'ADMIN', 'MEMBER'];
          for (const roleId of rolesToDelete) {
            try {
              await this.rbacCompanyRoleRepo.delete(company.id, roleId);
            } catch (err) {
              console.error(`[CreateCompanyUseCase] Rollback failed for role ${roleId}:`, err);
            }
          }
        }

        if (companyCreated) {
          console.log('[CreateCompanyUseCase] Rollback: Deleting company');
          try {
            await this.companyRepo.delete(company.id);
            console.log('[CreateCompanyUseCase] Company deleted successfully');
          } catch (err) {
            console.error('[CreateCompanyUseCase] Rollback failed for company:', err);
          }
        }

        if (entitlementCreated) {
          console.log('[CreateCompanyUseCase] Rollback: Deleting entitlement');
          try {
            await this.entitlementRepo.deactivateEntitlement(`ent_${company.id}`);
            console.log('[CreateCompanyUseCase] Entitlement deactivated successfully');
          } catch (err) {
            console.error('[CreateCompanyUseCase] Rollback failed for entitlement:', err);
          }
        }

        console.log('[CreateCompanyUseCase] Rollback completed');
      } catch (rollbackError) {
        console.error('[CreateCompanyUseCase] CRITICAL: Rollback itself failed:', rollbackError);
      }

      // Re-throw the original error with more context
      throw new Error(`Company creation failed: ${error?.message || error}. Rollback completed.`);
    }
  }
}
