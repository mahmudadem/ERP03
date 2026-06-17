import { CompanySettingsController } from '../../../../api/controllers/core/CompanySettingsController';
import { diContainer } from '../../../../infrastructure/di/bindRepositories';

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

describe('CompanySettingsController tenant context', () => {
  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('uses authenticated user company over forged query or body company ids', async () => {
    const getSettings = jest.fn().mockResolvedValue({ companyId: 'cmp-1' });
    overrideContainer('companySettingsRepository', {
      getSettings,
    });

    const req: any = {
      user: { uid: 'user-1', companyId: 'cmp-1', isSuperAdmin: false },
      query: { companyId: 'cmp-2' },
      body: { companyId: 'cmp-3' },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await CompanySettingsController.getSettings(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(getSettings).toHaveBeenCalledWith('cmp-1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('allows super admins to inspect an explicit company settings record', async () => {
    const getSettings = jest.fn().mockResolvedValue({ companyId: 'cmp-2' });
    overrideContainer('companySettingsRepository', {
      getSettings,
    });

    const req: any = {
      user: { uid: 'admin-1', companyId: null, isSuperAdmin: true },
      query: { companyId: 'cmp-2' },
      body: {},
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await CompanySettingsController.getSettings(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(getSettings).toHaveBeenCalledWith('cmp-2');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
