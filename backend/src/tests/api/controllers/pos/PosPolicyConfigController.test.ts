import { PosController } from '../../../../api/controllers/pos/PosController';
import { diContainer } from '../../../../infrastructure/di/bindRepositories';
import { PolicyConfig } from '../../../../domain/system-core/entities/PolicyConfig';

const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();

function overrideContainer(key: string, value: any) {
  if (!originalDescriptors.has(key)) {
    originalDescriptors.set(key, Object.getOwnPropertyDescriptor(diContainer, key));
  }
  Object.defineProperty(diContainer, key, {
    configurable: true,
    get: () => value,
  });
}

function restoreContainer() {
  for (const [key, descriptor] of originalDescriptors) {
    if (descriptor) {
      Object.defineProperty(diContainer, key, descriptor);
    } else {
      delete (diContainer as any)[key];
    }
  }
  originalDescriptors.clear();
}

const makeReq = (overrides: any = {}): any => ({
  user: { uid: 'u-1', companyId: 'cmp-A', isSuperAdmin: false },
  body: {},
  ...overrides,
});

const makeRes = (): any => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res;
};

/**
 * Task 267-D: POS module-local doorway to the engine-owned typed
 * `PolicyConfig`. The route is gated by `pos.settings.manage` and must
 * NEVER expose rules tagged for another module (Sales / Purchases /
 * Accounting). Tenant isolation is enforced by always using the auth
 * `companyId`.
 */
describe('PosController.getPolicies / updatePolicies (Task 267-D)', () => {
  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('GET /tenant/pos/policies returns ONLY POS-tagged rules (does NOT include unscoped TENANT rules)', async () => {
    // CTO review feedback 267-D: a module doorway must NEVER include
    // unscoped TENANT/company-wide rules in its response. Those rules
    // belong to the company-wide matrix; the POS doorway must not
    // mutate their module tag nor expose them for editing.
    const existing = new PolicyConfig({
      companyId: 'cmp-A',
      rules: [
        { id: 'pos-direct-sale', scope: 'MODULE', module: 'pos', action: 'directSale', effect: 'ALLOW' },
        { id: 'sales-threshold', scope: 'MODULE', module: 'sales', action: 'invoicePosting', effect: 'REQUIRE_APPROVAL' },
        { id: 'purchases-threshold', scope: 'MODULE', module: 'purchases', action: 'invoicePosting', effect: 'BLOCK' },
        { id: 'tenant-default', scope: 'TENANT', action: 'directSale', effect: 'BLOCK', isHard: true },
      ],
    });
    const getConfig = jest.fn().mockResolvedValue(existing);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig: jest.fn() });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await PosController.getPolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
    // POS gets ONLY its own module rules. NEVER another module's rules,
    // and NEVER unscoped TENANT/company-wide rules.
    const ruleIds = jsonCall.data.rules.map((r: any) => r.id);
    expect(ruleIds).toEqual(['pos-direct-sale']);
    expect(ruleIds).not.toContain('sales-threshold');
    expect(ruleIds).not.toContain('purchases-threshold');
    expect(ruleIds).not.toContain('tenant-default');
  });

  it('GET returns an empty rules array when the company has no config', async () => {
    const getConfig = jest.fn().mockResolvedValue(null);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig: jest.fn() });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await PosController.getPolicies(req, res, next);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.data.companyId).toBe('cmp-A');
    expect(jsonCall.data.rules).toEqual([]);
  });

  it('PUT /tenant/pos/policies writes POS rules and PRESERVES rules for other modules', async () => {
    const existing = new PolicyConfig({
      companyId: 'cmp-A',
      rules: [
        { id: 'sales-keep', scope: 'MODULE', module: 'sales', action: 'invoicePosting', effect: 'BLOCK' },
        { id: 'purchases-keep', scope: 'MODULE', module: 'purchases', action: 'invoicePosting', effect: 'BLOCK' },
      ],
    });
    const getConfig = jest.fn().mockResolvedValue(existing);
    const saveConfig = jest.fn().mockResolvedValue(undefined);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig });

    const req = makeReq({
      body: {
        rules: [
          { id: 'pos-direct-sale', scope: 'MODULE', action: 'directSale', effect: 'ALLOW' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PosController.updatePolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(saveConfig).toHaveBeenCalledTimes(1);
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    const ids = saved.rules.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['pos-direct-sale', 'sales-keep', 'purchases-keep']));
    // The new rule is force-stamped to module: 'pos' (validator contract).
    expect(saved.rules.find((r) => r.id === 'pos-direct-sale')?.module).toBe('pos');
  });

  it('PUT /tenant/pos/policies preserves an existing unscoped TENANT hard rule (CTO 267-D)', async () => {
    // The previous behaviour silently DELETED unscoped TENANT rules when
    // a module PUT ran, because the preservation filter was
    // `rule.module !== undefined && rule.module !== 'pos'`. A hard rule
    // (e.g. period lock) that is unscoped belongs to the company-wide
    // matrix; the POS doorway MUST preserve it. Pinned by CTO review.
    const existing = new PolicyConfig({
      companyId: 'cmp-A',
      rules: [
        { id: 'tenant-period-lock', scope: 'TENANT', action: 'directSale', effect: 'BLOCK', isHard: true, reasonCode: 'PERIOD_LOCKED' },
      ],
    });
    const getConfig = jest.fn().mockResolvedValue(existing);
    const saveConfig = jest.fn().mockResolvedValue(undefined);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig });

    const req = makeReq({
      body: {
        rules: [
          { id: 'pos-direct-sale', scope: 'MODULE', action: 'directSale', effect: 'ALLOW' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PosController.updatePolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    const ids = saved.rules.map((r) => r.id);
    // The unscoped TENANT hard rule MUST be preserved untouched.
    expect(ids).toEqual(expect.arrayContaining(['tenant-period-lock', 'pos-direct-sale']));
    const tenant = saved.rules.find((r) => r.id === 'tenant-period-lock');
    expect(tenant).toBeDefined();
    expect(tenant!.isHard).toBe(true);
    expect(tenant!.reasonCode).toBe('PERIOD_LOCKED');
    // The tenant rule must remain unscoped (no module tag forced onto it).
    expect(tenant!.module).toBeUndefined();
  });

  it('PUT rejects rules tagged for another module with a 400 (no cross-module rewrite)', async () => {
    const getConfig = jest.fn().mockResolvedValue(null);
    const saveConfig = jest.fn();
    overrideContainer('policyConfigRepository', { getConfig, saveConfig });

    const req = makeReq({
      body: {
        rules: [
          { id: 'sales-thief', scope: 'MODULE', module: 'sales', action: 'invoicePosting', effect: 'ALLOW' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PosController.updatePolicies(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it('PUT uses the auth companyId — tenant isolation', async () => {
    const getConfig = jest.fn().mockResolvedValue(null);
    const saveConfig = jest.fn().mockResolvedValue(undefined);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig });

    const req = makeReq({
      user: { uid: 'u-1', companyId: 'cmp-A', isSuperAdmin: false },
      body: {
        companyId: 'cmp-EVIL', // attacker tries to write to another company
        rules: [
          { id: 'pos-direct-sale', scope: 'MODULE', action: 'directSale', effect: 'ALLOW' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PosController.updatePolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    expect(saved.companyId).toBe('cmp-A');
  });
});
