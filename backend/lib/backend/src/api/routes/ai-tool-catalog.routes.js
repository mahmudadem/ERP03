"use strict";
/**
 * Super Admin AI Tool Catalog Routes
 *
 * Platform-level endpoints for managing AI tool definitions,
 * enablement policies, and model tool policies.
 *
 * All routes require Super Admin authentication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AiToolCatalogController_1 = require("../controllers/ai-assistant/AiToolCatalogController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const router = (0, express_1.Router)();
// Apply auth and super-admin guard for all platform AI tool routes
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
// ─── Tool Catalog ─────────────────────────────────────────────────────────
/**
 * GET /platform/ai-tools
 * List all tool definitions with optional filters.
 * Query params: module, category, status, mode
 */
router.get('/ai-tools', AiToolCatalogController_1.AiToolCatalogController.listTools);
/**
 * GET /platform/ai-tools/:toolName
 * Get a single tool definition.
 */
router.get('/ai-tools/:toolName', AiToolCatalogController_1.AiToolCatalogController.getTool);
/**
 * PATCH /platform/ai-tools/:toolName
 * Update a tool definition (status only).
 * Body: { status: 'active' | 'disabled' | 'deprecated' }
 */
router.patch('/ai-tools/:toolName', AiToolCatalogController_1.AiToolCatalogController.updateTool);
/**
 * PATCH /platform/ai-tools/:toolName/enable
 * Enable a tool globally.
 */
router.patch('/ai-tools/:toolName/enable', AiToolCatalogController_1.AiToolCatalogController.enableTool);
/**
 * PATCH /platform/ai-tools/:toolName/disable
 * Disable a tool globally.
 */
router.patch('/ai-tools/:toolName/disable', AiToolCatalogController_1.AiToolCatalogController.disableTool);
/**
 * PATCH /platform/ai-tools/:toolName/keywords
 * Update a tool's chat keywords.
 * Body: { keywords: string[] }
 */
router.patch('/ai-tools/:toolName/keywords', AiToolCatalogController_1.AiToolCatalogController.updateChatKeywords);
/**
 * POST /platform/ai-tools/sync
 * Sync static catalog seed into the DB.
 */
router.post('/ai-tools/sync', AiToolCatalogController_1.AiToolCatalogController.syncCatalog);
// ─── Model Profiles ──────────────────────────────────────────────────────
router.get('/ai-providers', AiToolCatalogController_1.AiToolCatalogController.listProviders);
router.post('/ai-providers', AiToolCatalogController_1.AiToolCatalogController.createProvider);
router.get('/ai-providers/:providerId', AiToolCatalogController_1.AiToolCatalogController.getProvider);
router.patch('/ai-providers/:providerId', AiToolCatalogController_1.AiToolCatalogController.updateProvider);
router.patch('/ai-providers/:providerId/enable', AiToolCatalogController_1.AiToolCatalogController.enableProvider);
router.patch('/ai-providers/:providerId/disable', AiToolCatalogController_1.AiToolCatalogController.disableProvider);
router.get('/ai-certifications/valid', AiToolCatalogController_1.AiToolCatalogController.listValidCertifiedProfiles);
router.patch('/ai-certifications/:certificationId/expire', AiToolCatalogController_1.AiToolCatalogController.expireCertification);
router.get('/ai-model-profiles', AiToolCatalogController_1.AiToolCatalogController.listModelProfiles);
router.post('/ai-model-profiles', AiToolCatalogController_1.AiToolCatalogController.createModelProfile);
router.post('/ai-model-profiles/sync', AiToolCatalogController_1.AiToolCatalogController.syncModelProfiles);
router.post('/ai-model-profiles/:profileId/diagnostics', AiToolCatalogController_1.AiToolCatalogController.runModelProfileDiagnostics);
router.get('/ai-model-profiles/:profileId/certifications', AiToolCatalogController_1.AiToolCatalogController.listModelProfileCertifications);
router.post('/ai-model-profiles/:profileId/certifications/manual', AiToolCatalogController_1.AiToolCatalogController.recordGlobalCertification);
router.post('/ai-model-profiles/:profileId/certifications/run', AiToolCatalogController_1.AiToolCatalogController.runGlobalCertification);
router.get('/ai-model-profiles/:profileId', AiToolCatalogController_1.AiToolCatalogController.getModelProfile);
router.patch('/ai-model-profiles/:profileId', AiToolCatalogController_1.AiToolCatalogController.updateModelProfile);
router.delete('/ai-model-profiles/:profileId', AiToolCatalogController_1.AiToolCatalogController.deleteModelProfile);
// ─── Enablement Policies ──────────────────────────────────────────────────
/**
 * GET /platform/ai-tool-policies
 * List all tool enablement policies.
 */
router.get('/ai-tool-policies', AiToolCatalogController_1.AiToolCatalogController.listEnablementPolicies);
/**
 * PATCH /platform/ai-tool-policies/:toolId
 * Update a tool enablement policy.
 */
router.patch('/ai-tool-policies/:toolId', AiToolCatalogController_1.AiToolCatalogController.updateEnablementPolicy);
// ─── Model Tool Policies ──────────────────────────────────────────────────
/**
 * GET /platform/ai-model-tool-policies
 * List all model tool policies.
 */
router.get('/ai-model-tool-policies', AiToolCatalogController_1.AiToolCatalogController.listModelToolPolicies);
/**
 * PATCH /platform/ai-model-tool-policies/:policyId
 * Update a model tool policy.
 */
router.patch('/ai-model-tool-policies/:policyId', AiToolCatalogController_1.AiToolCatalogController.updateModelToolPolicy);
exports.default = router;
//# sourceMappingURL=ai-tool-catalog.routes.js.map