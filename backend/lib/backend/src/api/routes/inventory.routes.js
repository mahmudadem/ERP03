"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const InventoryController_1 = require("../controllers/inventory/InventoryController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const permissionGuard_1 = require("../middlewares/guards/permissionGuard");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.post('/items', (0, permissionGuard_1.permissionGuard)('inventory.items.create'), InventoryController_1.InventoryController.createItem);
router.post('/warehouses', (0, permissionGuard_1.permissionGuard)('inventory.warehouses.create'), InventoryController_1.InventoryController.createWarehouse);
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map