"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SuperAdminController_1 = require("../controllers/super-admin/SuperAdminController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
router.get('/users', SuperAdminController_1.SuperAdminController.listAllUsers);
router.patch('/users/:userId/promote', SuperAdminController_1.SuperAdminController.promoteUser);
router.patch('/users/:userId/demote', SuperAdminController_1.SuperAdminController.demoteUser);
router.get('/companies', SuperAdminController_1.SuperAdminController.listAllCompanies);
router.get('/overview', SuperAdminController_1.SuperAdminController.getSystemOverview);
exports.default = router;
//# sourceMappingURL=super-admin.routes.js.map