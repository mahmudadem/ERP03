"use strict";
/**
 * CreateCompanyUseCase.ts
 *
 * Purpose: Handling direct company creation from the fast onboarding wizard.
 * Bypasses the session-based multi-step wizard logic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCompanyUseCase = void 0;
const Company_1 = require("../../../domain/core/entities/Company");
const CompanyModule_1 = require("../../../domain/company/entities/CompanyModule");
const ApiError_1 = require("../../../api/errors/ApiError");
class CreateCompanyUseCase {
    constructor(companyRepo, userRepo, rbacCompanyUserRepo, rbacCompanyRoleRepo, rolePermissionResolver, 
    // private voucherTypeRepo: IVoucherTypeDefinitionRepository, // TODO: Re-enable when implementing voucher template copy
    bundleRepo, companyModuleRepo) {
        this.companyRepo = companyRepo;
        this.userRepo = userRepo;
        this.rbacCompanyUserRepo = rbacCompanyUserRepo;
        this.rbacCompanyRoleRepo = rbacCompanyRoleRepo;
        this.rolePermissionResolver = rolePermissionResolver;
        this.bundleRepo = bundleRepo;
        this.companyModuleRepo = companyModuleRepo;
    }
    generateId(prefix) {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
    async execute(input) {
        const user = await this.userRepo.getUserById(input.userId);
        if (!user)
            throw ApiError_1.ApiError.unauthorized('User not found');
        // Check for duplicates
        const existing = await this.companyRepo.findByNameAndOwner(input.companyName, input.userId);
        if (existing) {
            throw ApiError_1.ApiError.conflict(`You already have a company named "${input.companyName}". Please choose a different name.`);
        }
        const bundle = await this.bundleRepo.getById(input.bundleId);
        if (!bundle)
            throw ApiError_1.ApiError.badRequest('Invalid bundle selected');
        const now = new Date();
        // Default fiscal year: Jan 1 to Dec 31
        const fiscalYearStart = new Date(now.getFullYear(), 0, 1);
        const fiscalYearEnd = new Date(now.getFullYear(), 11, 31);
        const company = new Company_1.Company(this.generateId('cmp'), input.companyName, input.userId, now, now, 'USD', // Default currency
        fiscalYearStart, fiscalYearEnd, Array.from(new Set([...bundle.modulesIncluded, 'companyAdmin'])), // Force 'companyAdmin' module
        [], // features
        '', // Tax ID optional
        bundle.name, // Subscription Plan / Bundle Name
        undefined, // Address
        input.country, undefined, // Logo URL
        { email: input.email } // Contact Info
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
                        permissions: [],
                        moduleBundles: roleDef.modules,
                        companyId: company.id,
                        createdAt: now,
                        updatedAt: now,
                        explicitPermissions: roleDef.permissions,
                        resolvedPermissions: []
                    });
                }
                else {
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
                return CompanyModule_1.CompanyModuleEntity.create(company.id, moduleCode);
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
        }
        catch (error) {
            console.error('[CreateCompanyUseCase] Company creation failed, initiating rollback...', error);
            // ROLLBACK: Clean up in reverse order
            try {
                if (modulesCreated) {
                    console.log('[CreateCompanyUseCase] Rollback: Deleting module records');
                    const finalModules = Array.from(new Set([...bundle.modulesIncluded, 'companyAdmin']));
                    for (const moduleCode of finalModules) {
                        try {
                            await this.companyModuleRepo.delete(company.id, moduleCode);
                        }
                        catch (err) {
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
                        }
                        catch (err) {
                            console.error(`[CreateCompanyUseCase] Rollback failed for role ${roleId}:`, err);
                        }
                    }
                }
                if (companyCreated) {
                    console.log('[CreateCompanyUseCase] Rollback: Deleting company');
                    try {
                        await this.companyRepo.delete(company.id);
                        console.log('[CreateCompanyUseCase] Company deleted successfully');
                    }
                    catch (err) {
                        console.error('[CreateCompanyUseCase] Rollback failed for company:', err);
                    }
                }
                console.log('[CreateCompanyUseCase] Rollback completed');
            }
            catch (rollbackError) {
                console.error('[CreateCompanyUseCase] CRITICAL: Rollback itself failed:', rollbackError);
            }
            // Re-throw the original error with more context
            throw new Error(`Company creation failed: ${(error === null || error === void 0 ? void 0 : error.message) || error}. Rollback completed.`);
        }
    }
}
exports.CreateCompanyUseCase = CreateCompanyUseCase;
//# sourceMappingURL=CreateCompanyUseCase.js.map