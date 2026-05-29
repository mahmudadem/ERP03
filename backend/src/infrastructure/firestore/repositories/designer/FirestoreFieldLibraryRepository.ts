/**
 * FirestoreFieldLibraryRepository.ts
 *
 * Phase A implementation. Reads + idempotent upsert; no super-admin
 * write paths yet (those land in Phase B).
 *
 * Paths:
 *   system_metadata/field_library/items/{fieldId}
 *   companies/{companyId}/field_library/{fieldId}
 *
 * The system path uses the same nested-collection shape as
 * `system_metadata/voucher_types/items` so the super-admin UI's
 * directory layout stays consistent.
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import {
  IFieldLibraryRepository,
} from '../../../../repository/interfaces/designer/IFieldLibraryRepository';
import {
  FieldLibraryEntry,
  ResolvedFieldLibrary,
} from '../../../../domain/designer/entities/FieldLibraryEntry';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreFieldLibraryRepository implements IFieldLibraryRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private systemCollection() {
    return this.db
      .collection('system_metadata')
      .doc('field_library')
      .collection('items');
  }

  private companyCollection(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('field_library');
  }

  /**
   * Stable content hash used to decide whether an upsert should bump
   * the entry's monotonic `version`. Excludes the fields that change
   * on every write so re-running the seeder is a no-op when nothing
   * meaningful has changed.
   */
  private contentHash(entry: FieldLibraryEntry): string {
    const stable = {
      id: entry.id,
      label: entry.label,
      type: entry.type,
      fieldClass: entry.fieldClass,
      sectionHint: entry.sectionHint ?? null,
      alwaysMandatory: entry.alwaysMandatory ?? false,
      alwaysShared: entry.alwaysShared ?? false,
      supportedTypes: (entry.supportedTypes ?? []).slice().sort(),
      excludedTypes: (entry.excludedTypes ?? []).slice().sort(),
      selectorBinding: entry.selectorBinding ?? null,
      deprecated: entry.deprecated ?? false,
    };
    return createHash('sha1').update(JSON.stringify(stable)).digest('hex');
  }

  private fromDoc(data: any, fallbackScope: 'system' | 'company'): FieldLibraryEntry {
    return {
      id: data.id,
      label: data.label,
      type: data.type,
      fieldClass: data.fieldClass,
      sectionHint: data.sectionHint ?? undefined,
      alwaysMandatory: data.alwaysMandatory ?? false,
      alwaysShared: data.alwaysShared ?? false,
      supportedTypes: data.supportedTypes ?? undefined,
      excludedTypes: data.excludedTypes ?? undefined,
      selectorBinding: data.selectorBinding ?? undefined,
      version: typeof data.version === 'number' ? data.version : 1,
      deprecated: data.deprecated ?? false,
      scope: data.scope ?? fallbackScope,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? undefined,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt ?? undefined,
      createdBy: data.createdBy ?? undefined,
      updatedBy: data.updatedBy ?? undefined,
    };
  }

  async listSystemEntries(): Promise<FieldLibraryEntry[]> {
    try {
      const snap = await this.systemCollection().get();
      return snap.docs.map((d) => this.fromDoc({ ...d.data(), id: d.id }, 'system'));
    } catch (err) {
      throw new InfrastructureError('Error listing system field library', err);
    }
  }

  async listCompanyEntries(companyId: string): Promise<FieldLibraryEntry[]> {
    try {
      const snap = await this.companyCollection(companyId).get();
      return snap.docs.map((d) => this.fromDoc({ ...d.data(), id: d.id }, 'company'));
    } catch (err) {
      throw new InfrastructureError('Error listing company field library', err);
    }
  }

  async resolveForCompany(
    companyId: string,
    options: { includeDeprecated?: boolean } = {}
  ): Promise<ResolvedFieldLibrary> {
    const [systemEntries, companyEntries] = await Promise.all([
      this.listSystemEntries(),
      companyId ? this.listCompanyEntries(companyId) : Promise.resolve([] as FieldLibraryEntry[]),
    ]);

    // System wins on id collision (defence in depth — uniqueness is also
    // enforced on insert in Phase B). Filter deprecated unless asked.
    const byId = new Map<string, FieldLibraryEntry>();
    for (const e of companyEntries) {
      if (!options.includeDeprecated && e.deprecated) continue;
      byId.set(e.id, e);
    }
    for (const e of systemEntries) {
      if (!options.includeDeprecated && e.deprecated) continue;
      byId.set(e.id, e); // overwrites company on collision
    }

    const entries = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    const lineEligible = entries.filter((e) => e.sectionHint === 'BODY');
    const headerEligible = entries.filter((e) => e.sectionHint !== 'BODY');

    return { entries, lineEligible, headerEligible };
  }

  async getSystemEntry(id: string): Promise<FieldLibraryEntry | null> {
    try {
      const snap = await this.systemCollection().doc(id).get();
      if (!snap.exists) return null;
      return this.fromDoc({ ...snap.data(), id: snap.id }, 'system');
    } catch (err) {
      throw new InfrastructureError(`Error reading field library entry ${id}`, err);
    }
  }

  async setSystemEntryDeprecated(
    id: string,
    deprecated: boolean,
    updatedBy: string,
  ): Promise<FieldLibraryEntry> {
    const existing = await this.getSystemEntry(id);
    if (!existing) {
      throw new InfrastructureError(`Cannot deprecate missing field ${id}`, null);
    }
    // Re-route through upsert so the version-bump and contentHash logic
    // stays in one place. The hash includes `deprecated`, so flipping
    // it always produces a different hash and bumps version by 1.
    return this.upsertSystemEntry({ ...existing, deprecated }, updatedBy);
  }

  async hardDeleteSystemEntry(id: string): Promise<void> {
    try {
      await this.systemCollection().doc(id).delete();
    } catch (err) {
      throw new InfrastructureError(`Error deleting field library entry ${id}`, err);
    }
  }

  async upsertSystemEntry(entry: FieldLibraryEntry, updatedBy: string): Promise<FieldLibraryEntry> {
    if (!entry.id) {
      throw new InfrastructureError('Field library entry must have an id', null);
    }
    try {
      const ref = this.systemCollection().doc(entry.id);
      const snap = await ref.get();
      const newHash = this.contentHash(entry);

      let version = 1;
      let createdAt: any = FieldValue.serverTimestamp();
      let createdBy = updatedBy;

      if (snap.exists) {
        const existing = snap.data() || {};
        const existingHash: string | undefined = existing.contentHash;
        version = typeof existing.version === 'number' ? existing.version : 1;
        createdAt = existing.createdAt ?? createdAt;
        createdBy = existing.createdBy ?? createdBy;

        // No content change -> no version bump, no write. Decision 6.3:
        // version is the audit signal; we don't want re-running the
        // seeder to look like meaningful drift.
        if (existingHash === newHash) {
          return this.fromDoc({ ...existing, id: entry.id }, 'system');
        }

        version = version + 1;
      }

      const payload: any = {
        id: entry.id,
        label: entry.label,
        type: entry.type,
        fieldClass: entry.fieldClass,
        sectionHint: entry.sectionHint ?? null,
        alwaysMandatory: entry.alwaysMandatory ?? false,
        alwaysShared: entry.alwaysShared ?? false,
        supportedTypes: entry.supportedTypes ?? null,
        excludedTypes: entry.excludedTypes ?? null,
        selectorBinding: entry.selectorBinding ?? null,
        deprecated: entry.deprecated ?? false,
        scope: 'system',
        version,
        contentHash: newHash,
        createdAt,
        updatedAt: FieldValue.serverTimestamp(),
        createdBy,
        updatedBy,
      };
      // Firestore rejects undefined; the explicit nulls above already
      // handle the optionals.

      await ref.set(payload, { merge: false });
      const after = await ref.get();
      return this.fromDoc({ ...after.data(), id: entry.id }, 'system');
    } catch (err) {
      if (err instanceof InfrastructureError) throw err;
      throw new InfrastructureError(`Error upserting field library entry ${entry.id}`, err);
    }
  }
}
