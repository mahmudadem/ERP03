"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseModule = void 0;
const purchases_routes_1 = __importDefault(require("../../api/routes/purchases.routes"));
class PurchaseModule {
    constructor() {
        this.metadata = {
            id: 'purchase',
            name: 'Purchase',
            version: '1.0.0',
            description: 'Purchase settings and purchase order management',
            requiredBundles: ['professional', 'enterprise'],
        };
        this.permissions = [
            'purchase.view',
            'purchase.settings.view',
            'purchase.settings.manage',
            'purchase.orders.view',
            'purchase.orders.manage',
        ];
    }
    async initialize() {
        console.log('Initializing Purchase Module...');
    }
    getRouter() {
        return purchases_routes_1.default;
    }
    async shutdown() {
        console.log('Shutting down Purchase Module...');
    }
}
exports.PurchaseModule = PurchaseModule;
//# sourceMappingURL=PurchaseModule.js.map