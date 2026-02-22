
import * as admin from 'firebase-admin';
import { FiscalYear, FiscalYearStatus, PeriodStatus, PeriodScheme } from '../src/domain/accounting/entities/FiscalYear';
import { FirestoreFiscalYearRepository } from '../src/infrastructure/firestore/repositories/accounting/FirestoreFiscalYearRepository';
import { BusinessError } from '../src/errors/AppError';
import { ErrorCode } from '../src/errors/ErrorCodes';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'erp-03',
  });
}

const db = admin.firestore();

async function verifySpecialPeriodStrictRule() {
  console.log('\n=== Testing Fiscal Year Special Period Strict Rule ===\n');

  const companyId = 'test_fy_strict_' + Date.now();
  const repo = new FirestoreFiscalYearRepository(db);

  // 1. Create a Fiscal Year for 2025
  const fyId = 'FY2025_' + companyId;
  const periods = [
    // Regular P12
    {
      id: fyId + '_P12',
      name: 'December 2025',
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      status: PeriodStatus.OPEN,
      periodNo: 12,
      isSpecial: false
    },
    // Special P13
    {
      id: fyId + '_P13',
      name: 'Year-End Adjustments',
      startDate: '2025-12-31',
      endDate: '2025-12-31',
      status: PeriodStatus.OPEN,
      periodNo: 13,
      isSpecial: true
    }
  ];

  const fy = new FiscalYear(
    fyId,
    companyId,
    'Fiscal Year 2025',
    '2025-01-01',
    '2025-12-31',
    FiscalYearStatus.OPEN,
    periods as any,
    undefined,
    new Date(),
    'admin',
    PeriodScheme.MONTHLY,
    1 // specialPeriodsCount
  );

  await repo.save(fy);
  console.log(`✓ Created FY 2025 with P13 for company ${companyId}`);

  // 2. Test Case: Incorrect Date for Special Period
  console.log('\nTEST 1: Post to P13 with INCORRECT date (2025-11-30)');
  try {
    fy.getPeriodForDate('2025-11-30', 13);
    console.log('  ✗ FAILED: Expected getPeriodForDate to throw for incorrect special period date');
  } catch (error: any) {
    if (error.code === ErrorCode.INVALID_SPECIAL_PERIOD_USAGE) {
      console.log(`  ✓ Correctly blocked with code ${error.code}: ${error.message}`);
    } else {
      console.log(`  ✗ Wrong error: ${error.message} (Code: ${error.code})`);
    }
  }

  // 3. Test Case: Correct Date for Special Period
  console.log('\nTEST 2: Post to P13 with CORRECT date (2025-12-31)');
  try {
    const period = fy.getPeriodForDate('2025-12-31', 13);
    if (period && period.periodNo === 13) {
      console.log('  ✓ Success! Period 13 resolved correctly for date 2025-12-31');
    } else {
      console.log('  ✗ FAILED: Period 13 not resolved or wrong period returned');
    }
  } catch (error: any) {
    console.log(`  ✗ FAILED: Unexpected error: ${error.message}`);
  }

  // 4. Test Case: Regular Period with Special Period overlap (on year end)
  console.log('\nTEST 3: Post to the same date (2025-12-31) WITHOUT explicit period override');
  try {
    const period = fy.getPeriodForDate('2025-12-31');
    if (period && period.periodNo === 12) {
      console.log('  ✓ Success! Defaulted to REGULAR Period 12 (as expected)');
    } else {
      console.log(`  ✗ FAILED: Expected P12 but got P${period?.periodNo}`);
    }
  } catch (error: any) {
    console.log(`  ✗ FAILED: Unexpected error: ${error.message}`);
  }

  console.log('\n=== Verification Complete ===\n');
}

verifySpecialPeriodStrictRule()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
