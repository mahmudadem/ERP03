"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runModuleStartupValidation = void 0;
/**
 * Module Startup Validation
 *
 * Runs at server startup to build the in-memory availability map.
 * This validates the union of DB records and code manifests.
 *
 * Rules:
 * - DB + code: validate compatibility
 * - DB only: mark runtime availability failed, reason IMPLEMENTATION_MISSING
 * - code only: expose to SuperAdmin as UNREGISTERED_IMPLEMENTATION
 * - neither: irrelevant
 *
 * This does NOT write to DB.
 */
const ModuleAvailabilityService_1 = require("../application/platform/ModuleAvailabilityService");
const ModuleRegistry_1 = require("../application/platform/ModuleRegistry");
const EntitlementServiceAdapter_1 = require("../application/platform/EntitlementServiceAdapter");
const EntitlementService_1 = require("../application/platform/EntitlementService");
const PermissionCatalogSyncService_1 = require("../application/platform/PermissionCatalogSyncService");
const bindRepositories_1 = require("../infrastructure/di/bindRepositories");
async function runModuleStartupValidation() {
    console.log('=== Module Startup Validation ===');
    try {
        const codeModuleRegistry = ModuleRegistry_1.ModuleRegistry.getInstance();
        const moduleRegistryRepo = bindRepositories_1.diContainer.moduleRegistryRepository;
        let entitlementService;
        if (bindRepositories_1.diContainer.companyEntitlementRepository) {
            console.log('Using EntitlementService (normalized tables)');
            entitlementService = new EntitlementService_1.EntitlementService(bindRepositories_1.diContainer.companyEntitlementRepository);
        }
        else {
            console.log('Using EntitlementServiceAdapter (legacy company.modules)');
            entitlementService = new EntitlementServiceAdapter_1.EntitlementServiceAdapter(bindRepositories_1.diContainer.companyRepository);
        }
        ModuleAvailabilityService_1.ModuleAvailabilityService.create(moduleRegistryRepo, codeModuleRegistry, entitlementService);
        const report = await ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance().buildAvailabilityMap();
        if (report.dbOnly.length > 0) {
            console.warn('⚠️  DB-only modules (no implementation):', report.dbOnly.join(', '));
        }
        if (report.codeOnly.length > 0) {
            console.warn('⚠️  Code-only modules (not registered):', report.codeOnly.join(', '));
        }
        if (report.versionMismatch.length > 0) {
            console.warn('⚠️  Version mismatch modules:');
            for (const vm of report.versionMismatch) {
                console.warn(`   - ${vm.moduleId}: DB=${vm.dbVersion}, Code=${vm.codeVersion}`);
            }
        }
        if (report.dbOnly.length === 0 && report.codeOnly.length === 0 && report.versionMismatch.length === 0) {
            console.log('✓ All modules validated successfully');
        }
        await runCapabilityStartupValidation();
        await runPermissionStartupValidation();
        console.log('=== Startup Validation Complete ===');
    }
    catch (error) {
        console.error('Module startup validation failed:', error);
        throw error;
    }
}
exports.runModuleStartupValidation = runModuleStartupValidation;
async function runCapabilityStartupValidation() {
    console.log('=== Capability Startup Validation ===');
    if (!bindRepositories_1.diContainer.capabilityRegistryRepository) {
        console.log('⚠️  Capability registry repository not configured, skipping');
        return;
    }
    try {
        const capabilities = await bindRepositories_1.diContainer.capabilityRegistryRepository.getAll();
        const readyCapabilities = capabilities.filter(c => c.lifecycleStatus === 'ready');
        if (capabilities.length === 0) {
            console.log('✓ No capabilities registered');
            return;
        }
        console.log(`Found ${capabilities.length} capabilities (${readyCapabilities.length} ready)`);
        const invalidCapabilities = capabilities.filter(c => {
            if (c.lifecycleStatus === 'ready' && c.runtimeStatus !== 'available') {
                return true;
            }
            if (c.enablementPolicy === 'platform_only') {
                return false;
            }
            if (c.enablementPolicy !== 'company_admin_optional' &&
                c.enablementPolicy !== 'bundle_entitled') {
                return true;
            }
            return false;
        });
        if (invalidCapabilities.length > 0) {
            console.error('✗ Invalid capabilities found:', invalidCapabilities.map(c => c.code).join(', '));
            throw new Error(`Invalid capabilities: ${invalidCapabilities.map(c => c.code).join(', ')}`);
        }
        const unreadyWithOptionalPolicy = capabilities.filter(c => c.enablementPolicy === 'company_admin_optional' && c.lifecycleStatus !== 'ready');
        if (unreadyWithOptionalPolicy.length > 0) {
            console.warn('⚠️  company_admin_optional capabilities not ready:', unreadyWithOptionalPolicy.map(c => c.code).join(', '));
        }
        console.log('✓ All capabilities validated successfully');
    }
    catch (error) {
        if (error.message.includes('Invalid capabilities')) {
            throw error;
        }
        console.error('Capability startup validation failed:', error);
    }
}
async function runPermissionStartupValidation() {
    console.log('=== Permission Startup Validation ===');
    if (!bindRepositories_1.diContainer.permissionRegistryRepository) {
        console.log('⚠️  Permission registry repository not configured, skipping');
        return;
    }
    try {
        const syncService = new PermissionCatalogSyncService_1.PermissionCatalogSyncService();
        const report = await syncService.sync();
        if (report.errors.length > 0) {
            console.error('✗ Permission sync failed:', report.errors.join(', '));
            throw new Error(`Permission sync failed: ${report.errors.join(', ')}`);
        }
        if (report.synced === 0) {
            console.warn('⚠️  No permissions synced - catalog may be empty');
        }
        console.log(`✓ Permission catalog synced: ${report.synced} permissions (${report.newPermissions.length} new, ${report.updatedPermissions.length} updated)`);
    }
    catch (error) {
        console.error('✗ Permission startup validation failed:', error);
        throw error;
    }
}
//# sourceMappingURL=moduleStartupValidation.js.map