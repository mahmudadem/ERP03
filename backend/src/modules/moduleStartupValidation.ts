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
import { ModuleAvailabilityService } from '../application/platform/ModuleAvailabilityService';
import { ModuleRegistry } from '../application/platform/ModuleRegistry';
import { EntitlementServiceAdapter } from '../application/platform/EntitlementServiceAdapter';
import { EntitlementService } from '../application/platform/EntitlementService';
import { PermissionCatalogSyncService } from '../application/platform/PermissionCatalogSyncService';
import { diContainer } from '../infrastructure/di/bindRepositories';

export async function runModuleStartupValidation(): Promise<void> {
  console.log('=== Module Startup Validation ===');

  try {
    const codeModuleRegistry = ModuleRegistry.getInstance();
    const moduleRegistryRepo = diContainer.moduleRegistryRepository;

    let entitlementService;
    if (diContainer.companyEntitlementRepository) {
      console.log('Using EntitlementService (normalized tables)');
      entitlementService = new EntitlementService(diContainer.companyEntitlementRepository);
    } else {
      console.log('Using EntitlementServiceAdapter (legacy company.modules)');
      entitlementService = new EntitlementServiceAdapter(diContainer.companyRepository);
    }

    ModuleAvailabilityService.create(
      moduleRegistryRepo,
      codeModuleRegistry,
      entitlementService
    );

    const report = await ModuleAvailabilityService.getInstance().buildAvailabilityMap();

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
  } catch (error) {
    console.error('Module startup validation failed:', error);
    throw error;
  }
}

async function runCapabilityStartupValidation(): Promise<void> {
  console.log('=== Capability Startup Validation ===');

  if (!diContainer.capabilityRegistryRepository) {
    console.log('⚠️  Capability registry repository not configured, skipping');
    return;
  }

  try {
    const capabilities = await diContainer.capabilityRegistryRepository.getAll();
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

    const unreadyWithOptionalPolicy = capabilities.filter(c =>
      c.enablementPolicy === 'company_admin_optional' && c.lifecycleStatus !== 'ready'
    );

    if (unreadyWithOptionalPolicy.length > 0) {
      console.warn('⚠️  company_admin_optional capabilities not ready:', unreadyWithOptionalPolicy.map(c => c.code).join(', '));
    }

    console.log('✓ All capabilities validated successfully');
  } catch (error) {
    if ((error as Error).message.includes('Invalid capabilities')) {
      throw error;
    }
    console.error('Capability startup validation failed:', error);
  }
}

async function runPermissionStartupValidation(): Promise<void> {
  console.log('=== Permission Startup Validation ===');

  if (!diContainer.permissionRegistryRepository) {
    console.log('⚠️  Permission registry repository not configured, skipping');
    return;
  }

  try {
    const syncService = new PermissionCatalogSyncService();
    await syncService.sync();
    console.log('✓ Permission catalog synced successfully');
  } catch (error) {
    console.error('Permission startup validation failed:', error);
  }
}
