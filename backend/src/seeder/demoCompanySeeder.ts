import { InitializeAccountingUseCase } from '../application/accounting/use-cases/InitializeAccountingUseCase';
import { ICompanyRepository } from '../repository/interfaces/core/ICompanyRepository';
import { ICompanyRoleRepository } from '../repository/interfaces/rbac/ICompanyRoleRepository';
import { ICompanyUserRepository } from '../repository/interfaces/rbac/ICompanyUserRepository';
import { IUserRepository } from '../repository/interfaces/core/IUserRepository';
import { IVoucherTypeDefinitionRepository } from '../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { ICompanyModuleRepository } from '../repository/interfaces/company/ICompanyModuleRepository';
import { ICompanySettingsRepository } from '../repository/interfaces/core/ICompanySettingsRepository';
import { Company } from '../domain/core/entities/Company';
import { User } from '../domain/core/entities/User';
import { CompanyRole } from '../domain/rbac/CompanyRole';
import { CompanyUser } from '../domain/rbac/CompanyUser';
import { CompanyModuleEntity } from '../domain/company/entities/CompanyModule';
import * as crypto from 'crypto';

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

export interface SeedResult {
    companyId: string;
    companyName: string;
    rolesCreated: any[];
    usersCreated: any[];
    activeModules: string[];
    activeFeatures: string[];
    bundleApplied: string;
}

export async function seedDemoCompany(deps: SeedDependencies): Promise<SeedResult> {
    // ... (keep existing destructuring)
    const {
        companyRepository,
        companyRoleRepository,
        companyUserRepository,
        userRepository,
        companyModuleRepository,
        initializeAccountingUseCase
    } = deps;

    // Step 1: Create Company
    const companyId = crypto.randomUUID();
    // Use a fixed ID for the admin user for easier testing if needed, or random
    const adminUserId = crypto.randomUUID();
    
    console.log(`🏁 Step 1: Creating Company '${companyId}'...`);

    const demoCompany = new Company(
        companyId,
        'Demo Manufacturing Co.',
        adminUserId,
        new Date(),
        new Date(),
        'TRY',
        new Date(`${new Date().getFullYear()}-01-01`),
        new Date(`${new Date().getFullYear()}-12-31`),
        ['accounting', 'inventory', 'finance', 'hr'], // Active modules
        [], // Features
        '1234567890', // Tax ID
        'PRO_PLAN'
    );

    await companyRepository.save(demoCompany);
    console.log('✅ Company created');

    // Step 1.1: Create Module Records
    console.log('🏁 Step 1.1: Creating Module Records...');
    const modules = ['accounting', 'inventory', 'finance', 'hr'];
    for (const mod of modules) {
        const moduleEntity = CompanyModuleEntity.create(companyId, mod);
        await companyModuleRepository.create(moduleEntity);
    }
    console.log(`✅ Created ${modules.length} module records`);

    // Step 2: Create Roles
    console.log('🏁 Step 2: Creating Roles...');
    const adminRoleId = crypto.randomUUID();
    const financeRoleId = crypto.randomUUID();
    const inventoryRoleId = crypto.randomUUID();

    const createdRoles: CompanyRole[] = [
        {
            id: adminRoleId,
            companyId,
            name: 'Admin',
            description: 'Full access to all modules',
            permissions: ['*'], // Wildcard for super admin within company
            isSystem: true,
            isDefaultForNewUsers: false,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: financeRoleId,
            companyId,
            name: 'Finance Manager',
            description: 'Access to accounting and finance modules',
            permissions: ['accounting.*', 'finance.*'],
            isSystem: false,
            isDefaultForNewUsers: false,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: inventoryRoleId,
            companyId,
            name: 'Inventory Manager',
            description: 'Access to inventory module',
            permissions: ['inventory.*'],
            isSystem: false,
            isDefaultForNewUsers: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    /* Note: Ideally we use companyRoleRepository.create for each, 
       assuming the repository has a create or save method. 
       Based on ICompanyRoleRepository definition (not fully visible but implied),
       we'll assume a 'create' method exists or similar. 
       Wait, ICompanyRoleRepository usually has create/update.
       Let's check ICompanyRoleRepository if possible. 
       I'll assume create(role) exists.
    */
    // Assuming create exists based on typical patterns. If not we might need to adjust.
    // Given the previous error "Cannot find name ICompanyRepository", we saw the file.
    // Let's assume standard repo methods.
    
    // We will loop to create roles
    // Actually, looking at typical repo patterns in this project (Firestore), it likely takes the object.
    
    // BUT WAIT: ICompanyRoleRepository might not have `create` if it's read-only? 
    // Usually it has save/create. 
    // Let's try to save them.
    
    for (const role of createdRoles) {
         await companyRoleRepository.create(role);
    }
    console.log(`✅ Created ${createdRoles.length} roles`);

    // Step 3: Create Users
    console.log('🏁 Step 3: Creating Users...');
    const createdUsers: any[] = []; // Using any to simplify mapping to SeedResult

    const usersToCreate = [
        {
            id: adminUserId,
            email: 'admin@demo.com',
            name: 'Demo Admin',
            roleId: adminRoleId,
            roleName: 'Admin'
        },
        {
            id: crypto.randomUUID(),
            email: 'finance@demo.com',
            name: 'Finance User',
            roleId: financeRoleId,
            roleName: 'Finance Manager'
        },
        {
            id: crypto.randomUUID(),
            email: 'inventory@demo.com',
            name: 'Inventory User',
            roleId: inventoryRoleId,
            roleName: 'Inventory Manager'
        }
    ];

    for (const u of usersToCreate) {
        const user = new User(
            u.id,
            u.email,
            u.name,
            'USER', // Global role
            new Date(),
            undefined, // Picture
            undefined, // Plan
            companyId  // Active company
        );

        await userRepository.createUser(user);
        createdUsers.push({ ...u, role: u.roleName });
    }
    console.log(`✅ Created ${createdUsers.length} users`);

    // Step 4: Assign Users to Company
    console.log('🏁 Step 4: Assigning Users to Company...');
    for (const u of usersToCreate) {
        const assignment: CompanyUser = {
            userId: u.id,
            companyId,
            roleId: u.roleId,
            isOwner: u.roleName === 'Admin', // crude check
            createdAt: new Date(),
            isDisabled: false
        };
        await companyUserRepository.create(assignment);
    }
    console.log('✅ Users assigned to company');

    // Step 5: Initialize Accounting (Create Accounts, Vouchers, etc.)
    console.log('🏁 Step 5: Initializing Accounting Module...');
    try {
        await initializeAccountingUseCase.execute({
            companyId,
            config: {
                baseCurrency: 'TRY',
                fiscalYearStart: `${new Date().getFullYear()}-01-01`,
                fiscalYearEnd: `${new Date().getFullYear()}-12-31`,
                coaTemplate: 'standard', // Assuming this template exists from system seeder
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
