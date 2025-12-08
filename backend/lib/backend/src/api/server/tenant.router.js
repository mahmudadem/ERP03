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
const authMiddleware_1 = require("../middlewares/authMiddleware");
const tenantContextMiddleware_1 = require("../middlewares/tenantContextMiddleware");
const ModuleRegistry_1 = require("../../application/platform/ModuleRegistry");
const companyModuleGuard_1 = require("../middlewares/guards/companyModuleGuard");
const ownerOrPermissionGuard_1 = require("../middlewares/guards/ownerOrPermissionGuard");
// Company Admin Routes
const company_admin_routes_1 = __importDefault(require("../routes/company-admin.routes"));
// Legacy routes (to be migrated to modules)
const system_rbac_routes_1 = __importDefault(require("../routes/system.rbac.routes"));
const company_moduleSettings_routes_1 = __importDefault(require("../routes/company.moduleSettings.routes"));
const router = (0, express_1.Router)();
// Apply Auth & Tenant Context Middleware
router.use(authMiddleware_1.authMiddleware);
router.use(tenantContextMiddleware_1.tenantContextMiddleware);
// Mount Company Admin Routes
// Owner bypass: If user.isOwner === true, skip permission check
router.use('/company-admin', (0, ownerOrPermissionGuard_1.ownerOrPermissionGuard)('system.company.manage'), company_admin_routes_1.default);
// Dynamically mount module routes from registry
const registry = ModuleRegistry_1.ModuleRegistry.getInstance();
const modules = registry.getAllModules();
for (const module of modules) {
    const moduleRouter = module.getRouter();
    router.use(`/${module.metadata.id}`, (0, companyModuleGuard_1.companyModuleGuard)(module.metadata.id), moduleRouter);
    console.log(`Mounted module: ${module.metadata.id} at /${module.metadata.id}`);
}
router.use('/rbac', system_rbac_routes_1.default);
router.use(company_moduleSettings_routes_1.default);
exports.default = router;
//# sourceMappingURL=tenant.router.js.map