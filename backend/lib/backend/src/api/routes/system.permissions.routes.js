"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const ModulePermissionsController_1 = require("../controllers/system/ModulePermissionsController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
router.get('/system/permissions/modules', ModulePermissionsController_1.ModulePermissionsController.listModules);
router.get('/system/permissions/:moduleId', ModulePermissionsController_1.ModulePermissionsController.getByModule);
router.post('/system/permissions/:moduleId', ModulePermissionsController_1.ModulePermissionsController.create);
router.put('/system/permissions/:moduleId', ModulePermissionsController_1.ModulePermissionsController.upsert);
router.delete('/system/permissions/:moduleId', ModulePermissionsController_1.ModulePermissionsController.remove);
exports.default = router;
//# sourceMappingURL=system.permissions.routes.js.map