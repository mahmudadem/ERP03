"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SuperAdminVoucherTypeController_1 = require("../controllers/super-admin/SuperAdminVoucherTypeController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
router.get('/', SuperAdminVoucherTypeController_1.SuperAdminVoucherTypeController.listSystemTemplates);
router.post('/', SuperAdminVoucherTypeController_1.SuperAdminVoucherTypeController.createSystemTemplate);
router.put('/:id', SuperAdminVoucherTypeController_1.SuperAdminVoucherTypeController.updateSystemTemplate);
router.delete('/:id', SuperAdminVoucherTypeController_1.SuperAdminVoucherTypeController.deleteSystemTemplate);
exports.default = router;
//# sourceMappingURL=super-admin.voucher-types.routes.js.map