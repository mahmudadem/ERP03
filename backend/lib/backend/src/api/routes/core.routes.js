"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CompanyController_1 = require("../controllers/core/CompanyController");
const CompanySettingsController_1 = require("../controllers/core/CompanySettingsController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Protected routes
router.use(authMiddleware_1.authMiddleware);
router.post('/companies/create', CompanyController_1.CompanyController.createCompany);
router.get('/companies/my', CompanyController_1.CompanyController.getUserCompanies);
// Settings
router.get('/company/settings', CompanySettingsController_1.CompanySettingsController.getSettings);
router.post('/company/settings', CompanySettingsController_1.CompanySettingsController.updateSettings);
exports.default = router;
//# sourceMappingURL=core.routes.js.map