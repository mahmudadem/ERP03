import { CompanyModule } from '../../../domain/company/entities/CompanyModule';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';
import { CompanyUser } from '../../../domain/rbac/CompanyUser';
import { ModuleAvailabilityService } from '../../platform/ModuleAvailabilityService';

function normalizeList(values?: string[]): string[] {
  return (values || [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

export function roleHasModuleWildcard(
  role: CompanyRole | null | undefined,
  membership: Pick<CompanyUser, 'roleId' | 'isOwner'> | null | undefined
): boolean {
  if (membership?.isOwner === true) return true;

  const roleId = String(role?.id || membership?.roleId || '').trim().toUpperCase();
  const roleName = String(role?.name || '').trim().toUpperCase();
  if (roleId === 'OWNER' || roleId === 'ADMIN') return true;
  if (roleName === 'OWNER' || roleName === 'ADMIN' || roleName === 'ADMINISTRATOR') return true;

  const permissions = [
    ...(role?.explicitPermissions || []),
    ...(role?.resolvedPermissions || []),
    ...(role?.permissions || []),
  ];
  return permissions.includes('*');
}

export function resolveCompanyModuleAccess(input: {
  companyModules: CompanyModule[];
  legacyModules?: string[];
  entitledModules?: string[];
  roleModuleBundles?: string[];
  role?: CompanyRole | null;
  membership?: Pick<CompanyUser, 'roleId' | 'isOwner'> | null;
}): string[] {
  const hasCompanyModuleRecords = input.companyModules.length > 0;
  const legacyModuleSet = new Set(normalizeList(input.legacyModules));
  const entitledModuleSet = new Set(normalizeList(input.entitledModules));
  const roleModuleSet = new Set(normalizeList(input.roleModuleBundles));

  const enabledModuleSet = hasCompanyModuleRecords
    ? new Set(
        input.companyModules
          .filter((module) => module.isEnabled)
          .map((module) => String(module.moduleCode || '').trim().toLowerCase())
          .filter(Boolean)
      )
    : legacyModuleSet;

  const companyAllowedModules = Array.from(enabledModuleSet).filter(
    (moduleId) => entitledModuleSet.has(moduleId) || legacyModuleSet.has(moduleId)
  );

  if (roleHasModuleWildcard(input.role, input.membership)) {
    return companyAllowedModules;
  }

  if (roleModuleSet.size === 0) {
    return [];
  }

  return companyAllowedModules.filter((moduleId) => roleModuleSet.has(moduleId));
}

export function resolveCompanyEnabledModules(input: {
  companyModules: CompanyModule[];
  legacyModules?: string[];
  entitledModules?: string[];
}): string[] {
  return resolveCompanyModuleAccess({
    companyModules: input.companyModules,
    legacyModules: input.legacyModules,
    entitledModules: input.entitledModules,
    roleModuleBundles: [],
    role: null,
    membership: { roleId: 'OWNER', isOwner: true },
  });
}

export async function filterRuntimeAvailableModules(
  companyId: string,
  moduleIds: string[],
  availabilityService: ModuleAvailabilityService = ModuleAvailabilityService.getInstance()
): Promise<string[]> {
  const result: string[] = [];
  const normalizedModuleIds = normalizeList(moduleIds);

  for (const moduleId of normalizedModuleIds) {
    const availability = await availabilityService.isAvailableForCompany(moduleId, companyId);
    if (availability.available) {
      result.push(moduleId);
    }
  }

  return result;
}
