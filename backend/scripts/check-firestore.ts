
import admin from 'firebase-admin';
import { diContainer } from '../src/infrastructure/di/bindRepositories';

// Register for firestore-admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

async function main() {
    const companies = await diContainer.companyRepository.listAll();
    console.log('--- COMPANIES ---');
    console.log(JSON.stringify(companies.map(c => ({ id: c.id, name: c.name })), null, 2));

    for (const company of companies) {
        const fyList = await diContainer.fiscalYearRepository.findByCompany(company.id);
        console.log(`--- FISCAL YEARS FOR ${company.name} (${company.id}) ---`);
        
        const cleanFy = fyList.map( fy => ({
            id: fy.id,
            name: fy.name,
            startDate: fy.startDate,
            endDate: fy.endDate,
            status: fy.status,
            specialPeriodsCount: fy.specialPeriodsCount,
            periods: fy.periods.map(p => ({
                id: p.id,
                name: p.name,
                startDate: p.startDate,
                endDate: p.endDate,
                status: p.status,
                isSpecial: p.isSpecial,
                periodNo: p.periodNo
            }))
        }));
        console.log(JSON.stringify(cleanFy, null, 2));
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
