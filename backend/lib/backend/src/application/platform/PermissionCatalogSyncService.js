"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionCatalogSyncService = void 0;
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
const bindRepositories_1 = require("../../infrastructure/di/bindRepositories");
const ModuleRegistry_1 = require("./ModuleRegistry");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PermissionCatalog_1 = require("../../config/PermissionCatalog");
const CompanyModuleAccessResolver_1 = require("../company-admin/services/CompanyModuleAccessResolver");
class PermissionCatalogSyncService {
    constructor() {
        this.routesDir = path.join(__dirname, '../../api/routes');
    }
    async sync(companyId) {
        const report = {
            synced: 0,
            newPermissions: [],
            updatedPermissions: [],
            unchangedPermissions: [],
            errors: [],
            routePermissions: 0,
            modulePermissions: 0
        };
        if (!bindRepositories_1.diContainer.permissionRegistryRepository) {
            report.errors.push('Permission registry repository not configured');
            return report;
        }
        const permissionCodes = new Set();
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
        const existingPermissions = await bindRepositories_1.diContainer.permissionRegistryRepository.getAll();
        const existingMap = new Map(existingPermissions.map(p => [p.id, p]));
        const dbCodes = new Set(existingPermissions.map(p => p.id));
        for (const code of permissionCodes) {
            const parts = code.split('.');
            const moduleId = parts[0];
            const action = parts.slice(1).join('.');
            const name = this.formatPermissionName(code);
            const description = this.formatPermissionDescription(code, moduleId, action);
            if (!dbCodes.has(code)) {
                const newPerm = {
                    id: code,
                    name,
                    description,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                await bindRepositories_1.diContainer.permissionRegistryRepository.create(newPerm);
                report.newPermissions.push(code);
                console.log(`[PermissionSync] Created: ${code}`);
            }
            else {
                const existing = existingMap.get(code);
                const needsUpdate = (existing === null || existing === void 0 ? void 0 : existing.name) !== name ||
                    (existing === null || existing === void 0 ? void 0 : existing.description) !== description;
                if (needsUpdate) {
                    await bindRepositories_1.diContainer.permissionRegistryRepository.update(code, {
                        name,
                        description
                    });
                    report.updatedPermissions.push(code);
                    console.log(`[PermissionSync] Updated: ${code}`);
                }
                else {
                    report.unchangedPermissions.push(code);
                }
            }
            report.synced++;
        }
        console.log(`[PermissionSync] Complete: ${report.synced} synced (${report.newPermissions.length} new, ${report.updatedPermissions.length} updated)`);
        return report;
    }
    async getAvailablePermissions(companyId) {
        if (!bindRepositories_1.diContainer.permissionRegistryRepository) {
            return [];
        }
        if (!companyId) {
            return bindRepositories_1.diContainer.permissionRegistryRepository.getAll();
        }
        const allPerms = await bindRepositories_1.diContainer.permissionRegistryRepository.getAll();
        if (!bindRepositories_1.diContainer.companyRepository ||
            !bindRepositories_1.diContainer.companyModuleRepository ||
            !bindRepositories_1.diContainer.companyEntitlementRepository) {
            return allPerms;
        }
        const [company, entitledModules, entitledCapabilities, companyModules] = await Promise.all([
            bindRepositories_1.diContainer.companyRepository.findById(companyId),
            bindRepositories_1.diContainer.companyEntitlementRepository.getEffectiveModules(companyId),
            bindRepositories_1.diContainer.companyEntitlementRepository.getEffectiveCapabilities(companyId),
            bindRepositories_1.diContainer.companyModuleRepository.listByCompany(companyId)
        ]);
        const enabledModules = (0, CompanyModuleAccessResolver_1.resolveCompanyEnabledModules)({
            companyModules,
            legacyModules: ((company === null || company === void 0 ? void 0 : company.modules) || []),
            entitledModules,
        });
        const runtimeAvailableModules = await (0, CompanyModuleAccessResolver_1.filterRuntimeAvailableModules)(companyId, enabledModules);
        const runtimeAvailableModuleSet = new Set(runtimeAvailableModules);
        const { knownCapabilityCodes, availableCapabilityCodes } = await this.getAvailableCapabilityCodeSets(companyId, runtimeAvailableModules, entitledCapabilities);
        const availablePerms = allPerms.filter(perm => {
            const [moduleId] = perm.id.split('.');
            if (moduleId === 'system')
                return true;
            if (!runtimeAvailableModuleSet.has(moduleId))
                return false;
            const permissionCapability = this.getPermissionCapabilityPrefix(perm.id);
            if (permissionCapability && knownCapabilityCodes.has(permissionCapability)) {
                return availableCapabilityCodes.has(permissionCapability);
            }
            return true;
        });
        return availablePerms;
    }
    getCodeOwnedPermissionKeys() {
        return new Set([
            ...this.collectCatalogPermissions(),
            ...this.collectModulePermissions(),
            ...this.collectRoutePermissions(),
        ]);
    }
    async validate() {
        const invalidPermissions = [];
        if (!bindRepositories_1.diContainer.permissionRegistryRepository) {
            invalidPermissions.push('Permission registry repository not configured');
            return { valid: false, invalidPermissions };
        }
        const existingPermissions = await bindRepositories_1.diContainer.permissionRegistryRepository.getAll();
        const validSet = new Set(existingPermissions.map(p => p.id));
        return {
            valid: validSet.size > 0,
            invalidPermissions
        };
    }
    collectModulePermissions() {
        const moduleRegistry = ModuleRegistry_1.ModuleRegistry.getInstance();
        const allModules = moduleRegistry.getAllModules();
        const permissions = new Set();
        for (const mod of allModules) {
            const manifest = mod.getManifest();
            for (const perm of manifest.requiredPermissions || []) {
                permissions.add(perm);
            }
        }
        return Array.from(permissions);
    }
    collectCatalogPermissions() {
        const permissions = new Set();
        for (const moduleCatalog of PermissionCatalog_1.PERMISSION_CATALOG) {
            for (const perm of moduleCatalog.permissions) {
                permissions.add(perm.id);
            }
        }
        return Array.from(permissions);
    }
    collectRoutePermissions() {
        const permissions = new Set();
        if (!fs.existsSync(this.routesDir)) {
            console.warn(`[PermissionSync] Routes directory not found: ${this.routesDir}`);
            return [];
        }
        const files = fs.readdirSync(this.routesDir).filter(f => f.endsWith('.routes.ts') || f.endsWith('.routes.js'));
        for (const file of files) {
            const filePath = path.join(this.routesDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const guardRegex = /\b(?:permissionGuard|ownerOrPermissionGuard)(?:\s*\))?\s*\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*\)/g;
            let match;
            while ((match = guardRegex.exec(content)) !== null) {
                permissions.add(match[1]);
            }
        }
        return Array.from(permissions);
    }
    getPermissionCapabilityPrefix(permissionId) {
        const parts = permissionId.split('.');
        if (parts.length < 3)
            return null;
        return parts.slice(0, 2).join('.');
    }
    async getAvailableCapabilityCodeSets(companyId, runtimeAvailableModules, entitledCapabilities) {
        const knownCapabilityCodes = new Set();
        const availableCapabilityCodes = new Set();
        if (!bindRepositories_1.diContainer.capabilityRegistryRepository) {
            return { knownCapabilityCodes, availableCapabilityCodes };
        }
        const [capabilities, companyCapabilities] = await Promise.all([
            bindRepositories_1.diContainer.capabilityRegistryRepository.getAll(),
            bindRepositories_1.diContainer.capabilityRegistryRepository.getByCompanyId(companyId),
        ]);
        const runtimeModuleSet = new Set(runtimeAvailableModules.map((m) => m.toLowerCase()));
        const entitledCapabilitySet = new Set(entitledCapabilities.map((c) => c.toLowerCase()));
        const enabledCapabilitySet = new Set(companyCapabilities
            .filter((capability) => capability.isEnabled)
            .map((capability) => capability.capabilityId.toLowerCase()));
        for (const capability of capabilities) {
            const code = capability.code.toLowerCase();
            const id = capability.id.toLowerCase();
            knownCapabilityCodes.add(code);
            const isEntitled = entitledCapabilitySet.has(code) || entitledCapabilitySet.has(id);
            if (!isEntitled)
                continue;
            if (!runtimeModuleSet.has(capability.moduleId.toLowerCase()))
                continue;
            if (capability.lifecycleStatus !== 'ready')
                continue;
            if (capability.runtimeStatus !== 'available')
                continue;
            if (capability.implementationStatus !== 'passed')
                continue;
            if (capability.enablementPolicy === 'platform_only')
                continue;
            if (capability.enablementPolicy === 'company_admin_optional') {
                const isEnabled = enabledCapabilitySet.has(code) || enabledCapabilitySet.has(id);
                if (!isEnabled)
                    continue;
            }
            availableCapabilityCodes.add(code);
        }
        return { knownCapabilityCodes, availableCapabilityCodes };
    }
    formatPermissionName(code) {
        const parts = code.split('.');
        const moduleName = parts[0];
        const resource = parts[1] || 'all';
        const action = parts[2] || 'manage';
        return `${this.capitalize(resource)} ${this.capitalize(action)}`;
    }
    formatPermissionDescription(code, moduleId, action) {
        const descriptions = {
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
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
exports.PermissionCatalogSyncService = PermissionCatalogSyncService;
//# sourceMappingURL=PermissionCatalogSyncService.js.map