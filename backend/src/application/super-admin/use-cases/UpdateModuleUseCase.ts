import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ICompanyEntitlementRepository } from '../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { IRoleTemplateRegistryRepository } from '../../../repository/interfaces/super-admin/IRoleTemplateRegistryRepository';
import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { IAuditLogRepository } from '../../../repository/interfaces/system/IAuditLogRepository';
import { AuditLog } from '../../../domain/system/entities/AuditLog';
import { ModuleDefinition } from '../../../domain/super-admin/ModuleDefinition';

interface UpdateModuleInput {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  releaseNotes?: string;
  lifecycleStatus?: 'draft' | 'ready' | 'deprecated' | 'inactive';
  runtimeStatus?: 'available' | 'suspended';
  suspendReason?: string;
  reason?: string;
  requestedBy?: string;
}

export class UpdateModuleUseCase {
  constructor(
    private moduleRepo: IModuleRegistryRepository,
    private companyRepository?: ICompanyRepository,
    private companyModuleRepository?: ICompanyModuleRepository,
    private entitlementRepository?: ICompanyEntitlementRepository,
    private bundleRegistryRepository?: IBundleRegistryRepository,
    private roleTemplateRegistryRepository?: IRoleTemplateRegistryRepository,
    private companyRoleRepository?: ICompanyRoleRepository,
    private auditLogRepository?: IAuditLogRepository
  ) {}

  async execute(input: UpdateModuleInput): Promise<void> {
    const { id, suspendReason, reason, requestedBy, ...updates } = input;

    const existing = await this.moduleRepo.getById(id);
    if (!existing) {
      throw new Error('Module not found');
    }

    if (updates.lifecycleStatus === 'ready' && existing.implementationStatus !== 'passed') {
      throw new Error('Cannot set lifecycleStatus to ready - implementation check must pass first');
    }

    if (updates.lifecycleStatus === 'inactive' && existing.lifecycleStatus !== 'inactive') {
      await this.assertCanDeactivate(existing);
    }

    if (updates.runtimeStatus === 'suspended' && existing.runtimeStatus !== 'suspended') {
      const normalizedReason = String(suspendReason || reason || '').trim();
      if (!normalizedReason) {
        throw new Error('Suspend reason is required');
      }
    }

    if (updates.runtimeStatus && updates.runtimeStatus !== existing.runtimeStatus && !this.auditLogRepository) {
      throw new Error('Audit repository is required for runtime status changes');
    }

    await this.moduleRepo.update(id, {
      ...updates,
      updatedAt: new Date(),
    });

    if (updates.runtimeStatus && updates.runtimeStatus !== existing.runtimeStatus) {
      await this.writeRuntimeStatusAudit(existing, updates.runtimeStatus, suspendReason || reason, requestedBy);
    }
  }

  private normalize(value: string | undefined | null): string {
    return String(value || '').trim().toLowerCase();
  }

  private permissionBelongsToModule(permission: string, moduleCode: string): boolean {
    const normalized = this.normalize(permission);
    return normalized === moduleCode || normalized.startsWith(`${moduleCode}.`);
  }

  private async assertCanDeactivate(module: ModuleDefinition): Promise<void> {
    const moduleCode = this.normalize(module.code || module.id);
    const blockers: string[] = [];

    if (this.bundleRegistryRepository) {
      const bundles = await this.bundleRegistryRepository.getAll();
      const blockingBundles = bundles.filter((bundle: any) => {
        const lifecycle = this.normalize(bundle.lifecycleStatus);
        if (!['ready', 'deprecated'].includes(lifecycle)) return false;

        const moduleItems = [
          ...(Array.isArray(bundle.modulesIncluded) ? bundle.modulesIncluded : []),
          ...(Array.isArray(bundle.items)
            ? bundle.items
                .filter((item: any) => item.itemType === 'module')
                .map((item: any) => item.itemKey)
            : []),
        ];

        return moduleItems.some((item) => this.normalize(item) === moduleCode);
      });

      if (blockingBundles.length > 0) {
        blockers.push(`${blockingBundles.length} ready/deprecated bundle(s) include this module`);
      }
    }

    if (this.roleTemplateRegistryRepository) {
      const templates = await this.roleTemplateRegistryRepository.getAll();
      const blockingTemplates = templates.filter((template) =>
        (template.permissions || []).some((permission) => this.permissionBelongsToModule(permission, moduleCode))
      );

      if (blockingTemplates.length > 0) {
        blockers.push(`${blockingTemplates.length} role template(s) depend on this module permissions`);
      }
    }

    if (this.companyRepository) {
      const companies = await this.companyRepository.listAll();
      let enabledCompanyCount = 0;
      let entitlementCount = 0;
      let companyRoleCount = 0;

      for (const company of companies) {
        if (this.companyModuleRepository) {
          const states = await this.companyModuleRepository.listByCompany(company.id);
          const hasModuleRecords = states.length > 0;
          const enabledByRecord = states.some(
            (state) => this.normalize(state.moduleCode) === moduleCode && state.isEnabled
          );
          const enabledByLegacyFallback = !hasModuleRecords &&
            Array.isArray((company as any).modules) &&
            (company as any).modules.some((moduleId: string) => this.normalize(moduleId) === moduleCode);

          if (enabledByRecord || enabledByLegacyFallback) {
            enabledCompanyCount += 1;
          }
        }

        if (this.entitlementRepository) {
          const entitlements = await this.entitlementRepository.getActiveByCompanyId(company.id);
          const hasEntitlement = entitlements.some((entitlement) =>
            entitlement.items.some(
              (item) => item.itemType === 'module' && this.normalize(item.itemKey) === moduleCode
            )
          );

          if (hasEntitlement) {
            entitlementCount += 1;
          }
        }

        if (this.companyRoleRepository) {
          const roles = await this.companyRoleRepository.getAll(company.id);
          const hasRoleDependency = roles.some((role: any) => {
            const moduleBundles = Array.isArray(role.moduleBundles) ? role.moduleBundles : [];
            const permissions = [
              ...(Array.isArray(role.permissions) ? role.permissions : []),
              ...(Array.isArray(role.explicitPermissions) ? role.explicitPermissions : []),
              ...(Array.isArray(role.resolvedPermissions) ? role.resolvedPermissions : []),
            ];

            return moduleBundles.some((moduleId: string) => this.normalize(moduleId) === moduleCode) ||
              permissions.some((permission: string) => this.permissionBelongsToModule(permission, moduleCode));
          });

          if (hasRoleDependency) {
            companyRoleCount += 1;
          }
        }
      }

      if (enabledCompanyCount > 0) {
        blockers.push(`${enabledCompanyCount} company module enablement record(s) use this module`);
      }
      if (entitlementCount > 0) {
        blockers.push(`${entitlementCount} active entitlement(s) grant this module`);
      }
      if (companyRoleCount > 0) {
        blockers.push(`${companyRoleCount} company role(s) depend on this module`);
      }
    }

    if (blockers.length > 0) {
      throw new Error(`Cannot set lifecycleStatus=inactive while module is in use: ${blockers.join('; ')}`);
    }
  }

  private async writeRuntimeStatusAudit(
    module: ModuleDefinition,
    newStatus: 'available' | 'suspended',
    reason?: string,
    requestedBy?: string
  ): Promise<void> {
    if (!this.auditLogRepository) return;

    const action = newStatus === 'suspended' ? 'MODULE_SUSPENDED' : 'MODULE_RESUMED';
    const audit = new AuditLog(
      `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      'ModuleRegistry',
      module.id,
      requestedBy || 'system',
      new Date(),
      {
        moduleCode: module.code,
        previousRuntimeStatus: module.runtimeStatus,
        newRuntimeStatus: newStatus,
        reason: String(reason || '').trim() || undefined,
      }
    );

    await this.auditLogRepository.log(audit);
  }
}
