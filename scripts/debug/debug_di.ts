
import { diContainer } from './backend/src/infrastructure/di/bindRepositories';
import { GetGeneralLedgerUseCase } from './backend/src/application/accounting/use-cases/ReportingUseCases';

async function test() {
  console.log('--- DI TEST START ---');
  const companies = await diContainer.companyRepository.list();
  if (companies.length === 0) return console.log('No companies');
  const cid = companies[0].id;
  const uid = 'system-debug'; 
  console.log('Testing for CID:', cid);

  const accounts = await diContainer.accountRepository.list(cid);
  console.log(`Fetched ${accounts.length} accounts`);
  if (accounts.length > 0) {
    console.log('First account sample:', { id: accounts[0].id, code: accounts[0].code, name: accounts[0].name });
  }

  const useCase = new GetGeneralLedgerUseCase(
    diContainer.ledgerRepository as any,
    diContainer.accountRepository,
    diContainer.voucherRepository,
    { assertOrThrow: () => Promise.resolve() } as any
  );

  const report = await useCase.execute(cid, uid, {});
  console.log(`Generated report with ${report.length} entries`);
  if (report.length > 0) {
    console.log('First entry enrichment:', {
      voucherNo: report[0].voucherNo,
      accountCode: report[0].accountCode,
      accountName: report[0].accountName
    });
    
    if (report[0].accountName === 'Unknown Account') {
        console.log('❌ Enrichment FAILED in use case');
        const entryId = report[0].accountId;
        const found = accounts.find(a => a.id === entryId);
        console.log(`Manual check for account ID ${entryId}: ${found ? 'Found' : 'NOT found'}`);
    } else {
        console.log('✅ Enrichment SUCCEEDED in script');
    }
  }
}

test().catch(console.error);
