"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckModuleImplementationUseCase = void 0;
class CheckModuleImplementationUseCase {
    constructor(moduleRepo, codeModuleRegistry) {
        this.moduleRepo = moduleRepo;
        this.codeModuleRegistry = codeModuleRegistry;
    }
    async execute(moduleId) {
        const errors = [];
        const normalizedId = moduleId.toLowerCase();
        let dbModule = await this.moduleRepo.getById(moduleId);
        if (!dbModule) {
            const byCode = await this.moduleRepo.getByCode(normalizedId);
            if (byCode) {
                dbModule = byCode;
            }
            else {
                errors.push(`Module not found in registry`);
            }
        }
        const codeModule = this.codeModuleRegistry.getModule(normalizedId);
        if (!codeModule) {
            errors.push(`Code implementation not found for module '${normalizedId}'`);
        }
        if (dbModule && codeModule) {
            const dbCode = (dbModule.code || dbModule.id).toLowerCase();
            if (dbCode !== codeModule.metadata.id.toLowerCase()) {
                errors.push(`Code module ID '${codeModule.metadata.id}' does not match DB code '${dbModule.code || dbModule.id}'`);
            }
            const manifest = this.extractManifest(codeModule);
            if (!manifest.version || manifest.version.trim() === '') {
                errors.push(`Code manifest version is required but missing`);
            }
            else if (dbModule.version !== manifest.version) {
                errors.push(`Version mismatch: DB=${dbModule.version}, Code=${manifest.version}`);
            }
            try {
                const router = codeModule.getRouter();
                if (!router) {
                    errors.push(`Router not found for module`);
                }
            }
            catch (e) {
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
        const result = {
            moduleId,
            status,
            errors,
            checkedAt: new Date(),
        };
        if (dbModule) {
            await this.moduleRepo.updateImplementationCheck(dbModule.id, status, errors.length > 0 ? errors.join('; ') : null, result.checkedAt);
        }
        return result;
    }
    extractManifest(module) {
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
exports.CheckModuleImplementationUseCase = CheckModuleImplementationUseCase;
//# sourceMappingURL=CheckModuleImplementationUseCase.js.map