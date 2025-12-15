import * as admin from 'firebase-admin';
import { ICompanyRepository } from '../repository/interfaces/core/ICompanyRepository';
import { ICompanyRoleRepository } from '../repository/interfaces/rbac/ICompanyRoleRepository';
import { ICompanyUserRepository } from '../repository/interfaces/rbac/ICompanyUserRepository';
import { IUserRepository } from '../repository/interfaces/core/IUserRepository';
import { IVoucherTypeDefinitionRepository } from '../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { ICompanyModuleRepository } from '../repository/interfaces/company/ICompanyModuleRepository';
import { Company } from '../domain/core/entities/Company';
import { User } from '../domain/core/entities/User';
import { CompanyRole } from '../domain/rbac/CompanyRole';
import { VoucherTypeDefinition } from '../domain/designer/entities/VoucherTypeDefinition';
import { FieldDefinition } from '../domain/designer/entities/FieldDefinition';

export interface SeedDependencies {
    companyRepository: ICompanyRepository;
    companyRoleRepository: ICompanyRoleRepository;
    companyUserRepository: ICompanyUserRepository;
    userRepository: IUserRepository;
    voucherTypeDefinitionRepository: IVoucherTypeDefinitionRepository;
    companyModuleRepository: ICompanyModuleRepository;
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

    // Step 4: Set basic modules (no longer using hardcoded bundles)
    console.log('📦 Step 4: Setting Basic Modules...');
    
    await companyRepository.update(companyId, {
        modules: ['accounting', 'inventory', 'finance', 'hr'],
        subscriptionPlan: '', // No hardcoded bundle
        ownerId: ownerUserId
    });

    // Substep: Create Company Module entries (Subcollection)
    console.log('  → Creating module entries in subcollection...');
    const modulesToInit = ['accounting', 'inventory', 'finance', 'hr'];
    for (const mod of modulesToInit) {
        console.log(`    → Creating module: ${mod}...`);
        try {
            await deps.companyModuleRepository.create({
                companyId,
                moduleCode: mod,
                initialized: false, // Explicitly false to trigger wizard
                initializationStatus: 'pending',
                config: {},
                installedAt: new Date()
            });
            console.log(`    ✓ Module ${mod} created successfully`);
        } catch (err) {
            console.error(`    ❌ Failed to create module ${mod}:`, err);
            throw err;
        }
    }

    console.log(`  ✓ Basic modules activated: ${modulesToInit.join(', ')}`);
    console.log('');

    // Note: Features are no longer part of bundles in the new architecture
    console.log('ℹ️  Note: Features are managed separately in the new bundle architecture');
    console.log('');

    // Step 5: Voucher Types - Skipped for now
    console.log('ℹ️  Step 5: Voucher Types creation skipped (undefined value issue)');
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
