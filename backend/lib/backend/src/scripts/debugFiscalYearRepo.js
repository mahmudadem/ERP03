"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const bindRepositories_1 = require("../infrastructure/di/bindRepositories");
const FiscalYear_1 = require("../domain/accounting/entities/FiscalYear");
// Initialize Firebase if not already (it might be by diContainer)
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'erp-03' });
}
async function main() {
    console.log('Debugging Fiscal Year Repo...');
    const repo = bindRepositories_1.diContainer.fiscalYearRepository;
    // Create a dummy FiscalYear
    const fy = new FiscalYear_1.FiscalYear('DEBUG-FY', 'SYCO', 'Debug FY', '2027-01-01', '2027-12-31', FiscalYear_1.FiscalYearStatus.OPEN, [
        {
            id: '2027-01',
            name: 'Jan 2027',
            startDate: '2027-01-01',
            endDate: '2027-01-31',
            status: FiscalYear_1.PeriodStatus.OPEN,
            periodNo: 1,
            isSpecial: false
        }
    ], undefined, new Date(), 'tester');
    // Manually invoke logic similar to toPersistence
    const persistenceData = {
        companyId: fy.companyId,
        name: fy.name,
        startDate: fy.startDate,
        endDate: fy.endDate,
        status: fy.status,
        periods: fy.periods.map((p) => (Object.assign(Object.assign({}, p), { closedAt: p.closedAt ? firestore_1.Timestamp.fromDate(p.closedAt) : null, lockedAt: p.lockedAt ? firestore_1.Timestamp.fromDate(p.lockedAt) : null }))),
        closingVoucherId: fy.closingVoucherId || null,
        createdAt: fy.createdAt ? firestore_1.Timestamp.fromDate(fy.createdAt) : admin.firestore.FieldValue.serverTimestamp(),
        createdBy: fy.createdBy || null,
    };
    console.log('Persistence Data:', JSON.stringify(persistenceData, null, 2));
    try {
        await repo.save(fy);
        console.log('Save SUCCESS');
    }
    catch (err) {
        console.error('Save FAILED:', err);
    }
}
main().catch(console.error);
//# sourceMappingURL=debugFiscalYearRepo.js.map