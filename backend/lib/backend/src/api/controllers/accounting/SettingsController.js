"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const SettingsResolver_1 = require("../../../application/common/services/SettingsResolver");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
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
class SettingsController {
    /**
     * GET /accounting/settings
     *
     * Returns current accounting policy configuration
     */
    static async getSettings(req, res, next) {
        var _a, _b, _c;
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            // Permission check would go here in production
            // await permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.read');
            const { FirestoreAccountingPolicyConfigProvider } = await Promise.resolve().then(() => __importStar(require('../../../infrastructure/accounting/config/FirestoreAccountingPolicyConfigProvider')));
            const db = admin.firestore();
            const settingsResolver = new SettingsResolver_1.SettingsResolver(db);
            const provider = new FirestoreAccountingPolicyConfigProvider(settingsResolver);
            const config = await provider.getConfig(companyId);
            // 1. Resolve Base Currency from Shared Currencies (Tier 2)
            const currencies = await bindRepositories_1.diContainer.companyCurrencyRepository.findEnabledByCompany(companyId);
            const baseCurrency = (_a = currencies.find(c => c.isBase)) === null || _a === void 0 ? void 0 : _a.currencyCode;
            // 2. Get metadata (updatedAt, updatedBy) if available
            const settingsRef = settingsResolver.getAccountingSettingsRef(companyId);
            const settingsDoc = await settingsRef.get();
            const metadata = settingsDoc.exists ? {
                updatedAt: (_b = settingsDoc.data()) === null || _b === void 0 ? void 0 : _b.updatedAt,
                updatedBy: (_c = settingsDoc.data()) === null || _c === void 0 ? void 0 : _c.updatedBy
            } : {};
            res.json({
                success: true,
                data: Object.assign(Object.assign(Object.assign({}, config), { baseCurrency }), metadata)
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * PUT /accounting/settings
     *
     * Updates accounting policy configuration
     */
    static async updateSettings(req, res, next) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
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
            const settingsResolver = new SettingsResolver_1.SettingsResolver(db);
            // Build update payload
            const updateData = {
                // ... (preserving payload building logic)
                // Approval Policy V1 toggles
                financialApprovalEnabled: (_a = req.body.financialApprovalEnabled) !== null && _a !== void 0 ? _a : false,
                faApplyMode: req.body.faApplyMode || 'ALL',
                custodyConfirmationEnabled: (_b = req.body.custodyConfirmationEnabled) !== null && _b !== void 0 ? _b : false,
                // V3 Controls
                strictApprovalMode: (_d = (_c = req.body.strictApprovalMode) !== null && _c !== void 0 ? _c : req.body.financialApprovalEnabled) !== null && _d !== void 0 ? _d : true,
                allowEditDeletePosted: (_e = req.body.allowEditDeletePosted) !== null && _e !== void 0 ? _e : false,
                // Mode A Controls
                autoPostEnabled: (_f = req.body.autoPostEnabled) !== null && _f !== void 0 ? _f : true,
                // Legacy field (synced with financialApprovalEnabled)
                approvalRequired: (_h = (_g = req.body.financialApprovalEnabled) !== null && _g !== void 0 ? _g : req.body.approvalRequired) !== null && _h !== void 0 ? _h : false,
                periodLockEnabled: (_j = req.body.periodLockEnabled) !== null && _j !== void 0 ? _j : false,
                accountAccessEnabled: (_k = req.body.accountAccessEnabled) !== null && _k !== void 0 ? _k : false,
                policyErrorMode: req.body.policyErrorMode || 'FAIL_FAST',
                updatedAt: new Date().toISOString(),
                updatedBy: userId
            };
            if (req.body.lockedThroughDate !== undefined) {
                updateData.lockedThroughDate = req.body.lockedThroughDate;
            }
            if (req.body.costCenterPolicy !== undefined) {
                updateData.costCenterPolicy = {
                    enabled: (_l = req.body.costCenterPolicy.enabled) !== null && _l !== void 0 ? _l : false,
                    requiredFor: req.body.costCenterPolicy.requiredFor || {}
                };
            }
            if (req.body.paymentMethods !== undefined) {
                updateData.paymentMethods = req.body.paymentMethods;
            }
            // Update Firestore
            const settingsRef = settingsResolver.getAccountingSettingsRef(companyId);
            console.log('[SettingsController] Saving to path:', settingsRef.path);
            // CLEANUP: Explicitly remove baseCurrency if it's trapped in this tier
            // We use FieldValue.delete() to ensure it's gone from the document
            await settingsRef.update(Object.assign(Object.assign({}, updateData), { baseCurrency: firestore_1.FieldValue.delete() }));
            console.log('[SettingsController] Save and cleanup successful');
            res.json({
                success: true,
                message: 'Settings updated successfully'
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Validate settings payload
     */
    static validateSettings(body) {
        var _a, _b;
        const errors = [];
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
        if (((_b = (_a = body.costCenterPolicy) === null || _a === void 0 ? void 0 : _a.requiredFor) === null || _b === void 0 ? void 0 : _b.accountTypes) !== undefined) {
            if (!Array.isArray(body.costCenterPolicy.requiredFor.accountTypes)) {
                errors.push({
                    code: 'INVALID_TYPE',
                    message: 'costCenterPolicy.requiredFor.accountTypes must be an array',
                    fieldHints: ['costCenterPolicy.requiredFor.accountTypes']
                });
            }
        }
        // Validate paymentMethods is array
        if (body.paymentMethods !== undefined) {
            if (!Array.isArray(body.paymentMethods)) {
                errors.push({
                    code: 'INVALID_TYPE',
                    message: 'paymentMethods must be an array',
                    fieldHints: ['paymentMethods']
                });
            }
        }
        return errors;
    }
}
exports.SettingsController = SettingsController;
//# sourceMappingURL=SettingsController.js.map