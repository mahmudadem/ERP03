import { Salesperson, SalespersonProps } from '../../../domain/sales/entities/Salesperson';
import {
  ISalespersonRepository,
  SalespersonListOptions,
} from '../../../repository/interfaces/sales/ISalespersonRepository';
import { ICommissionEntryRepository } from '../../../repository/interfaces/sales/ICommissionEntryRepository';

// ---------------------------------------------------------------------------
// Shared input types
// ---------------------------------------------------------------------------

export interface CreateSalespersonInput {
  companyId: string;
  code: string;
  name: string;
  email?: string;
  defaultCommissionPct: number;
  commissionPayableAccountId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
}

export interface UpdateSalespersonInput {
  companyId: string;
  id: string;
  code?: string;
  name?: string;
  email?: string | null;
  defaultCommissionPct?: number;
  commissionPayableAccountId?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

// ---------------------------------------------------------------------------
// CreateSalespersonUseCase
// ---------------------------------------------------------------------------

export class CreateSalespersonUseCase {
  constructor(private readonly salespersonRepo: ISalespersonRepository) {}

  async execute(input: CreateSalespersonInput): Promise<Salesperson> {
    // Validate code uniqueness within company
    const existing = await this.salespersonRepo.getByCode(input.companyId, input.code);
    if (existing) {
      throw new Error(
        `Salesperson with code "${input.code}" already exists in company ${input.companyId}`
      );
    }

    const salesperson = new Salesperson({
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      email: input.email,
      defaultCommissionPct: input.defaultCommissionPct,
      commissionPayableAccountId: input.commissionPayableAccountId,
      status: input.status ?? 'ACTIVE',
      createdBy: input.createdBy,
    });

    await this.salespersonRepo.create(salesperson);
    return salesperson;
  }
}

// ---------------------------------------------------------------------------
// UpdateSalespersonUseCase
// ---------------------------------------------------------------------------

export class UpdateSalespersonUseCase {
  constructor(private readonly salespersonRepo: ISalespersonRepository) {}

  async execute(input: UpdateSalespersonInput): Promise<Salesperson> {
    const existing = await this.salespersonRepo.getById(input.companyId, input.id);
    if (!existing) {
      throw new Error(`Salesperson not found: ${input.id}`);
    }

    // Validate code uniqueness — skip self
    if (input.code !== undefined && input.code !== existing.code) {
      const conflict = await this.salespersonRepo.getByCode(input.companyId, input.code);
      if (conflict && conflict.id !== input.id) {
        throw new Error(
          `Salesperson with code "${input.code}" already exists in company ${input.companyId}`
        );
      }
    }

    const props: SalespersonProps = {
      id: existing.id,
      companyId: existing.companyId,
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      email:
        input.email !== undefined
          ? (input.email ?? undefined)
          : existing.email,
      defaultCommissionPct:
        input.defaultCommissionPct !== undefined
          ? input.defaultCommissionPct
          : existing.defaultCommissionPct,
      commissionPayableAccountId:
        input.commissionPayableAccountId !== undefined
          ? (input.commissionPayableAccountId ?? undefined)
          : existing.commissionPayableAccountId,
      status: input.status ?? existing.status,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    const updated = new Salesperson(props);
    await this.salespersonRepo.update(updated);
    return updated;
  }
}

// ---------------------------------------------------------------------------
// DeleteSalespersonUseCase
// ---------------------------------------------------------------------------

export class DeleteSalespersonUseCase {
  constructor(
    private readonly salespersonRepo: ISalespersonRepository,
    private readonly commissionEntryRepo: ICommissionEntryRepository
  ) {}

  async execute(companyId: string, id: string): Promise<void> {
    const existing = await this.salespersonRepo.getById(companyId, id);
    if (!existing) {
      throw new Error(`Salesperson not found: ${id}`);
    }

    // Block deletion if there are any unpaid (ACCRUED) commissions
    const accrued = await this.commissionEntryRepo.list(companyId, {
      salespersonId: id,
      status: 'ACCRUED',
      limit: 1,
    });
    if (accrued.length > 0) {
      throw new Error(
        `Cannot delete Salesperson "${existing.name}": there is at least one ACCRUED commission entry that has not been paid`
      );
    }

    await this.salespersonRepo.delete(companyId, id);
  }
}

// ---------------------------------------------------------------------------
// GetSalespersonUseCase
// ---------------------------------------------------------------------------

export class GetSalespersonUseCase {
  constructor(private readonly salespersonRepo: ISalespersonRepository) {}

  async execute(companyId: string, id: string): Promise<Salesperson | null> {
    return this.salespersonRepo.getById(companyId, id);
  }
}

// ---------------------------------------------------------------------------
// ListSalespersonsUseCase
// ---------------------------------------------------------------------------

export class ListSalespersonsUseCase {
  constructor(private readonly salespersonRepo: ISalespersonRepository) {}

  async execute(
    companyId: string,
    options?: SalespersonListOptions
  ): Promise<Salesperson[]> {
    return this.salespersonRepo.list(companyId, options);
  }
}
