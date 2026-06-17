import { requireCompanyParamMatchesContext } from '../../../api/middlewares/guards/companyContextGuard';
import { ApiError } from '../../../api/errors/ApiError';

describe('requireCompanyParamMatchesContext', () => {
  it('allows normal users to access their active company param', () => {
    const req: any = {
      params: { companyId: 'cmp-1' },
      user: { uid: 'user-1', companyId: 'cmp-1', isSuperAdmin: false },
    };
    const next = jest.fn();

    requireCompanyParamMatchesContext()(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks normal users from using another company param', () => {
    const req: any = {
      params: { companyId: 'cmp-2' },
      user: { uid: 'user-1', companyId: 'cmp-1', isSuperAdmin: false },
    };
    const next = jest.fn();

    requireCompanyParamMatchesContext()(req, {} as any, next);

    const error = next.mock.calls[0][0] as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('COMPANY_ACCESS_DENIED');
  });

  it('allows super admins to use an explicit company param', () => {
    const req: any = {
      params: { companyId: 'cmp-2' },
      user: { uid: 'admin-1', companyId: null, isSuperAdmin: true },
    };
    const next = jest.fn();

    requireCompanyParamMatchesContext()(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });
});
