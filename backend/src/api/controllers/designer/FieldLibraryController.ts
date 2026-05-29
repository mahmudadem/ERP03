/**
 * FieldLibraryController.ts
 *
 * Phase A of task 135 — read-only endpoints for the Layer 1 Field
 * Library. The Forms Management wizard does NOT consume these yet
 * (Phase C wires that). They exist so:
 *   - The seeder's output is inspectable via HTTP without opening
 *     Firebase console.
 *   - Phase B's super-admin UI has a stable contract to read against.
 *   - Smoke tests can confirm the resolver merge (system + company)
 *     before any UI surface depends on it.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

export class FieldLibraryController {
  /**
   * GET /tenant/designer/field-library
   *
   * Returns the merged catalog visible to the authenticated user's
   * company. Honors decision 6.2:
   *   - System entries from `system_metadata/field_library/items`
   *   - Plus the company's `custom_metadata` entries (none today —
   *     Phase D adds the authoring API)
   *   - System wins on id collision
   *   - Deprecated entries are filtered unless `?includeDeprecated=1`
   *
   * Response shape mirrors `ResolvedFieldLibrary`:
   *   { entries, headerEligible, lineEligible }
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || '';
      const includeDeprecated = String(req.query.includeDeprecated || '').toLowerCase() === '1'
        || String(req.query.includeDeprecated || '').toLowerCase() === 'true';

      const resolved = await diContainer.fieldLibraryRepository.resolveForCompany(
        companyId,
        { includeDeprecated }
      );

      res.json({ success: true, data: resolved });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /tenant/designer/field-library/system
   *
   * Returns ONLY the system-tier entries (no company merge). Used by
   * the future super-admin Field Library editor (Phase B) to drive the
   * "all fields in the canonical library" view. Open to any tenant
   * user in Phase A — read-only data; tighten to a super-admin guard
   * in Phase B when authoring lands.
   */
  static async listSystem(_req: Request, res: Response, next: NextFunction) {
    try {
      const entries = await diContainer.fieldLibraryRepository.listSystemEntries();
      res.json({ success: true, data: { entries } });
    } catch (err) {
      next(err);
    }
  }
}
