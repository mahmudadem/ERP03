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
exports.FirestoreBankStatementRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const BankStatement_1 = require("../../../../domain/accounting/entities/BankStatement");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
const toTimestamp = (val) => {
    if (!val)
        return admin.firestore.FieldValue.serverTimestamp();
    const date = val instanceof Date ? val : new Date(val);
    return admin.firestore.Timestamp.fromDate(date);
};
class FirestoreBankStatementRepository {
    constructor(db) {
        this.db = db;
    }
    col(companyId) {
        return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('bankStatements');
    }
    async save(statement) {
        try {
            await this.col(statement.companyId).doc(statement.id).set({
                companyId: statement.companyId,
                accountId: statement.accountId,
                bankName: statement.bankName,
                statementDate: statement.statementDate,
                importedAt: toTimestamp(statement.importedAt),
                importedBy: statement.importedBy,
                lines: statement.lines
            });
            return statement;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to save bank statement', error);
        }
    }
    async findById(companyId, id) {
        var _a, _b;
        try {
            const doc = await this.col(companyId).doc(id).get();
            if (!doc.exists)
                return null;
            const data = doc.data();
            return new BankStatement_1.BankStatement(doc.id, data.companyId, data.accountId, data.bankName, data.statementDate, ((_b = (_a = data.importedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(), data.importedBy || '', data.lines || []);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to load bank statement', error);
        }
    }
    async list(companyId, accountId) {
        try {
            let q = this.col(companyId);
            if (accountId)
                q = q.where('accountId', '==', accountId);
            const snap = await q.orderBy('statementDate', 'desc').limit(50).get();
            return snap.docs.map((d) => {
                var _a, _b;
                const data = d.data();
                return new BankStatement_1.BankStatement(d.id, data.companyId, data.accountId, data.bankName, data.statementDate, ((_b = (_a = data.importedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(), data.importedBy || '', data.lines || []);
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list bank statements', error);
        }
    }
    async updateLineMatch(companyId, statementId, lineId, matchStatus, ledgerEntryId) {
        try {
            const doc = await this.col(companyId).doc(statementId).get();
            if (!doc.exists)
                throw new InfrastructureError_1.InfrastructureError('Bank statement not found', new Error('not found'));
            const data = doc.data();
            const lines = (data.lines || []).map((l) => l.id === lineId ? Object.assign(Object.assign({}, l), { matchStatus, matchedLedgerEntryId: ledgerEntryId || null }) : l);
            await doc.ref.set({ lines }, { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update bank statement line match', error);
        }
    }
}
exports.FirestoreBankStatementRepository = FirestoreBankStatementRepository;
//# sourceMappingURL=FirestoreBankStatementRepository.js.map