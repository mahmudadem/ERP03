import { PolicyConfigController } from '../../../../api/controllers/system-core/PolicyConfigController';
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
  tenantContext: { companyId: 'cmp-A', isOwner: false, permissions: [] },
  body: {},
  ...overrides,
});

const makeRes = (): any => {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res;
};

/**
 * Task 267-D: company-wide Controls & Policies doorway. The full matrix
 * route — read and write the entire `PolicyConfig` for the company.
 *
 * Tenant isolation: `companyId` is taken from the auth context, never
 * from the request body.
 */
describe('PolicyConfigController (Task 267-D company/global)', () => {
  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('GET /tenant/settings/controls/policies returns the company-wide config', async () => {
    const existing = new PolicyConfig({
      companyId: 'cmp-A',
      rules: [
        { id: 'tenant-block', scope: 'TENANT', action: 'directSale', effect: 'BLOCK' },
      ],
    });
    const getConfig = jest.fn().mockResolvedValue(existing);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig: jest.fn() });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await PolicyConfigController.getPolicyConfig(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(getConfig).toHaveBeenCalledWith('cmp-A');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ companyId: 'cmp-A' }),
    });
  });

  it('GET returns a default empty config when no document exists yet', async () => {
    const getConfig = jest.fn().mockResolvedValue(null);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig: jest.fn() });

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await PolicyConfigController.getPolicyConfig(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
    expect(jsonCall.data.companyId).toBe('cmp-A');
    expect(jsonCall.data.rules).toEqual([]);
  });

  it('PUT /tenant/settings/controls/policies writes a full multi-module config', async () => {
    const getConfig = jest.fn().mockResolvedValue(null);
    const saveConfig = jest.fn().mockResolvedValue(undefined);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig });

    const req = makeReq({
      body: {
        rules: [
          { id: 'pos-direct-sale', scope: 'MODULE', module: 'pos', action: 'directSale', effect: 'ALLOW' },
          { id: 'sales-threshold', scope: 'MODULE', module: 'sales', action: 'invoicePosting', effect: 'REQUIRE_APPROVAL', requireApprovalAbove: 10000 },
          { id: 'purchases-threshold', scope: 'MODULE', module: 'purchases', action: 'invoicePosting', effect: 'REQUIRE_APPROVAL', requireApprovalAbove: 5000 },
          { id: 'tenant-hard', scope: 'TENANT', action: 'directSale', effect: 'BLOCK', isHard: true, reasonCode: 'PERIOD_LOCKED' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PolicyConfigController.updatePolicyConfig(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(saveConfig).toHaveBeenCalledTimes(1);
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    expect(saved.companyId).toBe('cmp-A');
    expect(saved.rules).toHaveLength(4);
    expect(saved.rules.find((r) => r.id === 'tenant-hard')?.isHard).toBe(true);
  });

  it('PUT rejects a malformed rule (missing id) with a 400', async () => {
    const getConfig = jest.fn().mockResolvedValue(null);
    const saveConfig = jest.fn();
    overrideContainer('policyConfigRepository', { getConfig, saveConfig });

    const req = makeReq({
      body: {
        rules: [{ id: '', scope: 'TENANT', action: 'directSale', effect: 'BLOCK' }],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PolicyConfigController.updatePolicyConfig(req, res, next);

    // Validator + entity both throw. Next receives the error.
    expect(next).toHaveBeenCalled();
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it('PUT uses the auth companyId — never trusts a forged companyId in the body', async () => {
    const getConfig = jest.fn().mockResolvedValue(null);
    const saveConfig = jest.fn().mockResolvedValue(undefined);
    overrideContainer('policyConfigRepository', { getConfig, saveConfig });

    const req = makeReq({
      body: {
        companyId: 'cmp-EVIL', // attacker tries to write to another company
        rules: [
          { id: 'tenant-block', scope: 'TENANT', action: 'directSale', effect: 'BLOCK' },
        ],
      },
    });
    const res = makeRes();
    const next = jest.fn();

    await PolicyConfigController.updatePolicyConfig(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const saved = saveConfig.mock.calls[0][0] as PolicyConfig;
    // The controller stamps companyId from the auth context, NEVER from
    // the body. The forged `cmp-EVIL` is silently dropped.
    expect(saved.companyId).toBe('cmp-A');
  });
});
