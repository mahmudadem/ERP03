import {
  resolveCompanyCapabilityAccess,
  resolveEnabledCompanyCapabilityCodes,
} from '../CompanyCapabilityAccessResolver';
import { CapabilityRegistry } from '../../../../domain/company/entities/CompanyCapability';

const baseCapability: CapabilityRegistry = {
  id: 'cap_sales_ai',
  code: 'sales.ai',
  moduleId: 'sales',
  name: 'Sales AI',
  lifecycleStatus: 'ready',
  runtimeStatus: 'available',
  implementationStatus: 'passed',
  enablementPolicy: 'company_admin_optional',
  requiresMigration: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeCapability(overrides: Partial<CapabilityRegistry> = {}): CapabilityRegistry {
  return { ...baseCapability, ...overrides };
}

function makeRepos(input: {
  capabilities: CapabilityRegistry[];
  enabledCapabilities?: string[];
  entitledCapabilities?: string[];
}) {
  return {
    capabilityRepository: {
      getAll: jest.fn().mockResolvedValue(input.capabilities),
      getByCompanyId: jest.fn().mockResolvedValue(
        (input.enabledCapabilities || []).map((capabilityId) => ({
          companyId: 'cmp_1',
          capabilityId,
          isEnabled: true,
          config: {},
          createdAt: new Date(),
        }))
      ),
    } as any,
    entitlementRepository: {
      getEffectiveCapabilities: jest.fn().mockResolvedValue(input.entitledCapabilities || []),
    } as any,
  };
}

describe('CompanyCapabilityAccessResolver', () => {
  it('returns only enabled capabilities that pass registry, entitlement, and parent-module gates', async () => {
    const repos = makeRepos({
      capabilities: [makeCapability()],
      enabledCapabilities: ['sales.ai'],
      entitledCapabilities: ['sales.ai'],
    });

    const result = await resolveEnabledCompanyCapabilityCodes({
      companyId: 'cmp_1',
      accessibleModules: ['sales'],
      ...repos,
    });

    expect(result).toEqual(['sales.ai']);
  });

  it('blocks enabled stale capabilities when parent module is not accessible', async () => {
    const repos = makeRepos({
      capabilities: [makeCapability()],
      enabledCapabilities: ['sales.ai'],
      entitledCapabilities: ['sales.ai'],
    });

    const result = await resolveCompanyCapabilityAccess({
      companyId: 'cmp_1',
      accessibleModules: [],
      ...repos,
    });

    expect(result).toEqual([
      expect.objectContaining({
        code: 'sales.ai',
        enabled: true,
        available: false,
        blockedReason: 'Parent module sales must be enabled and available first',
      }),
    ]);
  });

  it('does not expose enabled capabilities with blocked registry policy to runtime', async () => {
    const repos = makeRepos({
      capabilities: [
        makeCapability({
          code: 'sales.platform-only',
          enablementPolicy: 'platform_only',
        }),
      ],
      enabledCapabilities: ['sales.platform-only'],
      entitledCapabilities: ['sales.platform-only'],
    });

    const result = await resolveEnabledCompanyCapabilityCodes({
      companyId: 'cmp_1',
      accessibleModules: ['sales'],
      ...repos,
    });

    expect(result).toEqual([]);
  });
});
