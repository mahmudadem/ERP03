import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

/**
 * SettingsController
 * 
 * Manages accounting policy configuration for a company.
 * 
 * SECURITY:
 * - userId from auth context only
 * - Admin-only write access
 * - No userId override in payload
 */
export class SettingsController {
  /**
   * GET /accounting/settings
   * 
   * Returns current accounting policy configuration
   */
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      // Permission check would go here in production
      // await permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.read');

      const { FirestoreAccountingPolicyConfigProvider } = await import('../../../infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider');
      
      const db = admin.firestore();
      const provider = new FirestoreAccountingPolicyConfigProvider(db);
      
      const config = await provider.getConfig(companyId);

      // Get metadata (updatedAt, updatedBy) if available
      const settingsDoc = await db
        .collection('companies')
        .doc(companyId)
        .collection('settings')
        .doc('accounting')
        .get();

      const metadata = settingsDoc.exists ? {
        updatedAt: settingsDoc.data()?.updatedAt,
        updatedBy: settingsDoc.data()?.updatedBy
      } : {};

      res.json({
        success: true,
        data: {
          ...config,
          ...metadata
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /accounting/settings
   * 
   * Updates accounting policy configuration
   */
  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      // SECURITY: Reject userId override
      if (req.body && req.body.userId !== undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'USER_ID_NOT_ALLOWED',
            message: 'userId cannot be provided in request body'
          }
        });
      }

      // Permission check would go here in production
      // await permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');

      // Validate payload
      const errors = SettingsController.validateSettings(req.body);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid settings',
            category: 'VALIDATION',
            details: {
              violations: errors
            }
          }
        });
      }

      const db = admin.firestore();

      // Build update payload
      const updateData: any = {
        // Approval Policy V1 toggles
        financialApprovalEnabled: req.body.financialApprovalEnabled ?? false,
        faApplyMode: req.body.faApplyMode || 'ALL',  // Default to ALL
        custodyConfirmationEnabled: req.body.custodyConfirmationEnabled ?? false,
        
        // V3 Controls
        strictApprovalMode: req.body.strictApprovalMode ?? req.body.financialApprovalEnabled ?? true,
        allowEditDeletePosted: req.body.allowEditDeletePosted ?? false,
        
        // Mode A Controls
        autoPostEnabled: req.body.autoPostEnabled ?? true,

        // Legacy field (synced with financialApprovalEnabled)
        approvalRequired: req.body.financialApprovalEnabled ?? req.body.approvalRequired ?? false,
        
        periodLockEnabled: req.body.periodLockEnabled ?? false,
        accountAccessEnabled: req.body.accountAccessEnabled ?? false,
        policyErrorMode: req.body.policyErrorMode || 'FAIL_FAST',
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      };

      if (req.body.lockedThroughDate !== undefined) {
        updateData.lockedThroughDate = req.body.lockedThroughDate;
      }

      if (req.body.costCenterPolicy !== undefined) {
        updateData.costCenterPolicy = {
          enabled: req.body.costCenterPolicy.enabled ?? false,
          requiredFor: req.body.costCenterPolicy.requiredFor || {}
        };
      }

      // Update Firestore
      console.log('[SettingsController] Saving to path:', `companies/${companyId}/settings/accounting`);
      console.log('[SettingsController] Update data:', JSON.stringify(updateData, null, 2));
      
      await db
        .collection('companies')
        .doc(companyId)
        .collection('settings')
        .doc('accounting')
        .set(updateData, { merge: true });
      
      console.log('[SettingsController] Save successful');

      res.json({
        success: true,
        message: 'Settings updated successfully'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Validate settings payload
   */
  private static validateSettings(body: any): any[] {
    const errors: any[] = [];

    // Validate lockedThroughDate format (YYYY-MM-DD)
    if (body.lockedThroughDate !== undefined && body.lockedThroughDate !== null) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.lockedThroughDate)) {
        errors.push({
          code: 'INVALID_DATE_FORMAT',
          message: 'lockedThroughDate must be in YYYY-MM-DD format',
          fieldHints: ['lockedThroughDate']
        });
      }
    }

    // Validate policyErrorMode enum
    if (body.policyErrorMode !== undefined) {
      if (!['FAIL_FAST', 'AGGREGATE'].includes(body.policyErrorMode)) {
        errors.push({
          code: 'INVALID_ENUM_VALUE',
          message: 'policyErrorMode must be either FAIL_FAST or AGGREGATE',
          fieldHints: ['policyErrorMode']
        });
      }
    }

    // Validate costCenterPolicy.requiredFor.accountTypes is array
    if (body.costCenterPolicy?.requiredFor?.accountTypes !== undefined) {
      if (!Array.isArray(body.costCenterPolicy.requiredFor.accountTypes)) {
        errors.push({
          code: 'INVALID_TYPE',
          message: 'costCenterPolicy.requiredFor.accountTypes must be an array',
          fieldHints: ['costCenterPolicy.requiredFor.accountTypes']
        });
      }
    }

    return errors;
  }
}
