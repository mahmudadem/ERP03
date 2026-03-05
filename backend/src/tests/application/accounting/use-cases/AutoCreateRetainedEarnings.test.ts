import { AutoCreateRetainedEarningsUseCase } from '../../../../application/accounting/use-cases/FiscalYearUseCases';
import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { PermissionChecker } from '../../../../application/rbac/PermissionChecker';

describe('AutoCreateRetainedEarningsUseCase', () => {
    let useCase: AutoCreateRetainedEarningsUseCase;
    let mockAccountRepo: any;
    let mockPermissionChecker: any;

    beforeEach(() => {
        mockAccountRepo = {
            list: jest.fn(),
            create: jest.fn()
        };
        mockPermissionChecker = {
            assertOrThrow: jest.fn().mockResolvedValue(true)
        };
        useCase = new AutoCreateRetainedEarningsUseCase(mockAccountRepo, mockPermissionChecker);
    });

    test('Creates account if it does not exist', async () => {
        mockAccountRepo.list.mockResolvedValue([
            { userCode: '1000', name: 'Cash' }
        ]);
        mockAccountRepo.create.mockResolvedValue({ id: 'new-acc', userCode: '30200', name: 'Retained Earnings', equitySubgroup: 'RETAINED_EARNINGS' });

        const result = await useCase.execute('c1', 'u1');

        expect(result.created).toBe(true);
        expect(result.account.userCode).toBe('30200');
        expect(mockAccountRepo.create).toHaveBeenCalledWith('c1', expect.objectContaining({
            userCode: '30200',
            name: 'Retained Earnings',
            classification: 'EQUITY',
            isProtected: true,
            equitySubgroup: 'RETAINED_EARNINGS'
        }));
    });

    test('Returns existing account found by equitySubgroup tag', async () => {
        const existing = { id: 'ext-tag', userCode: '30500', name: 'Accumulated Profit', equitySubgroup: 'RETAINED_EARNINGS' };
        mockAccountRepo.list.mockResolvedValue([existing]);

        const result = await useCase.execute('c1', 'u1');

        expect(result.created).toBe(false);
        expect(result.account.id).toBe('ext-tag');
        expect(mockAccountRepo.create).not.toHaveBeenCalled();
    });

    test('Falls back to name-based lookup for backward compat', async () => {
        const existing = { id: 'ext-1', userCode: '30500', name: 'Retained Earnings' };
        mockAccountRepo.list.mockResolvedValue([existing]);

        const result = await useCase.execute('c1', 'u1');

        expect(result.created).toBe(false);
        expect(result.account.id).toBe('ext-1');
        expect(mockAccountRepo.create).not.toHaveBeenCalled();
    });

    test('Creates new account if code 30200 is taken but not by RE', async () => {
        const existing = { id: 'ext-2', userCode: '30200', name: 'Other Account' };
        mockAccountRepo.list.mockResolvedValue([existing]);
        mockAccountRepo.create.mockImplementation((companyId, data) => Promise.resolve({ id: 'new-acc', ...data }));

        const result = await useCase.execute('c1', 'u1');

        expect(result.created).toBe(true);
        expect(result.account.userCode).toBe('30201');
    });

    test('Handles code collision by incrementing', async () => {
        mockAccountRepo.list.mockResolvedValue([
            { userCode: '30200', name: 'Some other account' },
            { userCode: '30201', name: 'Another one' }
        ]);
        mockAccountRepo.create.mockImplementation((companyId, data) => Promise.resolve({ id: 'new-acc', ...data }));

        const result = await useCase.execute('c1', 'u1');

        expect(result.created).toBe(true);
        expect(result.account.userCode).toBe('30202');
    });
});
