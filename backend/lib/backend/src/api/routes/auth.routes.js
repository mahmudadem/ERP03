"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const AuthPermissionsController_1 = require("../controllers/auth/AuthPermissionsController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/auth/me/permissions', AuthPermissionsController_1.AuthPermissionsController.getMyPermissions);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map