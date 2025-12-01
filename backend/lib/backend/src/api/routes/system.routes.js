"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SystemController_1 = require("../controllers/system/SystemController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.post('/roles', SystemController_1.SystemController.createRole);
exports.default = router;
//# sourceMappingURL=system.routes.js.map