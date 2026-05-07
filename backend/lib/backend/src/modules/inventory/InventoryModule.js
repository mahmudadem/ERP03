"use strict";
/**
 * InventoryModule.ts
 *
 * Inventory module implementation that registers with the platform.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryModule = void 0;
const inventory_routes_1 = __importDefault(require("../../api/routes/inventory.routes"));
class InventoryModule {
    constructor() {
        this.metadata = {
            id: 'inventory',
            name: 'Inventory',
            version: '1.0.0',
            description: 'Inventory management with items, warehouses, and stock movements',
            requiredBundles: ['professional', 'enterprise']
        };
        this.permissions = [
            'inventory.view',
            'inventory.settings.view',
            'inventory.settings.manage',
            'inventory.items.view',
            'inventory.items.manage',
            'inventory.categories.view',
            'inventory.categories.manage',
            'inventory.warehouses.view',
            'inventory.warehouses.manage',
            'inventory.uom.view',
            'inventory.uom.manage',
            'inventory.stock.view',
            'inventory.stock.adjust',
            'inventory.stockLevels.view',
            'inventory.movements.view',
            'inventory.movements.record',
            'inventory.valuation.view',
            'inventory.reconcile.run'
        ];
    }
    getManifest() {
        return {
            id: this.metadata.id,
            name: this.metadata.name,
            version: this.metadata.version,
            description: this.metadata.description,
            requiredPermissions: this.permissions,
        };
    }
    async initialize() {
        console.log('Initializing Inventory Module...');
    }
    getRouter() {
        return inventory_routes_1.default;
    }
    async shutdown() {
        console.log('Shutting down Inventory Module...');
    }
}
exports.InventoryModule = InventoryModule;
//# sourceMappingURL=InventoryModule.js.map