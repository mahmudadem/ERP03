"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ModuleSettingsDefinitionsController_1 = require("../controllers/system/ModuleSettingsDefinitionsController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
router.get('/system/module-settings/definitions', ModuleSettingsDefinitionsController_1.ModuleSettingsDefinitionsController.list);
router.get('/system/module-settings/definitions/:moduleId', ModuleSettingsDefinitionsController_1.ModuleSettingsDefinitionsController.get);
router.post('/system/module-settings/definitions', ModuleSettingsDefinitionsController_1.ModuleSettingsDefinitionsController.create);
router.put('/system/module-settings/definitions/:moduleId', ModuleSettingsDefinitionsController_1.ModuleSettingsDefinitionsController.update);
router.delete('/system/module-settings/definitions/:moduleId', ModuleSettingsDefinitionsController_1.ModuleSettingsDefinitionsController.remove);
exports.default = router;
//# sourceMappingURL=system.moduleSettings.routes.js.map