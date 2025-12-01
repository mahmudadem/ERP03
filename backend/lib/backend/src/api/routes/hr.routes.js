"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const HrController_1 = require("../controllers/hr/HrController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionsMiddleware_1 = require("../middlewares/permissionsMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.post('/employees', (0, permissionsMiddleware_1.permissionsMiddleware)('hr.employees.create'), HrController_1.HrController.registerEmployee);
router.post('/attendance', (0, permissionsMiddleware_1.permissionsMiddleware)('hr.attendance.record'), HrController_1.HrController.recordAttendance);
exports.default = router;
//# sourceMappingURL=hr.routes.js.map