"use strict";
/**
 * AccountingModule.ts
 *
 * Accounting module implementation that registers with the platform.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingModule = void 0;
const accounting_routes_1 = __importDefault(require("../../api/routes/accounting.routes"));
class AccountingModule {
    constructor() {
        this.metadata = {
            id: 'accounting',
            name: 'Accounting',
            version: '1.0.0',
            description: 'Core accounting module with vouchers, accounts, and financial reports',
            requiredBundles: ['starter', 'professional', 'enterprise']
        };
        this.permissions = [
            'accounting.view',
            'accounting.accounts.view',
            'accounting.accounts.manage',
            'accounting.vouchers.view',
            'accounting.vouchers.create',
            'accounting.vouchers.approve',
            'accounting.reports.view'
        ];
    }
    async initialize() {
        console.log('Initializing Accounting Module...');
        // Any module-specific initialization logic here
    }
    getRouter() {
        return accounting_routes_1.default;
    }
    async shutdown() {
        console.log('Shutting down Accounting Module...');
    }
}
exports.AccountingModule = AccountingModule;
//# sourceMappingURL=AccountingModule.js.map