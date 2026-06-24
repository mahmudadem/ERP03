import { PurchaseController } from '../../../../api/controllers/purchases/PurchaseController';
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
 * Task 267-D: Purchases module-local doorway to the engine-owned typed
 * `PolicyConfig`. Gated by `purchase.settings.manage`. Exposes only
 * Purchases-scoped rules. Tenant isolation is enforced by always using
 * the auth `companyId`.
 */
describe('PurchaseController.getPolicies / updatePolicies (Task 267-D)', () => {
  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('GET /tenant/purchases/policies returns ONLY Purchases-tagged rules (does NOT include unscoped TENANT rules)', async () => {
    // CTO review feedback 267-D: a module doorway must NEVER include
    // unscoped TENANT/company-wide rules in its response. Those rules
    // belong to the company-wide matrix; the Purchases doorway must not
    // mutate their module tag nor expose them for editing.
    const existing = new PolicyConfig({
      companyId: 'cmp-A',
      rules: [
        { id: 'purchases-invoice-threshold', scope: 'MODULE', module: 'purchases', action: 'invoicePosting', effect: 'REQUIRE_APPROVAL', requireApprovalAbove: 5000 },
        { id: 'pos-direct-sale', scope: 'MODULE', module: 'pos', action: 'directSale', effect: 'ALLOW' },
        { id: 'sales-threshold', scope: 'MODULE', module: 'sales', action: 'invoicePosting', effect: 'BLOCK' },
        { id: 'tenant-hard', scope: 'TENANT', action: 'directSale', effect: 'BLOCK', isHard: true },
      ],
    });
    const getConfig = jest.fn().mockResolvedValue(existing);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig: jest.fn() });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await PurchaseController.getPolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const jsonCall = res.json.mock.calls[0][0];
    const ruleIds = jsonCall.data.rules.map((r: any) => r.id);
    expect(ruleIds).toEqual(['purchases-invoice-threshold']);
    expect(ruleIds).not.toContain('pos-direct-sale');
    expect(ruleIds).not.toContain('sales-threshold');
    expect(ruleIds).not.toContain('tenant-hard');
  });

  it('GET returns an empty rules array when no config exists', async () => {
    const getConfig = jest.fn().mockResolvedValue(null);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig: jest.fn() });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await PurchaseController.getPolicies(req, res, next);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.data.companyId).toBe('cmp-A');
    expect(jsonCall.data.rules).toEqual([]);
  });

  it('PUT /tenant/purchases/policies writes Purchases rules and PRESERVES rules for other modules', async () => {
    const existing = new PolicyConfig({
      companyId: 'cmp-A',
      rules: [
        { id: 'pos-keep', scope: 'MODULE', module: 'pos', action: 'directSale', effect: 'ALLOW' },
        { id: 'sales-keep', scope: 'MODULE', module: 'sales', action: 'invoicePosting', effect: 'BLOCK' },
      ],
    });
    const getConfig = jest.fn().mockResolvedValue(existing);
    const saveConfig = jest.fn().mockResolvedValue(undefined);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig });

    const req = makeReq({
      body: {
        rules: [
          { id: 'purchases-invoice-threshold', scope: 'MODULE', action: 'invoicePosting', effect: 'REQUIRE_APPROVAL', requireApprovalAbove: 5000 },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PurchaseController.updatePolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    const ids = saved.rules.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['purchases-invoice-threshold', 'pos-keep', 'sales-keep']));
    expect(saved.rules.find((r) => r.id === 'purchases-invoice-threshold')?.module).toBe('purchases');
  });

  it('PUT /tenant/purchases/policies preserves an existing unscoped TENANT hard rule (CTO 267-D)', async () => {
    // The previous behaviour silently DELETED unscoped TENANT rules when
    // a module PUT ran, because the preservation filter was
    // `rule.module !== undefined && rule.module !== 'purchases'`. A hard
    // rule (e.g. period lock) that is unscoped belongs to the
    // company-wide matrix; the Purchases doorway MUST preserve it.
    // Pinned by CTO review.
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
          { id: 'purchases-invoice-threshold', scope: 'MODULE', action: 'invoicePosting', effect: 'BLOCK' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PurchaseController.updatePolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    const ids = saved.rules.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['tenant-period-lock', 'purchases-invoice-threshold']));
    const tenant = saved.rules.find((r) => r.id === 'tenant-period-lock');
    expect(tenant).toBeDefined();
    expect(tenant!.isHard).toBe(true);
    expect(tenant!.reasonCode).toBe('PERIOD_LOCKED');
    expect(tenant!.module).toBeUndefined();
  });

  it('PUT rejects rules tagged for another module with a 400', async () => {
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

    await PurchaseController.updatePolicies(req, res, next);

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
        companyId: 'cmp-EVIL',
        rules: [
          { id: 'purchases-invoice-threshold', scope: 'MODULE', action: 'invoicePosting', effect: 'BLOCK' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PurchaseController.updatePolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    expect(saved.companyId).toBe('cmp-A');
  });
});
