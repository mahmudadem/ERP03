"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateModuleUseCase = void 0;
const AuditLog_1 = require("../../../domain/system/entities/AuditLog");
class UpdateModuleUseCase {
    constructor(moduleRepo, companyRepository, companyModuleRepository, entitlementRepository, bundleRegistryRepository, roleTemplateRegistryRepository, companyRoleRepository, auditLogRepository) {
        this.moduleRepo = moduleRepo;
        this.companyRepository = companyRepository;
        this.companyModuleRepository = companyModuleRepository;
        this.entitlementRepository = entitlementRepository;
        this.bundleRegistryRepository = bundleRegistryRepository;
        this.roleTemplateRegistryRepository = roleTemplateRegistryRepository;
        this.companyRoleRepository = companyRoleRepository;
        this.auditLogRepository = auditLogRepository;
    }
    async execute(input) {
        const { id, suspendReason, reason, requestedBy } = input, updates = __rest(input, ["id", "suspendReason", "reason", "requestedBy"]);
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
        await this.moduleRepo.update(id, Object.assign(Object.assign({}, updates), { updatedAt: new Date() }));
        if (updates.runtimeStatus && updates.runtimeStatus !== existing.runtimeStatus) {
            await this.writeRuntimeStatusAudit(existing, updates.runtimeStatus, suspendReason || reason, requestedBy);
        }
    }
    normalize(value) {
        return String(value || '').trim().toLowerCase();
    }
    permissionBelongsToModule(permission, moduleCode) {
        const normalized = this.normalize(permission);
        return normalized === moduleCode || normalized.startsWith(`${moduleCode}.`);
    }
    async assertCanDeactivate(module) {
        const moduleCode = this.normalize(module.code || module.id);
        const blockers = [];
        if (this.bundleRegistryRepository) {
            const bundles = await this.bundleRegistryRepository.getAll();
            const blockingBundles = bundles.filter((bundle) => {
                const lifecycle = this.normalize(bundle.lifecycleStatus);
                if (!['ready', 'deprecated'].includes(lifecycle))
                    return false;
                const moduleItems = [
                    ...(Array.isArray(bundle.modulesIncluded) ? bundle.modulesIncluded : []),
                    ...(Array.isArray(bundle.items)
                        ? bundle.items
                            .filter((item) => item.itemType === 'module')
                            .map((item) => item.itemKey)
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
            const blockingTemplates = templates.filter((template) => (template.permissions || []).some((permission) => this.permissionBelongsToModule(permission, moduleCode)));
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
                    const enabledByRecord = states.some((state) => this.normalize(state.moduleCode) === moduleCode && state.isEnabled);
                    const enabledByLegacyFallback = !hasModuleRecords &&
                        Array.isArray(company.modules) &&
                        company.modules.some((moduleId) => this.normalize(moduleId) === moduleCode);
                    if (enabledByRecord || enabledByLegacyFallback) {
                        enabledCompanyCount += 1;
                    }
                }
                if (this.entitlementRepository) {
                    const entitlements = await this.entitlementRepository.getActiveByCompanyId(company.id);
                    const hasEntitlement = entitlements.some((entitlement) => entitlement.items.some((item) => item.itemType === 'module' && this.normalize(item.itemKey) === moduleCode));
                    if (hasEntitlement) {
                        entitlementCount += 1;
                    }
                }
                if (this.companyRoleRepository) {
                    const roles = await this.companyRoleRepository.getAll(company.id);
                    const hasRoleDependency = roles.some((role) => {
                        const moduleBundles = Array.isArray(role.moduleBundles) ? role.moduleBundles : [];
                        const permissions = [
                            ...(Array.isArray(role.permissions) ? role.permissions : []),
                            ...(Array.isArray(role.explicitPermissions) ? role.explicitPermissions : []),
                            ...(Array.isArray(role.resolvedPermissions) ? role.resolvedPermissions : []),
                        ];
                        return moduleBundles.some((moduleId) => this.normalize(moduleId) === moduleCode) ||
                            permissions.some((permission) => this.permissionBelongsToModule(permission, moduleCode));
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
    async writeRuntimeStatusAudit(module, newStatus, reason, requestedBy) {
        if (!this.auditLogRepository)
            return;
        const action = newStatus === 'suspended' ? 'MODULE_SUSPENDED' : 'MODULE_RESUMED';
        const audit = new AuditLog_1.AuditLog(`audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, action, 'ModuleRegistry', module.id, requestedBy || 'system', new Date(), {
            moduleCode: module.code,
            previousRuntimeStatus: module.runtimeStatus,
            newRuntimeStatus: newStatus,
            reason: String(reason || '').trim() || undefined,
        });
        await this.auditLogRepository.log(audit);
    }
}
exports.UpdateModuleUseCase = UpdateModuleUseCase;
//# sourceMappingURL=UpdateModuleUseCase.js.map