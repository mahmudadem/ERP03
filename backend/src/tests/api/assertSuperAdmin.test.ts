import { assertSuperAdmin } from '../../api/middlewares/assertSuperAdmin';
import { diContainer } from '../../infrastructure/di/bindRepositories';

describe('assertSuperAdmin', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects non-Super Admin users on /super-admin routes', async () => {
    jest.spyOn(diContainer as any, 'userRepository', 'get').mockReturnValue({
      getUserById: jest.fn(async () => ({ isAdmin: () => false })),
    });
    const req: any = {
      originalUrl: '/super-admin/platform/ai-providers',
      path: '/platform/ai-providers',
      user: { uid: 'user-1' },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await assertSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-Super Admin users on /platform/ai-assistant/credits/grant routes', async () => {
    jest.spyOn(diContainer as any, 'userRepository', 'get').mockReturnValue({
      getUserById: jest.fn(async () => ({ isAdmin: () => false })),
    });
    const req: any = {
      originalUrl: '/platform/ai-assistant/credits/grant',
      path: '/ai-assistant/credits/grant',
      user: { uid: 'user-1' },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await assertSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows Super Admin users on /platform/ai-assistant/credits/grant routes', async () => {
    jest.spyOn(diContainer as any, 'userRepository', 'get').mockReturnValue({
      getUserById: jest.fn(async () => ({ isAdmin: () => true })),
    });
    const req: any = {
      originalUrl: '/platform/ai-assistant/credits/grant',
      path: '/ai-assistant/credits/grant',
      user: { uid: 'admin-1' },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await assertSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when user uid is missing', async () => {
    const req: any = {
      originalUrl: '/platform/ai-assistant/credits/grant',
      path: '/ai-assistant/credits/grant',
      user: {},
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await assertSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});