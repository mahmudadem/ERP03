import { VendorGroup } from '../../../domain/purchases/entities/VendorGroup';
import {
  AssignVendorToGroupUseCase,
  CreateVendorGroupUseCase,
  DeleteVendorGroupUseCase,
} from '../../../application/purchases/use-cases/VendorGroupUseCases';
import { IVendorGroupRepository } from '../../../repository/interfaces/purchases/IVendorGroupRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { Party } from '../../../domain/shared/entities/Party';

const makeGroup = (overrides: Partial<ConstructorParameters<typeof VendorGroup>[0]> = {}) =>
  new VendorGroup({
    id: 'vg-1',
    companyId: 'co-1',
    name: 'Local Suppliers',
    status: 'ACTIVE',
    createdBy: 'u-1',
    ...overrides,
  });

const makeVendor = (overrides: Partial<ConstructorParameters<typeof Party>[0]> = {}) =>
  new Party({
    id: 'vendor-1',
    companyId: 'co-1',
    code: 'SUP-001',
    legalName: 'Acme Supplies LLC',
    displayName: 'Acme Supplies',
    roles: ['VENDOR'],
    active: true,
    createdBy: 'u-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

const makeGroupRepo = (overrides: Partial<IVendorGroupRepository> = {}): jest.Mocked<IVendorGroupRepository> => ({
  create: jest.fn(),
  update: jest.fn(),
  getById: jest.fn(),
  getByName: jest.fn(),
  list: jest.fn(),
  delete: jest.fn(),
  ...overrides,
} as jest.Mocked<IVendorGroupRepository>);

const makePartyRepo = (overrides: Partial<IPartyRepository> = {}): jest.Mocked<IPartyRepository> => ({
  create: jest.fn(),
  update: jest.fn(),
  getById: jest.fn(),
  getByCode: jest.fn(),
  list: jest.fn(),
  delete: jest.fn(),
  ...overrides,
} as jest.Mocked<IPartyRepository>);

describe('VendorGroupUseCases', () => {
  it('creates a vendor group when the name is unique', async () => {
    const groupRepo = makeGroupRepo({ getByName: jest.fn().mockResolvedValue(null) });
    const uc = new CreateVendorGroupUseCase(groupRepo);

    const result = await uc.execute({
      companyId: 'co-1',
      name: 'Import Suppliers',
      description: 'Foreign vendors',
      createdBy: 'u-1',
    });

    expect(result).toBeInstanceOf(VendorGroup);
    expect(result.name).toBe('Import Suppliers');
    expect(groupRepo.create).toHaveBeenCalledWith(result);
  });

  it('rejects duplicate vendor group names in the same company', async () => {
    const groupRepo = makeGroupRepo({ getByName: jest.fn().mockResolvedValue(makeGroup()) });
    const uc = new CreateVendorGroupUseCase(groupRepo);

    await expect(uc.execute({ companyId: 'co-1', name: 'Local Suppliers', createdBy: 'u-1' }))
      .rejects.toThrow('already exists');
    expect(groupRepo.create).not.toHaveBeenCalled();
  });

  it('blocks delete while vendors still reference the group', async () => {
    const groupRepo = makeGroupRepo({ getById: jest.fn().mockResolvedValue(makeGroup()) });
    const partyRepo = makePartyRepo({ list: jest.fn().mockResolvedValue([makeVendor({ vendorGroupId: 'vg-1' })]) });
    const uc = new DeleteVendorGroupUseCase(groupRepo, partyRepo);

    await expect(uc.execute('co-1', 'vg-1')).rejects.toThrow('still reference it');
    expect(groupRepo.delete).not.toHaveBeenCalled();
  });

  it('assigns an active group to a vendor', async () => {
    const groupRepo = makeGroupRepo({ getById: jest.fn().mockResolvedValue(makeGroup()) });
    const vendor = makeVendor();
    const partyRepo = makePartyRepo({ getById: jest.fn().mockResolvedValue(vendor) });
    const uc = new AssignVendorToGroupUseCase(groupRepo, partyRepo);

    await uc.execute({ companyId: 'co-1', vendorId: 'vendor-1', vendorGroupId: 'vg-1' });

    expect((vendor as any).vendorGroupId).toBe('vg-1');
    expect(partyRepo.update).toHaveBeenCalledWith(vendor);
  });

  it('rejects assigning an inactive group', async () => {
    const groupRepo = makeGroupRepo({ getById: jest.fn().mockResolvedValue(makeGroup({ status: 'INACTIVE' })) });
    const partyRepo = makePartyRepo();
    const uc = new AssignVendorToGroupUseCase(groupRepo, partyRepo);

    await expect(uc.execute({ companyId: 'co-1', vendorId: 'vendor-1', vendorGroupId: 'vg-1' }))
      .rejects.toThrow('inactive VendorGroup');
    expect(partyRepo.update).not.toHaveBeenCalled();
  });

  it('clears a vendor group assignment', async () => {
    const groupRepo = makeGroupRepo();
    const vendor = makeVendor({ vendorGroupId: 'vg-1' });
    const partyRepo = makePartyRepo({ getById: jest.fn().mockResolvedValue(vendor) });
    const uc = new AssignVendorToGroupUseCase(groupRepo, partyRepo);

    await uc.execute({ companyId: 'co-1', vendorId: 'vendor-1', vendorGroupId: null });

    expect((vendor as any).vendorGroupId).toBeUndefined();
    expect(partyRepo.update).toHaveBeenCalledWith(vendor);
  });
});
