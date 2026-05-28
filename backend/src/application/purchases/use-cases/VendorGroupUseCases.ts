import { VendorGroup, VendorGroupProps } from '../../../domain/purchases/entities/VendorGroup';
import {
  IVendorGroupRepository,
  VendorGroupListOptions,
} from '../../../repository/interfaces/purchases/IVendorGroupRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';

export interface CreateVendorGroupInput {
  companyId: string;
  name: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
}

export interface UpdateVendorGroupInput {
  companyId: string;
  id: string;
  name?: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface AssignVendorToGroupInput {
  companyId: string;
  vendorId: string;
  vendorGroupId: string | null;
}

export interface ListVendorGroupsOptions {
  status?: 'ACTIVE' | 'INACTIVE';
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export class CreateVendorGroupUseCase {
  constructor(private readonly vendorGroupRepo: IVendorGroupRepository) {}

  async execute(input: CreateVendorGroupInput): Promise<VendorGroup> {
    const existing = await this.vendorGroupRepo.getByName(input.companyId, input.name);
    if (existing) {
      throw new Error(`VendorGroup with name "${input.name}" already exists in company ${input.companyId}`);
    }

    const group = new VendorGroup({
      companyId: input.companyId,
      name: input.name,
      description: input.description,
      status: input.status ?? 'ACTIVE',
      createdBy: input.createdBy,
    });

    await this.vendorGroupRepo.create(group);
    return group;
  }
}

export class UpdateVendorGroupUseCase {
  constructor(private readonly vendorGroupRepo: IVendorGroupRepository) {}

  async execute(input: UpdateVendorGroupInput): Promise<VendorGroup> {
    const existing = await this.vendorGroupRepo.getById(input.companyId, input.id);
    if (!existing) {
      throw new Error(`VendorGroup not found: ${input.id}`);
    }

    if (input.name !== undefined && input.name !== existing.name) {
      const conflict = await this.vendorGroupRepo.getByName(input.companyId, input.name);
      if (conflict && conflict.id !== input.id) {
        throw new Error(`VendorGroup with name "${input.name}" already exists in company ${input.companyId}`);
      }
    }

    const props: VendorGroupProps = {
      id: existing.id,
      companyId: existing.companyId,
      name: input.name ?? existing.name,
      description:
        input.description !== undefined
          ? (input.description ?? undefined)
          : existing.description,
      status: input.status ?? existing.status,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    const updated = new VendorGroup(props);
    await this.vendorGroupRepo.update(updated);
    return updated;
  }
}

export class DeleteVendorGroupUseCase {
  constructor(
    private readonly vendorGroupRepo: IVendorGroupRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(companyId: string, id: string): Promise<void> {
    const existing = await this.vendorGroupRepo.getById(companyId, id);
    if (!existing) {
      throw new Error(`VendorGroup not found: ${id}`);
    }

    const parties = await this.partyRepo.list(companyId, { role: 'VENDOR' });
    const referencingCount = parties.filter((p) => (p as any).vendorGroupId === id).length;

    if (referencingCount > 0) {
      throw new Error(
        `Cannot delete VendorGroup "${existing.name}": ${referencingCount} vendor(s) still reference it`
      );
    }

    await this.vendorGroupRepo.delete(companyId, id);
  }
}

export class GetVendorGroupUseCase {
  constructor(private readonly vendorGroupRepo: IVendorGroupRepository) {}

  async execute(companyId: string, id: string): Promise<VendorGroup | null> {
    return this.vendorGroupRepo.getById(companyId, id);
  }
}

export class ListVendorGroupsUseCase {
  constructor(private readonly vendorGroupRepo: IVendorGroupRepository) {}

  async execute(companyId: string, options?: ListVendorGroupsOptions): Promise<VendorGroup[]> {
    const opts: VendorGroupListOptions = {
      status: options?.status,
      includeInactive: options?.includeInactive,
      limit: options?.limit,
      offset: options?.offset,
    };
    return this.vendorGroupRepo.list(companyId, opts);
  }
}

export class AssignVendorToGroupUseCase {
  constructor(
    private readonly vendorGroupRepo: IVendorGroupRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(input: AssignVendorToGroupInput): Promise<void> {
    if (input.vendorGroupId !== null) {
      const group = await this.vendorGroupRepo.getById(input.companyId, input.vendorGroupId);
      if (!group) {
        throw new Error(`VendorGroup not found: ${input.vendorGroupId}`);
      }
      if (group.status !== 'ACTIVE') {
        throw new Error(`Cannot assign vendor to inactive VendorGroup "${group.name}"`);
      }
    }

    const party = await this.partyRepo.getById(input.companyId, input.vendorId);
    if (!party) {
      throw new Error(`Party not found: ${input.vendorId}`);
    }
    if (!party.roles.includes('VENDOR')) {
      throw new Error(`Party is not a vendor: ${input.vendorId}`);
    }

    (party as any).vendorGroupId = input.vendorGroupId !== null ? input.vendorGroupId : undefined;
    party.updatedAt = new Date();

    await this.partyRepo.update(party);
  }
}
