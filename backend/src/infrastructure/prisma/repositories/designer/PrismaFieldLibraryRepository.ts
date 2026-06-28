/**
 * PrismaFieldLibraryRepository.ts
 *
 * SQL twin of FirestoreFieldLibraryRepository. Faithful port — same content
 * hash, same version-bump logic, same system-wins-on-collision resolver.
 *
 * Two storage scopes:
 *   scope = 'system'  → fieldLibraryEntry rows with companyId = null
 *   scope = 'company' → fieldLibraryEntry rows with companyId = <id>
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import {
  IFieldLibraryRepository,
} from '../../../../repository/interfaces/designer/IFieldLibraryRepository';
import {
  FieldLibraryEntry,
  ResolvedFieldLibrary,
} from '../../../../domain/designer/entities/FieldLibraryEntry';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class PrismaFieldLibraryRepository implements IFieldLibraryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Stable content hash — identical algorithm as the Firestore version so
   * entries seeded via either backend produce the same hash and therefore
   * the same de-dup decision.
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

  private fromRow(row: any, fallbackScope: 'system' | 'company'): FieldLibraryEntry {
    return {
      id: row.id,
      label: row.label,
      type: row.type,
      fieldClass: row.fieldClass,
      sectionHint: row.sectionHint ?? undefined,
      alwaysMandatory: row.alwaysMandatory ?? false,
      alwaysShared: row.alwaysShared ?? false,
      supportedTypes: row.supportedTypes ?? undefined,
      excludedTypes: row.excludedTypes ?? undefined,
      selectorBinding: row.selectorBinding ?? undefined,
      version: typeof row.version === 'number' ? row.version : 1,
      deprecated: row.deprecated ?? false,
      scope: (row.scope as 'system' | 'company') ?? fallbackScope,
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt ?? undefined,
      updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt ?? undefined,
      createdBy: row.createdBy ?? undefined,
      updatedBy: row.updatedBy ?? undefined,
    };
  }

  // ── Interface implementation ──────────────────────────────────────────────

  async listSystemEntries(): Promise<FieldLibraryEntry[]> {
    try {
      const rows = await (this.prisma as any).fieldLibraryEntry.findMany({
        where: { scope: 'system', companyId: null },
      });
      return rows.map((r: any) => this.fromRow(r, 'system'));
    } catch (err) {
      throw new InfrastructureError('Error listing system field library', err);
    }
  }

  async listCompanyEntries(companyId: string): Promise<FieldLibraryEntry[]> {
    try {
      const rows = await (this.prisma as any).fieldLibraryEntry.findMany({
        where: { scope: 'company', companyId },
      });
      return rows.map((r: any) => this.fromRow(r, 'company'));
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

    // System wins on id collision — same logic as Firestore twin.
    const byId = new Map<string, FieldLibraryEntry>();
    for (const e of companyEntries) {
      if (!options.includeDeprecated && e.deprecated) continue;
      byId.set(e.id, e);
    }
    for (const e of systemEntries) {
      if (!options.includeDeprecated && e.deprecated) continue;
      byId.set(e.id, e);
    }

    const entries = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    const lineEligible = entries.filter((e) => e.sectionHint === 'BODY');
    const headerEligible = entries.filter((e) => e.sectionHint !== 'BODY');

    return { entries, lineEligible, headerEligible };
  }

  async getSystemEntry(id: string): Promise<FieldLibraryEntry | null> {
    try {
      const row = await (this.prisma as any).fieldLibraryEntry.findFirst({
        where: { id, scope: 'system', companyId: null },
      });
      if (!row) return null;
      return this.fromRow(row, 'system');
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
    // Re-route through upsert so version-bump logic is centralised.
    return this.upsertSystemEntry({ ...existing, deprecated }, updatedBy);
  }

  async hardDeleteSystemEntry(id: string): Promise<void> {
    try {
      await (this.prisma as any).fieldLibraryEntry.deleteMany({
        where: { id, scope: 'system', companyId: null },
      });
    } catch (err) {
      throw new InfrastructureError(`Error deleting field library entry ${id}`, err);
    }
  }

  async upsertSystemEntry(entry: FieldLibraryEntry, updatedBy: string): Promise<FieldLibraryEntry> {
    if (!entry.id) {
      throw new InfrastructureError('Field library entry must have an id', null);
    }
    try {
      const newHash = this.contentHash(entry);
      const existing = await (this.prisma as any).fieldLibraryEntry.findFirst({
        where: { id: entry.id, scope: 'system', companyId: null },
      });

      let version = 1;
      let createdAt = new Date();
      let createdBy = updatedBy;

      if (existing) {
        version = typeof existing.version === 'number' ? existing.version : 1;
        createdAt = existing.createdAt ?? createdAt;
        createdBy = existing.createdBy ?? createdBy;

        // No content change → no version bump, no write (same as Firestore twin).
        if (existing.contentHash === newHash) {
          return this.fromRow(existing, 'system');
        }
        version = version + 1;
      }

      const payload = {
        id: entry.id,
        scope: 'system',
        companyId: null,
        label: entry.label,
        type: entry.type,
        fieldClass: entry.fieldClass,
        sectionHint: entry.sectionHint ?? null,
        alwaysMandatory: entry.alwaysMandatory ?? false,
        alwaysShared: entry.alwaysShared ?? false,
        supportedTypes: entry.supportedTypes ?? [],
        excludedTypes: entry.excludedTypes ?? [],
        selectorBinding: entry.selectorBinding ?? null,
        deprecated: entry.deprecated ?? false,
        version,
        contentHash: newHash,
        createdAt,
        updatedAt: new Date(),
        createdBy,
        updatedBy,
      };

      if (existing) {
        const updated = await (this.prisma as any).fieldLibraryEntry.update({
          where: { id: entry.id },
          data: { ...payload, createdAt: existing.createdAt },
        });
        return this.fromRow(updated, 'system');
      } else {
        const created = await (this.prisma as any).fieldLibraryEntry.create({ data: payload });
        return this.fromRow(created, 'system');
      }
    } catch (err) {
      if (err instanceof InfrastructureError) throw err;
      throw new InfrastructureError(`Error upserting field library entry ${entry.id}`, err);
    }
  }
}
