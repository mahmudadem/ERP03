/**
 * VoucherFormController.ts
 * 
 * API Controller for VoucherForms CRUD operations
 * 
 * Endpoints:
 * GET    /tenant/accounting/voucher-forms         - List all forms for company
 * GET    /tenant/accounting/voucher-forms/:id     - Get form by ID
 * POST   /tenant/accounting/voucher-forms         - Create new form
 * PUT    /tenant/accounting/voucher-forms/:id     - Update form
 * DELETE /tenant/accounting/voucher-forms/:id     - Delete form
 * GET    /tenant/accounting/voucher-forms/by-type/:typeId - Get forms by type
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { VoucherFormDefinition } from '../../../repository/interfaces/designer/IVoucherFormRepository';

export class VoucherFormController {
  /**
   * List all voucher forms for the current company
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const forms = await diContainer.voucherFormRepository.getAllByCompany(companyId);
      res.json({ success: true, data: forms });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get a specific form by ID
   */
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const { id } = req.params;
      
      const form = await diContainer.voucherFormRepository.getById(companyId, id);
      
      if (!form) {
        const { BusinessError } = await import('../../../errors/AppError');
        const { ErrorCode } = await import('../../../errors/ErrorCodes');
        throw new BusinessError(
          ErrorCode.VOUCH_NOT_FOUND,
          `Form not found: ${id}`,
          { formId: id }
        );
      }
      
      res.json({ success: true, data: form });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get forms by type ID
   */
  static async getByType(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const { typeId } = req.params;
      
      const forms = await diContainer.voucherFormRepository.getByTypeId(companyId, typeId);
      res.json({ success: true, data: forms });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new form
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      
      const formData: Partial<VoucherFormDefinition> = req.body;
      
      // Validate required fields
      if (!formData.name || !formData.code || !formData.typeId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: name, code, typeId' 
        });
      }
      
      // Generate ID if not provided
      const formId = formData.id || `form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      const form: VoucherFormDefinition = {
        id: formId,
        companyId,
        typeId: formData.typeId,
        name: formData.name,
        code: formData.code,
        description: formData.description || null,
        prefix: formData.prefix || null,
        isDefault: formData.isDefault ?? false,
        isSystemGenerated: false,
        isLocked: false,
        enabled: formData.enabled ?? true,
        headerFields: formData.headerFields || [],
        tableColumns: formData.tableColumns || [],
        layout: formData.layout || {},
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId
      };
      
      const created = await diContainer.voucherFormRepository.create(form);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update a form
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const { id } = req.params;
      
      // Check if form exists
      const existing = await diContainer.voucherFormRepository.getById(companyId, id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Form not found' });
      }
      
      const updates: Partial<VoucherFormDefinition> = req.body;
      
      // Allow updating 'enabled' field even for locked forms (company preference)
      const isOnlyEnablingDisabling = Object.keys(updates).length === 1 && 'enabled' in updates;
      
      // Prevent editing locked forms (except for enabled field)
      if (existing.isLocked && !isOnlyEnablingDisabling) {
        return res.status(403).json({ 
          success: false, 
          error: 'Cannot edit locked form. Clone it instead.' 
        });
      }
      
      // Prevent changing certain fields
      delete (updates as any).id;
      delete (updates as any).companyId;
      delete (updates as any).createdAt;
      delete (updates as any).createdBy;
      delete (updates as any).isSystemGenerated;
      
      await diContainer.voucherFormRepository.update(companyId, id, updates);
      
      const updated = await diContainer.voucherFormRepository.getById(companyId, id);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete a form
   */
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const { id } = req.params;
      
      // Check if form exists
      const existing = await diContainer.voucherFormRepository.getById(companyId, id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Form not found' });
      }
      
      // Prevent deleting locked or system-generated forms
      if (existing.isLocked || existing.isSystemGenerated) {
        return res.status(403).json({ 
          success: false, 
          error: 'Cannot delete system or locked forms' 
        });
      }

      // Check for usage in existing vouchers
      const usageCount = await diContainer.voucherRepository.countByFormId(companyId, id);
      if (usageCount > 0) {
        return res.status(409).json({
          success: false,
          error: `Cannot delete form in use. It is used by ${usageCount} voucher(s).`,
          usageCount
        });
      }
      
      await diContainer.voucherFormRepository.delete(companyId, id);
      res.json({ success: true, message: 'Form deleted' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Clone a form
   */
  static async clone(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const { id } = req.params;
      const { newName, newCode } = req.body;
      
      // Get source form
      const source = await diContainer.voucherFormRepository.getById(companyId, id);
      if (!source) {
        return res.status(404).json({ success: false, error: 'Source form not found' });
      }
      
      // Create clone
      const cloneId = `form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      const cloned: VoucherFormDefinition = {
        ...source,
        id: cloneId,
        name: newName || `${source.name} (Copy)`,
        code: newCode || `${source.code}_COPY`,
        isDefault: false,
        isSystemGenerated: false,
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId
      };
      
      const created = await diContainer.voucherFormRepository.create(cloned);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
}
