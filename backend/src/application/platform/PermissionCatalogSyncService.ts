/**
 * PermissionCatalogSyncService.ts
 *
 * Syncs permissions from module manifests to the permission registry.
 * Runs at startup to ensure all code-declared permissions exist in DB.
 */
import { diContainer } from '../../infrastructure/di/bindRepositories';
import { ModuleRegistry } from './ModuleRegistry';
import { PermissionDefinition } from '../../domain/super-admin/PermissionDefinition';

export interface PermissionCatalogSyncReport {
  synced: number;
  newPermissions: string[];
  updatedPermissions: string[];
  unchangedPermissions: string[];
  errors: string[];
}

export class PermissionCatalogSyncService {
  async sync(): Promise<PermissionCatalogSyncReport> {
    const report: PermissionCatalogSyncReport = {
      synced: 0,
      newPermissions: [],
      updatedPermissions: [],
      unchangedPermissions: [],
      errors: []
    };

    if (!diContainer.permissionRegistryRepository) {
      report.errors.push('Permission registry repository not configured');
      return report;
    }

    const moduleRegistry = ModuleRegistry.getInstance();
    const allModules = moduleRegistry.getAllModules();

    const permissionCodes = new Set<string>();
    for (const mod of allModules) {
      const manifest = mod.getManifest();
      for (const perm of manifest.requiredPermissions || []) {
        permissionCodes.add(perm);
      }
    }

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

    console.log(`[PermissionSync] Complete: ${report.synced} synced, ${report.newPermissions.length} new, ${report.updatedPermissions.length} updated`);
    return report;
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
      export: `Export ${moduleId} data`
    };

    return descriptions[action] || `Permission for ${code}`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}