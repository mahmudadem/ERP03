"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const UserPreferencesController_1 = require("../controllers/core/UserPreferencesController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/user/preferences', UserPreferencesController_1.UserPreferencesController.getMyPreferences);
router.post('/user/preferences', UserPreferencesController_1.UserPreferencesController.upsertMyPreferences);
exports.default = router;
//# sourceMappingURL=user.preferences.routes.js.map