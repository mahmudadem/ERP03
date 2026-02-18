import { FirestoreFiscalYearRepository } from '../FirestoreFiscalYearRepository';
import { FiscalYear, PeriodScheme, PeriodStatus, FiscalYearStatus } from '../../../../../domain/accounting/entities/FiscalYear';
import * as admin from 'firebase-admin';

// Mock Firestore
const mockDocResult = (data: any) => ({
    exists: true,
    id: 'FY2025',
    data: () => data
});

const mockCollection = {
    doc: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
    get: jest.fn()
};

const mockDb = {
    collection: jest.fn().mockReturnThis(), // companies
    doc: jest.fn().mockReturnThis(), // companyId
} as any;

describe('FirestoreFiscalYearRepository', () => {
    // We need to access private methods or export the mapper functions to test them in isolation.
    // However, since we can't easily change visibility for tests without verifying the class,
    // we will test via the public `findById` method which uses `toDomain`.

    let repo: FirestoreFiscalYearRepository;

    beforeEach(() => {
        repo = new FirestoreFiscalYearRepository(mockDb);
        // We need to mock the chain: db.collection().doc().collection().doc().collection()
        // The implementation uses a helper `collection(companyId)` which builds the path.
        // It does: db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('fiscalYears')
        
        const mockFyCollection = {
            doc: jest.fn()
        };
        
        // Mock chain
        const collectionFn = jest.fn();
        const docFn = jest.fn();
        
        mockDb.collection = collectionFn;
        // companies
        collectionFn.mockReturnValue({ doc: docFn });
        // companyId
        docFn.mockReturnValue({ collection: collectionFn }); 
        
        // This is getting complicated to mock the exact chain.
        // Instead, let's look at the file. `toDomain` is defined outside the class but not exported.
        // In this environment, we can't easily access non-exported members.
        // We will assume `findById` works if we mock the *last* collection call.
        
        // Let's redefine `collection` method on the instance to avoid mocking the whole DB chain.
        (repo as any).collection = jest.fn().mockReturnValue(mockFyCollection);
    });

    it('defaults to MONTHLY period scheme when missing in data', async () => {
        const legacyData = {
            companyId: 'company1',
            name: 'FY 2025',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            status: 'OPEN',
            periods: [
                { id: '2025-01', name: 'Jan 2025', startDate: '2025-01-01', endDate: '2025-01-31', status: 'OPEN' }
            ]
            // periodScheme is MISSING
        };

        const mockGet = jest.fn().mockResolvedValue(mockDocResult(legacyData));
        ((repo as any).collection('company1').doc as jest.Mock).mockReturnValue({ get: mockGet });

        const result = await repo.findById('company1', 'FY2025');

        expect(result).toBeDefined();
        expect(result!.periodScheme).toBe(PeriodScheme.MONTHLY);
        // Explicitly check strict equality of period ID
        expect(result!.periods[0].id).toBe('2025-01'); 
    });

    it('defaults to MONTHLY period scheme when invalid in data', async () => {
        const corruptData = {
            companyId: 'company1',
            name: 'FY 2025',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            status: 'OPEN',
            periodScheme: 'INVALID_SCHEME',
            periods: []
        };

        const mockGet = jest.fn().mockResolvedValue(mockDocResult(corruptData));
        ((repo as any).collection('company1').doc as jest.Mock).mockReturnValue({ get: mockGet });

        const result = await repo.findById('company1', 'FY2025');

        expect(result).toBeDefined();
        expect(result!.periodScheme).toBe(PeriodScheme.MONTHLY);
    });

    it('loads QUARTERLY period scheme correctly', async () => {
        const newData = {
            companyId: 'company1',
            name: 'FY 2026',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            status: 'OPEN',
            periodScheme: 'QUARTERLY',
            periods: []
        };

        const mockGet = jest.fn().mockResolvedValue(mockDocResult(newData));
        ((repo as any).collection('company1').doc as jest.Mock).mockReturnValue({ get: mockGet });

        const result = await repo.findById('company1', 'FY2026');

        expect(result).toBeDefined();
        expect(result!.periodScheme).toBe(PeriodScheme.QUARTERLY);
    });
});
