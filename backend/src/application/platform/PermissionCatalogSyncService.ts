/**
 * PermissionCatalogSyncService.ts
 *
 * Syncs permissions from:
 * 1. Module manifests (requiredPermissions)
 * 2. Route guards (permissionGuard, ownerOrPermissionGuard)
 * 3. Capability manifests (if applicable)
 *
 * Runs at startup to ensure all code-declared permissions exist in DB.
 */
import { diContainer } from '../../infrastructure/di/bindRepositories';
import { ModuleRegistry } from './ModuleRegistry';
import { PermissionDefinition } from '../../domain/super-admin/PermissionDefinition';
import * as fs from 'fs';
import * as path from 'path';
import { PERMISSION_CATALOG } from '../../config/PermissionCatalog';
import {
  filterRuntimeAvailableModules,
  resolveCompanyEnabledModules
} from '../company-admin/services/CompanyModuleAccessResolver';

export interface PermissionCatalogSyncReport {
  synced: number;
  newPermissions: string[];
  updatedPermissions: string[];
  unchangedPermissions: string[];
  errors: string[];
  routePermissions: number;
  modulePermissions: number;
}

export class PermissionCatalogSyncService {
  private routesDir = path.join(__dirname, '../../api/routes');

  async sync(companyId?: string): Promise<PermissionCatalogSyncReport> {
    const report: PermissionCatalogSyncReport = {
      synced: 0,
      newPermissions: [],
      updatedPermissions: [],
      unchangedPermissions: [],
      errors: [],
      routePermissions: 0,
      modulePermissions: 0
    };

    if (!diContainer.permissionRegistryRepository) {
      report.errors.push('Permission registry repository not configured');
      return report;
    }

    const permissionCodes = new Set<string>();

    const catalogPermissions = this.collectCatalogPermissions();
    for (const perm of catalogPermissions) {
      permissionCodes.add(perm);
    }

    const modulePermissions = this.collectModulePermissions();
    for (const perm of modulePermissions) {
      permissionCodes.add(perm);
    }
    report.modulePermissions = modulePermissions.length;

    const routePermissions = this.collectRoutePermissions();
    for (const perm of routePermissions) {
      permissionCodes.add(perm);
    }
    report.routePermissions = routePermissions.length;

    console.log(`[PermissionSync] Found ${permissionCodes.size} permissions (${modulePermissions.length} from modules, ${routePermissions.length} from routes)`);

    const existingPermissions = await diContainer.permissionRegistryRepository.getAll();
    const existingMap = new Map(existingPermissions.map(p => [p.id, p]));
    const dbCodes = new Set(existingPermissions.map(p => p.id));

    for (const code of permissionCodes) {
      const parts = code.split('.');
      const moduleId = parts[0];
      const action = parts.slice(1).join('.');

      const name = this.formatPermissionName(code);
      const description = this.formatPermissionDescription(code, moduleId, action);

      if (!dbCodes.has(code)) {
        const newPerm: PermissionDefinition = {
          id: code,
          name,
          description,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await diContainer.permissionRegistryRepository.create(newPerm);
        report.newPermissions.push(code);
        console.log(`[PermissionSync] Created: ${code}`);
      } else {
        const existing = existingMap.get(code);
        const needsUpdate =
          existing?.name !== name ||
          existing?.description !== description;

        if (needsUpdate) {
          await diContainer.permissionRegistryRepository.update(code, {
            name,
            description
          });
          report.updatedPermissions.push(code);
          console.log(`[PermissionSync] Updated: ${code}`);
        } else {
          report.unchangedPermissions.push(code);
        }
      }
      report.synced++;
    }

    console.log(`[PermissionSync] Complete: ${report.synced} synced (${report.newPermissions.length} new, ${report.updatedPermissions.length} updated)`);
    return report;
  }

  async getAvailablePermissions(companyId: string): Promise<PermissionDefinition[]> {
    if (!diContainer.permissionRegistryRepository) {
      return [];
    }

    if (!companyId) {
      return diContainer.permissionRegistryRepository.getAll();
    }

    const allPerms = await diContainer.permissionRegistryRepository.getAll();
    if (
      !diContainer.companyRepository ||
      !diContainer.companyModuleRepository ||
      !diContainer.companyEntitlementRepository
    ) {
      return allPerms;
    }

    const [company, entitledModules, entitledCapabilities, companyModules] = await Promise.all([
      diContainer.companyRepository.findById(companyId),
      diContainer.companyEntitlementRepository.getEffectiveModules(companyId),
      diContainer.companyEntitlementRepository.getEffectiveCapabilities(companyId),
      diContainer.companyModuleRepository.listByCompany(companyId)
    ]);

    const enabledModules = resolveCompanyEnabledModules({
      companyModules,
      legacyModules: (company?.modules || []) as string[],
      entitledModules,
    });
    const runtimeAvailableModules = await filterRuntimeAvailableModules(companyId, enabledModules);
    const runtimeAvailableModuleSet = new Set(runtimeAvailableModules);
    const {
      knownCapabilityCodes,
      availableCapabilityCodes
    } = await this.getAvailableCapabilityCodeSets(
      companyId,
      runtimeAvailableModules,
      entitledCapabilities
    );

    const availablePerms = allPerms.filter(perm => {
      const [moduleId] = perm.id.split('.');
      if (moduleId === 'system') return true;

      if (!runtimeAvailableModuleSet.has(moduleId)) return false;

      const permissionCapability = this.getPermissionCapabilityPrefix(perm.id);
      if (permissionCapability && knownCapabilityCodes.has(permissionCapability)) {
        return availableCapabilityCodes.has(permissionCapability);
      }

      return true;
    });

    return availablePerms;
  }

  getCodeOwnedPermissionKeys(): Set<string> {
    return new Set([
      ...this.collectCatalogPermissions(),
      ...this.collectModulePermissions(),
      ...this.collectRoutePermissions(),
    ]);
  }

  async validate(): Promise<{ valid: boolean; invalidPermissions: string[] }> {
    const invalidPermissions: string[] = [];

    if (!diContainer.permissionRegistryRepository) {
      invalidPermissions.push('Permission registry repository not configured');
      return { valid: false, invalidPermissions };
    }

    const existingPermissions = await diContainer.permissionRegistryRepository.getAll();
    const validSet = new Set(existingPermissions.map(p => p.id));

    return {
      valid: validSet.size > 0,
      invalidPermissions
    };
  }

  private collectModulePermissions(): string[] {
    const moduleRegistry = ModuleRegistry.getInstance();
    const allModules = moduleRegistry.getAllModules();
    const permissions = new Set<string>();

    for (const mod of allModules) {
      const manifest = mod.getManifest();
      for (const perm of manifest.requiredPermissions || []) {
        permissions.add(perm);
      }
    }

    return Array.from(permissions);
  }

  private collectCatalogPermissions(): string[] {
    const permissions = new Set<string>();

    for (const moduleCatalog of PERMISSION_CATALOG) {
      for (const perm of moduleCatalog.permissions) {
        permissions.add(perm.id);
      }
    }

    return Array.from(permissions);
  }

  private collectRoutePermissions(): string[] {
    const permissions = new Set<string>();

    if (!fs.existsSync(this.routesDir)) {
      console.warn(`[PermissionSync] Routes directory not found: ${this.routesDir}`);
      return [];
    }

    const files = fs.readdirSync(this.routesDir).filter(f => f.endsWith('.routes.ts') || f.endsWith('.routes.js'));

    for (const file of files) {
      const filePath = path.join(this.routesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      const guardRegex = /\b(?:permissionGuard|ownerOrPermissionGuard)(?:\s*\))?\s*\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*\)/g;
      let match: RegExpExecArray | null;
      while ((match = guardRegex.exec(content)) !== null) {
        permissions.add(match[1]);
      }
    }

    return Array.from(permissions);
  }

  private getPermissionCapabilityPrefix(permissionId: string): string | null {
    const parts = permissionId.split('.');
    if (parts.length < 3) return null;
    return parts.slice(0, 2).join('.');
  }

  private async getAvailableCapabilityCodeSets(
    companyId: string,
    runtimeAvailableModules: string[],
    entitledCapabilities: string[]
  ): Promise<{ knownCapabilityCodes: Set<string>; availableCapabilityCodes: Set<string> }> {
    const knownCapabilityCodes = new Set<string>();
    const availableCapabilityCodes = new Set<string>();

    if (!diContainer.capabilityRegistryRepository) {
      return { knownCapabilityCodes, availableCapabilityCodes };
    }

    const [capabilities, companyCapabilities] = await Promise.all([
      diContainer.capabilityRegistryRepository.getAll(),
      diContainer.capabilityRegistryRepository.getByCompanyId(companyId),
    ]);

    const runtimeModuleSet = new Set(runtimeAvailableModules.map((m) => m.toLowerCase()));
    const entitledCapabilitySet = new Set(entitledCapabilities.map((c) => c.toLowerCase()));
    const enabledCapabilitySet = new Set(
      companyCapabilities
        .filter((capability) => capability.isEnabled)
        .map((capability) => capability.capabilityId.toLowerCase())
    );

    for (const capability of capabilities) {
      const code = capability.code.toLowerCase();
      const id = capability.id.toLowerCase();
      knownCapabilityCodes.add(code);

      const isEntitled = entitledCapabilitySet.has(code) || entitledCapabilitySet.has(id);
      if (!isEntitled) continue;
      if (!runtimeModuleSet.has(capability.moduleId.toLowerCase())) continue;
      if (capability.lifecycleStatus !== 'ready') continue;
      if (capability.runtimeStatus !== 'available') continue;
      if (capability.implementationStatus !== 'passed') continue;
      if (capability.enablementPolicy === 'platform_only') continue;

      if (capability.enablementPolicy === 'company_admin_optional') {
        const isEnabled = enabledCapabilitySet.has(code) || enabledCapabilitySet.has(id);
        if (!isEnabled) continue;
      }

      availableCapabilityCodes.add(code);
    }

    return { knownCapabilityCodes, availableCapabilityCodes };
  }

  private formatPermissionName(code: string): string {
    const parts = code.split('.');
    const moduleName = parts[0];
    const resource = parts[1] || 'all';
    const action = parts[2] || 'manage';

    return `${this.capitalize(resource)} ${this.capitalize(action)}`;
  }

  private formatPermissionDescription(code: string, moduleId: string, action: string): string {
    const descriptions: Record<string, string> = {
      view: `View ${moduleId} data`,
      manage: `Manage ${moduleId} settings and configuration`,
      create: `Create ${moduleId} records`,
      update: `Update ${moduleId} records`,
      delete: `Delete ${moduleId} records`,
      approve: `Approve ${moduleId} transactions`,
      reports: `View ${moduleId} reports`,
      export: `Export ${moduleId} data`,
      read: `Read ${moduleId} data`,
      write: `Write ${moduleId} data`,
      post: `Post ${moduleId} transactions`,
      edit: `Edit ${moduleId} records`,
      cancel: `Cancel ${moduleId} transactions`,
      reconcile: `Run ${moduleId} reconciliation`,
      adjust: `Adjust ${moduleId} values`,
      record: `Record ${moduleId} movements`,
      verify: `Verify ${moduleId} transactions`,
      correct: `Correct ${moduleId} entries`,
      lock: `Lock ${moduleId} records`,
    };

    return descriptions[action] || `Permission for ${code}`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
