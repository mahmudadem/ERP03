"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const UserCompaniesController_1 = require("../controllers/user/UserCompaniesController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/users/me/companies', UserCompaniesController_1.UserCompaniesController.listUserCompanies);
router.post('/users/me/switch-company', UserCompaniesController_1.UserCompaniesController.switchCompany);
router.get('/users/me/active-company', UserCompaniesController_1.UserCompaniesController.getActiveCompany);
exports.default = router;
//# sourceMappingURL=user.companies.routes.js.map