"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CompanyWizardController_1 = require("../controllers/super-admin/CompanyWizardController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/models', CompanyWizardController_1.CompanyWizardController.getModels);
router.get('/steps', CompanyWizardController_1.CompanyWizardController.getSteps);
router.post('/start', CompanyWizardController_1.CompanyWizardController.start);
router.get('/step', CompanyWizardController_1.CompanyWizardController.getStep);
router.post('/step', CompanyWizardController_1.CompanyWizardController.submitStep);
router.get('/options', CompanyWizardController_1.CompanyWizardController.getOptions);
router.post('/complete', CompanyWizardController_1.CompanyWizardController.complete);
exports.default = router;
//# sourceMappingURL=super-admin.company-wizard.routes.js.map