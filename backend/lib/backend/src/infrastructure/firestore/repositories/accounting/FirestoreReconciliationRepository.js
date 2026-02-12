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
exports.FirestoreReconciliationRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const Reconciliation_1 = require("../../../../domain/accounting/entities/Reconciliation");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
const toTimestamp = (val) => {
    if (!val)
        return admin.firestore.FieldValue.serverTimestamp();
    const date = val instanceof Date ? val : new Date(val);
    return admin.firestore.Timestamp.fromDate(date);
};
class FirestoreReconciliationRepository {
    constructor(db) {
        this.db = db;
    }
    col(companyId) {
        return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('reconciliations');
    }
    async save(reconciliation) {
        try {
            await this.col(reconciliation.companyId).doc(reconciliation.id).set({
                companyId: reconciliation.companyId,
                accountId: reconciliation.accountId,
                bankStatementId: reconciliation.bankStatementId,
                periodEnd: reconciliation.periodEnd,
                bookBalance: reconciliation.bookBalance,
                bankBalance: reconciliation.bankBalance,
                adjustments: reconciliation.adjustments,
                status: reconciliation.status,
                completedAt: reconciliation.completedAt ? toTimestamp(reconciliation.completedAt) : null,
                completedBy: reconciliation.completedBy || null
            });
            return reconciliation;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to save reconciliation', error);
        }
    }
    async update(reconciliation) {
        await this.save(reconciliation);
    }
    async findLatestForAccount(companyId, accountId) {
        try {
            const snap = await this.col(companyId)
                .where('accountId', '==', accountId)
                .orderBy('periodEnd', 'desc')
                .limit(1)
                .get();
            if (snap.empty)
                return null;
            const d = snap.docs[0];
            return this.toDomain(d.id, d.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to load reconciliation', error);
        }
    }
    async list(companyId, accountId) {
        try {
            let q = this.col(companyId);
            if (accountId)
                q = q.where('accountId', '==', accountId);
            const snap = await q.orderBy('periodEnd', 'desc').limit(50).get();
            return snap.docs.map((d) => this.toDomain(d.id, d.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list reconciliations', error);
        }
    }
    toDomain(id, data) {
        var _a, _b;
        return new Reconciliation_1.Reconciliation(id, data.companyId, data.accountId, data.bankStatementId, data.periodEnd, data.bookBalance, data.bankBalance, data.adjustments || [], data.status || 'IN_PROGRESS', ((_b = (_a = data.completedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || undefined, data.completedBy || undefined);
    }
}
exports.FirestoreReconciliationRepository = FirestoreReconciliationRepository;
//# sourceMappingURL=FirestoreReconciliationRepository.js.map