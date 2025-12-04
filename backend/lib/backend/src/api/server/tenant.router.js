"use strict";
/**
 * tenant.router.ts (Updated)
 *
 * Tenant Router that dynamically mounts module routes from the registry.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenantContextMiddleware_1 = require("../middlewares/tenantContextMiddleware");
const ModuleRegistry_1 = require("../../application/platform/ModuleRegistry");
const router = (0, express_1.Router)();
// Apply Tenant Context Middleware
router.use(tenantContextMiddleware_1.tenantContextMiddleware);
// Dynamically mount module routes from registry
const registry = ModuleRegistry_1.ModuleRegistry.getInstance();
const modules = registry.getAllModules();
for (const module of modules) {
    const moduleRouter = module.getRouter();
    router.use(`/${module.metadata.id}`, moduleRouter);
    console.log(`Mounted module: ${module.metadata.id} at /${module.metadata.id}`);
}
// Legacy routes (to be migrated to modules)
const system_rbac_routes_1 = __importDefault(require("../routes/system.rbac.routes"));
const company_moduleSettings_routes_1 = __importDefault(require("../routes/company.moduleSettings.routes"));
router.use('/rbac', system_rbac_routes_1.default);
router.use(company_moduleSettings_routes_1.default);
exports.default = router;
//# sourceMappingURL=tenant.router.js.map