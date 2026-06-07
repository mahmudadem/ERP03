/**
 * FieldLibraryUseCases.ts
 *
 * Application-layer orchestration for the super-admin Field Library
 * editor (Phase B of task 135).
 *
 * Three small use cases. Each enforces a rule that's too policy-shaped
 * to live in the repository.
 */

import {
  FieldClass,
  FieldLibraryEntry,
} from '../../../domain/designer/entities/FieldLibraryEntry';
import { IFieldLibraryRepository } from '../../../repository/interfaces/designer/IFieldLibraryRepository';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';

const ALLOWED_FIELD_CLASSES: FieldClass[] = [
  'system_core',
  'system_optional',
  'computed',
  'custom_metadata',
];

const ID_RX = /^[a-zA-Z_][a-zA-Z0-9_-]{1,63}$/;

/**
 * Shared input validator. Centralised so create and update apply the
 * same rules — id format, mandatory fields, fieldClass membership.
 */
function validateInput(input: Partial<FieldLibraryEntry>, opts: { idMustBePresent: boolean }): string[] {
  const errors: string[] = [];
  if (opts.idMustBePresent) {
    if (!input.id) errors.push('id is required');
    else if (!ID_RX.test(input.id)) {
      errors.push(`id "${input.id}" must match ${ID_RX.source}`);
    }
  }
  if (!input.label || !input.label.trim()) errors.push('label is required');
  if (!input.type || !input.type.trim()) errors.push('type is required');
  if (input.fieldClass && !ALLOWED_FIELD_CLASSES.includes(input.fieldClass)) {
    errors.push(`fieldClass "${input.fieldClass}" is not one of ${ALLOWED_FIELD_CLASSES.join(', ')}`);
  }
  return errors;
}

export class CreateFieldLibraryEntryUseCase {
  constructor(private readonly repo: IFieldLibraryRepository) {}

  /**
   * Decision 6.1 — flat namespace, enforced on insert. We probe by id
   * across BOTH tiers (system + company) before write so the editor
   * gets a clear error rather than the writer silently overwriting.
   *
   * Company-tier uniqueness check is best-effort here: we don't have a
   * companyId, so we can only check the system tier. The company-tier
   * editor (Phase D) will add the cross-tier probe.
   */
  async execute(input: Partial<FieldLibraryEntry>, updatedBy: string): Promise<FieldLibraryEntry> {
    const errors = validateInput(input, { idMustBePresent: true });
    if (errors.length) throw new Error(`Validation failed: ${errors.join('; ')}`);

    const existing = await this.repo.getSystemEntry(input.id!);
    if (existing) {
      throw new Error(`A field with id "${input.id}" already exists. Pick a different id.`);
    }

    const entry: FieldLibraryEntry = {
      id: input.id!,
      label: input.label!.trim(),
      type: input.type!.trim(),
      fieldClass: input.fieldClass ?? 'system_optional',
      sectionHint: input.sectionHint,
      alwaysMandatory: input.alwaysMandatory ?? false,
      alwaysShared: input.alwaysShared ?? false,
      supportedTypes: input.supportedTypes,
      excludedTypes: input.excludedTypes,
      selectorBinding: input.selectorBinding,
      version: 1,
      deprecated: false,
      scope: 'system',
    };
    return this.repo.upsertSystemEntry(entry, updatedBy);
  }
}

export class UpdateFieldLibraryEntryUseCase {
  constructor(private readonly repo: IFieldLibraryRepository) {}

  /**
   * Updates an existing system entry. `id` is immutable — the editor
   * UI must surface it as read-only after creation. To "rename" a
   * field, you create a new one and deprecate the old.
   */
  async execute(
    id: string,
    patch: Partial<FieldLibraryEntry>,
    updatedBy: string,
  ): Promise<FieldLibraryEntry> {
    const existing = await this.repo.getSystemEntry(id);
    if (!existing) throw new Error(`Field "${id}" not found`);

    // id is immutable. Drop it from the patch if a client sent it.
    const { id: _ignored, version: _vIgnored, scope: _scopeIgnored, ...allowed } = patch as any;

    const merged: FieldLibraryEntry = {
      ...existing,
      ...allowed,
      id: existing.id,
      scope: 'system',
      version: existing.version, // upsert decides whether to bump
    };

    const errors = validateInput(merged, { idMustBePresent: false });
    if (errors.length) throw new Error(`Validation failed: ${errors.join('; ')}`);

    return this.repo.upsertSystemEntry(merged, updatedBy);
  }
}

export class DeprecateFieldLibraryEntryUseCase {
  constructor(private readonly repo: IFieldLibraryRepository) {}

  async execute(id: string, deprecated: boolean, updatedBy: string): Promise<FieldLibraryEntry> {
    return this.repo.setSystemEntryDeprecated(id, deprecated, updatedBy);
  }
}

/**
 * Hard delete with reference-safety gate (decision 6.3 — destructive
 * deletes are forbidden when references exist).
 *
 * Phase B scope: probe the system voucher templates only. Company
 * voucher types and company forms aren't searched here because they
 * cascade from the system templates anyway, and a full scan across
 * every company is expensive. Phase C will tighten the gate by adding
 * a company-side scan when forms persist their field references in
 * the normalised `fieldId` shape (today they often inline the field
 * definition, which is harder to grep).
 */
export class HardDeleteFieldLibraryEntryUseCase {
  constructor(
    private readonly fieldRepo: IFieldLibraryRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
  ) {}

  async execute(id: string): Promise<{ ok: true } | { ok: false; usedBy: string[] }> {
    const existing = await this.fieldRepo.getSystemEntry(id);
    if (!existing) throw new Error(`Field "${id}" not found`);

    const systemTemplates = await this.voucherTypeRepo.getSystemTemplates();
    const usedBy: string[] = [];
    for (const tpl of systemTemplates) {
      const headerHit = (tpl.headerFields || []).some((f: any) =>
        (f.id || f.name || f.fieldId) === id,
      );
      // VoucherTypeDefinition stores line columns as `tableColumns`,
      // not `lineFields`. Some legacy/inflight types may carry both
      // shapes — check both defensively.
      const tableColumns = (tpl as any).tableColumns || [];
      const lineFields = (tpl as any).lineFields || [];
      const lineHit = [...tableColumns, ...lineFields].some((f: any) =>
        (f.id || f.name || f.fieldId) === id,
      );
      if (headerHit || lineHit) {
        usedBy.push(tpl.code || tpl.id || '<unknown>');
      }
    }

    if (usedBy.length) {
      return { ok: false, usedBy };
    }

    await this.fieldRepo.hardDeleteSystemEntry(id);
    return { ok: true };
  }
}
