/**
 * IFieldLibraryRepository.ts
 *
 * Repository contract for the Layer 1 field library. Phase A only
 * exposes the read paths the API needs plus the seeder's upsert. The
 * super-admin authoring API (Phase B) and the company custom-field
 * authoring API (Phase D) will extend this interface.
 */

import {
  FieldLibraryEntry,
  ResolvedFieldLibrary,
} from '../../../domain/designer/entities/FieldLibraryEntry';

export interface IFieldLibraryRepository {
  /**
   * List all system-tier entries (`system_metadata/field_library`).
   * Used by the seeder for idempotency checks and by the super-admin UI.
   */
  listSystemEntries(): Promise<FieldLibraryEntry[]>;

  /**
   * List a single company's `custom_metadata` entries. Empty array if
   * the company has authored no custom fields yet.
   */
  listCompanyEntries(companyId: string): Promise<FieldLibraryEntry[]>;

  /**
   * Resolver — returns the merged catalog visible to a given company.
   *
   * Implements decision 6.2:
   *   - Reads both tiers
   *   - System wins on id collision (defence in depth — uniqueness is
   *     also enforced on insert)
   *   - Skips deprecated entries unless `includeDeprecated` is true
   *
   * The Forms Management wizard reads this in Phase C; in Phase A it
   * exists so the read API has something to return.
   */
  resolveForCompany(
    companyId: string,
    options?: { includeDeprecated?: boolean }
  ): Promise<ResolvedFieldLibrary>;

  /**
   * Upsert a system-tier entry. Honors decision 6.3 versioning:
   *   - First write: version = 1
   *   - Subsequent writes whose content has changed: version bumps by 1
   *   - Subsequent writes whose content is identical: version unchanged
   *     (so re-running the seeder doesn't churn the audit history)
   *
   * Implementation must compute a stable content hash of the entry
   * (excluding `version`, `updatedAt`, `updatedBy`) to decide whether
   * to bump.
   */
  upsertSystemEntry(entry: FieldLibraryEntry, updatedBy: string): Promise<FieldLibraryEntry>;

  /**
   * Read a single system-tier entry by id. Returns `null` if absent.
   * Phase B uses this to power the editor's "load by id" path.
   */
  getSystemEntry(id: string): Promise<FieldLibraryEntry | null>;

  /**
   * Toggle the soft-delete (`deprecated`) flag on a system entry.
   * Decision 6.3 forbids destructive deletes; the editor calls this
   * instead. Bumps the version like any other content change.
   */
  setSystemEntryDeprecated(
    id: string,
    deprecated: boolean,
    updatedBy: string,
  ): Promise<FieldLibraryEntry>;

  /**
   * Hard delete — ONLY allowed if no voucher type, form, or other
   * persisted artifact references the entry. The use case enforces
   * that check; the repository just performs the write. Phase B will
   * gate this UI-side behind an explicit confirmation flow.
   */
  hardDeleteSystemEntry(id: string): Promise<void>;
}
