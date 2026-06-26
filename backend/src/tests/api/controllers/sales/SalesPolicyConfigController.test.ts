import { SalesController } from '../../../../api/controllers/sales/SalesController';
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
 * Task 267-D: Sales module-local doorway to the engine-owned typed
 * `PolicyConfig`. The route is gated by `sales.settings.manage` and
 * exposes only Sales-scoped rules. Tenant isolation is enforced by
 * always using the auth `companyId`.
 */
describe('SalesController.getPolicies / updatePolicies (Task 267-D)', () => {
  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('GET /tenant/sales/policies returns ONLY Sales-tagged rules (does NOT include unscoped TENANT rules)', async () => {
    // CTO review feedback 267-D: a module doorway must NEVER include
    // unscoped TENANT/company-wide rules in its response. Those rules
    // belong to the company-wide matrix; the Sales doorway must not
    // mutate their module tag nor expose them for editing.
    const existing = new PolicyConfig({
      companyId: 'cmp-A',
      rules: [
        { id: 'sales-invoice-threshold', scope: 'MODULE', module: 'sales', action: 'invoicePosting', effect: 'REQUIRE_APPROVAL', requireApprovalAbove: 10000 },
        { id: 'pos-direct-sale', scope: 'MODULE', module: 'pos', action: 'directSale', effect: 'ALLOW' },
        { id: 'purchases-threshold', scope: 'MODULE', module: 'purchases', action: 'invoicePosting', effect: 'BLOCK' },
        { id: 'tenant-hard', scope: 'TENANT', action: 'directSale', effect: 'BLOCK', isHard: true },
      ],
    });
    const getConfig = jest.fn().mockResolvedValue(existing);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig: jest.fn() });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await SalesController.getPolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const jsonCall = res.json.mock.calls[0][0];
    const ruleIds = jsonCall.data.rules.map((r: any) => r.id);
    expect(ruleIds).toEqual(['sales-invoice-threshold']);
    expect(ruleIds).not.toContain('pos-direct-sale');
    expect(ruleIds).not.toContain('purchases-threshold');
    expect(ruleIds).not.toContain('tenant-hard');
  });

  it('GET returns an empty rules array when no config exists', async () => {
    const getConfig = jest.fn().mockResolvedValue(null);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig: jest.fn() });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await SalesController.getPolicies(req, res, next);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.data.companyId).toBe('cmp-A');
    expect(jsonCall.data.rules).toEqual([]);
  });

  it('PUT /tenant/sales/policies writes Sales rules and PRESERVES rules for other modules', async () => {
    const existing = new PolicyConfig({
      companyId: 'cmp-A',
      rules: [
        { id: 'pos-keep', scope: 'MODULE', module: 'pos', action: 'directSale', effect: 'ALLOW' },
        { id: 'purchases-keep', scope: 'MODULE', module: 'purchases', action: 'invoicePosting', effect: 'BLOCK' },
      ],
    });
    const getConfig = jest.fn().mockResolvedValue(existing);
    const saveConfig = jest.fn().mockResolvedValue(undefined);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig });

    const req = makeReq({
      body: {
        rules: [
          { id: 'sales-invoice-threshold', scope: 'MODULE', action: 'invoicePosting', effect: 'REQUIRE_APPROVAL', requireApprovalAbove: 10000 },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await SalesController.updatePolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    const ids = saved.rules.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['sales-invoice-threshold', 'pos-keep', 'purchases-keep']));
    expect(saved.rules.find((r) => r.id === 'sales-invoice-threshold')?.module).toBe('sales');
  });

  it('PUT /tenant/sales/policies preserves an existing unscoped TENANT hard rule (CTO 267-D)', async () => {
    // The previous behaviour silently DELETED unscoped TENANT rules when
    // a module PUT ran, because the preservation filter was
    // `rule.module !== undefined && rule.module !== 'sales'`. A hard rule
    // (e.g. period lock) that is unscoped belongs to the company-wide
    // matrix; the Sales doorway MUST preserve it. Pinned by CTO review.
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
          { id: 'sales-invoice-threshold', scope: 'MODULE', action: 'invoicePosting', effect: 'BLOCK' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await SalesController.updatePolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    const ids = saved.rules.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['tenant-period-lock', 'sales-invoice-threshold']));
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
          { id: 'pos-thief', scope: 'MODULE', module: 'pos', action: 'directSale', effect: 'ALLOW' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await SalesController.updatePolicies(req, res, next);

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
          { id: 'sales-invoice-threshold', scope: 'MODULE', action: 'invoicePosting', effect: 'BLOCK' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await SalesController.updatePolicies(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    expect(saved.companyId).toBe('cmp-A');
  });
});
