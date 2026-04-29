"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleAvailabilityService = exports.ModuleAvailabilityState = void 0;
var ModuleAvailabilityState;
(function (ModuleAvailabilityState) {
    ModuleAvailabilityState["AVAILABLE"] = "available";
    ModuleAvailabilityState["DB_ONLY"] = "db_only";
    ModuleAvailabilityState["CODE_ONLY"] = "code_only";
    ModuleAvailabilityState["VERSION_MISMATCH"] = "version_mismatch";
    ModuleAvailabilityState["IMPLEMENTATION_FAILED"] = "implementation_failed";
    ModuleAvailabilityState["IMPLEMENTATION_UNCHECKED"] = "implementation_unchecked";
    ModuleAvailabilityState["NOT_READY"] = "not_ready";
    ModuleAvailabilityState["SUSPENDED"] = "suspended";
    ModuleAvailabilityState["NOT_ENTITLED"] = "not_entitled";
    ModuleAvailabilityState["ENABLED_BUT_SUSPENDED"] = "enabled_but_suspended";
})(ModuleAvailabilityState = exports.ModuleAvailabilityState || (exports.ModuleAvailabilityState = {}));
const PLATFORM_IDS = ['companyadmin', 'core', 'auth', 'rbac', 'settings', 'system'];
class ModuleAvailabilityService {
    constructor(moduleRegistryRepo, codeModuleRegistry, entitlementService) {
        this.moduleRegistryRepo = moduleRegistryRepo;
        this.codeModuleRegistry = codeModuleRegistry;
        this.entitlementService = entitlementService;
        this.availabilityMap = new Map();
        this.initialized = false;
        this.lastRefreshedAt = 0;
        this.isRefreshing = false;
        this.CACHE_TTL_MS = 30000;
        this.versionMismatchList = [];
    }
    static getInstance() {
        if (!ModuleAvailabilityService.instance) {
            throw new Error('ModuleAvailabilityService not initialized. Call create() then build() first.');
        }
        return ModuleAvailabilityService.instance;
    }
    static create(moduleRegistryRepo, codeModuleRegistry, entitlementService) {
        ModuleAvailabilityService.instance = new ModuleAvailabilityService(moduleRegistryRepo, codeModuleRegistry, entitlementService);
        return ModuleAvailabilityService.instance;
    }
    async refreshIfNeeded() {
        const now = Date.now();
        if (!this.initialized || (now - this.lastRefreshedAt) < this.CACHE_TTL_MS)
            return;
        if (this.isRefreshing)
            return;
        this.isRefreshing = true;
        try {
            await this.buildAvailabilityMap();
        }
        finally {
            this.isRefreshing = false;
        }
    }
    async buildAvailabilityMap() {
        this.versionMismatchList = [];
        const report = { dbOnly: [], codeOnly: [], versionMismatch: [] };
        const dbModules = await this.moduleRegistryRepo.getAll();
        const dbModuleMap = new Map(dbModules
            .map((m) => [this.normalizeModuleId(m.code || m.id), m])
            .filter(([moduleId]) => Boolean(moduleId)));
        const codeModules = this.codeModuleRegistry.getAllModules();
        const codeModuleMap = new Map(codeModules
            .map((m) => { var _a; return [this.normalizeModuleId((_a = m.metadata) === null || _a === void 0 ? void 0 : _a.id), m]; })
            .filter(([moduleId]) => Boolean(moduleId)));
        const allModuleIds = new Set([...dbModuleMap.keys(), ...codeModuleMap.keys()]);
        for (const moduleId of allModuleIds) {
            const dbModule = dbModuleMap.get(moduleId);
            const codeModule = codeModuleMap.get(moduleId);
            if (dbModule && codeModule) {
                const manifest = this.extractManifest(codeModule);
                const hasRouter = this.checkRouterExists(codeModule);
                const versionMismatch = dbModule.version !== manifest.version;
                if (versionMismatch) {
                    this.versionMismatchList.push({
                        moduleId,
                        dbVersion: dbModule.version,
                        codeVersion: manifest.version,
                    });
                    report.versionMismatch.push({
                        moduleId,
                        dbVersion: dbModule.version,
                        codeVersion: manifest.version,
                    });
                }
                const state = this.determineState(dbModule, hasRouter, versionMismatch);
                this.availabilityMap.set(moduleId, {
                    moduleId,
                    state,
                    dbRecord: dbModule,
                    manifest,
                    hasRouter,
                    entitlementsMissing: false,
                    reason: this.getStateReason(state, dbModule, versionMismatch),
                });
            }
            else if (dbModule && !codeModule) {
                this.availabilityMap.set(moduleId, {
                    moduleId,
                    state: ModuleAvailabilityState.DB_ONLY,
                    dbRecord: dbModule,
                    hasRouter: false,
                    entitlementsMissing: false,
                    reason: 'Implementation not found in code',
                });
                report.dbOnly.push(moduleId);
            }
            else if (codeModule && !dbModule) {
                const manifest = this.extractManifest(codeModule);
                this.availabilityMap.set(moduleId, {
                    moduleId,
                    state: ModuleAvailabilityState.CODE_ONLY,
                    manifest,
                    hasRouter: this.checkRouterExists(codeModule),
                    entitlementsMissing: false,
                    reason: 'Module not registered in database',
                });
                report.codeOnly.push(moduleId);
            }
        }
        this.initialized = true;
        this.lastRefreshedAt = Date.now();
        return report;
    }
    determineState(dbModule, hasRouter, versionMismatch) {
        if (!hasRouter) {
            return ModuleAvailabilityState.IMPLEMENTATION_FAILED;
        }
        if (versionMismatch) {
            return ModuleAvailabilityState.VERSION_MISMATCH;
        }
        if (dbModule.implementationStatus === 'failed') {
            return ModuleAvailabilityState.IMPLEMENTATION_FAILED;
        }
        if (dbModule.implementationStatus === 'unchecked') {
            return ModuleAvailabilityState.IMPLEMENTATION_UNCHECKED;
        }
        if (dbModule.lifecycleStatus !== 'ready') {
            return ModuleAvailabilityState.NOT_READY;
        }
        if (dbModule.runtimeStatus === 'suspended') {
            return ModuleAvailabilityState.SUSPENDED;
        }
        return ModuleAvailabilityState.AVAILABLE;
    }
    getStateReason(state, dbModule, versionMismatch) {
        switch (state) {
            case ModuleAvailabilityState.AVAILABLE:
                return '';
            case ModuleAvailabilityState.VERSION_MISMATCH:
                return `Version mismatch: DB=${dbModule.version}, Code version differs`;
            case ModuleAvailabilityState.IMPLEMENTATION_FAILED:
                return dbModule.implementationError || 'Implementation check failed';
            case ModuleAvailabilityState.IMPLEMENTATION_UNCHECKED:
                return 'Implementation not yet verified by SuperAdmin';
            case ModuleAvailabilityState.NOT_READY:
                return `lifecycleStatus is ${dbModule.lifecycleStatus}`;
            case ModuleAvailabilityState.SUSPENDED:
                return 'Module is temporarily suspended';
            default:
                return '';
        }
    }
    isAvailable(moduleId) {
        const info = this.availabilityMap.get(moduleId.toLowerCase());
        if (!info)
            return ModuleAvailabilityState.DB_ONLY;
        return info.state;
    }
    getAvailabilityInfo(moduleId) {
        return this.availabilityMap.get(moduleId.toLowerCase());
    }
    async ensureCacheFresh() {
        await this.refreshIfNeeded();
    }
    async isAvailableForCompany(moduleId, companyId) {
        await this.refreshIfNeeded();
        const info = this.availabilityMap.get(moduleId.toLowerCase());
        if (!info) {
            return { available: false, state: ModuleAvailabilityState.DB_ONLY, reason: 'Module not found' };
        }
        if (info.state === ModuleAvailabilityState.DB_ONLY) {
            return { available: false, state: info.state, reason: info.reason };
        }
        if (info.state === ModuleAvailabilityState.CODE_ONLY) {
            return { available: false, state: info.state, reason: info.reason };
        }
        if (info.state === ModuleAvailabilityState.VERSION_MISMATCH) {
            return { available: false, state: info.state, reason: info.reason };
        }
        if (info.state === ModuleAvailabilityState.IMPLEMENTATION_FAILED) {
            return { available: false, state: info.state, reason: info.reason };
        }
        if (info.state === ModuleAvailabilityState.IMPLEMENTATION_UNCHECKED) {
            return { available: false, state: info.state, reason: info.reason };
        }
        if (info.state === ModuleAvailabilityState.NOT_READY) {
            return { available: false, state: info.state, reason: info.reason };
        }
        if (info.state === ModuleAvailabilityState.SUSPENDED) {
            return { available: false, state: info.state, reason: info.reason };
        }
        const entitled = await this.entitlementService.companyHasModule(companyId, moduleId);
        if (!entitled) {
            return { available: false, state: ModuleAvailabilityState.NOT_ENTITLED, reason: 'Company not entitled to this module' };
        }
        return { available: true, state: ModuleAvailabilityState.AVAILABLE };
    }
    async getAvailableModulesForCompany(companyId) {
        const available = [];
        for (const [moduleId, info] of this.availabilityMap) {
            if (PLATFORM_IDS.includes(moduleId))
                continue;
            const isGloballyAvailable = info.state === ModuleAvailabilityState.AVAILABLE ||
                info.state === ModuleAvailabilityState.SUSPENDED;
            if (isGloballyAvailable) {
                const entitled = await this.entitlementService.companyHasModule(companyId, moduleId);
                if (entitled) {
                    available.push(moduleId);
                }
            }
        }
        return available;
    }
    async getCompanyAdminAvailableModules(companyId, enabledModuleIds) {
        const result = [];
        const normalizedEnabled = enabledModuleIds
            ? enabledModuleIds.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean)
            : [];
        for (const [moduleId, info] of this.availabilityMap) {
            if (PLATFORM_IDS.includes(moduleId))
                continue;
            const entitled = await this.entitlementService.companyHasModule(companyId, moduleId);
            if (!entitled)
                continue;
            if (info.state === ModuleAvailabilityState.AVAILABLE) {
                result.push(info);
            }
            else if (info.state === ModuleAvailabilityState.SUSPENDED && normalizedEnabled.includes(moduleId)) {
                result.push(info);
            }
        }
        return result;
    }
    getSuperAdminView() {
        const available = [];
        const dbOnly = [];
        const codeOnly = [];
        const implementationFailed = [];
        const notReady = [];
        const implementationUnchecked = [];
        const suspended = [];
        for (const [moduleId, info] of this.availabilityMap) {
            if (PLATFORM_IDS.includes(moduleId))
                continue;
            if (info.state === ModuleAvailabilityState.AVAILABLE && info.dbRecord) {
                available.push(info.dbRecord);
            }
            else if (info.state === ModuleAvailabilityState.DB_ONLY && info.dbRecord) {
                dbOnly.push(info.dbRecord);
            }
            else if (info.state === ModuleAvailabilityState.CODE_ONLY && info.manifest) {
                codeOnly.push({ id: moduleId, manifest: info.manifest, hasRouter: info.hasRouter });
            }
            else if (info.state === ModuleAvailabilityState.IMPLEMENTATION_FAILED && info.dbRecord) {
                implementationFailed.push(info.dbRecord);
            }
            else if (info.state === ModuleAvailabilityState.NOT_READY && info.dbRecord) {
                notReady.push(info.dbRecord);
            }
            else if (info.state === ModuleAvailabilityState.IMPLEMENTATION_UNCHECKED && info.dbRecord) {
                implementationUnchecked.push(info.dbRecord);
            }
            else if (info.state === ModuleAvailabilityState.SUSPENDED && info.dbRecord) {
                suspended.push(info.dbRecord);
            }
        }
        return {
            available,
            dbOnly,
            codeOnly,
            versionMismatch: this.versionMismatchList,
            implementationFailed,
            notReady,
            implementationUnchecked,
            suspended,
        };
    }
    isInitialized() {
        return this.initialized;
    }
    async rebuildAvailabilityMap() {
        return this.buildAvailabilityMap();
    }
    normalizeModuleId(moduleId) {
        return String(moduleId || '').trim().toLowerCase();
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
    checkRouterExists(module) {
        try {
            const router = module.getRouter();
            return router !== undefined && router !== null;
        }
        catch (_a) {
            return false;
        }
    }
}
exports.ModuleAvailabilityService = ModuleAvailabilityService;
//# sourceMappingURL=ModuleAvailabilityService.js.map