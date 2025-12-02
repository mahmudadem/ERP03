"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TemplatesController_1 = require("../controllers/super-admin/TemplatesController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
router.get('/wizard-templates', TemplatesController_1.TemplatesController.listWizardTemplates);
router.get('/coa-templates', TemplatesController_1.TemplatesController.listCoaTemplates);
router.get('/currencies', TemplatesController_1.TemplatesController.listCurrencies);
exports.default = router;
//# sourceMappingURL=super-admin.templates.routes.js.map