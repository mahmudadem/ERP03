import { CapabilityRegistry, CompanyCapability } from '../../../domain/company/entities/CompanyCapability';
import { ICapabilityRegistryRepository } from '../../../repository/interfaces/company/ICapabilityRegistryRepository';
import { ICompanyEntitlementRepository } from '../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';

export interface CompanyCapabilityAccessItem {
  code: string;
  moduleId: string;
  name: string;
  description?: string;
  enablementPolicy: CapabilityRegistry['enablementPolicy'];
  enabled: boolean;
  available: boolean;
  blockedReason?: string;
}

export interface CompanyCapabilityAccessInput {
  companyId: string;
  accessibleModules: string[];
  capabilityRepository: ICapabilityRegistryRepository;
  entitlementRepository: ICompanyEntitlementRepository;
}

function normalize(value: string | undefined | null): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeList(values?: string[]): string[] {
  return (values || []).map(normalize).filter(Boolean);
}

function buildRegistryIndexes(capabilities: CapabilityRegistry[]) {
  const byCode = new Map<string, CapabilityRegistry>();
  const byId = new Map<string, CapabilityRegistry>();

  for (const capability of capabilities) {
    byCode.set(normalize(capability.code), capability);
    byId.set(normalize(capability.id), capability);
  }

  return { byCode, byId };
}

function resolveCapabilityForState(
  state: CompanyCapability,
  byCode: Map<string, CapabilityRegistry>,
  byId: Map<string, CapabilityRegistry>
): CapabilityRegistry | undefined {
  const key = normalize(state.capabilityId);
  return byCode.get(key) || byId.get(key);
}

function isCapabilityEntitled(
  capability: CapabilityRegistry,
  entitledCapabilities: Set<string>
): boolean {
  return entitledCapabilities.has(normalize(capability.code)) ||
    entitledCapabilities.has(normalize(capability.id));
}

function getCapabilityBlockedReason(
  capability: CapabilityRegistry,
  entitledCapabilities: Set<string>,
  accessibleModules: Set<string>
): string | undefined {
  if (capability.enablementPolicy !== 'company_admin_optional') {
    return 'Capability is not company-admin optional';
  }

  if (capability.lifecycleStatus !== 'ready') {
    return `Capability is not ready for use: ${capability.lifecycleStatus}`;
  }

  if (capability.runtimeStatus !== 'available') {
    return 'Capability is suspended';
  }

  if (capability.implementationStatus !== 'passed') {
    return 'Capability implementation check not passed';
  }

  if (!isCapabilityEntitled(capability, entitledCapabilities)) {
    return 'Company is not entitled to this capability';
  }

  if (!accessibleModules.has(normalize(capability.moduleId))) {
    return `Parent module ${capability.moduleId} must be enabled and available first`;
  }

  return undefined;
}

export async function resolveCompanyCapabilityAccess(
  input: CompanyCapabilityAccessInput
): Promise<CompanyCapabilityAccessItem[]> {
  const [capabilities, companyCapabilities, entitledCapabilityCodes] = await Promise.all([
    input.capabilityRepository.getAll(),
    input.capabilityRepository.getByCompanyId(input.companyId),
    input.entitlementRepository.getEffectiveCapabilities(input.companyId),
  ]);

  const accessibleModuleSet = new Set(normalizeList(input.accessibleModules));
  const entitledCapabilitySet = new Set(normalizeList(entitledCapabilityCodes));
  const { byCode, byId } = buildRegistryIndexes(capabilities);

  const enabledCapabilityCodes = new Set<string>();
  for (const state of companyCapabilities) {
    if (!state.isEnabled) continue;

    const capability = resolveCapabilityForState(state, byCode, byId);
    if (capability) {
      enabledCapabilityCodes.add(normalize(capability.code));
    }
  }

  return capabilities
    .map((capability) => {
      const code = normalize(capability.code);
      const blockedReason = getCapabilityBlockedReason(
        capability,
        entitledCapabilitySet,
        accessibleModuleSet
      );
      const enabled = enabledCapabilityCodes.has(code);

      return {
        code,
        moduleId: normalize(capability.moduleId),
        name: capability.name,
        description: capability.description,
        enablementPolicy: capability.enablementPolicy,
        enabled,
        available: !blockedReason,
        blockedReason,
      };
    })
    .filter((item) => item.available || (item.enabled && item.enablementPolicy === 'company_admin_optional'));
}

export async function resolveEnabledCompanyCapabilityCodes(
  input: CompanyCapabilityAccessInput
): Promise<string[]> {
  const capabilities = await resolveCompanyCapabilityAccess(input);
  return capabilities
    .filter((capability) => capability.enabled && capability.available)
    .map((capability) => capability.code);
}
