/**
 * Governance Policy Tests - STRICT vs FLEXIBLE Mode Enforcement
 * 
 * Tests proving correct behavior per final business rules:
 * 1. STRICT MODE: posted edit/delete blocked
 * 2. FLEXIBLE toggle OFF: posted edit/delete blocked
 * 3. FLEXIBLE toggle ON: posted edit/delete succeeds with ledger handling
 * 4. Reversal remains the correction path when toggle OFF
 */
import { VoucherEntity } from '../../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherStatus, VoucherType, PostingLockPolicy } from '../../../../domain/accounting/types/VoucherTypes';
import { UpdateVoucherUseCase, CancelVoucherUseCase } from '../VoucherUseCases';
import { BusinessError } from '../../../../errors/AppError';
import { ErrorCode } from '../../../../errors/ErrorCodes';
import { makePostedVoucher, makeVoucher } from './testHelpers';

describe('Governance Policy Enforcement - STRICT vs FLEXIBLE Modes', () => {
    let mockVoucherRepo: any;
    let mockLedgerRepo: any;
    let mockPermissionChecker: any;
    let mockPolicyConfig: any;
    let mockTransactionManager: any;

    beforeEach(() => {
        mockVoucherRepo = { 
            findById: jest.fn(), 
            save: jest.fn(v => v) 
        };
        mockLedgerRepo = { 
            getGeneralLedger: jest.fn(), 
            deleteForVoucher: jest.fn(), 
            recordForVoucher: jest.fn() 
        };
        mockPermissionChecker = { 
            assertOrThrow: jest.fn() 
        };
        mockPolicyConfig = { 
            getConfig: jest.fn() 
        };
        mockTransactionManager = { 
            runTransaction: jest.fn(fn => fn()) 
        };
    });

    describe('STRICT MODE - Posted Vouchers are Immutable', () => {
        beforeEach(() => {
            // STRICT MODE: approvalRequired=true, strictApprovalMode=true
            mockPolicyConfig.getConfig.mockResolvedValue({
                strictApprovalMode: true,
                approvalRequired: true,
                allowEditDeletePosted: false
            });
        });

        it('should block EDIT of posted voucher with VOUCHER_POSTED_EDIT_FORBIDDEN (423)', async () => {
            const postedVoucher = makePostedVoucher({ id: 'v-posted-strict' });
            mockVoucherRepo.findById.mockResolvedValue(postedVoucher);

            const updateUseCase = new UpdateVoucherUseCase(
                mockVoucherRepo,
                {} as any,
                mockPermissionChecker,
                mockTransactionManager,
                mockPolicyConfig,
                mockLedgerRepo
            );

            await expect(
                updateUseCase.execute('c1', 'u1', 'v-posted-strict', { description: 'Modified' })
            ).rejects.toMatchObject({
                appError: {
                    code: ErrorCode.VOUCHER_POSTED_EDIT_FORBIDDEN,
                    details: expect.objectContaining({ httpStatus: 423 })
                }
            });
        });

        it('should block DELETE of posted voucher with VOUCHER_POSTED_DELETE_FORBIDDEN (423)', async () => {
            const postedVoucher = makePostedVoucher({ id: 'v-posted-strict-del' });
            mockVoucherRepo.findById.mockResolvedValue(postedVoucher);

            const cancelUseCase = new CancelVoucherUseCase(
                mockVoucherRepo,
                mockLedgerRepo,
                mockPermissionChecker,
                mockPolicyConfig
            );

            await expect(
                cancelUseCase.execute('c1', 'u1', 'v-posted-strict-del')
            ).rejects.toMatchObject({
                appError: {
                    code: ErrorCode.VOUCHER_POSTED_DELETE_FORBIDDEN,
                    details: expect.objectContaining({ httpStatus: 423 })
                }
            });

            // Ensure ledger was NOT touched
            expect(mockLedgerRepo.deleteForVoucher).not.toHaveBeenCalled();
        });
    });

    describe('FLEXIBLE MODE - Toggle OFF (Posted Immutable)', () => {
        beforeEach(() => {
            // FLEXIBLE MODE with toggle OFF
            mockPolicyConfig.getConfig.mockResolvedValue({
                strictApprovalMode: false,
                approvalRequired: false,
                allowEditDeletePosted: false
            });
        });

        it('should block EDIT of posted voucher when toggle is OFF', async () => {
            const postedVoucher = makePostedVoucher({ id: 'v-flex-off-edit' });
            mockVoucherRepo.findById.mockResolvedValue(postedVoucher);

            const updateUseCase = new UpdateVoucherUseCase(
                mockVoucherRepo,
                {} as any,
                mockPermissionChecker,
                mockTransactionManager,
                mockPolicyConfig,
                mockLedgerRepo
            );

            await expect(
                updateUseCase.execute('c1', 'u1', 'v-flex-off-edit', { description: 'Modified' })
            ).rejects.toMatchObject({
                appError: {
                    code: ErrorCode.VOUCHER_POSTED_EDIT_FORBIDDEN,
                    details: expect.objectContaining({ httpStatus: 423 })
                }
            });
        });

        it('should block DELETE of posted voucher when toggle is OFF', async () => {
            const postedVoucher = makePostedVoucher({ id: 'v-flex-off-del' });
            mockVoucherRepo.findById.mockResolvedValue(postedVoucher);

            const cancelUseCase = new CancelVoucherUseCase(
                mockVoucherRepo,
                mockLedgerRepo,
                mockPermissionChecker,
                mockPolicyConfig
            );

            await expect(
                cancelUseCase.execute('c1', 'u1', 'v-flex-off-del')
            ).rejects.toMatchObject({
                appError: {
                    code: ErrorCode.VOUCHER_POSTED_DELETE_FORBIDDEN
                }
            });
        });
    });

    describe('FLEXIBLE MODE - Toggle ON (Posted Editable/Deletable)', () => {
        beforeEach(() => {
            // FLEXIBLE MODE with toggle ON
            mockPolicyConfig.getConfig.mockResolvedValue({
                strictApprovalMode: false,
                approvalRequired: false,
                allowEditDeletePosted: true
            });
        });

        it('should ALLOW DELETE of posted voucher and remove ledger entries', async () => {
            const postedVoucher = makePostedVoucher({ id: 'v-flex-on-del' });
            mockVoucherRepo.findById.mockResolvedValue(postedVoucher);

            const cancelUseCase = new CancelVoucherUseCase(
                mockVoucherRepo,
                mockLedgerRepo,
                mockPermissionChecker,
                mockPolicyConfig
            );

            await expect(
                cancelUseCase.execute('c1', 'u1', 'v-flex-on-del')
            ).resolves.not.toThrow();

            // Verify ledger entries were deleted
            expect(mockLedgerRepo.deleteForVoucher).toHaveBeenCalledWith('c1', 'v-flex-on-del');
            
            // Verify voucher was saved as cancelled
            expect(mockVoucherRepo.save).toHaveBeenCalled();
        });

        it('should ALLOW EDIT of posted voucher (passes governance check)', async () => {
            const postedVoucher = makePostedVoucher({ id: 'v-flex-on-edit' });
            mockVoucherRepo.findById.mockResolvedValue(postedVoucher);

            // Verify governance guard passes
            expect(() => {
                postedVoucher.assertCanEdit(false, true); // FLEXIBLE + toggle ON
            }).not.toThrow();
        });
    });

    describe('NON-POSTED Vouchers - Always Editable/Deletable', () => {
        it('should allow EDIT of draft voucher in STRICT mode', async () => {
            const draftVoucher = makeVoucher({ id: 'v-draft', status: VoucherStatus.DRAFT });
            
            // Should not throw regardless of mode
            expect(() => {
                draftVoucher.assertCanEdit(true, false); // STRICT + toggle OFF
            }).not.toThrow();
        });

        it('should allow DELETE of draft voucher in STRICT mode', async () => {
            const draftVoucher = makeVoucher({ id: 'v-draft-del', status: VoucherStatus.DRAFT });
            
            expect(() => {
                draftVoucher.assertCanDelete(true, false); // STRICT + toggle OFF
            }).not.toThrow();
        });
    });

    /**
     * CRITICAL INVARIANT: Strict-Forever Lock
     * Vouchers posted under STRICT policy are IMMUTABLE FOREVER
     * Even if company switches to FLEXIBLE mode with toggle ON
     */
    describe('STRICT-FOREVER INVARIANT - Mode Switch Cannot Unlock', () => {
        beforeEach(() => {
            // Company has switched to FLEXIBLE MODE with toggle ON
            mockPolicyConfig.getConfig.mockResolvedValue({
                strictApprovalMode: false,
                approvalRequired: false,
                allowEditDeletePosted: true // Toggle ON - should allow edits normally
            });
        });

        it('should block EDIT of STRICT_LOCKED voucher even in FLEXIBLE mode with toggle ON', async () => {
            // Voucher was posted under STRICT policy (has STRICT_LOCKED snapshotted)
            const strictLockedVoucher = makePostedVoucher({ 
                id: 'v-strict-forever-edit',
                postingLockPolicy: PostingLockPolicy.STRICT_LOCKED
            });
            mockVoucherRepo.findById.mockResolvedValue(strictLockedVoucher);

            const updateUseCase = new UpdateVoucherUseCase(
                mockVoucherRepo,
                {} as any,
                mockPermissionChecker,
                mockTransactionManager,
                mockPolicyConfig,
                mockLedgerRepo
            );

            // Despite FLEXIBLE mode + toggle ON, STRICT_LOCKED voucher must remain immutable
            await expect(
                updateUseCase.execute('c1', 'u1', 'v-strict-forever-edit', { description: 'Trying to break audit' })
            ).rejects.toMatchObject({
                appError: {
                    code: ErrorCode.VOUCHER_STRICT_LOCK_FOREVER,
                    details: expect.objectContaining({ 
                        httpStatus: 423,
                        postingLockPolicy: PostingLockPolicy.STRICT_LOCKED
                    })
                }
            });
        });

        it('should block DELETE of STRICT_LOCKED voucher even in FLEXIBLE mode with toggle ON', async () => {
            // Voucher was posted under STRICT policy
            const strictLockedVoucher = makePostedVoucher({ 
                id: 'v-strict-forever-del',
                postingLockPolicy: PostingLockPolicy.STRICT_LOCKED
            });
            mockVoucherRepo.findById.mockResolvedValue(strictLockedVoucher);

            const cancelUseCase = new CancelVoucherUseCase(
                mockVoucherRepo,
                mockLedgerRepo,
                mockPermissionChecker,
                mockPolicyConfig
            );

            // Despite FLEXIBLE mode + toggle ON, STRICT_LOCKED voucher must remain immutable
            await expect(
                cancelUseCase.execute('c1', 'u1', 'v-strict-forever-del')
            ).rejects.toMatchObject({
                appError: {
                    code: ErrorCode.VOUCHER_STRICT_LOCK_FOREVER,
                    details: expect.objectContaining({ 
                        httpStatus: 423,
                        postingLockPolicy: PostingLockPolicy.STRICT_LOCKED
                    })
                }
            });

            // Ensure ledger was NOT touched
            expect(mockLedgerRepo.deleteForVoucher).not.toHaveBeenCalled();
        });

        it('should ALLOW edit/delete of FLEXIBLE_LOCKED voucher in FLEXIBLE mode with toggle ON', () => {
            // Voucher was posted under FLEXIBLE policy (has FLEXIBLE_LOCKED snapshotted)
            const flexibleLockedVoucher = makePostedVoucher({ 
                id: 'v-flex-locked',
                postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED
            });

            // FLEXIBLE_LOCKED + FLEXIBLE mode + toggle ON = mutations allowed
            expect(() => {
                flexibleLockedVoucher.assertCanEdit(false, true);
            }).not.toThrow();

            expect(() => {
                flexibleLockedVoucher.assertCanDelete(false, true);
            }).not.toThrow();
        });
    });
});
