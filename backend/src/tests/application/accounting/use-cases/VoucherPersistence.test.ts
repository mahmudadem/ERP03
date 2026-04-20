import { CreateVoucherUseCase, UpdateVoucherUseCase } from '../../../../application/accounting/use-cases/VoucherUseCases';
import { VoucherEntity } from '../../../../domain/accounting/entities/VoucherEntity';
import { PostingLockPolicy, VoucherStatus, VoucherType } from '../../../../domain/accounting/types/VoucherTypes';
import { VoucherLineEntity } from '../../../../domain/accounting/entities/VoucherLineEntity';

// 1. Mock VoucherValidationService BEFORE import if possible, or use jest.mock
jest.mock('../../../../domain/accounting/services/VoucherValidationService', () => {
    return {
        VoucherValidationService: jest.fn().mockImplementation(() => {
            return {
                validateCore: jest.fn(),
                validateAccounts: jest.fn().mockResolvedValue(undefined),
                validatePolicies: jest.fn().mockResolvedValue(undefined)
            };
        })
    };
});

// Mock Dependencies
const mockPermissionChecker: any = {
    assertOrThrow: jest.fn().mockResolvedValue(undefined)
};

const mockVoucherRepo: any = {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(null) // Default
};

const mockAccountRepo: any = {
    getById: jest.fn().mockResolvedValue({ 
        id: 'acc1', 
        userCode: '1000',
        name: 'Test Account',
        accountRole: 'POSTING', 
        currencyPolicy: 'INHERIT', 
        status: 'ACTIVE', 
        setHasChildren: jest.fn() 
    }),
    hasChildren: jest.fn().mockResolvedValue(false),
    isUsed: jest.fn().mockResolvedValue(true)
};

const mockLedgerRepo: any = {
    deleteForVoucher: jest.fn().mockResolvedValue(undefined),
    recordForVoucher: jest.fn().mockResolvedValue(undefined)
};

const mockPolicyConfig: any = {
    getConfig: jest.fn().mockResolvedValue({
        strictApprovalMode: false,
        approvalRequired: false,
        allowEditDeletePosted: true
    })
};

const mockSettingsRepo: any = {
    getSettings: jest.fn().mockResolvedValue({ baseCurrency: 'USD', autoNumbering: false })
};

const mockTransaction: any = { id: 'tx-1' };
const mockTransactionManager: any = {
    runTransaction: jest.fn((cb) => cb(mockTransaction))
};

const mockVoucherTypeRepo: any = {
    getByCode: jest.fn().mockResolvedValue(null) // Return null/undefined to skip complex type logic
};

describe('Voucher Persistence Tests', () => {

    let createUseCase: CreateVoucherUseCase;
    let updateUseCase: UpdateVoucherUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup default mocks
        mockSettingsRepo.getSettings.mockResolvedValue({ baseCurrency: 'USD' });
        mockPolicyConfig.getConfig.mockResolvedValue({
            strictApprovalMode: false,
            approvalRequired: false,
            allowEditDeletePosted: true
        });
        mockAccountRepo.getById.mockImplementation(async (_companyId: string, accountId: string) => ({
            id: accountId,
            userCode: String(accountId).toUpperCase(),
            name: 'Test Account',
            accountRole: 'POSTING',
            currencyPolicy: 'INHERIT',
            status: 'ACTIVE',
            setHasChildren: jest.fn()
        }));
        
        createUseCase = new CreateVoucherUseCase(
            mockVoucherRepo,
            mockAccountRepo,
            mockSettingsRepo,
            mockPermissionChecker,
            mockTransactionManager,
            mockVoucherTypeRepo,
            undefined, // policyConfigProvider
            undefined, // ledgerRepo
            undefined, // policyRegistry
            undefined, // currencyRepo
            undefined  // sequenceRepo
        );

        updateUseCase = new UpdateVoucherUseCase(
            mockVoucherRepo,
            mockAccountRepo,
            mockPermissionChecker,
            mockTransactionManager,
            undefined, // policyConfigProvider
            undefined  // ledgerRepo
        );
    });

    test('CreateVoucherUseCase persists postingPeriodNo', async () => {
        const payload = {
            companyId: 'c1',
            voucherNo: 'V-001',
            date: '2024-12-31',
            type: VoucherType.JOURNAL_ENTRY, // Use generic type
            description: 'Test',
            currency: 'USD',
            lines: [
                { accountId: 'acc1', side: 'Debit', amount: 100 },
                { accountId: 'acc2', side: 'Credit', amount: 100 }
            ],
            postingPeriodNo: 13
        };

        await createUseCase.execute('c1', 'user1', payload);

        expect(mockVoucherRepo.save).toHaveBeenCalled();
        const savedVoucher = mockVoucherRepo.save.mock.calls[0][0];
        expect(savedVoucher).toBeInstanceOf(VoucherEntity);
        expect(savedVoucher.postingPeriodNo).toBe(13);
    });

    test('CreateVoucherUseCase passes transaction to save inside runTransaction', async () => {
        const payload = {
            companyId: 'c1',
            voucherNo: 'V-002',
            date: '2024-12-31',
            type: VoucherType.JOURNAL_ENTRY,
            description: 'Tx test',
            currency: 'USD',
            lines: [
                { accountId: 'acc1', side: 'Debit', amount: 50 },
                { accountId: 'acc2', side: 'Credit', amount: 50 }
            ]
        };

        await createUseCase.execute('c1', 'user1', payload);

        expect(mockVoucherRepo.save).toHaveBeenCalled();
        const firstSaveCall = mockVoucherRepo.save.mock.calls[0];
        expect(firstSaveCall[1]).toBe(mockTransaction);
    });

    test('UpdateVoucherUseCase preserves/updates postingPeriodNo', async () => {
        // Arrange: Existing voucher
        const existingVoucher = new VoucherEntity(
            'v1', 'c1', 'V-001', VoucherType.JOURNAL_ENTRY, '2024-12-31', 'Original',
            'USD', 'USD', 1,
            [new VoucherLineEntity(1, 'acc1', 'Debit', 100, 'USD', 100, 'USD', 1), new VoucherLineEntity(2, 'acc2', 'Credit', 100, 'USD', 100, 'USD', 1)],
            100, 100,
            VoucherStatus.DRAFT,
            {},
            'user1', new Date(),
            undefined, undefined, undefined, undefined,
            undefined, undefined, undefined, undefined,
            undefined, undefined, undefined,
            undefined, new Date(),
            13
        );

        // Ensure mock returns it
        mockVoucherRepo.findById.mockResolvedValue(existingVoucher);

        // Act: Update without changing period
        await updateUseCase.execute('c1', 'user1', 'v1', {
            description: 'Updated',
            lines: [
                { accountId: 'acc1', side: 'Debit', amount: 100 },
                { accountId: 'acc2', side: 'Credit', amount: 100 }
            ]
        });

        // Assert: Preserved
        expect(mockVoucherRepo.save).toHaveBeenCalled();
        const updated1 = mockVoucherRepo.save.mock.calls[0][0];
        expect(updated1.postingPeriodNo).toBe(13);

        // Act 2: Update period
        mockVoucherRepo.save.mockClear();
        await updateUseCase.execute('c1', 'user1', 'v1', {
            postingPeriodNo: 14,
            lines: [
                { accountId: 'acc1', side: 'Debit', amount: 100 },
                { accountId: 'acc2', side: 'Credit', amount: 100 }
            ]
        });
        
        // Assert: Updated
        const updated2 = mockVoucherRepo.save.mock.calls[0][0];
        expect(updated2.postingPeriodNo).toBe(14);
    });

    test('UpdateVoucherUseCase posted refresh passes transaction to deleteForVoucher and save', async () => {
        const approvedVoucher = new VoucherEntity(
            'v-posted', 'c1', 'V-003', VoucherType.JOURNAL_ENTRY, '2024-12-31', 'Posted Voucher',
            'USD', 'USD', 1,
            [
                new VoucherLineEntity(1, 'acc1', 'Debit', 100, 'USD', 100, 'USD', 1),
                new VoucherLineEntity(2, 'acc2', 'Credit', 100, 'USD', 100, 'USD', 1)
            ],
            100, 100,
            VoucherStatus.APPROVED,
            {},
            'user1', new Date(),
            'user1', new Date()
        );
        const postedVoucher = approvedVoucher.post('user1', new Date(), PostingLockPolicy.FLEXIBLE_LOCKED);

        mockVoucherRepo.findById.mockResolvedValue(postedVoucher);

        const postedUpdateUseCase = new UpdateVoucherUseCase(
            mockVoucherRepo,
            mockAccountRepo,
            mockPermissionChecker,
            mockTransactionManager,
            mockPolicyConfig,
            mockLedgerRepo
        );

        await postedUpdateUseCase.execute('c1', 'user1', 'v-posted', {
            description: 'Edited posted voucher',
            lines: [
                { accountId: 'acc1', side: 'Debit', amount: 100 },
                { accountId: 'acc2', side: 'Credit', amount: 100 }
            ]
        });

        expect(mockLedgerRepo.deleteForVoucher).toHaveBeenCalledWith('c1', 'v-posted', mockTransaction);
        expect(mockVoucherRepo.save).toHaveBeenCalled();
        const saveCall = mockVoucherRepo.save.mock.calls[0];
        expect(saveCall[1]).toBe(mockTransaction);
    });
});
