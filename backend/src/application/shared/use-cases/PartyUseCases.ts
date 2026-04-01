import { randomUUID } from 'crypto';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { Party, PartyRole } from '../../../domain/shared/entities/Party';

export interface CreatePartyInput {
  companyId: string;
  code: string;
  legalName: string;
  displayName: string;
  roles: PartyRole[];
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  defaultCurrency?: string;
  defaultAPAccountId?: string;
  defaultARAccountId?: string;
  createdBy: string;
}

export interface UpdatePartyInput {
  companyId: string;
  id: string;
  code?: string;
  legalName?: string;
  displayName?: string;
  roles?: PartyRole[];
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  defaultCurrency?: string;
  defaultAPAccountId?: string;
  defaultARAccountId?: string;
  active?: boolean;
}

export interface ListPartiesFilters {
  role?: PartyRole;
  active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export class CreatePartyUseCase {
  constructor(
    private readonly partyRepo: IPartyRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository
  ) {}

  async execute(input: CreatePartyInput): Promise<Party> {
    if (!Array.isArray(input.roles) || input.roles.length === 0) {
      throw new Error('Party roles must contain at least one role');
    }

    const existing = await this.partyRepo.getByCode(input.companyId, input.code);
    if (existing) {
      throw new Error(`Party code already exists: ${input.code}`);
    }

    if (input.defaultCurrency) {
      const enabled = await this.companyCurrencyRepo.isEnabled(input.companyId, input.defaultCurrency);
      if (!enabled) {
        throw new Error(`Default currency is not enabled for company: ${input.defaultCurrency}`);
      }
    }

    const now = new Date();
    const party = new Party({
      id: randomUUID(),
      companyId: input.companyId,
      code: input.code,
      legalName: input.legalName,
      displayName: input.displayName,
      roles: input.roles,
      contactPerson: input.contactPerson,
      phone: input.phone,
      email: input.email,
      address: input.address,
      taxId: input.taxId,
      paymentTermsDays: input.paymentTermsDays,
      defaultCurrency: input.defaultCurrency,
      defaultAPAccountId: input.defaultAPAccountId,
      defaultARAccountId: input.defaultARAccountId,
      active: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.partyRepo.create(party);
    return party;
  }
}

export class UpdatePartyUseCase {
  constructor(
    private readonly partyRepo: IPartyRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository
  ) {}

  async execute(input: UpdatePartyInput): Promise<Party> {
    const existing = await this.partyRepo.getById(input.companyId, input.id);
    if (!existing) {
      throw new Error(`Party not found: ${input.id}`);
    }

    const nextCode = input.code ?? existing.code;
    if (nextCode !== existing.code) {
      const duplicate = await this.partyRepo.getByCode(input.companyId, nextCode);
      if (duplicate && duplicate.id !== existing.id) {
        throw new Error(`Party code already exists: ${nextCode}`);
      }
    }

    if (input.roles && input.roles.length === 0) {
      throw new Error('Party roles must contain at least one role');
    }

    if (input.defaultCurrency) {
      const enabled = await this.companyCurrencyRepo.isEnabled(input.companyId, input.defaultCurrency);
      if (!enabled) {
        throw new Error(`Default currency is not enabled for company: ${input.defaultCurrency}`);
      }
    }

    const updated = new Party({
      id: existing.id,
      companyId: existing.companyId,
      code: input.code ?? existing.code,
      legalName: input.legalName ?? existing.legalName,
      displayName: input.displayName ?? existing.displayName,
      roles: input.roles ?? existing.roles,
      contactPerson: input.contactPerson ?? existing.contactPerson,
      phone: input.phone ?? existing.phone,
      email: input.email ?? existing.email,
      address: input.address ?? existing.address,
      taxId: input.taxId ?? existing.taxId,
      paymentTermsDays: input.paymentTermsDays ?? existing.paymentTermsDays,
      defaultCurrency: input.defaultCurrency ?? existing.defaultCurrency,
      defaultAPAccountId: input.defaultAPAccountId ?? existing.defaultAPAccountId,
      defaultARAccountId: input.defaultARAccountId ?? existing.defaultARAccountId,
      active: input.active ?? existing.active,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.partyRepo.update(updated);
    return updated;
  }
}

export class ListPartiesUseCase {
  constructor(private readonly partyRepo: IPartyRepository) {}

  async execute(companyId: string, filters: ListPartiesFilters = {}): Promise<Party[]> {
    const parties = await this.partyRepo.list(companyId, {
      role: filters.role,
      active: filters.active,
      limit: filters.limit,
      offset: filters.offset,
    });

    const search = (filters.search || '').trim().toLowerCase();
    if (!search) {
      return parties;
    }

    return parties.filter((party) =>
      party.code.toLowerCase().includes(search) ||
      party.legalName.toLowerCase().includes(search) ||
      party.displayName.toLowerCase().includes(search) ||
      (party.phone || '').toLowerCase().includes(search) ||
      (party.email || '').toLowerCase().includes(search)
    );
  }
}

export class GetPartyUseCase {
  constructor(private readonly partyRepo: IPartyRepository) {}

  async execute(companyId: string, id: string): Promise<Party> {
    const party = await this.partyRepo.getById(companyId, id);
    if (!party) {
      throw new Error(`Party not found: ${id}`);
    }

    return party;
  }
}
