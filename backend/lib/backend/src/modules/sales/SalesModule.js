"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesModule = void 0;
const sales_routes_1 = __importDefault(require("../../api/routes/sales.routes"));
class SalesModule {
    constructor() {
        this.metadata = {
            id: 'sales',
            name: 'Sales',
            version: '1.0.0',
            description: 'Sales settings and sales order management',
            requiredBundles: ['professional', 'enterprise'],
        };
        this.permissions = [
            'sales.view',
            'sales.settings.view',
            'sales.settings.manage',
            'sales.orders.view',
            'sales.orders.manage',
        ];
    }
    async initialize() {
        console.log('Initializing Sales Module...');
    }
    getRouter() {
        return sales_routes_1.default;
    }
    async shutdown() {
        console.log('Shutting down Sales Module...');
    }
}
exports.SalesModule = SalesModule;
//# sourceMappingURL=SalesModule.js.map