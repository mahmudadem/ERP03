import { ICompanyRepository } from '../repository/interfaces/core/ICompanyRepository';
import { ICompanyRoleRepository } from '../repository/interfaces/rbac/ICompanyRoleRepository';
import { ICompanyUserRepository } from '../repository/interfaces/rbac/ICompanyUserRepository';
import { IUserRepository } from '../repository/interfaces/core/IUserRepository';
import { Company } from '../domain/core/entities/Company';
import { CompanyRole } from '../domain/rbac/CompanyRole';
import { BUNDLES } from '../domain/platform/Bundle';
import { Features } from '../domain/platform/FeatureRegistry';

export interface SeedDependencies {
    companyRepository: ICompanyRepository;
    companyRoleRepository: ICompanyRoleRepository;
    companyUserRepository: ICompanyUserRepository;
    userRepository: IUserRepository;
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

    // Step 1: Create Demo Company
    console.log('📦 Step 1: Creating Demo Company...');
    const companyId = `demo_company_${Date.now()}`;
    const ownerId = `demo_owner_${Date.now()}`;

    const company = new Company(
        companyId,
        'Demo Manufacturing Co.',
        ownerId,
        new Date(),
        new Date(),
        'TRY',
        new Date(new Date().getFullYear(), 0, 1), // Jan 1
        new Date(new Date().getFullYear(), 11, 31), // Dec 31
        [], // modules - will be set by bundle
        'TR123456789',
        'starter', // subscriptionPlan
        'Istanbul, Turkey'
    );

    await companyRepository.create(company);
    console.log(`✅ Company created: ${companyId}\n`);

    // Step 2: Create 3 Demo Roles
    console.log('👥 Step 2: Creating Demo Roles...');
    const roles = [
        {
            id: `role_admin_${Date.now()}`,
            name: 'Admin',
            description: 'Full system administrator',
            permissions: ['view', 'edit', 'delete', 'manage_users', 'manage_settings']
        },
        {
            id: `role_finance_${Date.now() + 1}`,
            name: 'Finance Manager',
            description: 'Financial operations manager',
            permissions: ['view', 'edit', 'accounting.manage', 'reports.view']
        },
        {
            id: `role_inventory_${Date.now() + 2}`,
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

    // Step 3: Create 5 Demo Users
    console.log('👤 Step 3: Creating Demo Users...');
    const users = [
        { email: 'admin@demo.com', name: 'System Admin', roleIndex: 0 },
        { email: 'finance@demo.com', name: 'Finance Manager', roleIndex: 1 },
        { email: 'warehouse@demo.com', name: 'Warehouse Manager', roleIndex: 2 },
        { email: 'user1@demo.com', name: 'Demo User 1', roleIndex: 0 },
        { email: 'user2@demo.com', name: 'Demo User 2', roleIndex: 1 }
    ];

    const createdUsers: Array<{ id: string; email: string; role: string }> = [];

    for (const userData of users) {
        const userId = `user_${userData.email.split('@')[0]}_${Date.now()}`;
        const roleId = roles[userData.roleIndex].id;

        // Create user in user repository
        const user = {
            uid: userId,
            email: userData.email,
            name: userData.name,
            companyId,
            roleId,
            createdAt: new Date()
        };

        await userRepository.createUser(user as any);

        // Create company user membership
        const companyUser = {
            userId,
            companyId,
            roleId,
            isOwner: userData.email === 'admin@demo.com',
            createdAt: new Date()
        };

        await companyUserRepository.create(companyUser as any);

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
            subscriptionPlan: 'starter'
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
    } as any);

    for (const feature of additionalFeatures) {
        console.log(`  ✓ Feature enabled: ${feature}`);
    }
    console.log('');

    // Step 6: Return Final Result
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
