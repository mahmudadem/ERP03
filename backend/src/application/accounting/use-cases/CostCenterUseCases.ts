import { randomUUID } from 'crypto';
import { CostCenter, CostCenterStatus } from '../../../domain/accounting/entities/CostCenter';
import { ICostCenterRepository } from '../../../repository/interfaces/accounting/ICostCenterRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

export class ListCostCentersUseCase {
  constructor(private repo: ICostCenterRepository, private permissionChecker: PermissionChecker) {}
  async execute(companyId: string, userId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.accounts.view');
    return this.repo.findAll(companyId);
  }
}

export class CreateCostCenterUseCase {
  constructor(private repo: ICostCenterRepository, private permissionChecker: PermissionChecker) {}
  async execute(companyId: string, userId: string, payload: { name: string; code: string; description?: string; parentId?: string | null }) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const existing = await this.repo.findByCode(companyId, payload.code);
    if (existing) throw new Error('Cost center code already exists');
    const cc = new CostCenter(
      randomUUID(),
      companyId,
      payload.name,
      payload.code,
      payload.description || null,
      payload.parentId || null,
      CostCenterStatus.ACTIVE,
      new Date(),
      userId,
      new Date(),
      userId
    );
    const errors = cc.validate();
    if (errors.length) throw new Error(errors.join(', '));
    return this.repo.create(cc);
  }
}

export class UpdateCostCenterUseCase {
  constructor(private repo: ICostCenterRepository, private permissionChecker: PermissionChecker) {}
  async execute(companyId: string, userId: string, id: string, payload: Partial<CostCenter>) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const existing = await this.repo.findById(companyId, id);
    if (!existing) throw new Error('Cost center not found');
    const updated = new CostCenter(
      existing.id,
      companyId,
      payload.name ?? existing.name,
      payload.code ?? existing.code,
      payload.description ?? existing.description,
      payload.parentId === undefined ? existing.parentId : payload.parentId,
      payload.status ?? existing.status,
      existing.createdAt,
      existing.createdBy,
      new Date(),
      userId
    );
    const errors = updated.validate();
    if (errors.length) throw new Error(errors.join(', '));
    return this.repo.update(updated);
  }
}

export class DeactivateCostCenterUseCase {
  constructor(private repo: ICostCenterRepository, private permissionChecker: PermissionChecker) {}
  async execute(companyId: string, userId: string, id: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const existing = await this.repo.findById(companyId, id);
    if (!existing) throw new Error('Cost center not found');
    existing.deactivate(userId);
    return this.repo.update(existing);
  }
}
