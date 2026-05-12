/**
 * Super Admin AI Tool Catalog Routes
 *
 * Platform-level endpoints for managing AI tool definitions,
 * enablement policies, and model tool policies.
 *
 * All routes require Super Admin authentication.
 */

import { Router } from 'express';
import { AiToolCatalogController } from '../controllers/ai-assistant/AiToolCatalogController';
import { AiCreditController } from '../controllers/ai-assistant/AiCreditController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';

const router = Router();

// Apply auth and super-admin guard for all platform AI tool routes
router.use(authMiddleware);
router.use(assertSuperAdmin);

// ─── Tool Catalog ─────────────────────────────────────────────────────────

/**
 * GET /platform/ai-tools
 * List all tool definitions with optional filters.
 * Query params: module, category, status, mode
 */
router.get('/ai-tools', AiToolCatalogController.listTools);

/**
 * GET /platform/ai-tools/:toolName
 * Get a single tool definition.
 */
router.get('/ai-tools/:toolName', AiToolCatalogController.getTool);

/**
 * PATCH /platform/ai-tools/:toolName
 * Update a tool definition (status only).
 * Body: { status: 'active' | 'disabled' | 'deprecated' }
 */
router.patch('/ai-tools/:toolName', AiToolCatalogController.updateTool);

/**
 * PATCH /platform/ai-tools/:toolName/enable
 * Enable a tool globally.
 */
router.patch('/ai-tools/:toolName/enable', AiToolCatalogController.enableTool);

/**
 * PATCH /platform/ai-tools/:toolName/disable
 * Disable a tool globally.
 */
router.patch('/ai-tools/:toolName/disable', AiToolCatalogController.disableTool);

/**
 * PATCH /platform/ai-tools/:toolName/keywords
 * Update a tool's chat keywords.
 * Body: { keywords: string[] }
 */
router.patch('/ai-tools/:toolName/keywords', AiToolCatalogController.updateChatKeywords);

/**
 * POST /platform/ai-tools/sync
 * Sync static catalog seed into the DB.
 */
router.post('/ai-tools/sync', AiToolCatalogController.syncCatalog);

// ─── Model Profiles ──────────────────────────────────────────────────────

router.get('/ai-providers', AiToolCatalogController.listProviders);
router.post('/ai-providers', AiToolCatalogController.createProvider);
router.get('/ai-providers/:providerId', AiToolCatalogController.getProvider);
router.patch('/ai-providers/:providerId', AiToolCatalogController.updateProvider);
router.patch('/ai-providers/:providerId/enable', AiToolCatalogController.enableProvider);
router.patch('/ai-providers/:providerId/disable', AiToolCatalogController.disableProvider);

router.get('/ai-certifications/valid', AiToolCatalogController.listValidCertifiedProfiles);
router.patch('/ai-certifications/:certificationId/expire', AiToolCatalogController.expireCertification);

router.get('/ai-model-profiles', AiToolCatalogController.listModelProfiles);
router.post('/ai-model-profiles', AiToolCatalogController.createModelProfile);
router.post('/ai-model-profiles/sync', AiToolCatalogController.syncModelProfiles);
router.post('/ai-model-profiles/:profileId/diagnostics', AiToolCatalogController.runModelProfileDiagnostics);
router.post('/ai-model-profiles/:profileId/diagnostics/admin', AiToolCatalogController.runAdminModelProfileDiagnostics);
router.get('/ai-model-profiles/:profileId/certifications', AiToolCatalogController.listModelProfileCertifications);
router.post('/ai-model-profiles/:profileId/certifications/manual', AiToolCatalogController.recordGlobalCertification);
router.post('/ai-model-profiles/:profileId/certifications/run', AiToolCatalogController.runGlobalCertification);
router.get('/ai-model-profiles/:profileId', AiToolCatalogController.getModelProfile);
router.patch('/ai-model-profiles/:profileId', AiToolCatalogController.updateModelProfile);
router.delete('/ai-model-profiles/:profileId', AiToolCatalogController.deleteModelProfile);

// ─── Enablement Policies ──────────────────────────────────────────────────

/**
 * GET /platform/ai-tool-policies
 * List all tool enablement policies.
 */
router.get('/ai-tool-policies', AiToolCatalogController.listEnablementPolicies);

/**
 * PATCH /platform/ai-tool-policies/:toolId
 * Update a tool enablement policy.
 */
router.patch('/ai-tool-policies/:toolId', AiToolCatalogController.updateEnablementPolicy);

// ─── Model Tool Policies ──────────────────────────────────────────────────

/**
 * GET /platform/ai-model-tool-policies
 * List all model tool policies.
 */
router.get('/ai-model-tool-policies', AiToolCatalogController.listModelToolPolicies);

/**
 * PATCH /platform/ai-model-tool-policies/:policyId
 * Update a model tool policy.
 */
router.patch('/ai-model-tool-policies/:policyId', AiToolCatalogController.updateModelToolPolicy);

// ─── AI Credits (Super Admin) ────────────────────────────────────────────────

/**
 * POST /platform/ai-assistant/credits/grant
 * Super Admin grants credits to a tenant.
 * Body: { companyId: string, amount: number, reason?: string }
 */
router.post('/ai-assistant/credits/grant', AiCreditController.grantCredits);

export default router;
