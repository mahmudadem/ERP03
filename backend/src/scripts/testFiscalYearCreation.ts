
import { diContainer } from '../infrastructure/di/bindRepositories';
import { CreateFiscalYearUseCase, ListFiscalYearsUseCase } from '../application/accounting/use-cases/FiscalYearUseCases';
import { PermissionChecker } from '../application/rbac/PermissionChecker';
import { ICompanyRepository } from '../repository/interfaces/core/ICompanyRepository';
import { IFiscalYearRepository } from '../repository/interfaces/accounting/IFiscalYearRepository';

// Mock PermissionChecker to bypass checks
class MockPermissionChecker extends PermissionChecker {
  async assertOrThrow() { return; }
}

async function main() {
  console.log('Starting Fiscal Year Creation Test...');

  // 1. Setup Dependencies
  const companyRepo = diContainer.companyRepository;
  const fiscalYearRepo = diContainer.fiscalYearRepository;
  const permissionChecker = new MockPermissionChecker({} as any); // Mock dependencies

  // 2. Define Test Data
  const companyId = 'SYCO'; // Assuming SYCO exists from previous tasks
  const userId = 'test-user';
  const year = 2027; // Future year to avoid conflicts
  const startMonth = 1;
  const name = `Test Fiscal Year ${year}`;

  // 3. Cleanup existing (if any)
  const listUseCase = new ListFiscalYearsUseCase(fiscalYearRepo, permissionChecker);
  const existing = await listUseCase.execute(companyId, userId);
  const target = existing.find(fy => fy.name === name);
  if (target) {
    console.log(`Found existing FY ${target.id}, deleting (simulated - actually we cannot delete easily in this script without repo method, so we will just ignore or use a random year)`);
    // Ideally we'd delete, but let's just use a random year if needed.
  }

  // 4. Create Fiscal Year
  console.log(`Creating Fiscal Year: ${name}`);
  const createUseCase = new CreateFiscalYearUseCase(fiscalYearRepo, companyRepo, permissionChecker);
  
  try {
    const fy = await createUseCase.execute(companyId, userId, { year, startMonth, name });
    console.log('Fiscal Year Created Successfully!');
    console.log(JSON.stringify(fy, null, 2));

    // 5. Verify Structure
    if (!fy.id) throw new Error('FY missing ID');
    if (fy.startDate !== `${year}-01-01`) throw new Error(`FY startDate mismatch: ${fy.startDate}`);
    if (fy.periods.length !== 12) throw new Error(`FY period count mismatch: ${fy.periods.length}`);

    console.log('Verification Passed: Backend Logic is Sound.');
    process.exit(0);

  } catch (err) {
    console.error('Failed to create fiscal year:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
