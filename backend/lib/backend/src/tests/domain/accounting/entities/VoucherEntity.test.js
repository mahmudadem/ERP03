"use strict";
/**
 * Voucher Entity Tests
 *
 * Tests for the VoucherEntity aggregate root.
 * Verifies immutability, validation, and state transitions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const VoucherEntity_1 = require("../../../../src/domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../../src/domain/accounting/entities/VoucherLineEntity");
const VoucherTypes_1 = require("../../../../src/domain/accounting/types/VoucherTypes");
(0, globals_1.describe)('VoucherEntity', () => {
    const createTestLines = () => {
        return [
            new VoucherLineEntity_1.VoucherLineEntity(1, 'expense-001', 'Debit', 100, 'USD', 100, 'USD', 1.0, 'Test debit'),
            new VoucherLineEntity_1.VoucherLineEntity(2, 'cash-001', 'Credit', 100, 'USD', 100, 'USD', 1.0, 'Test credit')
        ];
    };
    (0, globals_1.describe)('constructor validation', () => {
        (0, globals_1.it)('should create voucher with valid data', () => {
            const lines = createTestLines();
            const voucher = new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test payment', 'USD', 'USD', 1.0, lines, 100, // totalDebit
            100, // totalCredit
            VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date());
            (0, globals_1.expect)(voucher.id).toBe('v-001');
            (0, globals_1.expect)(voucher.isBalanced).toBe(true);
        });
        (0, globals_1.it)('should reject if less than 2 lines', () => {
            const singleLine = [createTestLines()[0]];
            (0, globals_1.expect)(() => {
                new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, singleLine, 100, 0, VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date());
            }).toThrow('Voucher must have at least 2 lines');
        });
        (0, globals_1.it)('should reject if debits do not equal credits', () => {
            const unbalancedLines = [
                new VoucherLineEntity_1.VoucherLineEntity(1, 'expense-001', 'Debit', 100, 'USD', 100, 'USD', 1.0),
                new VoucherLineEntity_1.VoucherLineEntity(2, 'cash-001', 'Credit', 80, 'USD', 80, 'USD', 1.0)
            ];
            (0, globals_1.expect)(() => {
                new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, unbalancedLines, 100, 80, VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date());
            }).toThrow('Voucher not balanced');
        });
        (0, globals_1.it)('should reject if totals do not match line sums', () => {
            const lines = createTestLines();
            (0, globals_1.expect)(() => {
                new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, lines, 100, 90, // Wrong total!
                VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date());
            }).toThrow('Total credit does not match sum of credit lines');
        });
        (0, globals_1.it)('should reject if line currencies do not match voucher currency', () => {
            const mixedCurrencyLines = [
                new VoucherLineEntity_1.VoucherLineEntity(1, 'expense-001', 'Debit', 100, 'EUR', 110, 'USD', 1.1),
                new VoucherLineEntity_1.VoucherLineEntity(2, 'cash-001', 'Credit', 100, 'USD', 100, 'USD', 1.0)
            ];
            (0, globals_1.expect)(() => {
                new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, mixedCurrencyLines, 110, 100, VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date());
            }).toThrow('All lines must use the same transaction and base currency');
        });
    });
    (0, globals_1.describe)('status checks', () => {
        (0, globals_1.it)('should correctly identify draft voucher', () => {
            const voucher = new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, createTestLines(), 100, 100, VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date());
            (0, globals_1.expect)(voucher.isDraft).toBe(true);
            (0, globals_1.expect)(voucher.isApproved).toBe(false);
            (0, globals_1.expect)(voucher.isLocked).toBe(false);
            (0, globals_1.expect)(voucher.isRejected).toBe(false);
        });
        (0, globals_1.it)('should correctly identify approved voucher', () => {
            const voucher = new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, createTestLines(), 100, 100, VoucherTypes_1.VoucherStatus.APPROVED, 'user-001', new Date(), 'approver-001', new Date());
            (0, globals_1.expect)(voucher.isDraft).toBe(false);
            (0, globals_1.expect)(voucher.isApproved).toBe(true);
            (0, globals_1.expect)(voucher.isLocked).toBe(false);
        });
    });
    (0, globals_1.describe)('approve()', () => {
        (0, globals_1.it)('should create approved version from draft', () => {
            const draft = new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, createTestLines(), 100, 100, VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date());
            const approved = draft.approve('approver-001', new Date());
            (0, globals_1.expect)(approved.status).toBe(VoucherTypes_1.VoucherStatus.APPROVED);
            (0, globals_1.expect)(approved.approvedBy).toBe('approver-001');
            (0, globals_1.expect)(approved.approvedAt).toBeDefined();
            // Original unchanged (immutability)
            (0, globals_1.expect)(draft.status).toBe(VoucherTypes_1.VoucherStatus.DRAFT);
            (0, globals_1.expect)(draft.approvedBy).toBeUndefined();
        });
        (0, globals_1.it)('should reject approving non-draft voucher', () => {
            const approved = new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, createTestLines(), 100, 100, VoucherTypes_1.VoucherStatus.APPROVED, 'user-001', new Date(), 'approver-001', new Date());
            (0, globals_1.expect)(() => {
                approved.approve('another-user', new Date());
            }).toThrow('Cannot approve voucher in status: approved');
        });
    });
    (0, globals_1.describe)('reject()', () => {
        (0, globals_1.it)('should create rejected version from draft', () => {
            const draft = new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, createTestLines(), 100, 100, VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date());
            const rejected = draft.reject('rejecter-001', new Date(), 'Incorrect amount');
            (0, globals_1.expect)(rejected.status).toBe(VoucherTypes_1.VoucherStatus.REJECTED);
            (0, globals_1.expect)(rejected.rejectedBy).toBe('rejecter-001');
            (0, globals_1.expect)(rejected.rejectionReason).toBe('Incorrect amount');
            // Original unchanged
            (0, globals_1.expect)(draft.status).toBe(VoucherTypes_1.VoucherStatus.DRAFT);
        });
    });
    (0, globals_1.describe)('lock()', () => {
        (0, globals_1.it)('should create locked version from approved', () => {
            const approved = new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, createTestLines(), 100, 100, VoucherTypes_1.VoucherStatus.APPROVED, 'user-001', new Date(), 'approver-001', new Date());
            const locked = approved.lock('locker-001', new Date());
            (0, globals_1.expect)(locked.status).toBe(VoucherTypes_1.VoucherStatus.LOCKED);
            (0, globals_1.expect)(locked.lockedBy).toBe('locker-001');
            (0, globals_1.expect)(locked.lockedAt).toBeDefined();
        });
        (0, globals_1.it)('should reject locking draft voucher', () => {
            const draft = new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test', 'USD', 'USD', 1.0, createTestLines(), 100, 100, VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date());
            (0, globals_1.expect)(() => {
                draft.lock('locker-001', new Date());
            }).toThrow('Cannot lock voucher in status: draft');
        });
    });
    (0, globals_1.describe)('serialization', () => {
        (0, globals_1.it)('should serialize and deserialize correctly', () => {
            const original = new VoucherEntity_1.VoucherEntity('v-001', 'company-001', 'PAY-2025-001', VoucherTypes_1.VoucherType.PAYMENT, '2025-01-15', 'Test payment', 'USD', 'USD', 1.0, createTestLines(), 100, 100, VoucherTypes_1.VoucherStatus.DRAFT, 'user-001', new Date('2025-01-15T10:00:00Z'));
            const json = original.toJSON();
            const restored = VoucherEntity_1.VoucherEntity.fromJSON(json);
            (0, globals_1.expect)(restored.id).toBe(original.id);
            (0, globals_1.expect)(restored.voucherNo).toBe(original.voucherNo);
            (0, globals_1.expect)(restored.type).toBe(original.type);
            (0, globals_1.expect)(restored.status).toBe(original.status);
            (0, globals_1.expect)(restored.totalDebit).toBe(original.totalDebit);
            (0, globals_1.expect)(restored.totalCredit).toBe(original.totalCredit);
            (0, globals_1.expect)(restored.lines.length).toBe(original.lines.length);
        });
    });
});
//# sourceMappingURL=VoucherEntity.test.js.map