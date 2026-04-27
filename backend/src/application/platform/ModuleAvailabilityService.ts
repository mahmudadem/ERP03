/**
 * ModuleAvailabilityService
 *
 * Core service that combines:
 * - Code manifests (backend implementation)
 * - DB registry (SuperAdmin metadata)
 * - Startup validation (in-memory availability map)
 * - Entitlement checks
 *
 * This service enforces the availability contract:
 * A module is available to a company only when ALL of these are true:
 * - Backend implementation exists
 * - DB registry record exists
 * - Version matches between DB and code
 * - Router exists
 * - Implementation check passed (implementationStatus = passed)
 * - lifecycleStatus = ready
 * - runtimeStatus = available
 * - Company is entitled to the module
 */
import { IModuleRegistryRepository } from '../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ModuleRegistry as CodeModuleRegistry } from './ModuleRegistry';
import { IModule, ModuleManifest } from '../../domain/platform/IModule';
import { ModuleDefinition } from '../../domain/super-admin/ModuleDefinition';
import { IEntitlementService } from './IEntitlementService';
import { LifecycleStatus, RuntimeStatus, ImplementationStatus } from '../../domain/super-admin/ModuleDefinition';

export enum ModuleAvailabilityState {
  AVAILABLE = 'available',
  DB_ONLY = 'db_only',
  CODE_ONLY = 'code_only',
  VERSION_MISMATCH = 'version_mismatch',
  IMPLEMENTATION_FAILED = 'implementation_failed',
  IMPLEMENTATION_UNCHECKED = 'implementation_unchecked',
  NOT_READY = 'not_ready',
  SUSPENDED = 'suspended',
  NOT_ENTITLED = 'not_entitled',
  ENABLED_BUT_SUSPENDED = 'enabled_but_suspended',
}

export interface ModuleAvailabilityInfo {
  moduleId: string;
  state: ModuleAvailabilityState;
  dbRecord?: ModuleDefinition;
  manifest?: ModuleManifest;
  hasRouter: boolean;
  entitlementsMissing: boolean;
  reason?: string;
}

export interface ModuleMismatchReport {
  dbOnly: string[];
  codeOnly: string[];
  versionMismatch: { moduleId: string; dbVersion: string; codeVersion: string }[];
}

const PLATFORM_IDS = ['companyadmin', 'core', 'auth', 'rbac', 'settings', 'system'];

export class ModuleAvailabilityService {
  private static instance: ModuleAvailabilityService;
  private availabilityMap: Map<string, ModuleAvailabilityInfo> = new Map();
  private initialized = false;
  private lastRefreshedAt = 0;
  private isRefreshing = false;
  private readonly CACHE_TTL_MS = 30_000;
  private versionMismatchList: { moduleId: string; dbVersion: string; codeVersion: string }[] = [];

  private constructor(
    private moduleRegistryRepo: IModuleRegistryRepository,
    private codeModuleRegistry: CodeModuleRegistry,
    private entitlementService: IEntitlementService
  ) {}

  static getInstance(): ModuleAvailabilityService {
    if (!ModuleAvailabilityService.instance) {
      throw new Error('ModuleAvailabilityService not initialized. Call create() then build() first.');
    }
    return ModuleAvailabilityService.instance;
  }

  static create(
    moduleRegistryRepo: IModuleRegistryRepository,
    codeModuleRegistry: CodeModuleRegistry,
    entitlementService: IEntitlementService
  ): ModuleAvailabilityService {
    ModuleAvailabilityService.instance = new ModuleAvailabilityService(
      moduleRegistryRepo,
      codeModuleRegistry,
      entitlementService
    );
    return ModuleAvailabilityService.instance;
  }

  private async refreshIfNeeded(): Promise<void> {
    const now = Date.now();
    if (!this.initialized || (now - this.lastRefreshedAt) < this.CACHE_TTL_MS) return;
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    try {
      await this.buildAvailabilityMap();
    } finally {
      this.isRefreshing = false;
    }
  }

  async buildAvailabilityMap(): Promise<ModuleMismatchReport> {
    this.versionMismatchList = [];
    const report: ModuleMismatchReport = { dbOnly: [], codeOnly: [], versionMismatch: [] };

    const dbModules = await this.moduleRegistryRepo.getAll();
    const dbModuleMap = new Map(
      dbModules
        .map((m) => [this.normalizeModuleId(m.code || m.id), m] as const)
        .filter(([moduleId]) => Boolean(moduleId))
    );

    const codeModules = this.codeModuleRegistry.getAllModules();
    const codeModuleMap = new Map(
      codeModules
        .map((m) => [this.normalizeModuleId(m.metadata?.id), m] as const)
        .filter(([moduleId]) => Boolean(moduleId))
    );

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
      } else if (dbModule && !codeModule) {
        this.availabilityMap.set(moduleId, {
          moduleId,
          state: ModuleAvailabilityState.DB_ONLY,
          dbRecord: dbModule,
          hasRouter: false,
          entitlementsMissing: false,
          reason: 'Implementation not found in code',
        });
        report.dbOnly.push(moduleId);
      } else if (codeModule && !dbModule) {
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

  private determineState(
    dbModule: ModuleDefinition,
    hasRouter: boolean,
    versionMismatch: boolean
  ): ModuleAvailabilityState {
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

  private getStateReason(
    state: ModuleAvailabilityState,
    dbModule: ModuleDefinition,
    versionMismatch: boolean
  ): string {
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

  isAvailable(moduleId: string): ModuleAvailabilityState {
    const info = this.availabilityMap.get(moduleId.toLowerCase());
    if (!info) return ModuleAvailabilityState.DB_ONLY;
    return info.state;
  }

  getAvailabilityInfo(moduleId: string): ModuleAvailabilityInfo | undefined {
    return this.availabilityMap.get(moduleId.toLowerCase());
  }

  async ensureCacheFresh(): Promise<void> {
    await this.refreshIfNeeded();
  }

  async isAvailableForCompany(
    moduleId: string,
    companyId: string
  ): Promise<{ available: boolean; state: ModuleAvailabilityState; reason?: string }> {
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

  async getAvailableModulesForCompany(companyId: string): Promise<string[]> {
    const available: string[] = [];

    for (const [moduleId, info] of this.availabilityMap) {
      if (PLATFORM_IDS.includes(moduleId)) continue;

      const isGloballyAvailable =
        info.state === ModuleAvailabilityState.AVAILABLE ||
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

  async getCompanyAdminAvailableModules(companyId: string, enabledModuleIds?: string[]): Promise<ModuleAvailabilityInfo[]> {
    const result: ModuleAvailabilityInfo[] = [];
    const normalizedEnabled = enabledModuleIds
      ? enabledModuleIds.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean)
      : [];

    for (const [moduleId, info] of this.availabilityMap) {
      if (PLATFORM_IDS.includes(moduleId)) continue;

      const entitled = await this.entitlementService.companyHasModule(companyId, moduleId);
      if (!entitled) continue;

      if (info.state === ModuleAvailabilityState.AVAILABLE) {
        result.push(info);
      } else if (info.state === ModuleAvailabilityState.SUSPENDED && normalizedEnabled.includes(moduleId)) {
        result.push(info);
      }
    }

    return result;
  }

  getSuperAdminView(): {
    available: ModuleDefinition[];
    dbOnly: ModuleDefinition[];
    codeOnly: { id: string; manifest: ModuleManifest; hasRouter: boolean }[];
    versionMismatch: { moduleId: string; dbVersion: string; codeVersion: string }[];
    implementationFailed: ModuleDefinition[];
    notReady: ModuleDefinition[];
    implementationUnchecked: ModuleDefinition[];
    suspended: ModuleDefinition[];
  } {
    const available: ModuleDefinition[] = [];
    const dbOnly: ModuleDefinition[] = [];
    const codeOnly: { id: string; manifest: ModuleManifest; hasRouter: boolean }[] = [];
    const implementationFailed: ModuleDefinition[] = [];
    const notReady: ModuleDefinition[] = [];
    const implementationUnchecked: ModuleDefinition[] = [];
    const suspended: ModuleDefinition[] = [];

    for (const [moduleId, info] of this.availabilityMap) {
      if (PLATFORM_IDS.includes(moduleId)) continue;

      if (info.state === ModuleAvailabilityState.AVAILABLE && info.dbRecord) {
        available.push(info.dbRecord);
      } else if (info.state === ModuleAvailabilityState.DB_ONLY && info.dbRecord) {
        dbOnly.push(info.dbRecord);
      } else if (info.state === ModuleAvailabilityState.CODE_ONLY && info.manifest) {
        codeOnly.push({ id: moduleId, manifest: info.manifest, hasRouter: info.hasRouter });
      } else if (info.state === ModuleAvailabilityState.IMPLEMENTATION_FAILED && info.dbRecord) {
        implementationFailed.push(info.dbRecord);
      } else if (info.state === ModuleAvailabilityState.NOT_READY && info.dbRecord) {
        notReady.push(info.dbRecord);
      } else if (info.state === ModuleAvailabilityState.IMPLEMENTATION_UNCHECKED && info.dbRecord) {
        implementationUnchecked.push(info.dbRecord);
      } else if (info.state === ModuleAvailabilityState.SUSPENDED && info.dbRecord) {
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

  isInitialized(): boolean {
    return this.initialized;
  }

  async rebuildAvailabilityMap(): Promise<ModuleMismatchReport> {
    return this.buildAvailabilityMap();
  }

  private normalizeModuleId(moduleId?: string): string {
    return String(moduleId || '').trim().toLowerCase();
  }

  private extractManifest(module: IModule): ModuleManifest {
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

  private checkRouterExists(module: IModule): boolean {
    try {
      const router = module.getRouter();
      return router !== undefined && router !== null;
    } catch {
      return false;
    }
  }
}
