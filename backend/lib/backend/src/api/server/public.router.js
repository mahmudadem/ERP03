"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("../routes/auth.routes"));
const company_wizard_routes_1 = __importDefault(require("../routes/company-wizard.routes"));
const impersonation_routes_1 = __importDefault(require("../routes/impersonation.routes"));
const user_companies_routes_1 = __importDefault(require("../routes/user.companies.routes"));
const core_routes_1 = __importDefault(require("../routes/core.routes"));
const onboarding_routes_1 = __importDefault(require("../routes/onboarding.routes"));
const company_modules_routes_1 = __importDefault(require("../routes/company-modules.routes"));
const system_metadata_routes_1 = __importDefault(require("../routes/system.metadata.routes"));
const router = (0, express_1.Router)();
router.use(auth_routes_1.default);
router.use('/onboarding', onboarding_routes_1.default);
router.use('/company-wizard', company_wizard_routes_1.default);
router.use('/impersonate', impersonation_routes_1.default);
router.use(user_companies_routes_1.default);
router.use('/core', core_routes_1.default);
router.use('/company-modules', company_modules_routes_1.default);
router.use('/system/metadata', system_metadata_routes_1.default);
exports.default = router;
//# sourceMappingURL=public.router.js.map