import { InventoryController } from '../../../../api/controllers/inventory/InventoryController';
import { diContainer } from '../../../../infrastructure/di/bindRepositories';

/**
 * Task 277: a UOM conversion factor that has already been used in posted stock
 * movements is immutable. The apply-correction endpoint must reject any attempt
 * to rewrite a used factor (409) and must NOT mutate the conversion. For an
 * unused conversion the factor may still be changed. This pins the policy that
 * the old in-place "smart correction" delta-adjustment engine was removed to
 * enforce.
 */

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

const companyId = 'cmp-A';
const conversionId = 'conversion-1';

const makeReq = (overrides: any = {}): any => ({
  user: { uid: 'u-1', companyId, isSuperAdmin: false },
  params: { id: conversionId },
  body: { newFactor: 24 },
  ...overrides,
});

const makeRes = (): any => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

const stubImpact = (used: boolean) => {
  jest.spyOn(InventoryController as any, 'buildUomImpactUseCase').mockReturnValue({
    execute: jest.fn(async () => ({ used, impactedMovements: [] })),
  });
};

describe('InventoryController.applyUomConversionCorrection (Task 277 factor lock)', () => {
  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('rejects a used conversion with 409 and does not mutate it', async () => {
    const updateConversion = jest.fn();
    overrideContainer('uomConversionRepository', {
      getConversion: jest.fn(async () => ({ id: conversionId, companyId, itemId: 'item-1', factor: 12 })),
      updateConversion,
    });
    overrideContainer('uomRepository', {});
    stubImpact(true);

    const next = jest.fn();
    await InventoryController.applyUomConversionCorrection(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
    expect(updateConversion).not.toHaveBeenCalled();
  });

  it('reports noChanges for an unused conversion when the factor is unchanged', async () => {
    const updateConversion = jest.fn();
    overrideContainer('uomConversionRepository', {
      getConversion: jest.fn(async () => ({ id: conversionId, companyId, itemId: 'item-1', factor: 24 })),
      updateConversion,
    });
    overrideContainer('uomRepository', {});
    stubImpact(false);

    const res = makeRes();
    const next = jest.fn();
    await InventoryController.applyUomConversionCorrection(makeReq({ body: { newFactor: 24 } }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ noChanges: true }),
    }));
    expect(updateConversion).not.toHaveBeenCalled();
  });
});
