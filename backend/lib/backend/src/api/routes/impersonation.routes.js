"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ImpersonationController_1 = require("../controllers/impersonation/ImpersonationController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
router.post('/start', ImpersonationController_1.ImpersonationController.startImpersonation);
router.post('/stop', ImpersonationController_1.ImpersonationController.stopImpersonation);
router.get('/status', ImpersonationController_1.ImpersonationController.getImpersonationStatus);
exports.default = router;
//# sourceMappingURL=impersonation.routes.js.map