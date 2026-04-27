import { CreateCompanyRoleUseCase } from '../CreateCompanyRoleUseCase';
import { UpdateCompanyRoleUseCase } from '../UpdateCompanyRoleUseCase';
import { deriveModuleBundlesFromPermissions } from '../../services/RoleModuleBundleDeriver';
import { ICompanyRoleRepository } from '../../../../repository/interfaces/rbac/ICompanyRoleRepository';

const mockGetAvailablePermissions = jest.fn();

jest.mock('../../../platform/PermissionCatalogSyncService', () => ({
  PermissionCatalogSyncService: jest.fn().mockImplementation(() => ({
    getAvailablePermissions: mockGetAvailablePermissions,
  })),
}));

describe('company role module bundle derivation', () => {
  let roleRepository: jest.Mocked<ICompanyRoleRepository>;

  beforeEach(() => {
    mockGetAvailablePermissions.mockResolvedValue([
      { id: 'accounting.accounts.view' },
      { id: 'accounting.vouchers.view' },
      { id: 'inventory.items.manage' },
      { id: 'system.roles.manage' },
    ]);

    roleRepository = {
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('derives module IDs from permission prefixes only', () => {
    expect(deriveModuleBundlesFromPermissions([
      'accounting.accounts.view',
      'Accounting.vouchers.view',
      'inventory.items.manage',
      'system.roles.manage',
      '*',
      '',
    ])).toEqual(['accounting', 'inventory']);
  });

  it('creates company roles with moduleBundles and permission mirrors', async () => {
    const useCase = new CreateCompanyRoleUseCase(roleRepository);

    const result = await useCase.execute({
      companyId: 'cmp_1',
      name: 'Accountant',
      permissions: ['accounting.accounts.view', 'accounting.vouchers.view', 'system.roles.manage'],
    });

    expect(roleRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'cmp_1',
      name: 'Accountant',
      permissions: ['accounting.accounts.view', 'accounting.vouchers.view', 'system.roles.manage'],
      explicitPermissions: ['accounting.accounts.view', 'accounting.vouchers.view', 'system.roles.manage'],
      resolvedPermissions: ['accounting.accounts.view', 'accounting.vouchers.view', 'system.roles.manage'],
      moduleBundles: ['accounting'],
    }));
    expect(result.moduleBundles).toEqual(['accounting']);
    expect(result.resolvedPermissions).toEqual([
      'accounting.accounts.view',
      'accounting.vouchers.view',
      'system.roles.manage',
    ]);
  });

  it('recomputes moduleBundles when role permissions change', async () => {
    roleRepository.getById.mockResolvedValue({
      id: 'role_1',
      companyId: 'cmp_1',
      name: 'Stock Clerk',
      permissions: ['inventory.items.manage'],
      explicitPermissions: ['inventory.items.manage'],
      resolvedPermissions: ['inventory.items.manage'],
      moduleBundles: ['inventory'],
      isSystem: false,
    });

    const useCase = new UpdateCompanyRoleUseCase(roleRepository);

    await useCase.execute({
      companyId: 'cmp_1',
      roleId: 'role_1',
      permissions: ['accounting.accounts.view'],
    });

    expect(roleRepository.update).toHaveBeenCalledWith('cmp_1', 'role_1', expect.objectContaining({
      permissions: ['accounting.accounts.view'],
      explicitPermissions: ['accounting.accounts.view'],
      resolvedPermissions: ['accounting.accounts.view'],
      moduleBundles: ['accounting'],
    }));
  });

  it('preserves moduleBundles when metadata changes without permissions', async () => {
    roleRepository.getById.mockResolvedValue({
      id: 'role_1',
      companyId: 'cmp_1',
      name: 'Accountant',
      permissions: ['accounting.accounts.view'],
      explicitPermissions: ['accounting.accounts.view'],
      resolvedPermissions: ['accounting.accounts.view'],
      moduleBundles: ['accounting'],
      isSystem: false,
    });

    const useCase = new UpdateCompanyRoleUseCase(roleRepository);

    await useCase.execute({
      companyId: 'cmp_1',
      roleId: 'role_1',
      description: 'Updated description',
    });

    expect(roleRepository.update).toHaveBeenCalledWith('cmp_1', 'role_1', expect.objectContaining({
      description: 'Updated description',
      permissions: ['accounting.accounts.view'],
      explicitPermissions: ['accounting.accounts.view'],
      resolvedPermissions: ['accounting.accounts.view'],
      moduleBundles: ['accounting'],
    }));
    expect(mockGetAvailablePermissions).not.toHaveBeenCalled();
  });
});
