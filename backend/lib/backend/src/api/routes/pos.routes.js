"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PosController_1 = require("../controllers/pos/PosController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionsMiddleware_1 = require("../middlewares/permissionsMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.post('/shifts/open', (0, permissionsMiddleware_1.permissionsMiddleware)('pos.shift.open'), PosController_1.PosController.openShift);
router.post('/orders', (0, permissionsMiddleware_1.permissionsMiddleware)('pos.order.create'), PosController_1.PosController.createOrder);
exports.default = router;
//# sourceMappingURL=pos.routes.js.map