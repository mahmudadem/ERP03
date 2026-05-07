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
const router = (0, express_1.Router)();
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
 * POST /platform/ai-tools/sync
 * Sync static catalog seed into the DB.
 */
router.post('/ai-tools/sync', AiToolCatalogController_1.AiToolCatalogController.syncCatalog);
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