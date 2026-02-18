import { CreateFiscalYearUseCase } from '../FiscalYearUseCases';
import { IFiscalYearRepository } from '../../../../repository/interfaces/accounting/IFiscalYearRepository';
import { ICompanyRepository } from '../../../../repository/interfaces/core/ICompanyRepository';
import { PermissionChecker } from '../../../rbac/PermissionChecker';
import { PeriodScheme, FiscalYear } from '../../../../domain/accounting/entities/FiscalYear';

describe('CreateFiscalYearUseCase', () => {
  let useCase: CreateFiscalYearUseCase;
  let mockFiscalYearRepo: jest.Mocked<IFiscalYearRepository>;
  let mockCompanyRepo: jest.Mocked<ICompanyRepository>;
  let mockPermissionChecker: jest.Mocked<PermissionChecker>;

  beforeEach(() => {
    mockFiscalYearRepo = {
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      findByCompany: jest.fn().mockResolvedValue([]),
      findActiveForDate: jest.fn(),
      delete: jest.fn(),
    } as any;
    mockCompanyRepo = {
      findById: jest.fn(),
    } as any;
    mockPermissionChecker = {
        assertOrThrow: jest.fn(),
    } as any;

    useCase = new CreateFiscalYearUseCase(
      mockFiscalYearRepo,
      mockCompanyRepo,
      mockPermissionChecker
    );
  });

  it('creates MONTHLY fiscal year by default', async () => {
    await useCase.execute('company1', 'user1', { year: 2026, startMonth: 1 });

    expect(mockFiscalYearRepo.save).toHaveBeenCalled();
    const saveCall = mockFiscalYearRepo.save.mock.calls[0][0];
    expect(saveCall.periodScheme).toBe(PeriodScheme.MONTHLY);
    expect(saveCall.periods).toHaveLength(12);
    expect(saveCall.periods[0].id).toBe('FY2026-P01');
  });

  it('creates MAR-FEB MONTHLY fiscal year', async () => {
      // Start March 2026 -> End Feb 2027
      await useCase.execute('company1', 'user1', { year: 2026, startMonth: 3 });
  
      expect(mockFiscalYearRepo.save).toHaveBeenCalled();
      const saveCall = mockFiscalYearRepo.save.mock.calls[0][0];
      expect(saveCall.periodScheme).toBe(PeriodScheme.MONTHLY);
      expect(saveCall.periods).toHaveLength(12);
      expect(saveCall.id).toBe('FY2027'); // ID derived from End Year
      expect(saveCall.periods[0].id).toBe('FY2027-P01'); // Period IDs match FY ID
    });

  it('creates QUARTERLY fiscal year', async () => {
    await useCase.execute('company1', 'user1', { 
        year: 2026, 
        startMonth: 1, 
        periodScheme: PeriodScheme.QUARTERLY 
    });

    expect(mockFiscalYearRepo.save).toHaveBeenCalled();
    const saveCall = mockFiscalYearRepo.save.mock.calls[0][0];
    expect(saveCall.periodScheme).toBe(PeriodScheme.QUARTERLY);
    expect(saveCall.periods).toHaveLength(4);
    expect(saveCall.periods[0].id).toBe('FY2026-P01'); // Q1
    expect(saveCall.periods[3].id).toBe('FY2026-P04'); // Q4
  });

  it('creates SEMI_ANNUAL fiscal year', async () => {
    await useCase.execute('company1', 'user1', { 
        year: 2026, 
        startMonth: 1, 
        periodScheme: PeriodScheme.SEMI_ANNUAL 
    });

    expect(mockFiscalYearRepo.save).toHaveBeenCalled();
    const saveCall = mockFiscalYearRepo.save.mock.calls[0][0];
    expect(saveCall.periodScheme).toBe(PeriodScheme.SEMI_ANNUAL);
    expect(saveCall.periods).toHaveLength(2);
    expect(saveCall.periods[0].id).toBe('FY2026-P01'); // H1
    expect(saveCall.periods[1].id).toBe('FY2026-P02'); // H2
  });

  it('throws error for invalid period scheme', async () => {
    const invalidScheme = 'WEEKLY' as any;
    
    await expect(useCase.execute('company1', 'user1', { 
        year: 2026, 
        startMonth: 1, 
        periodScheme: invalidScheme 
    })).rejects.toHaveProperty('code', 'INVALID_PERIOD_SCHEME');
  });
});
