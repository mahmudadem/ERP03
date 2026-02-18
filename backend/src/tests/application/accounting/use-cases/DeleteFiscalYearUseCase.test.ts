import { DeleteFiscalYearUseCase } from '../../../../application/accounting/use-cases/FiscalYearUseCases';
import { IFiscalYearRepository } from '../../../../repository/interfaces/accounting/IFiscalYearRepository';
import { IVoucherRepository } from '../../../../domain/accounting/repositories/IVoucherRepository';
import { PermissionChecker } from '../../../../application/rbac/PermissionChecker';
import { FiscalYearStatus, PeriodStatus } from '../../../../domain/accounting/entities/FiscalYear';

describe('DeleteFiscalYearUseCase', () => {
    let useCase: DeleteFiscalYearUseCase;
    let mockFiscalYearRepo: any;
    let mockVoucherRepo: any;
    let mockPermissionChecker: any;

    beforeEach(() => {
        mockFiscalYearRepo = {
            findById: jest.fn(),
            delete: jest.fn()
        };
        mockVoucherRepo = {
            findByDateRange: jest.fn()
        };
        mockPermissionChecker = {
            assertOrThrow: jest.fn().mockResolvedValue(undefined)
        };
        useCase = new DeleteFiscalYearUseCase(mockFiscalYearRepo, mockVoucherRepo, mockPermissionChecker);
    });

    test('Deletes fiscal year if no vouchers exist and not closed', async () => {
        const fy = {
            id: 'fy1',
            name: 'FY 2024',
            status: FiscalYearStatus.OPEN,
            periods: [{ status: PeriodStatus.OPEN, periodNo: 1, isSpecial: false }],
            startDate: '2024-01-01',
            endDate: '2024-12-31'
        };
        mockFiscalYearRepo.findById.mockResolvedValue(fy);
        mockVoucherRepo.findByDateRange.mockResolvedValue([]);

        await useCase.execute('c1', 'u1', 'fy1');

        expect(mockFiscalYearRepo.delete).toHaveBeenCalledWith('c1', 'fy1');
    });

    test('Throws if fiscal year has vouchers', async () => {
        const fy = {
            id: 'fy1',
            name: 'FY 2024',
            status: FiscalYearStatus.OPEN,
            periods: [{ status: PeriodStatus.OPEN, periodNo: 1, isSpecial: false }],
            startDate: '2024-01-01',
            endDate: '2024-12-31'
        };
        mockFiscalYearRepo.findById.mockResolvedValue(fy);
        mockVoucherRepo.findByDateRange.mockResolvedValue([{ id: 'v1' }]);

        await expect(useCase.execute('c1', 'u1', 'fy1')).rejects.toThrow(/contains vouchers/);
    });

    test('Throws if fiscal year is CLOSED', async () => {
        const fy = {
            id: 'fy1',
            status: FiscalYearStatus.CLOSED,
            periods: []
        };
        mockFiscalYearRepo.findById.mockResolvedValue(fy);

        await expect(useCase.execute('c1', 'u1', 'fy1')).rejects.toThrow(/CLOSED/);
    });
});
