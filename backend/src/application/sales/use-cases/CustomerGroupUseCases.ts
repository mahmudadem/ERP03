import { CustomerGroup, CustomerGroupProps } from '../../../domain/sales/entities/CustomerGroup';
import {
  ICustomerGroupRepository,
  CustomerGroupListOptions,
} from '../../../repository/interfaces/sales/ICustomerGroupRepository';
import { IPriceListRepository } from '../../../repository/interfaces/sales/IPriceListRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';

// ---------------------------------------------------------------------------
// Shared input types
// ---------------------------------------------------------------------------

export interface CreateCustomerGroupInput {
  companyId: string;
  name: string;
  description?: string;
  defaultPriceListId?: string;
  defaultPaymentTermsDays?: number;
  defaultCreditLimit?: number;
  taxExempt?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
}

export interface UpdateCustomerGroupInput {
  companyId: string;
  id: string;
  name?: string;
  description?: string | null;
  defaultPriceListId?: string | null;
  defaultPaymentTermsDays?: number | null;
  defaultCreditLimit?: number | null;
  taxExempt?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface AssignCustomerToGroupInput {
  companyId: string;
  customerId: string;
  customerGroupId: string | null;
}

// ---------------------------------------------------------------------------
// CreateCustomerGroupUseCase
// ---------------------------------------------------------------------------

export class CreateCustomerGroupUseCase {
  constructor(
    private readonly customerGroupRepo: ICustomerGroupRepository,
    private readonly priceListRepo: IPriceListRepository
  ) {}

  async execute(input: CreateCustomerGroupInput): Promise<CustomerGroup> {
    // Validate name uniqueness within company
    const existing = await this.customerGroupRepo.getByName(input.companyId, input.name);
    if (existing) {
      throw new Error(
        `CustomerGroup with name "${input.name}" already exists in company ${input.companyId}`
      );
    }

    // Validate defaultPriceListId if provided
    if (input.defaultPriceListId) {
      const priceList = await this.priceListRepo.getById(
        input.companyId,
        input.defaultPriceListId
      );
      if (!priceList) {
        throw new Error(
          `PriceList not found: ${input.defaultPriceListId}`
        );
      }
    }

    const group = new CustomerGroup({
      companyId: input.companyId,
      name: input.name,
      description: input.description,
      defaultPriceListId: input.defaultPriceListId,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays,
      defaultCreditLimit: input.defaultCreditLimit,
      taxExempt: input.taxExempt,
      status: input.status ?? 'ACTIVE',
      createdBy: input.createdBy,
    });

    await this.customerGroupRepo.create(group);
    return group;
  }
}

// ---------------------------------------------------------------------------
// UpdateCustomerGroupUseCase
// ---------------------------------------------------------------------------

export class UpdateCustomerGroupUseCase {
  constructor(
    private readonly customerGroupRepo: ICustomerGroupRepository,
    private readonly priceListRepo: IPriceListRepository
  ) {}

  async execute(input: UpdateCustomerGroupInput): Promise<CustomerGroup> {
    const existing = await this.customerGroupRepo.getById(input.companyId, input.id);
    if (!existing) {
      throw new Error(`CustomerGroup not found: ${input.id}`);
    }

    // Validate name uniqueness — skip self
    if (input.name !== undefined && input.name !== existing.name) {
      const conflict = await this.customerGroupRepo.getByName(input.companyId, input.name);
      if (conflict && conflict.id !== input.id) {
        throw new Error(
          `CustomerGroup with name "${input.name}" already exists in company ${input.companyId}`
        );
      }
    }

    // Validate defaultPriceListId if explicitly provided (non-null)
    const newPriceListId =
      input.defaultPriceListId !== undefined
        ? input.defaultPriceListId  // may be null (clearing)
        : existing.defaultPriceListId;

    if (newPriceListId) {
      const priceList = await this.priceListRepo.getById(input.companyId, newPriceListId);
      if (!priceList) {
        throw new Error(`PriceList not found: ${newPriceListId}`);
      }
    }

    const props: CustomerGroupProps = {
      id: existing.id,
      companyId: existing.companyId,
      name: input.name ?? existing.name,
      description:
        input.description !== undefined
          ? (input.description ?? undefined)
          : existing.description,
      defaultPriceListId:
        input.defaultPriceListId !== undefined
          ? (input.defaultPriceListId ?? undefined)
          : existing.defaultPriceListId,
      defaultPaymentTermsDays:
        input.defaultPaymentTermsDays !== undefined
          ? (input.defaultPaymentTermsDays ?? undefined)
          : existing.defaultPaymentTermsDays,
      defaultCreditLimit:
        input.defaultCreditLimit !== undefined
          ? (input.defaultCreditLimit ?? undefined)
          : existing.defaultCreditLimit,
      taxExempt: input.taxExempt !== undefined ? input.taxExempt : existing.taxExempt,
      status: input.status ?? existing.status,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    const updated = new CustomerGroup(props);
    await this.customerGroupRepo.update(updated);
    return updated;
  }
}

// ---------------------------------------------------------------------------
// DeleteCustomerGroupUseCase
// ---------------------------------------------------------------------------

export class DeleteCustomerGroupUseCase {
  constructor(
    private readonly customerGroupRepo: ICustomerGroupRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(companyId: string, id: string): Promise<void> {
    const existing = await this.customerGroupRepo.getById(companyId, id);
    if (!existing) {
      throw new Error(`CustomerGroup not found: ${id}`);
    }

    // Check that no parties reference this group
    const parties = await this.partyRepo.list(companyId);
    const referencingCount = parties.filter(
      (p) => (p as any).customerGroupId === id
    ).length;

    if (referencingCount > 0) {
      throw new Error(
        `Cannot delete CustomerGroup "${existing.name}": ${referencingCount} party/parties still reference it`
      );
    }

    await this.customerGroupRepo.delete(companyId, id);
  }
}

// ---------------------------------------------------------------------------
// GetCustomerGroupUseCase
// ---------------------------------------------------------------------------

export class GetCustomerGroupUseCase {
  constructor(private readonly customerGroupRepo: ICustomerGroupRepository) {}

  async execute(companyId: string, id: string): Promise<CustomerGroup | null> {
    return this.customerGroupRepo.getById(companyId, id);
  }
}

// ---------------------------------------------------------------------------
// ListCustomerGroupsUseCase
// ---------------------------------------------------------------------------

export interface ListCustomerGroupsOptions {
  status?: 'ACTIVE' | 'INACTIVE';
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export class ListCustomerGroupsUseCase {
  constructor(private readonly customerGroupRepo: ICustomerGroupRepository) {}

  async execute(
    companyId: string,
    options?: ListCustomerGroupsOptions
  ): Promise<CustomerGroup[]> {
    const opts: CustomerGroupListOptions = {
      status: options?.status,
      includeInactive: options?.includeInactive,
      limit: options?.limit,
      offset: options?.offset,
    };
    return this.customerGroupRepo.list(companyId, opts);
  }
}

// ---------------------------------------------------------------------------
// AssignCustomerToGroupUseCase
// ---------------------------------------------------------------------------

export class AssignCustomerToGroupUseCase {
  constructor(
    private readonly customerGroupRepo: ICustomerGroupRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(input: AssignCustomerToGroupInput): Promise<void> {
    // Validate target group exists and is ACTIVE (if not clearing)
    if (input.customerGroupId !== null) {
      const group = await this.customerGroupRepo.getById(
        input.companyId,
        input.customerGroupId
      );
      if (!group) {
        throw new Error(`CustomerGroup not found: ${input.customerGroupId}`);
      }
      if (group.status !== 'ACTIVE') {
        throw new Error(
          `Cannot assign customer to inactive CustomerGroup "${group.name}"`
        );
      }
    }

    const party = await this.partyRepo.getById(input.companyId, input.customerId);
    if (!party) {
      throw new Error(`Party not found: ${input.customerId}`);
    }

    // Set / clear the customerGroupId
    (party as any).customerGroupId =
      input.customerGroupId !== null ? input.customerGroupId : undefined;
    party.updatedAt = new Date();

    await this.partyRepo.update(party);
  }
}
