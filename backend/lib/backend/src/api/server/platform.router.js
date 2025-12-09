"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const super_admin_routes_1 = __importDefault(require("../routes/super-admin.routes"));
const super_admin_templates_routes_1 = __importDefault(require("../routes/super-admin.templates.routes"));
const super_admin_voucher_types_routes_1 = __importDefault(require("../routes/super-admin.voucher-types.routes"));
const system_permissions_routes_1 = __importDefault(require("../routes/system.permissions.routes"));
const system_roles_routes_1 = __importDefault(require("../routes/system.roles.routes"));
const system_moduleSettings_routes_1 = __importDefault(require("../routes/system.moduleSettings.routes"));
const system_routes_1 = __importDefault(require("../routes/system.routes"));
const router = (0, express_1.Router)();
router.use('/super-admin', super_admin_routes_1.default);
router.use('/super-admin/templates', super_admin_templates_routes_1.default);
router.use('/super-admin/voucher-types', super_admin_voucher_types_routes_1.default);
router.use(system_permissions_routes_1.default);
router.use(system_roles_routes_1.default);
router.use(system_moduleSettings_routes_1.default);
router.use('/system', system_routes_1.default);
exports.default = router;
//# sourceMappingURL=platform.router.js.map