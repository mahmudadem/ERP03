"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const InventoryController_1 = require("../controllers/inventory/InventoryController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionsMiddleware_1 = require("../middlewares/permissionsMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.post('/items', (0, permissionsMiddleware_1.permissionsMiddleware)('inventory.items.create'), InventoryController_1.InventoryController.createItem);
router.post('/warehouses', (0, permissionsMiddleware_1.permissionsMiddleware)('inventory.warehouses.create'), InventoryController_1.InventoryController.createWarehouse);
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map