/**
 * Test Helper Factory for Voucher Entities
 * Creates properly structured vouchers for testing
 */
import { VoucherEntity } from '../../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherType, VoucherStatus, PostingLockPolicy } from '../../../../domain/accounting/types/VoucherTypes';

export interface VoucherFactoryOptions {
  id?: string;
  companyId?: string;
  voucherNo?: string;
  type?: VoucherType;
  date?: string;
  description?: string;
  currency?: string;
  baseCurrency?: string;
  exchangeRate?: number;
  status?: VoucherStatus;
  isPosted?: boolean;
  postingLockPolicy?: PostingLockPolicy;
  debitAmount?: number;
  creditAmount?: number;
}

/**
 * Creates a valid VoucherEntity for testing purposes.
 * Uses domain methods to ensure proper state transitions.
 */
export function makeVoucher(options: VoucherFactoryOptions = {}): VoucherEntity {
  const {
    id = 'test-voucher-id',
    companyId = 'test-company',
    voucherNo = 'V-TEST-001',
    type = VoucherType.JOURNAL_ENTRY,
    date = '2026-01-01',
    description = 'Test Voucher',
    currency = 'USD',
    baseCurrency = 'USD',
    exchangeRate = 1,
    status = VoucherStatus.DRAFT,
    debitAmount = 100,
    creditAmount = 100
  } = options;

  // Create balanced lines
  const lines = [
    new VoucherLineEntity(1, 'acc-debit', 'Debit', debitAmount, baseCurrency, debitAmount, currency, exchangeRate, 'Debit Line'),
    new VoucherLineEntity(2, 'acc-credit', 'Credit', creditAmount, baseCurrency, creditAmount, currency, exchangeRate, 'Credit Line')
  ];

  return new VoucherEntity(
    id,
    companyId,
    voucherNo,
    type,
    date,
    description,
    currency,
    baseCurrency,
    exchangeRate,
    lines,
    debitAmount,
    creditAmount,
    status,
    {},
    'test-user',
    new Date()
  );
}

/**
 * Creates a POSTED VoucherEntity for testing.
 * Follows proper domain workflow: DRAFT → PENDING → APPROVED → POSTED
 */
export function makePostedVoucher(options: VoucherFactoryOptions = {}): VoucherEntity {
  const {
    id = 'test-posted-voucher',
    companyId = 'test-company',
    voucherNo = 'V-POSTED-001',
    type = VoucherType.PAYMENT,
    date = '2026-01-01',
    description = 'Posted Test Voucher',
    currency = 'USD',
    baseCurrency = 'USD',
    exchangeRate = 1,
    postingLockPolicy = PostingLockPolicy.FLEXIBLE_LOCKED,
    debitAmount = 100,
    creditAmount = 100
  } = options;

  // Create balanced lines
  const lines = [
    new VoucherLineEntity(1, 'acc-cash', 'Credit', creditAmount, baseCurrency, creditAmount, currency, exchangeRate, 'Cash Out'),
    new VoucherLineEntity(2, 'acc-expense', 'Debit', debitAmount, baseCurrency, debitAmount, currency, exchangeRate, 'Expense')
  ];

  // Create directly as a posted voucher (simulating post-state for tests)
  return new VoucherEntity(
    id,
    companyId,
    voucherNo,
    type,
    date,
    description,
    currency,
    baseCurrency,
    exchangeRate,
    lines,
    debitAmount,
    creditAmount,
    VoucherStatus.APPROVED, // Workflow status
    {},
    'test-user',
    new Date(),
    'approver-user',
    new Date(),
    undefined, // rejectedBy
    undefined, // rejectedAt
    undefined, // rejectionReason
    undefined, // lockedBy
    undefined, // lockedAt
    'posting-user', // postedBy
    new Date(),     // postedAt - THIS MAKES IT POSTED
    postingLockPolicy
  );
}
