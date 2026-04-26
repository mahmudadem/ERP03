/**
 * CheckModuleImplementationUseCase
 *
 * Validates that a module's code implementation matches the DB registry.
 * Updates the module's implementationStatus in DB.
 *
 * Validates:
 * 1. Code module manifest exists for module ID
 * 2. DB version is compatible with code manifest version
 * 3. Router exists
 * 4. Permission manifest exists
 */
import { IModuleRegistryRepository } from '../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ModuleRegistry as CodeModuleRegistry } from '../../platform/ModuleRegistry';
import { IModule } from '../../../domain/platform/IModule';

export interface CheckImplementationResult {
  moduleId: string;
  status: 'passed' | 'failed';
  errors: string[];
  checkedAt: Date;
}

export class CheckModuleImplementationUseCase {
  constructor(
    private moduleRepo: IModuleRegistryRepository,
    private codeModuleRegistry: CodeModuleRegistry
  ) {}

  async execute(moduleId: string): Promise<CheckImplementationResult> {
    const errors: string[] = [];
    const normalizedId = moduleId.toLowerCase();

    const dbModule = await this.moduleRepo.getById(moduleId);
    if (!dbModule) {
      const byCode = await this.moduleRepo.getByCode(normalizedId);
      if (byCode) {
        errors.push(`Module found by code '${normalizedId}' but ID mismatch`);
      } else {
        errors.push(`Module not found in registry`);
      }
    }

    const codeModule = this.codeModuleRegistry.getModule(normalizedId);
    if (!codeModule) {
      errors.push(`Code implementation not found for module '${normalizedId}'`);
    }

    if (dbModule && codeModule) {
      if (dbModule.code.toLowerCase() !== codeModule.metadata.id.toLowerCase()) {
        errors.push(`Code module ID '${codeModule.metadata.id}' does not match DB code '${dbModule.code}'`);
      }

      const manifest = this.extractManifest(codeModule);
      if (!manifest.version || manifest.version.trim() === '') {
        errors.push(`Code manifest version is required but missing`);
      } else if (dbModule.version !== manifest.version) {
        errors.push(`Version mismatch: DB=${dbModule.version}, Code=${manifest.version}`);
      }

      try {
        const router = codeModule.getRouter();
        if (!router) {
          errors.push(`Router not found for module`);
        }
      } catch (e) {
        errors.push(`Failed to get router: ${e}`);
      }

      if (!codeModule.permissions || codeModule.permissions.length === 0) {
        errors.push(`No permissions defined for module`);
      }

      if (!manifest.requiredPermissions || manifest.requiredPermissions.length === 0) {
        errors.push(`No required permissions in manifest`);
      }
    }

    const status = errors.length === 0 ? 'passed' : 'failed';
    const result: CheckImplementationResult = {
      moduleId,
      status,
      errors,
      checkedAt: new Date(),
    };

    if (dbModule) {
      await this.moduleRepo.updateImplementationCheck(
        moduleId,
        status,
        errors.length > 0 ? errors.join('; ') : null,
        result.checkedAt
      );
    }

    return result;
  }

  private extractManifest(module: IModule): any {
    if (typeof module.getManifest === 'function') {
      return module.getManifest();
    }
    return {
      id: module.metadata.id,
      name: module.metadata.name,
      version: module.metadata.version,
      description: module.metadata.description,
      requiredPermissions: module.permissions,
    };
  }
}