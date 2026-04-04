"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const SharedController_1 = require("../controllers/shared/SharedController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.post('/parties', SharedController_1.SharedController.createParty);
router.get('/parties', SharedController_1.SharedController.listParties);
router.get('/parties/:id', SharedController_1.SharedController.getParty);
router.put('/parties/:id', SharedController_1.SharedController.updateParty);
router.post('/tax-codes', SharedController_1.SharedController.createTaxCode);
router.get('/tax-codes', SharedController_1.SharedController.listTaxCodes);
router.get('/tax-codes/:id', SharedController_1.SharedController.getTaxCode);
router.put('/tax-codes/:id', SharedController_1.SharedController.updateTaxCode);
exports.default = router;
//# sourceMappingURL=shared.routes.js.map