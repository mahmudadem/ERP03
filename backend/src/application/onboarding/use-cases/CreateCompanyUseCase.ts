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
// import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository'; // TODO: Re-enable
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { CompanyModuleEntity } from '../../../domain/company/entities/CompanyModule';
import { ApiError } from '../../../api/errors/ApiError';
import { ICompanySettingsRepository } from '../../../repository/interfaces/core/ICompanySettingsRepository';
import { CompanySettings } from '../../../domain/core/entities/CompanySettings';

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
    // private voucherTypeRepo: IVoucherTypeDefinitionRepository, // TODO: Re-enable when implementing voucher template copy
    private bundleRepo: IBundleRegistryRepository,
    private companyModuleRepo: ICompanyModuleRepository,
    private companySettingsRepo: ICompanySettingsRepository
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

    const now = new Date();
    // Default fiscal year: Jan 1 to Dec 31
    const fiscalYearStart = new Date(now.getFullYear(), 0, 1);
    const fiscalYearEnd = new Date(now.getFullYear(), 11, 31);

    const company = new Company(
      this.generateId('cmp'),
      input.companyName,
      input.userId,
      now,
      now,
      input.currency || 'USD', // Use input currency or default
      fiscalYearStart,
      fiscalYearEnd,
      Array.from(new Set([...bundle.modulesIncluded, 'companyAdmin'])), // Force 'companyAdmin' module
      [], // features
      '', // Tax ID optional
      bundle.name, // Subscription Plan / Bundle Name
      undefined, // Address
      input.country,
      input.logoData, // Logo URL (storing direct B64 for now)
      { email: input.email } // Contact Info - Fixed object literal
    );

    // Track what we've created for rollback purposes
    let companyCreated = false;
    let rolesCreated = false;
    let userRoleAssigned = false;
    let modulesCreated = false;

    try {
      // Step 1: Save company
      console.log('[CreateCompanyUseCase] Saving company:', company.id);
      await this.companyRepo.save(company);
      companyCreated = true;
      console.log('[CreateCompanyUseCase] Company saved successfully');

      // Initialize company settings with defaults from wizard
      await this.companySettingsRepo.updateSettings(company.id, {
        timezone: input.timezone || 'UTC',
        dateFormat: input.dateFormat || 'MM/DD/YYYY',
        language: input.language || 'en',
        uiMode: 'windows'
      });

      // Initialize Roles (OWNER, ADMIN, MEMBER)
      const finalModules = Array.from(new Set([...bundle.modulesIncluded, 'companyAdmin']));
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

      // Copy system voucher templates (DISABLED - method doesn't exist yet)
      // TODO: Re-enable when voucherTypeRepo.createVoucherType is available
      console.log('[CreateCompanyUseCase] Skipping voucher template copy (not implemented)');
      // try {
      //   const systemTemplates = await this.voucherTypeRepo.getSystemTemplates();
      //   for (const template of systemTemplates) {
      //     const newTemplate = {
      //       ...template,
      //       id: this.generateId('vtd'),
      //       companyId: company.id,
      //       isSystemTemplate: false
      //     };
      //     await this.voucherTypeRepo.createVoucherType(newTemplate);
      //   }
      // } catch (templateError) {
      //   console.warn('[CreateCompanyUseCase] Failed to copy voucher templates (non-critical):', templateError);
      // }

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

        console.log('[CreateCompanyUseCase] Rollback completed');
      } catch (rollbackError) {
        console.error('[CreateCompanyUseCase] CRITICAL: Rollback itself failed:', rollbackError);
      }

      // Re-throw the original error with more context
      throw new Error(`Company creation failed: ${error?.message || error}. Rollback completed.`);
    }
  }
}
