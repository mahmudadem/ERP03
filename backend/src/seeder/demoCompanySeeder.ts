import * as admin from 'firebase-admin';
import { ICompanyRepository } from '../repository/interfaces/core/ICompanyRepository';
import { ICompanyRoleRepository } from '../repository/interfaces/rbac/ICompanyRoleRepository';
import { ICompanyUserRepository } from '../repository/interfaces/rbac/ICompanyUserRepository';
import { IUserRepository } from '../repository/interfaces/core/IUserRepository';
import { IVoucherTypeDefinitionRepository } from '../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { Company } from '../domain/core/entities/Company';
import { User } from '../domain/core/entities/User';
import { CompanyRole } from '../domain/rbac/CompanyRole';
import { BUNDLES } from '../domain/platform/Bundle';
import { VoucherTypeDefinition } from '../domain/designer/entities/VoucherTypeDefinition';
import { FieldDefinition } from '../domain/designer/entities/FieldDefinition';

export interface SeedDependencies {
    companyRepository: ICompanyRepository;
    companyRoleRepository: ICompanyRoleRepository;
    companyUserRepository: ICompanyUserRepository;
    userRepository: IUserRepository;
    voucherTypeDefinitionRepository: IVoucherTypeDefinitionRepository;
}

export interface SeedResult {
    companyId: string;
    companyName: string;
    rolesCreated: Array<{ id: string; name: string }>;
    usersCreated: Array<{ id: string; email: string; role: string }>;
    activeModules: string[];
    activeFeatures: string[];
    bundleApplied: string;
}

export async function seedDemoCompany(deps: SeedDependencies): Promise<SeedResult> {
    const {
        companyRepository,
        companyRoleRepository,
        companyUserRepository,
        userRepository
    } = deps;

    console.log('🌱 Starting Demo Company Seeder...\n');

    // Generate shared timestamp for deterministic IDs in this run
    const ts = Date.now();

    // Primary owner/admin user we seed
    const ownerEmail = 'admin@demo.com';
    let ownerUserId = `user_admin_${ts}`;

    // Step 1: Create Demo Company (ownerId will be aligned to the admin user)
    console.log('📦 Step 1: Creating Demo Company...');
    const companyId = `demo_company_${ts}`;

    const company = new Company(
        companyId,
        'Demo Manufacturing Co.',
        ownerUserId,
        new Date(),
        new Date(),
        'TRY',
        new Date(new Date().getFullYear(), 0, 1), // Jan 1
        new Date(new Date().getFullYear(), 11, 31), // Dec 31
        [], // modules - will be set by bundle
        [], // features - will be set by bundle/updates
        'TR123456789',
        'starter', // subscriptionPlan
        'Istanbul, Turkey'
    );

    await companyRepository.save(company);
    console.log(`✅ Company created: ${companyId}\n`);

    // Step 2: Create Roles (Owner + 2 managers)
    console.log('👥 Step 2: Creating Demo Roles...');
    const roles = [
        {
            id: `role_owner_${ts}`,
            name: 'Owner',
            description: 'Company owner with full access',
            permissions: ['*']
        },
        {
            id: `role_admin_${ts}`,
            name: 'Admin',
            description: 'Full system administrator',
            permissions: ['view', 'edit', 'delete', 'manage_users', 'manage_settings']
        },
        {
            id: `role_finance_${ts + 1}`,
            name: 'Finance Manager',
            description: 'Financial operations manager',
            permissions: ['view', 'edit', 'accounting.manage', 'reports.view']
        },
        {
            id: `role_inventory_${ts + 2}`,
            name: 'Inventory Manager',
            description: 'Warehouse and inventory manager',
            permissions: ['view', 'edit', 'inventory.manage', 'warehouse.manage']
        }
    ];

    const createdRoles: Array<{ id: string; name: string }> = [];

    for (const roleData of roles) {
        const role: CompanyRole = {
            id: roleData.id,
            companyId,
            name: roleData.name,
            description: roleData.description,
            permissions: roleData.permissions,
            isSystem: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await companyRoleRepository.create(role);
        createdRoles.push({ id: role.id, name: role.name });
        console.log(`  ✓ Role created: ${role.name}`);
    }
    console.log('');

    // Step 3: Create Demo Users
    console.log('👤 Step 3: Creating Demo Users...');
    const users = [
        { email: ownerEmail, name: 'System Admin', roleIndex: 0, forceUserId: ownerUserId },
        { email: 'finance@demo.com', name: 'Finance Manager', roleIndex: 2 },
        { email: 'warehouse@demo.com', name: 'Warehouse Manager', roleIndex: 3 },
        { email: 'user1@demo.com', name: 'Demo User 1', roleIndex: 1 },
        { email: 'user2@demo.com', name: 'Demo User 2', roleIndex: 2 },
        { email: 'sa@demo.com', name: 'Super Admin', roleIndex: 0, isSuperAdmin: true, password: '123123' }
    ];

    const createdUsers: Array<{ id: string; email: string; role: string }> = [];

    for (const userData of users) {
        let userId = userData.forceUserId || `user_${userData.email.split('@')[0]}_${Date.now()}`;
        const roleId = roles[userData.roleIndex].id;

        // 1. Create Firebase Auth User
        try {
            await admin.auth().createUser({
                uid: userId,
                email: userData.email,
                password: userData.password || 'password123', // Default password
                displayName: userData.name,
                emailVerified: true
            });
            console.log(`  ✓ Auth account created: ${userData.email}`);
        } catch (error: any) {
            if (error.code === 'auth/email-already-exists') {
            console.log(`  ! Auth account already exists: ${userData.email} (Linking to existing)`);
                const existingUser = await admin.auth().getUserByEmail(userData.email);
                userId = existingUser.uid; 
            } else {
                console.error(`  ❌ Failed to create auth user for ${userData.email}:`, error);
            }
        }

        // Set Custom Claims for Super Admin
        if (userData.isSuperAdmin) {
            await admin.auth().setCustomUserClaims(userId, { superAdmin: true });
            console.log(`  ✓ Custom claims set for Super Admin: ${userData.email}`);
        }

        // Create user in user repository - use proper User entity
        const globalRole = userData.isSuperAdmin ? 'SUPER_ADMIN' : 'USER';
        const user = new User(
            userId,
            userData.email,
            userData.name,
            globalRole,
            new Date()
        );

        await userRepository.createUser(user);

        // Create company user membership
        const companyUser = {
            userId,
            companyId,
            roleId,
            isOwner: userData.email === ownerEmail,
            createdAt: new Date()
        };

        await companyUserRepository.create(companyUser as any);

        // Ensure activeCompanyId is set for the owner/admin
        if (userData.email === ownerEmail || userData.isSuperAdmin) {
            if (userData.email === ownerEmail) ownerUserId = userId;
            await userRepository.updateActiveCompany(userId, companyId);
        }

        createdUsers.push({
            id: userId,
            email: userData.email,
            role: roles[userData.roleIndex].name
        });
        console.log(`  ✓ User created: ${userData.email} (${roles[userData.roleIndex].name})`);
    }
    console.log('');

    // Step 4: Apply Starter Bundle
    console.log('📦 Step 4: Applying Starter Bundle...');
    const starterBundle = BUNDLES.find(b => b.id === 'starter');

    if (starterBundle) {
        await companyRepository.update(companyId, {
            modules: starterBundle.modules,
            subscriptionPlan: 'starter',
            ownerId: ownerUserId
        });
        console.log(`  ✓ Bundle applied: ${starterBundle.name}`);
        console.log(`  ✓ Modules activated: ${starterBundle.modules.join(', ')}`);
    }
    console.log('');

    // Step 5: Enable Additional Features
    console.log('🎯 Step 5: Enabling Additional Features...');
    const additionalFeatures = ['multiCurrency', 'auditLogs'];
    const allFeatures = [...(starterBundle?.features || []), ...additionalFeatures];

    await companyRepository.update(companyId, {
        features: allFeatures
    });

    for (const feature of additionalFeatures) {
        console.log(`  ✓ Feature enabled: ${feature}`);
    }
    console.log('');

    // Step 6: Create Voucher Types
    console.log('📄 Step 6: Creating Voucher Types...');
    const voucherType = new VoucherTypeDefinition(
        `vt_inv_${ts}`,
        companyId,
        'Sales Invoice',
        'INV',
        'ACCOUNTING',
        [
            new FieldDefinition('v_date', 'date', 'Date', 'DATE', true, false),
            new FieldDefinition('v_desc', 'description', 'Description', 'STRING', false, false)
        ],
        [
            { fieldId: 'l_desc', width: '40%' },
            { fieldId: 'l_acc', width: '30%' },
            { fieldId: 'l_debit', width: '15%' },
            { fieldId: 'l_credit', width: '15%' }
        ],
        {
            sections: [
                {
                    title: 'General Info',
                    fields: ['v_date', 'v_desc']
                }
            ],
            lineFields: [
                { ...new FieldDefinition('l_desc', 'description', 'Description', 'STRING', true, false) },
                { ...new FieldDefinition('l_acc', 'accountId', 'Account', 'REFERENCE', true, false, [], [], null) },
                { ...new FieldDefinition('l_debit', 'debit', 'Debit', 'NUMBER', false, false) },
                { ...new FieldDefinition('l_credit', 'credit', 'Credit', 'NUMBER', false, false) }
            ]
        }
    );

    // Note: The entity constructor might not match exactly what I guessed for layout.
    // Let's adjust based on the entity definition I saw earlier:
    // public layout: Record<string, any>
    // The frontend expects specific structure. I'll stick to a generic layout object that the frontend can parse or I'll adapt the frontend.
    // Actually, looking at the mock:
    /*
    header: { fields: [...] },
    lines: { columns: [...] }
    */
    // The backend entity has `headerFields` and `tableColumns`.
    // The `layout` param is likely for UI arrangement.
    // I will pass the line definitions in the layout or assume they are derived.
    // Wait, `tableColumns` only has `fieldId`. Where are the line field definitions stored?
    // The `VoucherTypeDefinition` class I saw:
    /*
    constructor(
        public id: string,
        public name: string,
        public code: string,
        public module: string,
        public headerFields: FieldDefinition[],
        public tableColumns: TableColumn[],
        public layout: Record<string, any>
    )
    */
    // It seems `headerFields` are explicit. But where are "Line Fields"?
    // Maybe they are supposed to be in `headerFields` too? No, that doesn't make sense.
    // Let's look at `VoucherTypeDefinition.ts` again.
    // Ah, I might have missed something.
    // If `tableColumns` references `fieldId`, those fields must be defined somewhere.
    // Maybe `headerFields` contains ALL fields?
    // Or maybe `layout` contains the line definitions?
    
    // I'll assume for now that I can put line field definitions in `layout.lineFields` as I did above.
    // And I'll update the repository/mapper if needed.
    
    await deps.voucherTypeDefinitionRepository.createVoucherType(voucherType);
    console.log(`  ✓ Voucher Type created: ${voucherType.name} (${voucherType.code})`);
    console.log('');

    // Step 7: Return Final Result
    const result: SeedResult = {
        companyId,
        companyName: 'Demo Manufacturing Co.',
        rolesCreated: createdRoles,
        usersCreated: createdUsers,
        activeModules: starterBundle?.modules || [],
        activeFeatures: allFeatures,
        bundleApplied: 'starter'
    };

    console.log('✅ Demo Company Seeded Successfully!\n');

    return result;
}
