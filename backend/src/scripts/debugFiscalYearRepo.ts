
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { diContainer } from '../infrastructure/di/bindRepositories';
import { FiscalYear, FiscalYearStatus, PeriodStatus } from '../domain/accounting/entities/FiscalYear';

// Initialize Firebase if not already (it might be by diContainer)
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'erp-03' });
}

async function main() {
  console.log('Debugging Fiscal Year Repo...');

  const repo = diContainer.fiscalYearRepository;

  // Create a dummy FiscalYear
  const fy = new FiscalYear(
    'DEBUG-FY',
    'SYCO',
    'Debug FY',
    '2027-01-01',
    '2027-12-31',
    FiscalYearStatus.OPEN,
    [
      {
        id: '2027-01',
        name: 'Jan 2027',
        startDate: '2027-01-01',
        endDate: '2027-01-31',
        status: PeriodStatus.OPEN,
        periodNo: 1,
        isSpecial: false
      }
    ],
    undefined,
    new Date(),
    'tester'
  );

  // Manually invoke logic similar to toPersistence
  const persistenceData = {
    companyId: fy.companyId,
    name: fy.name,
    startDate: fy.startDate,
    endDate: fy.endDate,
    status: fy.status,
    periods: fy.periods.map((p) => ({
      ...p,
      closedAt: p.closedAt ? Timestamp.fromDate(p.closedAt) : null,
      lockedAt: p.lockedAt ? Timestamp.fromDate(p.lockedAt) : null,
    })),
    closingVoucherId: fy.closingVoucherId || null,
    createdAt: fy.createdAt ? Timestamp.fromDate(fy.createdAt) : admin.firestore.FieldValue.serverTimestamp(),
    createdBy: fy.createdBy || null,
  };

  console.log('Persistence Data:', JSON.stringify(persistenceData, null, 2));

  try {
    await repo.save(fy);
    console.log('Save SUCCESS');
  } catch (err) {
    console.error('Save FAILED:', err);
  }
}

main().catch(console.error);
