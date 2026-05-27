import { randomUUID } from 'crypto';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { IPriceListRepository } from '../../../repository/interfaces/sales/IPriceListRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { CreateAccountUseCase } from '../../accounting/use-cases/accounts/CreateAccountUseCase';
import { Party, PartyRole } from '../../../domain/shared/entities/Party';
import {
  renderPartyAccountCode,
  templateUsesSequence,
} from '../services/PartyAccountCodeRenderer';

export type PartyAccountStrategy = 'AUTO_CREATE' | 'PICK_EXISTING';

export interface CreatePartyInput {
  companyId: string;
  code: string;
  legalName: string;
  displayName: string;
  roles: PartyRole[];
  /**
   * Required. Controls how the party's AR/AP sub-account is set.
   *  - AUTO_CREATE   → create a new sub-account under the configured parent
   *  - PICK_EXISTING → validate and use the provided defaultARAccountId / defaultAPAccountId
   */
  accountStrategy: PartyAccountStrategy;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  defaultCurrency?: string;
  defaultAPAccountId?: string;
  defaultARAccountId?: string;
  creditLimit?: number;
  creditHoldPolicy?: 'NONE' | 'WARN' | 'BLOCK';
  defaultPriceListId?: string;
  customerGroupId?: string;
  defaultSalesInvoiceTemplateId?: string;
  defaultSalesInvoiceFormType?: string;
  taxExempt?: boolean;
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
  creditLimit?: number;
  creditHoldPolicy?: 'NONE' | 'WARN' | 'BLOCK';
  defaultPriceListId?: string;
  customerGroupId?: string | null;
  defaultSalesInvoiceTemplateId?: string | null;
  defaultSalesInvoiceFormType?: string | null;
  taxExempt?: boolean;
  active?: boolean;
}

export interface ListPartiesFilters {
  role?: PartyRole;
  active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PartyAccountAutoCreateDeps {
  accountRepo: IAccountRepository;
  createAccountUseCase: CreateAccountUseCase;
  salesSettingsRepo: ISalesSettingsRepository;
  purchaseSettingsRepo: IPurchaseSettingsRepository;
}

export class CreatePartyUseCase {
  constructor(
    private readonly partyRepo: IPartyRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly autoCreateDeps?: PartyAccountAutoCreateDeps
  ) {}

  async execute(input: CreatePartyInput): Promise<Party> {
    if (!Array.isArray(input.roles) || input.roles.length === 0) {
      throw new Error('Party roles must contain at least one role');
    }

    if (input.accountStrategy !== 'AUTO_CREATE' && input.accountStrategy !== 'PICK_EXISTING') {
      throw new Error('accountStrategy is required: AUTO_CREATE or PICK_EXISTING');
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

    const isCustomer = input.roles.includes('CUSTOMER');
    const isVendor = input.roles.includes('VENDOR');

    let resolvedARAccountId = input.defaultARAccountId;
    let resolvedAPAccountId = input.defaultAPAccountId;

    if (input.accountStrategy === 'AUTO_CREATE') {
      if (!this.autoCreateDeps) {
        throw new Error('AUTO_CREATE strategy requires account/settings dependencies to be wired');
      }
      if (isCustomer) {
        resolvedARAccountId = await this.autoCreateSubAccount(
          input.companyId,
          input.code,
          input.legalName,
          'AR',
          input.createdBy
        );
      }
      if (isVendor) {
        resolvedAPAccountId = await this.autoCreateSubAccount(
          input.companyId,
          input.code,
          input.legalName,
          'AP',
          input.createdBy
        );
      }
    } else {
      // PICK_EXISTING: validate any provided account references match the role's expected classification
      if (this.autoCreateDeps?.accountRepo) {
        if (isCustomer && input.defaultARAccountId) {
          const acc = await this.autoCreateDeps.accountRepo.getById(input.companyId, input.defaultARAccountId);
          if (!acc) throw new Error(`AR account not found: ${input.defaultARAccountId}`);
          if (acc.classification !== 'ASSET') {
            throw new Error(`AR account must be classified as ASSET (got ${acc.classification})`);
          }
        }
        if (isVendor && input.defaultAPAccountId) {
          const acc = await this.autoCreateDeps.accountRepo.getById(input.companyId, input.defaultAPAccountId);
          if (!acc) throw new Error(`AP account not found: ${input.defaultAPAccountId}`);
          if (acc.classification !== 'LIABILITY') {
            throw new Error(`AP account must be classified as LIABILITY (got ${acc.classification})`);
          }
        }
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
      defaultAPAccountId: resolvedAPAccountId,
      defaultARAccountId: resolvedARAccountId,
      creditLimit: input.creditLimit,
      creditHoldPolicy: input.creditHoldPolicy,
      defaultPriceListId: input.defaultPriceListId,
      customerGroupId: input.customerGroupId,
      defaultSalesInvoiceTemplateId: input.defaultSalesInvoiceTemplateId,
      defaultSalesInvoiceFormType: input.defaultSalesInvoiceFormType,
      taxExempt: input.taxExempt,
      active: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.partyRepo.create(party);
    return party;
  }

  private async autoCreateSubAccount(
    companyId: string,
    partyCode: string,
    partyName: string,
    side: 'AR' | 'AP',
    createdBy: string
  ): Promise<string> {
    const deps = this.autoCreateDeps!;
    const salesSettings = side === 'AR' ? await deps.salesSettingsRepo.getSettings(companyId) : null;
    const purchaseSettings = side === 'AP' ? await deps.purchaseSettingsRepo.getSettings(companyId) : null;

    const parentAccountId = side === 'AR' ? salesSettings?.arParentAccountId : purchaseSettings?.apParentAccountId;
    if (!parentAccountId) {
      throw new Error(
        side === 'AR'
          ? 'AUTO_CREATE requires Sales Settings → AR Parent Account to be configured'
          : 'AUTO_CREATE requires Purchase Settings → AP Parent Account to be configured'
      );
    }

    const parent = await deps.accountRepo.getById(companyId, parentAccountId);
    if (!parent) {
      throw new Error(`${side} parent account not found: ${parentAccountId}`);
    }

    const template = side === 'AR'
      ? salesSettings?.partyAccountCodeFormat
      : purchaseSettings?.partyAccountCodeFormat;

    const usesSeq = templateUsesSequence(template);
    const parentCode = (parent as any).userCode || (parent as any).code || '';

    // Render the user code, resolving {seq3} by walking the next sequence under the parent
    // until a non-colliding code is found.
    let seq = 1;
    let userCode = renderPartyAccountCode(template, { parent: parentCode, partyCode, seq });
    if (usesSeq) {
      // Bump sequence until unique
      // (linear probe — acceptable since per-tenant chart of accounts stays small)
      // eslint-disable-next-line no-constant-condition
      while (await deps.accountRepo.existsByUserCode(companyId, userCode)) {
        seq += 1;
        userCode = renderPartyAccountCode(template, { parent: parentCode, partyCode, seq });
      }
    } else {
      if (await deps.accountRepo.existsByUserCode(companyId, userCode)) {
        throw new Error(
          `Generated account code already exists: ${userCode}. Add {seq3} to partyAccountCodeFormat to auto-disambiguate.`
        );
      }
    }

    const classification = side === 'AR' ? 'ASSET' : 'LIABILITY';
    const account = await deps.createAccountUseCase.execute(companyId, {
      userCode,
      name: `${side === 'AR' ? 'AR' : 'AP'} – ${partyName}`,
      classification,
      parentId: parentAccountId,
      accountRole: 'POSTING',
      createdBy,
    });

    return account.id;
  }
}

export class UpdatePartyUseCase {
  constructor(
    private readonly partyRepo: IPartyRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly priceListRepo?: IPriceListRepository
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

    if (input.defaultPriceListId && this.priceListRepo) {
      const priceList = await this.priceListRepo.getById(input.companyId, input.defaultPriceListId);
      if (!priceList) {
        throw new Error(`Price list not found: ${input.defaultPriceListId}`);
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
      creditLimit: input.creditLimit ?? existing.creditLimit,
      creditHoldPolicy: input.creditHoldPolicy ?? existing.creditHoldPolicy,
      defaultPriceListId: input.defaultPriceListId ?? existing.defaultPriceListId,
      customerGroupId:
        input.customerGroupId !== undefined
          ? (input.customerGroupId || undefined)
          : existing.customerGroupId,
      defaultSalesInvoiceTemplateId:
        input.defaultSalesInvoiceTemplateId !== undefined
          ? (input.defaultSalesInvoiceTemplateId || undefined)
          : existing.defaultSalesInvoiceTemplateId,
      defaultSalesInvoiceFormType:
        input.defaultSalesInvoiceFormType !== undefined
          ? (input.defaultSalesInvoiceFormType || undefined)
          : existing.defaultSalesInvoiceFormType,
      taxExempt: input.taxExempt ?? existing.taxExempt,
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
