import { authMiddleware } from '../../../api/middlewares/authMiddleware';
import { ApiError } from '../../../api/errors/ApiError';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

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

function buildRequest(companyId?: string) {
  return {
    headers: {
      authorization: 'Bearer valid-token',
      ...(companyId ? { 'x-company-id': companyId } : {}),
    },
  } as any;
}

describe('authMiddleware tenant context guard', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    overrideContainer('tokenVerifier', {
      verify: jest.fn().mockResolvedValue({ uid: 'user-1', email: 'user@example.com' }),
    });
    overrideContainer('userRepository', {
      getUserById: jest.fn().mockResolvedValue({ isAdmin: () => false }),
      getUserActiveCompany: jest.fn().mockResolvedValue(null),
    });
    overrideContainer('rbacCompanyUserRepository', {
      getByUserAndCompany: jest.fn().mockResolvedValue(null),
    });
  });

  afterEach(() => {
    restoreContainer();
    jest.restoreAllMocks();
  });

  it('allows a company header when the user has membership', async () => {
    const membership = { userId: 'user-1', companyId: 'cmp-1', roleId: 'ACCOUNTANT', isOwner: false };
    overrideContainer('rbacCompanyUserRepository', {
      getByUserAndCompany: jest.fn().mockResolvedValue(membership),
    });
    const req = buildRequest('cmp-1');
    const next = jest.fn();

    await authMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({
      uid: 'user-1',
      companyId: 'cmp-1',
      roleId: 'ACCOUNTANT',
      isOwner: false,
      isSuperAdmin: false,
    });
  });

  it('rejects a caller-selected company when the user has no membership', async () => {
    const req = buildRequest('other-company');
    const next = jest.fn();

    await authMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('COMPANY_ACCESS_DENIED');
    expect(req.user).toBeUndefined();
  });

  it('does not trust a stale stored active company without membership', async () => {
    overrideContainer('userRepository', {
      getUserById: jest.fn().mockResolvedValue({ isAdmin: () => false }),
      getUserActiveCompany: jest.fn().mockResolvedValue('stale-company'),
    });
    const req = buildRequest();
    const next = jest.fn();

    await authMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user.companyId).toBeNull();
    expect(req.user.roleId).toBeNull();
  });
});
