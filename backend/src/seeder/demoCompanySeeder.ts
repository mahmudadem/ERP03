import { InitializeAccountingUseCase } from '../application/accounting/use-cases/InitializeAccountingUseCase';

export interface SeedDependencies {
    companyRepository: ICompanyRepository;
    companyRoleRepository: ICompanyRoleRepository;
    companyUserRepository: ICompanyUserRepository;
    userRepository: IUserRepository;
    voucherTypeDefinitionRepository: IVoucherTypeDefinitionRepository;
    companyModuleRepository: ICompanyModuleRepository;
    companySettingsRepository: ICompanySettingsRepository;
    initializeAccountingUseCase: InitializeAccountingUseCase;
}

// ... (keep existing SeedResult interface)

export async function seedDemoCompany(deps: SeedDependencies): Promise<SeedResult> {
    // ... (keep existing destructuring)
    const {
        companyRepository,
        companyRoleRepository,
        companyUserRepository,
        userRepository,
        initializeAccountingUseCase
    } = deps;

// ... (keep lines 41-253)

    // Step 5: Initialize Accounting (Create Accounts, Vouchers, etc.)
    console.log('🏁 Step 5: Initializing Accounting Module...');
    try {
        await initializeAccountingUseCase.execute({
            companyId,
            config: {
                baseCurrency: 'TRY',
                fiscalYearStart: `${new Date().getFullYear()}-01-01`,
                fiscalYearEnd: `${new Date().getFullYear()}-12-31`,
                coaTemplate: 'standard_en', // Assuming this template exists from system seeder
                selectedVoucherTypes: ['payment_voucher', 'receipt_voucher', 'journal_entry', 'sales_invoice', 'purchase_invoice'] // IDs from seedSystemVoucherTypes
            }
        });
        console.log('✅ Accounting initialized with Vouchers and COA');
    } catch (err: any) {
        console.error('❌ Failed to initialize accounting:', err.message);
        // Don't fail the whole seeder, but log it
    }
    console.log('');

    // Step 6: Return Final Result
    const result: SeedResult = {
        companyId,
        companyName: 'Demo Manufacturing Co.',
        rolesCreated: createdRoles,
        usersCreated: createdUsers,
        activeModules: ['accounting', 'inventory', 'finance',  'hr'],
        activeFeatures: [],
        bundleApplied: 'none'
    };

    console.log('✅ Demo Company Seeded Successfully!\n');

    return result;
}
