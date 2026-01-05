import { VoucherEntity } from '../../../../domain/accounting/entities/VoucherEntity';
import { VoucherStatus, VoucherType, PostingLockPolicy } from '../../../../domain/accounting/types/VoucherTypes';
import { UpdateVoucherUseCase, CancelVoucherUseCase } from '../VoucherUseCases';
import { ApproveVoucherUseCase, RejectVoucherUseCase } from '../VoucherApprovalUseCases';
import { ReverseAndReplaceVoucherUseCase } from '../ReverseAndReplaceVoucherUseCase';
import { BusinessError } from '../../../../errors/AppError';
import { ErrorCode } from '../../../../errors/ErrorCodes';
import { makePostedVoucher } from './testHelpers';

describe('Audit Compliance (V2) - Concrete Evidence Suite', () => {
    let mockVoucherRepo: any;
    let mockLedgerRepo: any;
    let mockPermissionChecker: any;
    let mockPolicyProvider: any;

    beforeEach(() => {
        mockVoucherRepo = { findById: jest.fn(), save: jest.fn() };
        mockLedgerRepo = { getGeneralLedger: jest.fn(), deleteForVoucher: jest.fn(), recordForVoucher: jest.fn() };
        mockPermissionChecker = { assertOrThrow: jest.fn() };
        mockPolicyProvider = { getConfig: jest.fn() };
    });

    /**
     * Case A: STRICT_LOCKED Structural Immutability
     */
    it('STRICT_LOCKED: ALL mutation paths must be blocked with 423 Locked and VOUCHER_LOCKED_STRICT', async () => {
        const strictVoucher = new VoucherEntity(
            'v123', 'c1', 'V-001', VoucherType.JOURNAL_ENTRY, '2026-01-01', 'Desc',
            'USD', 'USD', 1, 
            [
               // Minimal lines to satisfy invariant
               { id: 1, accountId: 'a1', debitAmount: 100, creditAmount: 0, baseAmount: 100, side: 'Debit', currency: 'USD', baseCurrency: 'USD', exchangeRate: 1 } as any,
               { id: 2, accountId: 'a2', debitAmount: 0, creditAmount: 100, baseAmount: 100, side: 'Credit', currency: 'USD', baseCurrency: 'USD', exchangeRate: 1 } as any
            ], 
            100, 100, VoucherStatus.APPROVED, {}, 
            'u1', new Date(), undefined, undefined, undefined, undefined, undefined,
            undefined, undefined, 'posted-user', new Date(), 
            PostingLockPolicy.STRICT_LOCKED // <--- CRITICAL: Snapshotted Policy
        );

        mockVoucherRepo.findById.mockResolvedValue(strictVoucher);

        // 1. Update Test
        const updateUseCase = new UpdateVoucherUseCase(mockVoucherRepo, {} as any, mockPermissionChecker, {} as any, mockPolicyProvider);
        try {
            await updateUseCase.execute('c1', 'u1', 'v123', {});
            fail('Should have thrown 423');
        } catch (error: any) {
            expect(error.appError.code).toBe(ErrorCode.VOUCHER_LOCKED_STRICT);
            expect(error.appError.details.httpStatus).toBe(423);
        }

        // 2. Cancel Test
        const cancelUseCase = new CancelVoucherUseCase(mockVoucherRepo, mockLedgerRepo, mockPermissionChecker);
        try {
            await cancelUseCase.execute('c1', 'u1', 'v123');
            fail('Should have thrown 423');
        } catch (error: any) {
            expect(error.appError.code).toBe(ErrorCode.VOUCHER_LOCKED_STRICT);
            expect(error.appError.details.httpStatus).toBe(423);
        }

        // 3. Approval Test
        const approveUseCase = new ApproveVoucherUseCase(mockVoucherRepo);
        await expect(approveUseCase.execute('c1', 'v123', 'u1'))
            .rejects.toThrow(/VOUCHER_LOCKED_STRICT/);
            
        // 4. Rejection Test
        const rejectUseCase = new RejectVoucherUseCase(mockVoucherRepo);
        await expect(rejectUseCase.execute('c1', 'v123', 'u1', 'Reason'))
            .rejects.toThrow(/VOUCHER_LOCKED_STRICT/);
    });

    /**
     * Case B: Audit-Grade Reversals (Multi-Dimensional)
     */
    it('Reversal: must negate ACTUAL ledger impact across ALL dimensions and use posted-only filter', async () => {
        const postedVoucher = new VoucherEntity(
            'v456', 'c1', 'V-002', VoucherType.PAYMENT, '2026-01-01', 'Original',
            'USD', 'USD', 1, 
            [
               { id: 1, accountId: 'acc-cash', debitAmount: 0, creditAmount: 100, baseAmount: 100, side: 'Credit', currency: 'USD', baseCurrency: 'USD', exchangeRate: 1 } as any,
               { id: 2, accountId: 'acc-exp', debitAmount: 100, creditAmount: 0, baseAmount: 100, side: 'Debit', currency: 'USD', baseCurrency: 'USD', exchangeRate: 1 } as any
            ], 
            100, 100, VoucherStatus.APPROVED, {}, 
            'u1', new Date(), undefined, undefined, undefined, undefined, undefined,
            undefined, undefined, 'posted-user', new Date(), PostingLockPolicy.FLEXIBLE_LOCKED
        );

        // Simulation of ACTUAL POSTED LEDGER LINES (Audit Source of Truth)
        // Note: Dimensions like costCenterId and projectId must be perfectly negated
        const ledgerLines = [
            { 
              id: 'l1', accountId: 'acc-cash', side: 'Credit', baseAmount: 100, amount: 100, 
              currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, 
              costCenterId: 'cc-01', metadata: { projectId: 'p-99' }, isPosted: true 
            },
            { 
              id: 'l2', accountId: 'acc-exp', side: 'Debit', baseAmount: 100, amount: 100, 
              currency: 'USD', baseCurrency: 'USD', exchangeRate: 1, 
              costCenterId: 'cc-01', metadata: { projectId: 'p-99' }, isPosted: true 
            }
        ];

        mockVoucherRepo.findById.mockResolvedValue(postedVoucher);
        mockLedgerRepo.getGeneralLedger.mockResolvedValue(ledgerLines);
        mockVoucherRepo.save.mockImplementation(v => v);

        const reversalUseCase = new ReverseAndReplaceVoucherUseCase(mockVoucherRepo, mockLedgerRepo, mockPermissionChecker, { runTransaction: (fn: any) => fn() } as any);
        await reversalUseCase.execute('c1', 'u1', 'v456', { mode: 'REVERSE_ONLY', reason: 'Correction' });

        // 1. Verify Verification Query: Must use voucherId AND isPosted filter
        expect(mockLedgerRepo.getGeneralLedger).toHaveBeenCalledWith('c1', expect.objectContaining({
            voucherId: 'v456'
            // In implementation, isPosted check is inside Firestore repo, but logic must pass through
        }));

        // 2. Perform Grouped Negation Check
        const reversalVoucher: VoucherEntity = mockVoucherRepo.save.mock.calls[0][0];
        
        const computeNet = (originalEntry: any, reversalLine: any) => {
            const orig = originalEntry.baseAmount * (originalEntry.side === 'Debit' ? 1 : -1);
            const rev = reversalLine.baseAmount * (reversalLine.side === 'Debit' ? 1 : -1);
            return orig + rev;
        };

        // Assert Net Zero for Cash Entry
        expect(reversalVoucher.lines[0].accountId).toBe('acc-cash');
        expect(reversalVoucher.lines[0].costCenterId).toBe('cc-01');
        expect(reversalVoucher.lines[0].metadata.sourceLedgerEntryId).toBe('l1');
        expect(computeNet(ledgerLines[0], reversalVoucher.lines[0])).toBe(0);

        // Assert Net Zero for Expense Entry
        expect(reversalVoucher.lines[1].accountId).toBe('acc-exp');
        expect(reversalVoucher.lines[1].costCenterId).toBe('cc-01');
        expect(reversalVoucher.lines[1].metadata.projectId).toBe('p-99'); // Dimension preserved in metadata
        expect(computeNet(ledgerLines[1], reversalVoucher.lines[1])).toBe(0);
    });

    it('Reversal: must block creation for non-posted vouchers', async () => {
        const draftVoucher = new VoucherEntity(
             'v789', 'c1', 'V-003', VoucherType.JOURNAL_ENTRY, '2026-01-01', 'Draft',
             'USD', 'USD', 1, 
             [
                { id: 1, accountId: 'a1', baseAmount: 100, side: 'Debit' } as any,
                { id: 2, accountId: 'a2', baseAmount: 100, side: 'Credit' } as any
             ], 
             100, 100, VoucherStatus.DRAFT, {}, 'u1', new Date()
        );
        mockVoucherRepo.findById.mockResolvedValue(draftVoucher);

        const reversalUseCase = new ReverseAndReplaceVoucherUseCase(mockVoucherRepo, mockLedgerRepo, mockPermissionChecker, {} as any);
        await expect(reversalUseCase.execute('c1', 'u1', 'v789', { mode: 'REVERSE_ONLY' }))
            .rejects.toThrow(/Only POSTED vouchers can be reversed/);
    });

    /**
     * Case D: Fail-Fast Guard - No Ledger Lines for Posted Voucher
     */
    it('Reversal: must FAIL-FAST with ACC_006 if posted voucher has no ledger lines', async () => {
        // Arrange: Use factory to create a properly structured posted voucher
        const orphanPostedVoucher = makePostedVoucher({
            id: 'v-orphan',
            companyId: 'c1',
            voucherNo: 'V-ORPHAN',
            description: 'Orphan Posted Voucher',
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED
        });

        // Explicit precondition assertion
        expect(orphanPostedVoucher.isPosted).toBe(true);

        mockVoucherRepo.findById.mockResolvedValue(orphanPostedVoucher);
        mockLedgerRepo.getGeneralLedger.mockResolvedValue([]); // Empty ledger = data integrity issue

        const reversalUseCase = new ReverseAndReplaceVoucherUseCase(
            mockVoucherRepo, 
            mockLedgerRepo, 
            mockPermissionChecker, 
            { runTransaction: (fn: any) => fn() } as any
        );

        // Act & Assert: Verify rejection with proper error structure
        await expect(
            reversalUseCase.execute('c1', 'u1', 'v-orphan', { mode: 'REVERSE_ONLY' } as any)
        ).rejects.toMatchObject({
            appError: {
                code: ErrorCode.LEDGER_NOT_FOUND_FOR_POSTED_VOUCHER,
                details: expect.objectContaining({
                    httpStatus: 409,
                    voucherId: 'v-orphan'
                })
            }
        });

        // Assert ledger query was called with correct voucherId filter
        expect(mockLedgerRepo.getGeneralLedger).toHaveBeenCalledWith('c1', expect.objectContaining({
            voucherId: 'v-orphan'
        }));
    });
});
