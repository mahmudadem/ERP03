/**
 * VoucherTypeInstallController.ts
 *
 * Shared controller used by the per-module "Manage Voucher Types" settings
 * pages. Lets a tenant inspect the system catalog of voucher types for one
 * module, see which are already installed in their company, and install
 * additional types after the initialization wizard.
 *
 * Routes (registered per module):
 *   GET  /tenant/{module}/voucher-types/catalog
 *        -> { module, installed: [...templateIds], available: [...templates] }
 *   POST /tenant/{module}/voucher-types/install
 *        body: { selectedVoucherTypes: string[] } (template ids)
 *        -> { templatesUpserted, formsCreated, formsUpdated }
 *
 * Both routes derive `module` from a route param so we can register the
 * exact same controller methods inside accounting.routes / sales.routes /
 * purchases.routes without duplicating the install logic.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { syncCompanyVoucherTemplatesFromSystem } from '../../../application/system/services/CompanyVoucherTemplateSyncService';
import {
  canonicalizeVoucherCode,
} from '../../../domain/designer/services/VoucherFormDeduper';

const SUPPORTED_MODULES = new Set(['ACCOUNTING', 'SALES', 'PURCHASE']);
const normalizeModule = (value: string | undefined | null): string =>
  String(value || '').trim().toUpperCase();

const resolveModule = (req: Request): string => {
  const explicit = normalizeModule((req.params as any)?.module ?? (req.body as any)?.module);
  if (!explicit) {
    throw new Error('Module is required');
  }
  if (!SUPPORTED_MODULES.has(explicit)) {
    throw new Error(`Unsupported module: ${explicit}`);
  }
  return explicit;
};

export class VoucherTypeInstallController {
  /**
   * List the system catalog of voucher templates for a module, flagging
   * which ones the company has already installed. The frontend groups
   * these by canonical `voucherType` field to render type-level cards
   * (mirroring the wizard's Phase 1 behaviour).
   */
  static async catalog(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const module = resolveModule(req);

      const systemTemplates = await diContainer.voucherTypeDefinitionRepository.getSystemTemplates();
      const moduleTemplates = systemTemplates.filter(
        (t) => normalizeModule(t.module) === module
      );

      const companyTypes = await diContainer.voucherTypeDefinitionRepository.getByCompanyId(companyId);
      const installedCodes = new Set(
        companyTypes
          .filter((t) => normalizeModule(t.module) === module)
          .map((t) => canonicalizeVoucherCode(t.code))
      );

      const available = moduleTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        module: t.module,
        voucherType: (t as any).voucherType || t.code,
        persona: (t as any).persona || null,
        sidebarGroup: (t as any).sidebarGroup || null,
        isInstalled: installedCodes.has(canonicalizeVoucherCode(t.code)),
      }));

      res.json({
        success: true,
        data: { module, available },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Install (copy) additional voucher templates into the company catalog.
   * Idempotent — already-installed templates are left untouched. Newly
   * copied forms land as locked + inactive defaults (see commit ff2307e4).
   */
  static async install(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const createdBy = (req as any).user.uid || 'SYSTEM';
      const module = resolveModule(req);

      const rawSelection = (req.body as any)?.selectedVoucherTypes;
      if (!Array.isArray(rawSelection)) {
        return res.status(400).json({
          success: false,
          error: 'selectedVoucherTypes must be an array of template ids',
        });
      }
      const selectedTemplateIds = rawSelection
        .filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
        .map((id: string) => id.trim());

      if (selectedTemplateIds.length === 0) {
        return res.json({
          success: true,
          data: { templatesUpserted: 0, formsCreated: 0, formsUpdated: 0 },
        });
      }

      const result = await syncCompanyVoucherTemplatesFromSystem({
        companyId,
        modules: [module],
        selectedTemplateIds,
        createdBy,
        voucherTypeRepo: diContainer.voucherTypeDefinitionRepository,
        voucherFormRepo: diContainer.voucherFormRepository,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
