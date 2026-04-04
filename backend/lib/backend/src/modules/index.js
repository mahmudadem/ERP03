"use strict";
/**
 * modules/index.ts
 *
 * Central module registration point.
 * All modules register themselves here on startup.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllModules = void 0;
const ModuleRegistry_1 = require("../application/platform/ModuleRegistry");
const AccountingModule_1 = require("./accounting/AccountingModule");
const InventoryModule_1 = require("./inventory/InventoryModule");
const PurchaseModule_1 = require("./purchase/PurchaseModule");
const SalesModule_1 = require("./sales/SalesModule");
function registerAllModules() {
    const registry = ModuleRegistry_1.ModuleRegistry.getInstance();
    // Register modules
    registry.register(new AccountingModule_1.AccountingModule());
    registry.register(new InventoryModule_1.InventoryModule());
    registry.register(new PurchaseModule_1.PurchaseModule());
    registry.register(new SalesModule_1.SalesModule());
    // Add more modules here as they are created
    console.log(`Registered ${registry.getAllModules().length} modules`);
}
exports.registerAllModules = registerAllModules;
//# sourceMappingURL=index.js.map