"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * router.ts
 * Purpose: Aggregates all module routers into a single main router.
 */
const express_1 = require("express");
const core_routes_1 = __importDefault(require("../routes/core.routes"));
const system_routes_1 = __importDefault(require("../routes/system.routes"));
const accounting_routes_1 = __importDefault(require("../routes/accounting.routes"));
const inventory_routes_1 = __importDefault(require("../routes/inventory.routes"));
const hr_routes_1 = __importDefault(require("../routes/hr.routes"));
const pos_routes_1 = __importDefault(require("../routes/pos.routes"));
const designer_routes_1 = __importDefault(require("../routes/designer.routes"));
const system_rbac_routes_1 = __importDefault(require("../routes/system.rbac.routes"));
const super_admin_routes_1 = __importDefault(require("../routes/super-admin.routes"));
const super_admin_company_wizard_routes_1 = __importDefault(require("../routes/super-admin.company-wizard.routes"));
const impersonation_routes_1 = __importDefault(require("../routes/impersonation.routes"));
const user_companies_routes_1 = __importDefault(require("../routes/user.companies.routes"));
const system_moduleSettings_routes_1 = __importDefault(require("../routes/system.moduleSettings.routes"));
const company_moduleSettings_routes_1 = __importDefault(require("../routes/company.moduleSettings.routes"));
const system_permissions_routes_1 = __importDefault(require("../routes/system.permissions.routes"));
const system_roles_routes_1 = __importDefault(require("../routes/system.roles.routes"));
const auth_routes_1 = __importDefault(require("../routes/auth.routes"));
const router = (0, express_1.Router)();
// Health Check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Module Routes
// Auth first so it can't be shadowed and avoids any super-admin middleware ordering issues
router.use(auth_routes_1.default);
router.use('/core', core_routes_1.default);
router.use('/system', system_routes_1.default);
router.use('/rbac', system_rbac_routes_1.default);
router.use('/company-wizard', super_admin_company_wizard_routes_1.default);
router.use('/super-admin', super_admin_routes_1.default);
router.use('/impersonate', impersonation_routes_1.default);
router.use(user_companies_routes_1.default);
router.use(system_moduleSettings_routes_1.default);
router.use(company_moduleSettings_routes_1.default);
router.use(system_permissions_routes_1.default);
router.use(system_roles_routes_1.default);
router.use('/accounting', accounting_routes_1.default);
router.use('/inventory', inventory_routes_1.default);
router.use('/hr', hr_routes_1.default);
router.use('/pos', pos_routes_1.default);
router.use('/designer', designer_routes_1.default);
exports.default = router;
//# sourceMappingURL=router.js.map