"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DesignerController_1 = require("../controllers/designer/DesignerController");
const VoucherTypeController_1 = require("../controllers/designer/VoucherTypeController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionsMiddleware_1 = require("../middlewares/permissionsMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
// Admin / Designer actions
router.post('/forms', (0, permissionsMiddleware_1.permissionsMiddleware)('designer.forms.create'), DesignerController_1.DesignerController.createForm);
router.post('/voucher-types', (0, permissionsMiddleware_1.permissionsMiddleware)('designer.vouchertypes.create'), DesignerController_1.DesignerController.createVoucherType);
// Consumption endpoints (Used by the frontend engine)
router.get('/voucher-types', (0, permissionsMiddleware_1.permissionsMiddleware)('designer.vouchertypes.view'), VoucherTypeController_1.VoucherTypeController.listVoucherTypes);
router.get('/voucher-types/:code', (0, permissionsMiddleware_1.permissionsMiddleware)('designer.vouchertypes.view'), VoucherTypeController_1.VoucherTypeController.getVoucherTypeByCode);
exports.default = router;
//# sourceMappingURL=designer.routes.js.map