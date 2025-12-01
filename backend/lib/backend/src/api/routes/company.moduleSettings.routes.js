"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionsMiddleware_1 = require("../middlewares/permissionsMiddleware");
const CompanyModuleSettingsController_1 = require("../controllers/company/CompanyModuleSettingsController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/companies/:companyId/module-settings/:moduleId', (0, permissionsMiddleware_1.permissionsMiddleware)('module.settings.edit'), CompanyModuleSettingsController_1.CompanyModuleSettingsController.getSettings);
router.post('/companies/:companyId/module-settings/:moduleId', (0, permissionsMiddleware_1.permissionsMiddleware)('module.settings.edit'), CompanyModuleSettingsController_1.CompanyModuleSettingsController.saveSettings);
exports.default = router;
//# sourceMappingURL=company.moduleSettings.routes.js.map