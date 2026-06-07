/**
 * SuperAdminFieldLibraryController.ts
 *
 * Phase B of task 135. Super-admin authoring endpoints for the Layer 1
 * field library. Mounted under `/super-admin/field-library` with the
 * `assertSuperAdmin` guard.
 *
 * Reads are also exposed at the tenant scope via
 * `FieldLibraryController` (Phase A) — those are read-only and shared
 * with non-admin tenant users for resolver consumption. The endpoints
 * here are the only authoring path.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  CreateFieldLibraryEntryUseCase,
  UpdateFieldLibraryEntryUseCase,
  DeprecateFieldLibraryEntryUseCase,
  HardDeleteFieldLibraryEntryUseCase,
} from '../../../application/designer/use-cases/FieldLibraryUseCases';

const callerId = (req: Request): string =>
  (req as any).user?.uid || (req as any).user?.email || 'super_admin';

export class SuperAdminFieldLibraryController {
  /** GET /super-admin/field-library — list every system-tier entry. */
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const entries = await diContainer.fieldLibraryRepository.listSystemEntries();
      // Stable id sort so the UI renders deterministically.
      entries.sort((a, b) => a.id.localeCompare(b.id));
      res.json({ success: true, data: { entries } });
    } catch (err) {
      next(err);
    }
  }

  /** GET /super-admin/field-library/:id — single entry (or 404). */
  static async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await diContainer.fieldLibraryRepository.getSystemEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ success: false, error: 'Field not found' });
      }
      res.json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /super-admin/field-library
   * Body: full FieldLibraryEntry-shaped payload (id required).
   * Returns the created entry on 201.
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreateFieldLibraryEntryUseCase(diContainer.fieldLibraryRepository);
      const created = await useCase.execute(req.body || {}, callerId(req));
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      // Validation / collision errors surface as 400. Unknown errors
      // continue to the central error handler.
      if (
        err?.message?.startsWith('Validation failed') ||
        err?.message?.includes('already exists')
      ) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next(err);
    }
  }

  /**
   * PUT /super-admin/field-library/:id
   * Body: partial FieldLibraryEntry. `id`, `version`, and `scope` in
   * the body are ignored (they're server-managed).
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new UpdateFieldLibraryEntryUseCase(diContainer.fieldLibraryRepository);
      const updated = await useCase.execute(req.params.id, req.body || {}, callerId(req));
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (err?.message?.includes('not found')) {
        return res.status(404).json({ success: false, error: err.message });
      }
      if (err?.message?.startsWith('Validation failed')) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next(err);
    }
  }

  /**
   * PATCH /super-admin/field-library/:id/deprecated
   * Body: { deprecated: boolean }. Soft-deletes (or undeletes) the
   * entry. Decision 6.3 — this is the non-destructive path; the
   * field stays in the catalog with a strikethrough.
   */
  static async setDeprecated(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new DeprecateFieldLibraryEntryUseCase(diContainer.fieldLibraryRepository);
      const deprecated = Boolean((req.body || {}).deprecated);
      const updated = await useCase.execute(req.params.id, deprecated, callerId(req));
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (err?.message?.includes('Cannot deprecate missing')) {
        return res.status(404).json({ success: false, error: err.message });
      }
      next(err);
    }
  }

  /**
   * DELETE /super-admin/field-library/:id
   * Hard delete. The use case verifies no system voucher template
   * references this id; if any does, returns 409 with the list so the
   * admin sees exactly what's blocking.
   */
  static async hardDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new HardDeleteFieldLibraryEntryUseCase(
        diContainer.fieldLibraryRepository,
        diContainer.voucherTypeDefinitionRepository,
      );
      const result = await useCase.execute(req.params.id);
      if (!('ok' in result) || !result.ok) {
        return res.status(409).json({
          success: false,
          error: 'Field is referenced by one or more voucher types. Deprecate it instead.',
          usedBy: (result as any).usedBy,
        });
      }
      res.json({ success: true });
    } catch (err: any) {
      if (err?.message?.includes('not found')) {
        return res.status(404).json({ success: false, error: err.message });
      }
      next(err);
    }
  }
}
