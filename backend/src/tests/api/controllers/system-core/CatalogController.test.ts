import { CatalogController } from '../../../../api/controllers/system-core/CatalogController';
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

const makeRes = (): any => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('CatalogController tenant context', () => {
  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('lists items using the tenant context established by tenant middleware', async () => {
    const listItems = jest.fn().mockResolvedValue([]);
    overrideContainer('catalogCore', { listItems });

    const req: any = {
      tenantContext: { companyId: 'cmp-A' },
      user: { uid: 'user-1', companyId: 'cmp-A' },
      query: {},
    };
    const res = makeRes();
    const next = jest.fn();

    await CatalogController.listItems(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(listItems).toHaveBeenCalledWith('cmp-A', {
      type: undefined,
      categoryId: undefined,
      active: undefined,
      trackInventory: undefined,
      limit: undefined,
      offset: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it('forwards pagination and trackInventory filters to catalogCore.listItems', async () => {
    const listItems = jest.fn().mockResolvedValue([]);
    overrideContainer('catalogCore', { listItems });

    const req: any = {
      tenantContext: { companyId: 'cmp-A' },
      user: { uid: 'user-1', companyId: 'cmp-A' },
      query: {
        active: 'true',
        trackInventory: 'true',
        limit: '1000',
        offset: '25',
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await CatalogController.listItems(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(listItems).toHaveBeenCalledWith('cmp-A', {
      type: undefined,
      categoryId: undefined,
      active: true,
      trackInventory: true,
      limit: 1000,
      offset: 25,
    });
  });

  it('passes the authenticated company into item lookup', async () => {
    const getItem = jest.fn().mockResolvedValue(null);
    overrideContainer('catalogCore', { getItem });

    const req: any = {
      tenantContext: { companyId: 'cmp-A' },
      user: { uid: 'user-1', companyId: 'cmp-A' },
      params: { id: 'item-1' },
    };
    const res = makeRes();
    const next = jest.fn();

    await CatalogController.getItem(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(getItem).toHaveBeenCalledWith('cmp-A', 'item-1');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });
});
