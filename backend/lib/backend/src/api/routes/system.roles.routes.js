"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const SystemRoleController_1 = require("../controllers/system/SystemRoleController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
router.get('/system/roles', SystemRoleController_1.SystemRoleController.list);
router.get('/system/roles/:roleId', SystemRoleController_1.SystemRoleController.get);
router.post('/system/roles', SystemRoleController_1.SystemRoleController.create);
router.put('/system/roles/:roleId', SystemRoleController_1.SystemRoleController.update);
exports.default = router;
//# sourceMappingURL=system.roles.routes.js.map