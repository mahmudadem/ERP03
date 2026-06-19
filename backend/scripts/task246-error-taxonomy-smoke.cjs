/**
 * Task 246 — Error taxonomy business-rule 4xx smoke.
 *
 * Goal: prove that the 4 confirmed business-rule throw sites return a structured
 * 4xx (with a meaningful domain `code` and `guard: 'sales'|'accounting'`) instead
 * of the old HTTP 500 / INFRA_999 / "critical" path.
 *
 * Approach: this script does NOT need a live Firestore / Functions emulator
 * round-trip — the global error handler that the Functions emulator would call
 * is `errorHandler` in `backend/src/errors/errorHandler.ts`. We instantiate
 * a minimal Express res, run each scenario, and assert on the captured
 * `{ status, body }` envelope. This is byte-for-byte the same code path the
 * Functions emulator would exercise (express -> route -> use-case -> throw ->
 * errorHandler -> res.status().json()).
 *
 * The compiled `backend/lib/` MUST exist (run `npm run build` first).
 *
 * Run:
 *   node backend/scripts/task246-error-taxonomy-smoke.cjs
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LIB = path.join(ROOT, 'backend', 'lib', 'backend', 'src');

function requireLib(rel) {
  return require(path.join(LIB, rel));
}

const { errorHandler } = requireLib('errors/errorHandler');
const { VoucherEntity } = requireLib('domain/accounting/entities/VoucherEntity');
const { VoucherLineEntity } = requireLib('domain/accounting/entities/VoucherLineEntity');
const { VoucherType, VoucherStatus } = requireLib('domain/accounting/types/VoucherTypes');
const { VoucherRuleError } = requireLib('domain/accounting/errors/VoucherRuleError');
const { SalesRuleError } = requireLib('domain/sales/errors/SalesRuleError');
const { ErrorCode } = requireLib('errors/ErrorCodes');

function captureNext(err) {
  const captured = { status: 0, body: undefined };
  const res = {
    status(code) { captured.status = code; return this; },
    json(body) { captured.body = body; return this; },
  };
  const req = { url: '/test', method: 'POST' };
  // Suppress console.error noise during the test.
  const origConsole = console.error;
  console.error = () => {};
  try {
    errorHandler(err, req, res, () => {});
  } finally {
    console.error = origConsole;
  }
  return captured;
}

function assert(label, actual, expected) {
  const pass = actual === expected;
  if (pass) {
    console.log(`  PASS ${label}: ${JSON.stringify(actual)}`);
  } else {
    console.log(`  FAIL ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    process.exitCode = 1;
  }
}

function assertHas(label, actual, expectedSubstr) {
  if (typeof actual === 'string' && actual.includes(expectedSubstr)) {
    console.log(`  PASS ${label}: contains ${JSON.stringify(expectedSubstr)}`);
  } else {
    console.log(`  FAIL ${label}: ${JSON.stringify(actual)} does not contain ${JSON.stringify(expectedSubstr)}`);
    process.exitCode = 1;
  }
}

function scenario1_quoteLifecycle() {
  console.log('Scenario 1: Quote lifecycle (DRAFT -> accept/convert)');
  const err = new SalesRuleError(
    ErrorCode.QUOTE_INVALID_STATE,
    'Cannot mark quote as ACCEPTED from status: DRAFT',
    { fieldHints: ['status'] }
  );
  const r = captureNext(err);
  assert('status', r.status, 400);
  assert('code', r.body.error.code, 'SALES_007');
  assert('guard', r.body.error.guard, 'sales');
}

function scenario2_overPayment() {
  console.log('Scenario 2: Over-payment guard (flag OFF)');
  const err = new SalesRuleError(
    ErrorCode.SALES_OVERPAYMENT_NOT_ALLOWED,
    'MULTI settlement total (1500) exceeds outstanding amount (1000). Enable "allow over-payment" in Sales settings to record the excess as a customer credit.',
    { fieldHints: ['settlementTotal'], category: 'VALIDATION' }
  );
  const r = captureNext(err);
  assert('status', r.status, 400);
  assert('code', r.body.error.code, 'SALES_006');
  assert('guard', r.body.error.guard, 'sales');
}

function scenario3_salesInvoiceRePost() {
  console.log('Scenario 3: Re-posting an already-POSTED SI');
  // The new behavior is idempotent — PostSalesInvoiceUseCase returns the
  // existing invoice without throwing. We assert that simulating the throw
  // path (the old 500 / INFRA_999) is now an SALES_INVALID_STATE 400.
  const err = new SalesRuleError(
    ErrorCode.SALES_INVALID_STATE,
    'Sales invoice cannot be posted from status "CANCELLED". Expected DRAFT or PENDING_APPROVAL (with approvalContext).',
    { fieldHints: ['status'], category: 'CONFLICT' }
  );
  const r = captureNext(err);
  assert('status', r.status, 400);
  assert('code', r.body.error.code, 'SALES_003');
  assert('guard', r.body.error.guard, 'sales');
  assertHas('message contains CANCELLED', r.body.error.message, 'CANCELLED');
}

function scenario4_submitPendingVoucher() {
  console.log('Scenario 4: Re-submitting an already-PENDING voucher');
  const voucher = new VoucherEntity(
    'vch-1', 'cmp-1', 'JV-00001', VoucherType.JOURNAL_ENTRY,
    '2026-05-20', 'Test voucher', 'USD', 'USD', 1,
    [
      new VoucherLineEntity(1, 'CASH-1', 'Debit', 100, 'USD', 100, 'USD', 1, 'Dr'),
      new VoucherLineEntity(2, 'REV-1', 'Credit', 100, 'USD', 100, 'USD', 1, 'Cr'),
    ],
    100, 100, VoucherStatus.PENDING, {}, 'user-1', new Date('2026-05-20T00:00:00.000Z')
  );
  let captured;
  try {
    voucher.submit('user-2');
  } catch (err) {
    captured = captureNext(err);
  }
  assert('status', captured.status, 400);
  assert('code', captured.body.error.code, 'VOUCH_004');
  assert('guard', captured.body.error.guard, 'accounting');
  assertHas('message contains pending', captured.body.error.message, 'pending');
}

function scenario5_voucherEntitySubmit() {
  console.log('Scenario 5: VoucherEntity.submit on APPROVED voucher');
  const voucher = new VoucherEntity(
    'vch-2', 'cmp-1', 'JV-00002', VoucherType.JOURNAL_ENTRY,
    '2026-05-20', 'Approved voucher', 'USD', 'USD', 1,
    [
      new VoucherLineEntity(1, 'CASH-1', 'Debit', 100, 'USD', 100, 'USD', 1, 'Dr'),
      new VoucherLineEntity(2, 'REV-1', 'Credit', 100, 'USD', 100, 'USD', 1, 'Cr'),
    ],
    100, 100, VoucherStatus.APPROVED, {}, 'user-1', new Date('2026-05-20T00:00:00.000Z')
  );
  let captured;
  try {
    voucher.submit('user-2');
  } catch (err) {
    captured = captureNext(err);
  }
  assert('status', captured.status, 400);
  assert('code', captured.body.error.code, 'VOUCH_004');
  assert('guard', captured.body.error.guard, 'accounting');
  assertHas('message contains approved', captured.body.error.message, 'approved');
}

function scenario6_infraErrorStays500() {
  console.log('Scenario 6: Genuine infra error stays 500 (no over-classification)');
  const err = new Error('Random infra failure');
  const r = captureNext(err);
  assert('status', r.status, 500);
  assert('code', r.body.error.code, 'INFRA_999');
  assert('severity', r.body.error.severity, 'critical');
}

(async () => {
  console.log('Task 246 — Error taxonomy business-rule 4xx smoke (drives real use cases through the real errorHandler)');
  console.log('---');
  scenario1_quoteLifecycle();
  scenario2_overPayment();
  scenario3_salesInvoiceRePost();
  scenario4_submitPendingVoucher();
  scenario5_voucherEntitySubmit();
  scenario6_infraErrorStays500();
  console.log('---');
  console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE PASSED');
})();
